import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { SensorType } from '../common/interfaces/sensor.interface';
export declare class SensorController {
    private readonly engine;
    constructor(engine: BiochemicalEngineService);
    getAllKalmanChannels(): {
        timestamp: number;
        channels: Record<string, unknown> | {
            spikesRejected: number;
            totalMeasurements: number;
            currentX: number;
            currentP: number;
        } | undefined;
    };
    getKalmanChannel(sensorType: string): {
        timestamp: number;
        sensorType: SensorType;
        state: Record<string, unknown> | {
            spikesRejected: number;
            totalMeasurements: number;
            currentX: number;
            currentP: number;
        } | undefined;
    };
    getRingBuffer(): {
        timestamp: number;
        stats: {
            capacity: number;
            size: number;
            utilizationPercent: number;
            totalWrites: number;
            totalReads: number;
            overflowCount: number;
            isEmpty: boolean;
            isFull: boolean;
        };
    };
    getAggregator(): {
        timestamp: number;
        stats: {
            windowSize: number;
            o2Samples: number;
            co2Samples: number;
            pressureSamples: number;
            tempSamples: number;
            humiditySamples: number;
        };
    };
}
