import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { AcuteCo2Alert, LSTMPrediction, MetabolicGradient, VitalSignsSample } from '../common/interfaces/auricular.interface';
import { BiochemicalState } from '../common/interfaces/biochemical.interface';
import { MetabolicLstmService } from './metabolic-lstm.service';
import { SerialService } from '../serial/serial.service';
import { GasControlService } from '../gas-control/gas-control.service';
declare const AcuteInterventionService_base: new () => {
    on(event: "alert", listener: (a: AcuteCo2Alert) => void): unknown;
    off(event: "alert", listener: (a: AcuteCo2Alert) => void): unknown;
    emit(event: "alert", alert: AcuteCo2Alert): boolean;
};
export declare class AcuteInterventionService extends AcuteInterventionService_base implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly lstm;
    private readonly serial;
    private readonly gasControl;
    private alerts;
    private lastAlertAt;
    private lastInterventionAt;
    private interventionActive;
    private interventionTimer?;
    private alertTimestamps;
    constructor(logger: LoggerService, lstm: MetabolicLstmService, serial: SerialService, gasControl: GasControlService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    evaluate(prediction: LSTMPrediction, gradient: MetabolicGradient, vitalSigns: VitalSignsSample, currentState: BiochemicalState): AcuteCo2Alert | null;
    private selectInterventions;
    private executeInterventions;
    private canIssueAlert;
    private genAlertId;
    getRecentAlerts(limit?: number): AcuteCo2Alert[];
    isInterventionActive(): boolean;
    acknowledgeAlert(alertId: string): boolean;
    reset(): void;
}
export {};
