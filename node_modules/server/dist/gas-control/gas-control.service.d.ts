import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LoggerService } from '../common/logger/logger.service';
import { ValveControlCommand, ValveStatusReport, MasterControlReport, ValveId, ValveAction, CommandPriority } from '../common/interfaces/gas-control.interface';
import { MasterControlReporter } from './master-control-reporter.service';
export declare class GasControlService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly moduleRef;
    private readonly reporter;
    private controlLoop?;
    private valveStates;
    private valveCalibrations;
    private o2Pid;
    private co2Pid;
    private pressurePid;
    private pendingCommands;
    private commandCounter;
    private manualOverride;
    private lastControlCycle;
    private _engine?;
    constructor(logger: LoggerService, moduleRef: ModuleRef, reporter: MasterControlReporter);
    private get engine();
    onModuleInit(): void;
    onModuleDestroy(): void;
    private initializeValves;
    private initializeCalibrations;
    private controlTick;
    calculatePrecisePulseWidth(valveId: ValveId, deltaO2KPa: number): number;
    issueCommand(params: {
        valveId: ValveId;
        action: ValveAction;
        pulseWidthMs?: number;
        targetPressureDeltaKPa?: number;
        priority?: CommandPriority;
    }): Promise<ValveControlCommand>;
    private executeCommand;
    getValveStatus(valveId: ValveId): ValveStatusReport | null;
    getAllValveStatus(): Record<string, ValveStatusReport>;
    setManualOverride(enabled: boolean): void;
    getPIDStates(): {
        o2: {
            integral: number;
            previousError: number;
            lastOutput: number;
            params: {
                kp: number;
                ki: number;
                kd: number;
                setpoint: number;
                outputMin: number;
                outputMax: number;
                integralMax: number;
            };
        };
        co2: {
            integral: number;
            previousError: number;
            lastOutput: number;
            params: {
                kp: number;
                ki: number;
                kd: number;
                setpoint: number;
                outputMin: number;
                outputMax: number;
                integralMax: number;
            };
        };
        pressure: {
            integral: number;
            previousError: number;
            lastOutput: number;
            params: {
                kp: number;
                ki: number;
                kd: number;
                setpoint: number;
                outputMin: number;
                outputMax: number;
                integralMax: number;
            };
        };
        manualOverride: boolean;
        commandCounter: number;
    };
    getLatestMasterReport(): MasterControlReport | null;
    private genId;
}
