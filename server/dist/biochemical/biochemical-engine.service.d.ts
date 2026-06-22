import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { SerialService } from '../serial/serial.service';
import { MultiChannelKalmanFilter, FilteredSensorReading } from '../kalman/multi-channel-kalman.service';
import { LockFreeRingBuffer } from '../ring-buffer/lock-free-ring-buffer.service';
import { SensorAggregatorService } from './sensor-aggregator.service';
import { DiffusionGridService } from './diffusion-grid.service';
import { SensorType } from '../common/interfaces/sensor.interface';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';
export interface EngineDiagnostics {
    computeLatencyMs: number;
    avgLatencyMs: number;
    totalComputations: number;
    framesDropped: number;
    inputQueueSize: number;
    lastStateAgeSec: number;
}
export declare class BiochemicalEngineService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly serial;
    private readonly kalman;
    private readonly ringBuffer;
    private readonly aggregator;
    private readonly diffusion;
    private runLoop?;
    private gridLoop?;
    private lastState?;
    private lastGrid?;
    private diagnostics;
    private latencies;
    private stateListeners;
    private gridListeners;
    private engineStarted;
    private computeIntervalMs;
    private gridIntervalMs;
    private backpressureLevel;
    private adaptiveThrottleEnabled;
    private skippedGridTicks;
    private totalSkippedGrids;
    constructor(logger: LoggerService, serial: SerialService, kalman: MultiChannelKalmanFilter, ringBuffer: LockFreeRingBuffer<FilteredSensorReading>, aggregator: SensorAggregatorService, diffusion: DiffusionGridService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private scheduleComputeLoop;
    private scheduleGridLoop;
    private onSensorFrame;
    private computeTick;
    private gridTick;
    onBiochemicalState(listener: (s: BiochemicalState) => void): () => void;
    onDiffusionGrid(listener: (g: GasDiffusionGrid) => void): () => void;
    getCurrentState(): BiochemicalState | null;
    getCurrentGrid(): GasDiffusionGrid | null;
    getDiagnostics(): EngineDiagnostics;
    setBackpressureLevel(level: number): void;
    getBackpressureLevel(): number;
    setAdaptiveThrottle(enabled: boolean): void;
    getThrottleStats(): {
        backpressureLevel: number;
        adaptiveThrottleEnabled: boolean;
        totalSkippedGrids: number;
        computeIntervalMs: number;
        gridIntervalMs: number;
    };
    getKalmanChannelState(sensorType?: SensorType): Record<string, unknown> | {
        spikesRejected: number;
        totalMeasurements: number;
        currentX: number;
        currentP: number;
    } | undefined;
    getRingBufferStats(): {
        capacity: number;
        size: number;
        utilizationPercent: number;
        totalWrites: number;
        totalReads: number;
        overflowCount: number;
        isEmpty: boolean;
        isFull: boolean;
    };
    getAggregatorStats(): {
        windowSize: number;
        o2Samples: number;
        co2Samples: number;
        pressureSamples: number;
        tempSamples: number;
        humiditySamples: number;
    };
    getLatestReadings(): Record<string, FilteredSensorReading | null>;
}
