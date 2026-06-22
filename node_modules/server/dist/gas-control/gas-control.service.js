"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasControlService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const logger_service_1 = require("../common/logger/logger.service");
const gas_control_interface_1 = require("../common/interfaces/gas-control.interface");
const biochemical_engine_service_1 = require("../biochemical/biochemical-engine.service");
const pid_controller_service_1 = require("./pid-controller.service");
const biochemical_interface_1 = require("../common/interfaces/biochemical.interface");
const master_control_reporter_service_1 = require("./master-control-reporter.service");
let GasControlService = class GasControlService {
    logger;
    moduleRef;
    reporter;
    controlLoop;
    valveStates = new Map();
    valveCalibrations = new Map();
    o2Pid;
    co2Pid;
    pressurePid;
    pendingCommands = new Map();
    commandCounter = 0;
    manualOverride = false;
    lastControlCycle = 0;
    _engine;
    constructor(logger, moduleRef, reporter) {
        this.logger = logger;
        this.moduleRef = moduleRef;
        this.reporter = reporter;
        this.logger.setContext('GasControl');
        const o2Params = {
            kp: 180,
            ki: 12,
            kd: 25,
            setpoint: biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION * 100,
            outputMin: 0,
            outputMax: 5000,
            integralMax: 2000,
        };
        this.o2Pid = new pid_controller_service_1.PIDControllerService(o2Params);
        const co2Params = {
            kp: 0.02,
            ki: 0.004,
            kd: 0.008,
            setpoint: 800,
            outputMin: 0,
            outputMax: 10000,
            integralMax: 3000,
        };
        this.co2Pid = new pid_controller_service_1.PIDControllerService(co2Params);
        const pressureParams = {
            kp: 40,
            ki: 3,
            kd: 8,
            setpoint: biochemical_interface_1.BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA,
            outputMin: 0,
            outputMax: 3000,
            integralMax: 1500,
        };
        this.pressurePid = new pid_controller_service_1.PIDControllerService(pressureParams);
        this.initializeValves();
        this.initializeCalibrations();
    }
    get engine() {
        if (!this._engine) {
            this._engine = this.moduleRef.get(biochemical_engine_service_1.BiochemicalEngineService, { strict: false });
        }
        return this._engine;
    }
    onModuleInit() {
        this.controlLoop = setInterval(() => this.controlTick(), 200);
        this.logger.log('主动配气控制模块已启动 - PID控制循环: 5Hz');
    }
    onModuleDestroy() {
        if (this.controlLoop)
            clearInterval(this.controlLoop);
        for (const timer of this.pendingCommands.values())
            clearTimeout(timer);
    }
    initializeValves() {
        const valves = Object.values(gas_control_interface_1.ValveId);
        for (const v of valves) {
            this.valveStates.set(v, {
                reportId: this.genId('RPT'),
                timestamp: Date.now(),
                valveId: v,
                currentState: 'closed',
                totalOpenDurationMs: 0,
                cycleCount: 0,
                faultCode: gas_control_interface_1.ValveFaultCode.NONE,
            });
        }
    }
    initializeCalibrations() {
        this.valveCalibrations.set(gas_control_interface_1.ValveId.O2_SUPPLY_PRIMARY, {
            valveId: gas_control_interface_1.ValveId.O2_SUPPLY_PRIMARY,
            minPulseWidthMs: 25,
            maxPulseWidthMs: 4000,
            flowRateLitersPerMs: 0.00018,
            responseTimeMs: 8,
            kFactor: 1.003,
        });
        this.valveCalibrations.set(gas_control_interface_1.ValveId.CO2_SCRUBBER_A, {
            valveId: gas_control_interface_1.ValveId.CO2_SCRUBBER_A,
            minPulseWidthMs: 30,
            maxPulseWidthMs: 8000,
            flowRateLitersPerMs: 0.00009,
            responseTimeMs: 12,
            kFactor: 0.997,
        });
        this.valveCalibrations.set(gas_control_interface_1.ValveId.N2_BALLAST, {
            valveId: gas_control_interface_1.ValveId.N2_BALLAST,
            minPulseWidthMs: 40,
            maxPulseWidthMs: 6000,
            flowRateLitersPerMs: 0.00025,
            responseTimeMs: 15,
            kFactor: 1.001,
        });
    }
    controlTick() {
        if (this.manualOverride)
            return;
        const state = this.engine.getCurrentState();
        if (!state)
            return;
        const now = Date.now();
        const dt = this.lastControlCycle > 0 ? Math.min(2, (now - this.lastControlCycle) / 1000) : 0.2;
        this.lastControlCycle = now;
        const o2Percent = state.oxygenFraction * 100;
        const o2Output = this.o2Pid.update(biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION * 100, o2Percent, dt);
        const co2PPM = (state.partialPressureCO2 / state.absolutePressure) * 1_000_000;
        const co2Output = this.co2Pid.update(800, co2PPM, dt);
        const pressureOutput = this.pressurePid.update(biochemical_interface_1.BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA, state.absolutePressure, dt);
        if (o2Output > 30 && state.safetyIndicators.o2Status !== 'fatal') {
            const pulseMs = this.calculatePrecisePulseWidth(gas_control_interface_1.ValveId.O2_SUPPLY_PRIMARY, (biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION - state.oxygenFraction) * state.absolutePressure * 10);
            if (pulseMs > 10) {
                void this.issueCommand({
                    valveId: gas_control_interface_1.ValveId.O2_SUPPLY_PRIMARY,
                    action: gas_control_interface_1.ValveAction.PULSE,
                    pulseWidthMs: pulseMs,
                    targetPressureDeltaKPa: +((o2Output / 1000) * 0.1).toFixed(4),
                });
            }
        }
        if (co2Output > 50 && state.safetyIndicators.co2Status !== 'normal') {
            const scrubberPulse = Math.min(4000, Math.max(50, co2Output * 0.6));
            void this.issueCommand({
                valveId: gas_control_interface_1.ValveId.CO2_SCRUBBER_A,
                action: gas_control_interface_1.ValveAction.PULSE,
                pulseWidthMs: Math.round(scrubberPulse),
                targetPressureDeltaKPa: +((co2PPM - 800) * 1e-4).toFixed(5),
            });
        }
        if (pressureOutput > 80) {
            void this.issueCommand({
                valveId: gas_control_interface_1.ValveId.N2_BALLAST,
                action: gas_control_interface_1.ValveAction.PULSE,
                pulseWidthMs: Math.min(2000, Math.round(pressureOutput * 0.5)),
                targetPressureDeltaKPa: +(pressureOutput / 100).toFixed(3),
            });
        }
        void pressureOutput;
        void this.reporter.generateReport(state, this.getAllValveStatus());
    }
    calculatePrecisePulseWidth(valveId, deltaO2KPa) {
        const cal = this.valveCalibrations.get(valveId);
        if (!cal)
            return 0;
        const cabinVolLiters = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS;
        const totalKPa = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA;
        const requiredLiters = (deltaO2KPa / totalKPa) * cabinVolLiters;
        const rawPulseMs = requiredLiters / Math.max(1e-9, cal.flowRateLitersPerMs);
        const correctedPulse = rawPulseMs * cal.kFactor;
        return Math.round(Math.max(cal.minPulseWidthMs, Math.min(cal.maxPulseWidthMs, correctedPulse + cal.responseTimeMs)));
    }
    async issueCommand(params) {
        const command = {
            commandId: this.genId('CMD'),
            timestamp: Date.now(),
            valveId: params.valveId,
            action: params.action,
            pulseWidthMs: params.pulseWidthMs ?? 0,
            targetPressureDeltaKPa: params.targetPressureDeltaKPa ?? 0,
            priority: params.priority ?? gas_control_interface_1.CommandPriority.NORMAL,
            authorizer: 'automatic',
            expectedCompletionTime: Date.now() + (params.pulseWidthMs ?? 0) + 20,
        };
        this.commandCounter++;
        this.logger.debug(`阀门指令 ${command.commandId}: ${params.valveId} ${params.action} ` +
            `${params.pulseWidthMs ?? ''}ms ΔP=${params.targetPressureDeltaKPa ?? 0}kPa`);
        this.executeCommand(command);
        return command;
    }
    executeCommand(cmd) {
        const status = this.valveStates.get(cmd.valveId);
        const cal = this.valveCalibrations.get(cmd.valveId);
        if (status.faultCode !== gas_control_interface_1.ValveFaultCode.NONE) {
            this.logger.warn(`阀门 ${cmd.valveId} 存在故障码 ${status.faultCode}，指令已标记`);
        }
        switch (cmd.action) {
            case gas_control_interface_1.ValveAction.PULSE: {
                status.currentState = 'transitioning';
                status.lastCommandId = cmd.commandId;
                status.cycleCount++;
                const openTimer = setTimeout(() => {
                    status.currentState = 'open';
                    status.timestamp = Date.now();
                }, cal?.responseTimeMs ?? 10);
                const closeTimer = setTimeout(() => {
                    clearTimeout(openTimer);
                    status.currentState = 'closed';
                    status.totalOpenDurationMs += cmd.pulseWidthMs;
                    status.timestamp = Date.now();
                    this.pendingCommands.delete(cmd.commandId);
                }, cmd.pulseWidthMs + (cal?.responseTimeMs ?? 10));
                this.pendingCommands.set(cmd.commandId, closeTimer);
                break;
            }
            case gas_control_interface_1.ValveAction.OPEN:
                status.currentState = 'open';
                status.cycleCount++;
                status.timestamp = Date.now();
                break;
            case gas_control_interface_1.ValveAction.CLOSE:
                status.currentState = 'closed';
                status.timestamp = Date.now();
                break;
            case gas_control_interface_1.ValveAction.CALIBRATE:
                status.faultCode = gas_control_interface_1.ValveFaultCode.NONE;
                status.timestamp = Date.now();
                break;
        }
    }
    getValveStatus(valveId) {
        return this.valveStates.get(valveId) || null;
    }
    getAllValveStatus() {
        const result = {};
        for (const [k, v] of this.valveStates)
            result[k] = { ...v };
        return result;
    }
    setManualOverride(enabled) {
        this.manualOverride = enabled;
        this.logger.warn(`手动${enabled ? '启用' : '解除'}超控 - 自动控制${enabled ? '已挂起' : '恢复运行'}`);
    }
    getPIDStates() {
        return {
            o2: this.o2Pid.getState(),
            co2: this.co2Pid.getState(),
            pressure: this.pressurePid.getState(),
            manualOverride: this.manualOverride,
            commandCounter: this.commandCounter,
        };
    }
    getLatestMasterReport() {
        return this.reporter.getLatestReport();
    }
    genId(prefix) {
        const hex = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
        return `${prefix}-${Date.now().toString(36)}-${hex}`;
    }
};
exports.GasControlService = GasControlService;
exports.GasControlService = GasControlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        core_1.ModuleRef,
        master_control_reporter_service_1.MasterControlReporter])
], GasControlService);
//# sourceMappingURL=gas-control.service.js.map