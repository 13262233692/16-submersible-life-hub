import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { SerialService } from '../serial/serial.service';
import { MultiChannelKalmanFilter, FilteredSensorReading } from '../kalman/multi-channel-kalman.service';
import { LockFreeRingBuffer } from '../ring-buffer/lock-free-ring-buffer.service';
import { SensorAggregatorService } from './sensor-aggregator.service';
import { DiffusionGridService } from './diffusion-grid.service';
import { DecodedSensorData, SensorType } from '../common/interfaces/sensor.interface';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';

export interface EngineDiagnostics {
  computeLatencyMs: number;
  avgLatencyMs: number;
  totalComputations: number;
  framesDropped: number;
  inputQueueSize: number;
  lastStateAgeSec: number;
}

@Injectable()
export class BiochemicalEngineService implements OnModuleInit, OnModuleDestroy {
  private runLoop?: NodeJS.Timeout;
  private gridLoop?: NodeJS.Timeout;
  private lastState?: BiochemicalState;
  private lastGrid?: GasDiffusionGrid;
  private diagnostics: EngineDiagnostics = {
    computeLatencyMs: 0,
    avgLatencyMs: 0,
    totalComputations: 0,
    framesDropped: 0,
    inputQueueSize: 0,
    lastStateAgeSec: 0,
  };
  private latencies: number[] = [];
  private stateListeners: Array<(s: BiochemicalState) => void> = [];
  private gridListeners: Array<(g: GasDiffusionGrid) => void> = [];
  private engineStarted: boolean = false;

  private computeIntervalMs: number = 10;
  private gridIntervalMs: number = 33;
  private backpressureLevel: number = 0;
  private adaptiveThrottleEnabled: boolean = true;
  private skippedGridTicks: number = 0;
  private totalSkippedGrids: number = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly serial: SerialService,
    private readonly kalman: MultiChannelKalmanFilter,
    private readonly ringBuffer: LockFreeRingBuffer<FilteredSensorReading>,
    private readonly aggregator: SensorAggregatorService,
    private readonly diffusion: DiffusionGridService,
  ) {
    this.logger.setContext('BiochemicalEngine');
  }

  onModuleInit() {
    this.logger.log('生化计算引擎初始化完成，启动数据管线...');
    this.serial.on('frameDecoded', (frame) => {
      if ('sensorType' in frame && 'unit' in frame) {
        this.onSensorFrame(frame as DecodedSensorData);
      }
    });
    this.scheduleComputeLoop();
    this.scheduleGridLoop();
    this.engineStarted = true;
  }

  onModuleDestroy() {
    this.engineStarted = false;
    if (this.runLoop) {
      clearInterval(this.runLoop);
      this.runLoop = undefined;
    }
    if (this.gridLoop) {
      clearInterval(this.gridLoop);
      this.gridLoop = undefined;
    }
    this.stateListeners.length = 0;
    this.gridListeners.length = 0;
    this.lastState = undefined;
    this.lastGrid = undefined;
  }

  private scheduleComputeLoop() {
    if (this.runLoop) clearInterval(this.runLoop);
    this.runLoop = setInterval(() => this.computeTick(), this.computeIntervalMs);
  }

  private scheduleGridLoop() {
    if (this.gridLoop) clearInterval(this.gridLoop);
    this.gridLoop = setInterval(() => this.gridTick(), this.gridIntervalMs);
  }

  private onSensorFrame(frame: DecodedSensorData) {
    const filtered = this.kalman.apply(frame);
    if (filtered) {
      this.ringBuffer.push(filtered, filtered.timestamp);
    }
  }

  private computeTick() {
    if (!this.engineStarted) return;
    const t0 = performance.now();

    const readings = this.ringBuffer.drain(4096);
    this.diagnostics.inputQueueSize = this.ringBuffer.size;

    for (const reading of readings) {
      this.aggregator.ingest(reading);
    }

    if (readings.length > 0) {
      const state = this.aggregator.computeState();
      if (state) {
        this.lastState = state;
        for (const listener of this.stateListeners) {
          try { listener(state); } catch (e) { /* ignore listener errors */ }
        }
      }
    }

    const latency = performance.now() - t0;
    this.diagnostics.computeLatencyMs = +latency.toFixed(3);
    this.latencies.push(latency);
    if (this.latencies.length > 256) this.latencies.shift();
    this.diagnostics.avgLatencyMs = +(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(3);
    this.diagnostics.totalComputations++;

    if (latency > 50) {
      this.diagnostics.framesDropped++;
      if (this.diagnostics.framesDropped % 50 === 0) {
        this.logger.warn(
          `生化引擎性能告警: 单次延迟=${latency.toFixed(1)}ms, 总丢帧=${this.diagnostics.framesDropped}`,
        );
      }
    }

    this.diagnostics.lastStateAgeSec = this.lastState
      ? +((Date.now() - this.lastState.timestamp) / 1000).toFixed(3)
      : 999;
  }

  private gridTick() {
    if (!this.engineStarted || !this.lastState) return;

    if (this.adaptiveThrottleEnabled && this.backpressureLevel > 0) {
      const skipThreshold = Math.min(this.backpressureLevel, 5);
      if (this.skippedGridTicks < skipThreshold) {
        this.skippedGridTicks++;
        this.totalSkippedGrids++;
        return;
      }
      this.skippedGridTicks = 0;
    }

    try {
      const grid = this.diffusion.simulate(this.lastState);
      this.lastGrid = grid;
      for (const listener of this.gridListeners) {
        try { listener(grid); } catch (e) { /* ignore listener errors */ }
      }
    } catch (err) {
      this.logger.error(`扩散网格模拟失败: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  onBiochemicalState(listener: (s: BiochemicalState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      const idx = this.stateListeners.indexOf(listener);
      if (idx >= 0) this.stateListeners.splice(idx, 1);
    };
  }

  onDiffusionGrid(listener: (g: GasDiffusionGrid) => void): () => void {
    this.gridListeners.push(listener);
    return () => {
      const idx = this.gridListeners.indexOf(listener);
      if (idx >= 0) this.gridListeners.splice(idx, 1);
    };
  }

  getCurrentState(): BiochemicalState | null {
    return this.lastState || null;
  }

  getCurrentGrid(): GasDiffusionGrid | null {
    return this.lastGrid || null;
  }

  getDiagnostics(): EngineDiagnostics {
    return { ...this.diagnostics };
  }

  setBackpressureLevel(level: number): void {
    const clamped = Math.max(0, Math.min(5, level));
    if (clamped === this.backpressureLevel) return;

    const oldLevel = this.backpressureLevel;
    this.backpressureLevel = clamped;

    if (clamped > 0 && oldLevel === 0) {
      this.logger.warn(
        `生化引擎进入背压节流模式: 等级=${clamped}/5, 网格计算降频`,
      );
    } else if (clamped === 0 && oldLevel > 0) {
      this.logger.log('生化引擎退出背压节流模式，恢复全速率计算');
    }
  }

  getBackpressureLevel(): number {
    return this.backpressureLevel;
  }

  setAdaptiveThrottle(enabled: boolean): void {
    this.adaptiveThrottleEnabled = enabled;
  }

  getThrottleStats() {
    return {
      backpressureLevel: this.backpressureLevel,
      adaptiveThrottleEnabled: this.adaptiveThrottleEnabled,
      totalSkippedGrids: this.totalSkippedGrids,
      computeIntervalMs: this.computeIntervalMs,
      gridIntervalMs: this.gridIntervalMs,
    };
  }

  getKalmanChannelState(sensorType?: SensorType) {
    if (sensorType) return this.kalman.getChannelState(sensorType);
    return this.kalman.getAllChannelStates();
  }

  getRingBufferStats() {
    return this.ringBuffer.getStats();
  }

  getAggregatorStats() {
    return this.aggregator.getWindowStats();
  }

  getLatestReadings(): Record<string, FilteredSensorReading | null> {
    void SensorType;
    return {};
  }
}
