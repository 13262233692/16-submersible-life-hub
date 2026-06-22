import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { SENSOR_FRAME_CONFIG, SensorType } from '../common/interfaces/sensor.interface';
import { AURICULAR_FRAME_CONFIG, AuricularSensorType } from '../common/interfaces/auricular.interface';

interface SensorSimState {
  value: number;
  trend: number;
  noiseLevel: number;
  spikeProbability: number;
  min: number;
  max: number;
}

interface DiverVitalsSimState {
  diverId: number;
  pulseBpm: number;
  spo2Percent: number;
  perfusionIndex: number;
  ppgAmplitude: number;
  stressMode: boolean;
  stressTimerTicks: number;
}

@Injectable()
export class SimulatorService extends EventEmitter implements OnModuleDestroy {
  private sensors: Map<SensorType, SensorSimState>;
  private diverVitals: Map<number, DiverVitalsSimState>;
  private timer?: NodeJS.Timeout;
  private running: boolean = false;
  private sampleIntervalMs: number = 5;
  private tick: number = 0;
  private co2CrisisMode: boolean = false;
  private crisisTrigger: number = 0;

  constructor() {
    super();
    this.sensors = this.initializeSensors();
    this.diverVitals = this.initializeDiverVitals();
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
      max: 10000,
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

  private initializeDiverVitals(): Map<number, DiverVitalsSimState> {
    const map = new Map<number, DiverVitalsSimState>();
    for (let i = 1; i <= 3; i++) {
      map.set(i, {
        diverId: i,
        pulseBpm: 72 + i * 3,
        spo2Percent: 98.2,
        perfusionIndex: 5.5,
        ppgAmplitude: 28000,
        stressMode: false,
        stressTimerTicks: 0,
      });
    }
    return map;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.sampleIntervalMs = parseInt(process.env.SIMULATOR_RATE || '5', 10);
    this.crisisTrigger = parseInt(process.env.CRISIS_TRIGGER_TICKS || '0', 10);

    this.timer = setInterval(() => this.generateTick(), this.sampleIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private generateTick() {
    this.tick++;

    if (this.crisisTrigger > 0 && this.tick >= this.crisisTrigger && !this.co2CrisisMode) {
      this.triggerCo2Crisis();
    }

    this.generateSensorTick();

    if (this.tick % 2 === 0) {
      this.generateAuricularTick();
    }
  }

  private triggerCo2Crisis() {
    this.co2CrisisMode = true;
    const co2 = this.sensors.get(SensorType.CARBON_DIOXIDE);
    if (co2) co2.trend = 4.5;
    const o2 = this.sensors.get(SensorType.OXYGEN_PARTIAL_PRESSURE);
    if (o2) o2.trend = -0.01;

    for (const diver of this.diverVitals.values()) {
      diver.stressMode = true;
      diver.stressTimerTicks = 0;
      diver.pulseBpm = 120 + Math.random() * 30;
      diver.spo2Percent = 92.5;
      diver.perfusionIndex = 2.8;
    }

    this.emit('crisis:start', { timestamp: Date.now(), type: 'CO2_ACUTE' });
  }

  private generateSensorTick() {
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

  private generateAuricularTick() {
    const sensorTypes: AuricularSensorType[] = [
      AuricularSensorType.PULSE_RATE,
      AuricularSensorType.BLOOD_OXYGEN,
      AuricularSensorType.PERFUSION_INDEX,
      AuricularSensorType.PPG_EAR,
    ];

    for (const [diverId, diver] of this.diverVitals) {
      if (diver.stressMode) {
        diver.stressTimerTicks++;
        diver.pulseBpm += (Math.random() - 0.3) * 2.0;
        diver.pulseBpm = Math.max(100, Math.min(180, diver.pulseBpm));
        diver.spo2Percent -= Math.random() * 0.08;
        diver.spo2Percent = Math.max(82, Math.min(95, diver.spo2Percent));
        diver.perfusionIndex -= Math.random() * 0.05;
        diver.perfusionIndex = Math.max(1.5, Math.min(5, diver.perfusionIndex));
      } else {
        diver.pulseBpm += (Math.random() - 0.5) * 0.6;
        diver.pulseBpm = Math.max(65, Math.min(90, diver.pulseBpm));
        diver.spo2Percent += (Math.random() - 0.5) * 0.05;
        diver.spo2Percent = Math.max(96, Math.min(99.5, diver.spo2Percent));
        diver.perfusionIndex += (Math.random() - 0.5) * 0.08;
        diver.perfusionIndex = Math.max(4, Math.min(7, diver.perfusionIndex));
      }
      diver.ppgAmplitude = 25000 + Math.random() * 8000;

      for (const sensorType of sensorTypes) {
        const buffer = this.generateAuricularFrame(diverId, sensorType, diver);
        this.emit('data', buffer);
      }
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

  private generateAuricularFrame(
    diverId: number,
    sensorType: AuricularSensorType,
    diver: DiverVitalsSimState,
  ): Buffer {
    const scaling = AURICULAR_FRAME_CONFIG.SENSOR_SCALING[sensorType];

    let value: number;
    switch (sensorType) {
      case AuricularSensorType.PULSE_RATE:
        value = diver.pulseBpm;
        break;
      case AuricularSensorType.BLOOD_OXYGEN:
        value = diver.spo2Percent;
        break;
      case AuricularSensorType.PERFUSION_INDEX:
        value = diver.perfusionIndex;
        break;
      case AuricularSensorType.PPG_EAR:
      default:
        value = diver.ppgAmplitude;
        break;
    }

    value += (Math.random() - 0.5) * scaling.scale * 10;
    value = Math.max(scaling.min, Math.min(scaling.max, value));

    let rawInt = Math.round((value - scaling.offset) / scaling.scale);
    if (rawInt < 0) rawInt = 0;
    if (rawInt > 0xFFFFFFFFFFFFFFFF) rawInt = 0xFFFFFFFFFFFFFFFF;

    const sensorIdKey = Object.entries(AURICULAR_FRAME_CONFIG.SENSOR_ID_MAP)
      .find(([, v]) => v === sensorType)?.[0];
    const sensorId = sensorIdKey ? parseInt(sensorIdKey, 16) : 0xA1;

    const frame: number[] = [];
    frame.push(AURICULAR_FRAME_CONFIG.PREAMBLE);
    frame.push(diverId & 0xFF);
    frame.push(sensorId & 0xFF);

    for (let i = 7; i >= 0; i--) {
      frame.push(Number((BigInt(rawInt) >> BigInt(i * 8)) & 0xFFn));
    }

    frame.push(0x00);
    frame.push(0x00);
    frame.push(0x00);

    let chk = 0;
    for (let i = 0; i < AURICULAR_FRAME_CONFIG.CHECKSUM_BYTE; i++) {
      while (frame.length <= i) frame.push(0x00);
      chk = (chk + frame[i]) & 0xFF;
    }
    frame[AURICULAR_FRAME_CONFIG.CHECKSUM_BYTE] = ((~chk + 1) & 0xFF);

    frame.push(0x00);
    frame.push(AURICULAR_FRAME_CONFIG.END_BYTE);

    return Buffer.from(frame.slice(0, AURICULAR_FRAME_CONFIG.FRAME_SIZE));
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

  triggerAcuteCo2Crisis(diverId?: number) {
    this.triggerCo2Crisis();
    if (diverId !== undefined) {
      const d = this.diverVitals.get(diverId);
      if (d) d.stressMode = true;
    }
  }

  getCo2CrisisMode(): boolean {
    return this.co2CrisisMode;
  }

  getDiverVitalsSnapshot() {
    return Array.from(this.diverVitals.values()).map((d) => ({
      diverId: d.diverId,
      pulseBpm: +d.pulseBpm.toFixed(1),
      spo2Percent: +d.spo2Percent.toFixed(2),
      perfusionIndex: +d.perfusionIndex.toFixed(2),
      stressMode: d.stressMode,
    }));
  }

  onModuleDestroy() {
    void this.stop();
  }
}
