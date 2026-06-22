import { LoggerService } from '../common/logger/logger.service';
export interface KalmanConfig {
    processNoiseQ: number;
    measurementNoiseR: number;
    estimationErrorP: number;
    initialValue: number;
    adaptiveSensitivity: number;
}
export declare class KalmanFilterService {
    private readonly logger;
    private x;
    private p;
    private k;
    private readonly q;
    private readonly r;
    private readonly config;
    private innovationBuffer;
    private lastMeasurement?;
    private spikeDetectionCount;
    private outlierRejectedCount;
    constructor(configKey: string, logger: LoggerService);
    filter(measurement: number, timestamp?: number): {
        filtered: number;
        innovation: number;
        kalmanGain: number;
        errorCovariance: number;
        isSpike: boolean;
        adaptiveFactor: number;
    };
    private adaptiveProcessFactor;
    private lastMeasurementTimestamp?;
    private computeInnovationStats;
    getEstimate(): number;
    getErrorCovariance(): number;
    getStats(): {
        spikesRejected: number;
        totalMeasurements: number;
        currentX: number;
        currentP: number;
    };
    reset(value?: number): void;
}
