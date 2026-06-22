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
exports.AcuteInterventionService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const logger_service_1 = require("../common/logger/logger.service");
const metabolic_lstm_service_1 = require("./metabolic-lstm.service");
const serial_service_1 = require("../serial/serial.service");
const gas_control_service_1 = require("../gas-control/gas-control.service");
const gas_control_interface_1 = require("../common/interfaces/gas-control.interface");
const INTERVENTION = {
    CO2_CRITICAL_BAR: 0.025,
    CO2_WARNING_BAR: 0.018,
    COOLDOWN_MS: 30_000,
    MAX_ALERTS_PER_HOUR: 10,
    ANOMALY_TRIGGER: 2.8,
    NONLINEARITY_TRIGGER: 2.2,
    TIME_TO_BREACH_SEC: 120,
};
const BUS_COMMANDS = {
    SCRUBBER_BOOST: 0xC1,
    O2_PULSE_FLUSH: 0xC2,
    EMERGENCY_FLOOD: 0xC3,
    CREW_ALERT_BUZZER: 0xC4,
};
let AcuteInterventionService = class AcuteInterventionService extends events_1.EventEmitter {
    logger;
    lstm;
    serial;
    gasControl;
    alerts = [];
    lastAlertAt = 0;
    lastInterventionAt = 0;
    interventionActive = false;
    interventionTimer;
    alertTimestamps = [];
    constructor(logger, lstm, serial, gasControl) {
        super();
        this.logger = logger;
        this.lstm = lstm;
        this.serial = serial;
        this.gasControl = gasControl;
        this.logger.setContext('AcuteCo2-Intervention');
    }
    onModuleInit() {
        this.logger.log(`急性 CO2 中毒超前干预模块已就绪: 临界线=${INTERVENTION.CO2_CRITICAL_BAR}bar, ` +
            `预警线=${INTERVENTION.CO2_WARNING_BAR}bar, 冷却=${INTERVENTION.COOLDOWN_MS / 1000}s`);
    }
    onModuleDestroy() {
        if (this.interventionTimer) {
            clearTimeout(this.interventionTimer);
            this.interventionTimer = undefined;
        }
        this.removeAllListeners();
    }
    evaluate(prediction, gradient, vitalSigns, currentState) {
        const co2Critical = this.lstm.getCo2CriticalBar();
        const currentCo2Bar = currentState.partialPressureCO2 / 100;
        const timeToBreachSec = prediction.predictedCo2Bar5Min > currentCo2Bar
            ? Math.max(0, ((co2Critical - currentCo2Bar) /
                Math.max(0.00001, (prediction.predictedCo2Bar5Min - currentCo2Bar) / 300)) *
                1.0)
            : 9999;
        const shouldTrigger = (prediction.predictedCo2Bar5Min >= co2Critical &&
            prediction.confidence >= 0.7) ||
            (prediction.anomalyScore >= INTERVENTION.ANOMALY_TRIGGER &&
                prediction.nonlinearityIndex >= INTERVENTION.NONLINEARITY_TRIGGER &&
                prediction.predictedCo2Bar5Min >= INTERVENTION.CO2_WARNING_BAR) ||
            timeToBreachSec <= INTERVENTION.TIME_TO_BREACH_SEC;
        if (!shouldTrigger)
            return null;
        if (!this.canIssueAlert()) {
            this.logger.warn(`急性 CO2 中毒风险已触发但被限流 (冷却中: ${((this.lastAlertAt + INTERVENTION.COOLDOWN_MS - Date.now()) / 1000).toFixed(1)}s)`);
            return null;
        }
        const severity = prediction.predictedCo2Bar5Min >= co2Critical * 1.3 ? 'fatal'
            : prediction.predictedCo2Bar5Min >= co2Critical ? 'critical'
                : prediction.predictedCo2Bar5Min >= INTERVENTION.CO2_WARNING_BAR ? 'warning'
                    : 'info';
        const commands = this.selectInterventions(prediction, severity);
        const alert = {
            alertId: this.genAlertId(),
            timestamp: Date.now(),
            severity,
            title: severity === 'fatal'
                ? '⚠️  急性二氧化碳中毒 FATAL - 立即执行紧急干预'
                : severity === 'critical'
                    ? '🚨 急性二氧化碳中毒 CRITICAL - 强制启动生命维持'
                    : '⚠️  二氧化碳浓度异常升高 WARNING',
            message: `LSTM 预测 5 分钟 CO2 分压将达到 ${(prediction.predictedCo2Bar5Min * 1000).toFixed(1)} mbar ` +
                `(临界值 ${(co2Critical * 1000).toFixed(0)} mbar), ` +
                `非线性指数=${prediction.nonlinearityIndex.toFixed(2)}, ` +
                `距突破红线≈${timeToBreachSec.toFixed(0)}s. ` +
                `潜水员#${vitalSigns.diverId} 脉率=${vitalSigns.pulseBpm.toFixed(0)}bpm, ` +
                `SpO2=${vitalSigns.spo2Percent.toFixed(1)}%`,
            triggeringDiverId: vitalSigns.diverId,
            lstmPrediction: prediction,
            gradient,
            interventionCommands: commands.map((c) => c.name),
            co2CriticalBar: co2Critical,
            timeToBreachSec: +timeToBreachSec.toFixed(0),
            acknowledged: false,
        };
        this.alerts.unshift(alert);
        if (this.alerts.length > 100)
            this.alerts.length = 100;
        this.lastAlertAt = alert.timestamp;
        this.alertTimestamps.push(alert.timestamp);
        this.alertTimestamps = this.alertTimestamps.filter((t) => alert.timestamp - t < 3600_000);
        this.logger.error(`[${alert.severity.toUpperCase()}] ${alert.title}\n` +
            `  └─ 5min CO2: ${(prediction.predictedCo2Bar5Min * 1000).toFixed(1)} mbar, ` +
            `距突破: ${alert.timeToBreachSec}s, 置信: ${(prediction.confidence * 100).toFixed(0)}%`);
        this.executeInterventions(commands, alert);
        this.emit('alert', alert);
        return alert;
    }
    selectInterventions(prediction, severity) {
        const commands = [];
        commands.push({
            code: BUS_COMMANDS.SCRUBBER_BOOST,
            name: 'CO2_SCRUBBER_BOOST',
            description: '强制启动碱石灰吸收风扇阵列至满负荷 120%',
            payload: [0xFF, 0x78, 0x00, 0x78],
            priority: gas_control_interface_1.CommandPriority.CRITICAL,
        });
        const o2PulseMs = severity === 'fatal' ? 5000
            : severity === 'critical' ? 3000
                : 1500;
        commands.push({
            code: BUS_COMMANDS.O2_PULSE_FLUSH,
            name: 'O2_PURGE_PULSE',
            description: `脉冲冲洗纯氧 ${o2PulseMs}ms @ 12 L/min`,
            payload: [0x02, (o2PulseMs >> 8) & 0xFF, o2PulseMs & 0xFF, 0xC0],
            priority: gas_control_interface_1.CommandPriority.HIGH,
        });
        if (severity === 'fatal') {
            commands.push({
                code: BUS_COMMANDS.EMERGENCY_FLOOD,
                name: 'EMERGENCY_O2_FLOOD',
                description: '应急供氧溢流模式 10 秒',
                payload: [0x0A, 0x00, 0x00, 0xFF],
                priority: gas_control_interface_1.CommandPriority.CRITICAL,
            });
        }
        commands.push({
            code: BUS_COMMANDS.CREW_ALERT_BUZZER,
            name: 'CREW_ALERT',
            description: `舱内声光告警: 分级=${severity}`,
            payload: [severity === 'fatal' ? 0x03 : severity === 'critical' ? 0x02 : 0x01, 0x00, 0x00, 0x00],
            priority: gas_control_interface_1.CommandPriority.HIGH,
        });
        return commands;
    }
    async executeInterventions(commands, alert) {
        if (this.interventionActive) {
            this.logger.warn('干预流程已在执行中，本次指令叠加');
        }
        this.interventionActive = true;
        for (const cmd of commands) {
            this.logger.warn(`[总线指令 0x${cmd.code.toString(16).toUpperCase()}] ${cmd.description} ` +
                `(优先级=${cmd.priority})`);
            const buf = Buffer.from([
                0xEB, 0x00, cmd.code,
                ...cmd.payload,
                0x00, 0x00, 0x00,
                0x00, 0x00, 0x90,
            ]);
            await this.serial.sendCommand(buf);
        }
        try {
            await this.gasControl.issueCommand({
                valveId: gas_control_interface_1.ValveId.CO2_SCRUBBER_A,
                action: gas_control_interface_1.ValveAction.OPEN,
                pulseWidthMs: 15_000,
                priority: gas_control_interface_1.CommandPriority.CRITICAL,
            });
            await this.gasControl.issueCommand({
                valveId: gas_control_interface_1.ValveId.CO2_SCRUBBER_B,
                action: gas_control_interface_1.ValveAction.OPEN,
                pulseWidthMs: 15_000,
                priority: gas_control_interface_1.CommandPriority.CRITICAL,
            });
            await this.gasControl.issueCommand({
                valveId: gas_control_interface_1.ValveId.O2_SUPPLY_PRIMARY,
                action: gas_control_interface_1.ValveAction.PULSE,
                pulseWidthMs: alert.severity === 'fatal' ? 5000 : 3000,
                priority: gas_control_interface_1.CommandPriority.HIGH,
            });
            if (alert.severity === 'fatal') {
                await this.gasControl.issueCommand({
                    valveId: gas_control_interface_1.ValveId.EMERGENCY_O2,
                    action: gas_control_interface_1.ValveAction.OPEN,
                    pulseWidthMs: 10_000,
                    priority: gas_control_interface_1.CommandPriority.CRITICAL,
                });
            }
        }
        catch (err) {
            this.logger.error(`干预指令下发阀门失败: ${err.message}`);
        }
        if (this.interventionTimer)
            clearTimeout(this.interventionTimer);
        this.interventionTimer = setTimeout(() => {
            this.interventionActive = false;
            this.logger.log('急性干预流程结束，恢复常规配气策略');
        }, 20_000);
        this.lastInterventionAt = Date.now();
    }
    canIssueAlert() {
        const now = Date.now();
        if (now - this.lastAlertAt < INTERVENTION.COOLDOWN_MS)
            return false;
        const recent = this.alertTimestamps.filter((t) => now - t < 3600_000);
        return recent.length < INTERVENTION.MAX_ALERTS_PER_HOUR;
    }
    genAlertId() {
        const ts = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 6);
        return `CO2-ALERT-${ts}-${rand}`;
    }
    getRecentAlerts(limit = 20) {
        return this.alerts.slice(0, limit);
    }
    isInterventionActive() {
        return this.interventionActive;
    }
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find((a) => a.alertId === alertId);
        if (alert) {
            alert.acknowledged = true;
            this.logger.log(`告警已确认: ${alertId}`);
            return true;
        }
        return false;
    }
    reset() {
        this.alerts.length = 0;
        this.alertTimestamps.length = 0;
        this.lastAlertAt = 0;
        this.lastInterventionAt = 0;
        this.interventionActive = false;
        if (this.interventionTimer) {
            clearTimeout(this.interventionTimer);
            this.interventionTimer = undefined;
        }
        this.logger.warn('急性干预模块已重置');
    }
};
exports.AcuteInterventionService = AcuteInterventionService;
exports.AcuteInterventionService = AcuteInterventionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        metabolic_lstm_service_1.MetabolicLstmService,
        serial_service_1.SerialService,
        gas_control_service_1.GasControlService])
], AcuteInterventionService);
//# sourceMappingURL=acute-intervention.service.js.map