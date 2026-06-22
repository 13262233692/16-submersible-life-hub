import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import {
  ValveControlCommand,
  ValveStatusReport,
  MasterControlReport,
  ValveId,
  ValveAction,
  CommandPriority,
  ValveFaultCode,
  PIDControllerParams,
  SolenoidCalibrationData,
} from '../common/interfaces/gas-control.interface';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { PIDControllerService } from './pid-controller.service';
import { BIOCHEMICAL_CONSTANTS } from '../common/interfaces/biochemical.interface';
import { MasterControlReporter } from './master-control-reporter.service';

@Injectable()
export class GasControlService implements OnModuleInit, OnModuleDestroy {
  private controlLoop?: NodeJS.Timeout;
  private valveStates: Map<ValveId, ValveStatusReport> = new Map();
  private valveCalibrations: Map<ValveId, SolenoidCalibrationData> = new Map();
  private o2Pid: PIDControllerService;
  private co2Pid: PIDControllerService;
  private pressurePid: PIDControllerService;
  private pendingCommands: Map<string, NodeJS.Timeout> = new Map();
  private commandCounter: number = 0;
  private manualOverride: boolean = false;
  private lastControlCycle: number = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly engine: BiochemicalEngineService,
    private readonly reporter: MasterControlReporter,
  ) {
    this.logger.setContext('GasControl');

    const o2Params: PIDControllerParams = {
      kp: 180,
      ki: 12,
      kd: 25,
      setpoint: BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION * 100,
      outputMin: 0,
      outputMax: 5000,
      integralMax: 2000,
    };
    this.o2Pid = new PIDControllerService(o2Params);

    const co2Params: PIDControllerParams = {
      kp: 0.02,
      ki: 0.004,
      kd: 0.008,
      setpoint: 800,
      outputMin: 0,
      outputMax: 10000,
      integralMax: 3000,
    };
    this.co2Pid = new PIDControllerService(co2Params);

    const pressureParams: PIDControllerParams = {
      kp: 40,
      ki: 3,
      kd: 8,
      setpoint: BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA,
      outputMin: 0,
      outputMax: 3000,
      integralMax: 1500,
    };
    this.pressurePid = new PIDControllerService(pressureParams);

    this.initializeValves();
    this.initializeCalibrations();
  }

  onModuleInit() {
    this.controlLoop = setInterval(() => this.controlTick(), 200);
    this.logger.log('主动配气控制模块已启动 - PID控制循环: 5Hz');
  }

  onModuleDestroy() {
    if (this.controlLoop) clearInterval(this.controlLoop);
    for (const timer of this.pendingCommands.values()) clearTimeout(timer);
  }

  private initializeValves() {
    const valves = Object.values(ValveId);
    for (const v of valves) {
      this.valveStates.set(v, {
        reportId: this.genId('RPT'),
        timestamp: Date.now(),
        valveId: v,
        currentState: 'closed',
        totalOpenDurationMs: 0,
        cycleCount: 0,
        faultCode: ValveFaultCode.NONE,
      });
    }
  }

  private initializeCalibrations() {
    this.valveCalibrations.set(ValveId.O2_SUPPLY_PRIMARY, {
      valveId: ValveId.O2_SUPPLY_PRIMARY,
      minPulseWidthMs: 25,
      maxPulseWidthMs: 4000,
      flowRateLitersPerMs: 0.00018,
      responseTimeMs: 8,
      kFactor: 1.003,
    });
    this.valveCalibrations.set(ValveId.CO2_SCRUBBER_A, {
      valveId: ValveId.CO2_SCRUBBER_A,
      minPulseWidthMs: 30,
      maxPulseWidthMs: 8000,
      flowRateLitersPerMs: 0.00009,
      responseTimeMs: 12,
      kFactor: 0.997,
    });
    this.valveCalibrations.set(ValveId.N2_BALLAST, {
      valveId: ValveId.N2_BALLAST,
      minPulseWidthMs: 40,
      maxPulseWidthMs: 6000,
      flowRateLitersPerMs: 0.00025,
      responseTimeMs: 15,
      kFactor: 1.001,
    });
  }

  private controlTick() {
    if (this.manualOverride) return;
    const state = this.engine.getCurrentState();
    if (!state) return;

    const now = Date.now();
    const dt = this.lastControlCycle > 0 ? Math.min(2, (now - this.lastControlCycle) / 1000) : 0.2;
    this.lastControlCycle = now;

    const o2Percent = state.oxygenFraction * 100;
    const o2Output = this.o2Pid.update(BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION * 100, o2Percent, dt);
    const co2PPM = (state.partialPressureCO2 / state.absolutePressure) * 1_000_000;
    const co2Output = this.co2Pid.update(800, co2PPM, dt);
    const pressureOutput = this.pressurePid.update(
      BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA,
      state.absolutePressure,
      dt,
    );

    if (o2Output > 30 && state.safetyIndicators.o2Status !== 'fatal') {
      const pulseMs = this.calculatePrecisePulseWidth(
        ValveId.O2_SUPPLY_PRIMARY,
        (BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION - state.oxygenFraction) * state.absolutePressure * 10,
      );
      if (pulseMs > 10) {
        void this.issueCommand({
          valveId: ValveId.O2_SUPPLY_PRIMARY,
          action: ValveAction.PULSE,
          pulseWidthMs: pulseMs,
          targetPressureDeltaKPa: +((o2Output / 1000) * 0.1).toFixed(4),
        });
      }
    }

    if (co2Output > 50 && state.safetyIndicators.co2Status !== 'normal') {
      const scrubberPulse = Math.min(4000, Math.max(50, co2Output * 0.6));
      void this.issueCommand({
        valveId: ValveId.CO2_SCRUBBER_A,
        action: ValveAction.PULSE,
        pulseWidthMs: Math.round(scrubberPulse),
        targetPressureDeltaKPa: +((co2PPM - 800) * 1e-4).toFixed(5),
      });
    }

    if (pressureOutput > 80) {
      void this.issueCommand({
        valveId: ValveId.N2_BALLAST,
        action: ValveAction.PULSE,
        pulseWidthMs: Math.min(2000, Math.round(pressureOutput * 0.5)),
        targetPressureDeltaKPa: +(pressureOutput / 100).toFixed(3),
      });
    }

    void pressureOutput;
    void this.reporter.generateReport(state, this.getAllValveStatus());
  }

  calculatePrecisePulseWidth(valveId: ValveId, deltaO2KPa: number): number {
    const cal = this.valveCalibrations.get(valveId);
    if (!cal) return 0;

    const cabinVolLiters = BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS;
    const totalKPa = BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA;
    const requiredLiters = (deltaO2KPa / totalKPa) * cabinVolLiters;
    const rawPulseMs = requiredLiters / Math.max(1e-9, cal.flowRateLitersPerMs);
    const correctedPulse = rawPulseMs * cal.kFactor;

    return Math.round(
      Math.max(cal.minPulseWidthMs, Math.min(cal.maxPulseWidthMs, correctedPulse + cal.responseTimeMs)),
    );
  }

  async issueCommand(params: {
    valveId: ValveId;
    action: ValveAction;
    pulseWidthMs?: number;
    targetPressureDeltaKPa?: number;
    priority?: CommandPriority;
  }): Promise<ValveControlCommand> {
    const command: ValveControlCommand = {
      commandId: this.genId('CMD'),
      timestamp: Date.now(),
      valveId: params.valveId,
      action: params.action,
      pulseWidthMs: params.pulseWidthMs ?? 0,
      targetPressureDeltaKPa: params.targetPressureDeltaKPa ?? 0,
      priority: params.priority ?? CommandPriority.NORMAL,
      authorizer: 'automatic',
      expectedCompletionTime: Date.now() + (params.pulseWidthMs ?? 0) + 20,
    };
    this.commandCounter++;

    this.logger.debug(
      `阀门指令 ${command.commandId}: ${params.valveId} ${params.action} ` +
      `${params.pulseWidthMs ?? ''}ms ΔP=${params.targetPressureDeltaKPa ?? 0}kPa`,
    );

    this.executeCommand(command);
    return command;
  }

  private executeCommand(cmd: ValveControlCommand) {
    const status = this.valveStates.get(cmd.valveId)!;
    const cal = this.valveCalibrations.get(cmd.valveId);

    if (status.faultCode !== ValveFaultCode.NONE) {
      this.logger.warn(`阀门 ${cmd.valveId} 存在故障码 ${status.faultCode}，指令已标记`);
    }

    switch (cmd.action) {
      case ValveAction.PULSE: {
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
      case ValveAction.OPEN:
        status.currentState = 'open';
        status.cycleCount++;
        status.timestamp = Date.now();
        break;
      case ValveAction.CLOSE:
        status.currentState = 'closed';
        status.timestamp = Date.now();
        break;
      case ValveAction.CALIBRATE:
        status.faultCode = ValveFaultCode.NONE;
        status.timestamp = Date.now();
        break;
    }
  }

  getValveStatus(valveId: ValveId): ValveStatusReport | null {
    return this.valveStates.get(valveId) || null;
  }

  getAllValveStatus(): Record<string, ValveStatusReport> {
    const result: Record<string, ValveStatusReport> = {};
    for (const [k, v] of this.valveStates) result[k] = { ...v };
    return result;
  }

  setManualOverride(enabled: boolean) {
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

  getLatestMasterReport(): MasterControlReport | null {
    return this.reporter.getLatestReport();
  }

  private genId(prefix: string): string {
    const hex = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    return `${prefix}-${Date.now().toString(36)}-${hex}`;
  }
}
