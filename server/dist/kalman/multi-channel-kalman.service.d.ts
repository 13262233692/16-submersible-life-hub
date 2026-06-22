import { OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { SensorType, DecodedSensorData } from '../common/interfaces/sensor.interface';
export interface FilteredSensorReading {
    timestamp: number;
    sensorType: SensorType;
    rawValue: number;
    filteredValue: number;
    unit: string;
    innovation: number;
    kalmanGain: number;
    isSpikeRejected: boolean;
    adaptiveFactor: number;
}
export declare class MultiChannelKalmanFilter implements OnModuleInit {
    private readonly logger;
    private filterMap;
    constructor(logger: LoggerService);
    onModuleInit(): void;
    apply(sensor: DecodedSensorData): FilteredSensorReading | null;
    getChannelState(sensorType: SensorType): {
        spikesRejected: number;
        totalMeasurements: number;
        currentX: number;
        currentP: number;
    } | undefined;
    getAllChannelStates(): Record<string, unknown>;
    resetChannel(sensorType: SensorType, value?: number): void;
}
