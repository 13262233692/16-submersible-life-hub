import { OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { SensorType } from '../common/interfaces/sensor.interface';
export declare class SimulatorService extends EventEmitter implements OnModuleDestroy {
    private sensors;
    private timer?;
    private running;
    private sampleIntervalMs;
    private tick;
    constructor();
    private initializeSensors;
    start(): Promise<void>;
    stop(): Promise<void>;
    private generateSensorTick;
    private generateSensorFrame;
    forceSpike(sensorType: SensorType, amplitudePercent?: number): void;
    setOxygenConsumptionRate(rateMultiplier: number): void;
    onModuleDestroy(): void;
}
