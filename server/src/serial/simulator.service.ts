import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { SENSOR_FRAME_CONFIG, SensorType } from '../common/interfaces/sensor.interface';

interface SensorSimState {
  value: number;
  trend: number;
  noiseLevel: number;
  spikeProbability: number;
  min: number;
  max: number;
}

@Injectable()
export class SimulatorService extends EventEmitter implements OnModuleDestroy {
  private sensors: Map<SensorType, SensorSimState>;
  private timer?: NodeJS.Timeout;
  private running: boolean = false;
  private sampleIntervalMs: number = 5;
  private tick: number = 0;

  constructor() {
    super();
    this.sensors = this.initializeSensors();
  }

  private initializeSensors(): Map<SensorType, SensorSimState> {
    const map = new Map<SensorType, SensorSimState>();

    map.set(SensorType.OXYGEN_PARTIAL_PRESSURE, {
      value: 21.0,
      trend: 0,
      noiseLevel: 0.08,
      spikeProbability: 0.002,
      min: 18,
      max: 25,
    });

    map.set(SensorType.CARBON_DIOXIDE, {
      value: 800,
      trend: 0.3,
      noiseLevel: 15,
      spikeProbability: 0.003,
      min: 400,
      max: 5000,
    });

    map.set(SensorType.ABSOLUTE_PRESSURE, {
      value: 101.3,
      trend: 0,
      noiseLevel: 0.05,
      spikeProbability: 0.001,
      min: 95,
      max: 110,
    });

    map.set(SensorType.TEMPERATURE, {
      value: 23.5,
      trend: 0.01,
      noiseLevel: 0.05,
      spikeProbability: 0.0005,
      min: 18,
      max: 35,
    });

    map.set(SensorType.HUMIDITY, {
      value: 55,
      trend: 0.02,
      noiseLevel: 0.3,
      spikeProbability: 0.001,
      min: 30,
      max: 80,
    });

    return map;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.sampleIntervalMs = parseInt(process.env.SIMULATOR_RATE || '5', 10);

    this.timer = setInterval(() => this.generateSensorTick(), this.sampleIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private generateSensorTick() {
    this.tick++;
    const sensorsToEmit = [
      SensorType.OXYGEN_PARTIAL_PRESSURE,
      SensorType.CARBON_DIOXIDE,
      SensorType.ABSOLUTE_PRESSURE,
    ];

    if (this.tick % 4 === 0) {
      sensorsToEmit.push(SensorType.TEMPERATURE, SensorType.HUMIDITY);
    }

    for (const sensorType of sensorsToEmit) {
      const buffer = this.generateSensorFrame(sensorType);
      this.emit('data', buffer);
    }
  }

  private generateSensorFrame(sensorType: SensorType): Buffer {
    const sim = this.sensors.get(sensorType)!;

    sim.value += sim.trend * (0.5 + Math.random());
    sim.value += (Math.random() - 0.5) * sim.noiseLevel * 2;

    if (Math.random() < sim.spikeProbability) {
      const spikeAmp = (Math.random() - 0.5) * sim.value * 0.45;
      sim.value += spikeAmp;
    }

    sim.value = Math.max(sim.min, Math.min(sim.max, sim.value));

    const scaling = SENSOR_FRAME_CONFIG.SENSOR_SCALING[sensorType];
    let rawInt = Math.round((sim.value - scaling.offset) / scaling.scale);

    if (rawInt < 0) rawInt = 0;
    if (rawInt > 0xFFFFFFFF) rawInt = 0xFFFFFFFF;

    const sensorIdKey = Object.entries(SENSOR_FRAME_CONFIG.SENSOR_ID_MAP)
      .find(([, v]) => v === sensorType)?.[0];
    const sensorId = sensorIdKey ? parseInt(sensorIdKey, 10) : 0x01;

    const frame: number[] = [];
    frame.push(SENSOR_FRAME_CONFIG.PREAMBLE);
    frame.push(sensorId & 0xFF);

    for (let i = 3; i >= 0; i--) {
      frame.push((rawInt >>> (i * 8)) & 0xFF);
    }

    frame.push(0x00);
    frame.push(0x00);

    let chk = 0;
    for (let i = 0; i < SENSOR_FRAME_CONFIG.CHECKSUM_BYTE; i++) {
      while (frame.length <= i) frame.push(0x00);
      chk = (chk + frame[i]) & 0xFF;
    }
    frame[SENSOR_FRAME_CONFIG.CHECKSUM_BYTE] = ((~chk + 1) & 0xFF);

    frame.push(0x00);
    frame.push(SENSOR_FRAME_CONFIG.END_BYTE);

    while (frame.length < SENSOR_FRAME_CONFIG.FRAME_SIZE) {
      frame.splice(frame.length - 2, 0, 0x00);
    }

    return Buffer.from(frame.slice(0, SENSOR_FRAME_CONFIG.FRAME_SIZE));
  }

  forceSpike(sensorType: SensorType, amplitudePercent: number = 30) {
    const sim = this.sensors.get(sensorType);
    if (sim) {
      sim.value += sim.value * (amplitudePercent / 100) * (Math.random() > 0.5 ? 1 : -1);
    }
  }

  setOxygenConsumptionRate(rateMultiplier: number) {
    const o2 = this.sensors.get(SensorType.OXYGEN_PARTIAL_PRESSURE);
    if (o2) {
      o2.trend = -0.0015 * rateMultiplier;
    }
    const co2 = this.sensors.get(SensorType.CARBON_DIOXIDE);
    if (co2) {
      co2.trend = 0.25 * rateMultiplier;
    }
  }

  onModuleDestroy() {
    void this.stop();
  }
}
