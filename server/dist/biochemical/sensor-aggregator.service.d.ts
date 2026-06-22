import { OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { BiochemicalState } from '../common/interfaces/biochemical.interface';
import { FilteredSensorReading } from '../kalman/multi-channel-kalman.service';
export declare class SensorAggregatorService implements OnModuleInit {
    private readonly logger;
    private readonly windowSize;
    private window;
    private lastState?;
    private lastO2Moles;
    private lastComputationTime;
    constructor(logger: LoggerService);
    onModuleInit(): void;
    ingest(reading: FilteredSensorReading): void;
    computeState(): BiochemicalState | null;
    private hasEnoughData;
    private mapSensorToKey;
    private movingAverage;
    private idealGasMoles;
    private ppmTokPa;
    private waterVaporPressure;
    private computeSafetyIndicators;
    getLastState(): BiochemicalState | null;
    getWindowStats(): {
        windowSize: number;
        o2Samples: number;
        co2Samples: number;
        pressureSamples: number;
        tempSamples: number;
        humiditySamples: number;
    };
}
