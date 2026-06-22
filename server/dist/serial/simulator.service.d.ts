import { OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { SensorType } from '../common/interfaces/sensor.interface';
export declare class SimulatorService extends EventEmitter implements OnModuleDestroy {
    private sensors;
    private diverVitals;
    private timer?;
    private running;
    private sampleIntervalMs;
    private tick;
    private co2CrisisMode;
    private crisisTrigger;
    constructor();
    private initializeSensors;
    private initializeDiverVitals;
    start(): Promise<void>;
    stop(): Promise<void>;
    private generateTick;
    private triggerCo2Crisis;
    private generateSensorTick;
    private generateAuricularTick;
    private generateSensorFrame;
    private generateAuricularFrame;
    forceSpike(sensorType: SensorType, amplitudePercent?: number): void;
    setOxygenConsumptionRate(rateMultiplier: number): void;
    triggerAcuteCo2Crisis(diverId?: number): void;
    getCo2CrisisMode(): boolean;
    getDiverVitalsSnapshot(): {
        diverId: number;
        pulseBpm: number;
        spo2Percent: number;
        perfusionIndex: number;
        stressMode: boolean;
    }[];
    onModuleDestroy(): void;
}
