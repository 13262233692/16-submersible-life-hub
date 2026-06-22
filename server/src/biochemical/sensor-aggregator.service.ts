import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { SensorType } from '../common/interfaces/sensor.interface';
import {
  BiochemicalState,
  BIOCHEMICAL_CONSTANTS,
  SafetyIndicators,
} from '../common/interfaces/biochemical.interface';
import { FilteredSensorReading } from '../kalman/multi-channel-kalman.service';

interface SensorWindow {
  o2PP: number[];
  co2: number[];
  pressure: number[];
  temperature: number[];
  humidity: number[];
  timestamps: number[];
}

@Injectable()
export class SensorAggregatorService implements OnModuleInit {
  private readonly windowSize = 256;
  private window: SensorWindow = {
    o2PP: [],
    co2: [],
    pressure: [],
    temperature: [],
    humidity: [],
    timestamps: [],
  };
  private lastState?: BiochemicalState;
  private lastO2Moles: number = 0;
  private lastComputationTime: number = 0;

  constructor(private readonly logger: LoggerService) {}

  onModuleInit() {
    this.logger.setContext('SensorAggregator');
    this.lastComputationTime = Date.now();
    const initialPressure = BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA;
    const initialO2PP = initialPressure * BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION;
    this.lastO2Moles = this.idealGasMoles(initialO2PP, BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS, 295);
  }

  ingest(reading: FilteredSensorReading) {
    const key = this.mapSensorToKey(reading.sensorType);
    if (!key) return;

    const arr = this.window[key];
    arr.push(reading.filteredValue);
    if (arr.length > this.windowSize) arr.shift();

    if (this.window.timestamps.length === 0 ||
        reading.timestamp > this.window.timestamps[this.window.timestamps.length - 1]) {
      this.window.timestamps.push(reading.timestamp);
      if (this.window.timestamps.length > this.windowSize) this.window.timestamps.shift();
    }
  }

  computeState(): BiochemicalState | null {
    if (!this.hasEnoughData()) return this.lastState || null;

    const o2PP = this.movingAverage(this.window.o2PP, 64);
    const co2PPM = this.movingAverage(this.window.co2, 64);
    const absPressure = this.movingAverage(this.window.pressure, 64);
    const temperature = this.movingAverage(this.window.temperature, 32);
    const humidity = this.movingAverage(this.window.humidity, 32);

    if (o2PP === 0 || absPressure === 0) return this.lastState || null;

    const temperatureK = temperature + 273.15;
    const co2KPa = this.ppmTokPa(co2PPM, absPressure);
    const o2Fraction = Math.max(0.01, Math.min(0.6, o2PP / absPressure));
    const n2PP = Math.max(0, absPressure - o2PP - co2KPa - this.waterVaporPressure(temperatureK, humidity));

    const volumeLiters = BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS;
    const currentO2Moles = this.idealGasMoles(o2PP, volumeLiters, temperatureK);
    const currentCO2Moles = this.idealGasMoles(co2KPa, volumeLiters, temperatureK);

    const now = Date.now();
    const dtHours = Math.max(0.0001, (now - this.lastComputationTime) / (1000 * 3600));
    const crew = BIOCHEMICAL_CONSTANTS.METABOLIC.CREW_COUNT;
    const rq = BIOCHEMICAL_CONSTANTS.METABOLIC.RESPIRATORY_QUOTIENT;

    const theoreticalO2MolConsumption =
      BIOCHEMICAL_CONSTANTS.METABOLIC.RESTING_O2_CONSUMPTION_LPM * 60 * crew * dtHours / 22.4;

    const actualO2DeltaMol = this.lastO2Moles !== 0 ? (this.lastO2Moles - currentO2Moles) : theoreticalO2MolConsumption;
    const o2ConsumptionRateLPH = Math.max(0, actualO2DeltaMol * 22.4 / dtHours);
    const co2ProductionRateLPH = o2ConsumptionRateLPH * rq;
    void currentCO2Moles;

    const metabolicRateFactor = this.lastO2Moles !== 0
      ? Math.min(3, Math.max(0.3, actualO2DeltaMol / Math.max(0.0001, theoreticalO2MolConsumption)))
      : 1;

    const o2ReserveMoles = Math.max(0, currentO2Moles - o2FractionMinKPa(absPressure) / 100 * volumeLiters / (8.314 * temperatureK));
    const o2ConsumptionRateMolPerHour = o2ConsumptionRateLPH / 22.4;
    const o2ReserveMinutes = o2ConsumptionRateMolPerHour > 0
      ? Math.max(0, Math.min(99999, (o2ReserveMoles / o2ConsumptionRateMolPerHour) * 60))
      : 99999;

    const safetyIndicators = this.computeSafetyIndicators(o2Fraction, co2PPM, absPressure);

    this.lastO2Moles = currentO2Moles;
    this.lastComputationTime = now;

    const state: BiochemicalState = {
      timestamp: now,
      oxygenFraction: +o2Fraction.toFixed(6),
      partialPressureO2: +o2PP.toFixed(4),
      partialPressureCO2: +co2KPa.toFixed(6),
      partialPressureN2: +n2PP.toFixed(4),
      absolutePressure: +absPressure.toFixed(4),
      temperature: +temperature.toFixed(3),
      humidity: +humidity.toFixed(2),
      metabolicO2ConsumptionRate: +o2ConsumptionRateLPH.toFixed(4),
      metabolicCO2ProductionRate: +co2ProductionRateLPH.toFixed(4),
      respiratoryQuotient: rq,
      o2ReserveMinutes: +o2ReserveMinutes.toFixed(1),
      cabinAirVolume: volumeLiters,
      safetyIndicators,
    };

    this.lastState = state;
    void metabolicRateFactor;
    return state;
  }

  private hasEnoughData(): boolean {
    return (
      this.window.o2PP.length >= 8 &&
      this.window.co2.length >= 8 &&
      this.window.pressure.length >= 4
    );
  }

  private mapSensorToKey(type: SensorType): keyof SensorWindow | null {
    switch (type) {
      case SensorType.OXYGEN_PARTIAL_PRESSURE: return 'o2PP';
      case SensorType.CARBON_DIOXIDE: return 'co2';
      case SensorType.ABSOLUTE_PRESSURE: return 'pressure';
      case SensorType.TEMPERATURE: return 'temperature';
      case SensorType.HUMIDITY: return 'humidity';
      default: return null;
    }
  }

  private movingAverage(arr: number[], window: number): number {
    if (arr.length === 0) return 0;
    const n = Math.min(window, arr.length);
    let sum = 0;
    for (let i = arr.length - n; i < arr.length; i++) sum += arr[i];
    return sum / n;
  }

  private idealGasMoles(pKPa: number, vLiters: number, tKelvin: number): number {
    return (pKPa * vLiters) / (BIOCHEMICAL_CONSTANTS.IDEAL_GAS_CONSTANT * tKelvin);
  }

  private ppmTokPa(ppm: number, totalKPa: number): number {
    return (ppm / 1_000_000) * totalKPa;
  }

  private waterVaporPressure(tKelvin: number, rhPercent: number): number {
    const tC = tKelvin - 273.15;
    const satKPa = 0.61078 * Math.exp((17.27 * tC) / (tC + 237.3));
    return satKPa * (rhPercent / 100);
  }

  private computeSafetyIndicators(
    o2Frac: number,
    co2PPM: number,
    pressureKPa: number,
  ): SafetyIndicators {
    const th = BIOCHEMICAL_CONSTANTS.SAFETY_THRESHOLDS;

    let o2Status: SafetyIndicators['o2Status'] = 'normal';
    if (o2Frac < th.O2.MIN_SAFE || o2Frac > th.O2.MAX_TOXIC) o2Status = 'fatal';
    else if (o2Frac < th.O2.MIN_OPERATIONAL || o2Frac > th.O2.MAX_SAFE) o2Status = 'critical';
    else if (o2Frac < 0.20 || o2Frac > th.O2.MAX_OPERATIONAL) o2Status = 'warning';

    let co2Status: SafetyIndicators['co2Status'] = 'normal';
    if (co2PPM > th.CO2.FATAL) co2Status = 'fatal';
    else if (co2PPM > th.CO2.CRITICAL) co2Status = 'critical';
    else if (co2PPM > th.CO2.WARNING) co2Status = 'warning';

    let pressureStatus: SafetyIndicators['pressureStatus'] = 'normal';
    if (pressureKPa < th.PRESSURE.MIN_KPA || pressureKPa > th.PRESSURE.MAX_KPA) pressureStatus = 'critical';
    else if (pressureKPa < th.PRESSURE.OPTIMAL_MIN || pressureKPa > th.PRESSURE.OPTIMAL_MAX) pressureStatus = 'warning';

    const rank: Record<SafetyIndicators['o2Status'], number> = { normal: 0, warning: 1, critical: 2, fatal: 3 };
    const overall = Math.max(rank[o2Status], rank[co2Status], rank[pressureStatus]);
    const overallStatus: SafetyIndicators['overallStatus'] =
      (['normal', 'warning', 'critical', 'fatal'] as const)[overall];

    return { o2Status, co2Status, pressureStatus, overallStatus };
  }

  getLastState(): BiochemicalState | null {
    return this.lastState || null;
  }

  getWindowStats() {
    return {
      windowSize: this.windowSize,
      o2Samples: this.window.o2PP.length,
      co2Samples: this.window.co2.length,
      pressureSamples: this.window.pressure.length,
      tempSamples: this.window.temperature.length,
      humiditySamples: this.window.humidity.length,
    };
  }
}

function o2FractionMinKPa(totalKPa: number): number {
  const minFrac = BIOCHEMICAL_CONSTANTS.SAFETY_THRESHOLDS.O2.MIN_OPERATIONAL;
  return minFrac * totalKPa * 1000;
}
