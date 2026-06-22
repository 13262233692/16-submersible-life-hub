import { Injectable, OnModuleInit } from '@nestjs/common';
import { KalmanFilterService } from './kalman.service';
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

@Injectable()
export class MultiChannelKalmanFilter implements OnModuleInit {
  private filterMap: Map<SensorType, KalmanFilterService> = new Map();

  constructor(private readonly logger: LoggerService) {}

  onModuleInit() {
    this.logger.setContext('MultiKalman');
    this.filterMap.set(SensorType.OXYGEN_PARTIAL_PRESSURE, new KalmanFilterService('O2_PP', this.logger));
    this.filterMap.set(SensorType.CARBON_DIOXIDE, new KalmanFilterService('CO2', this.logger));
    this.filterMap.set(SensorType.ABSOLUTE_PRESSURE, new KalmanFilterService('P_ABS', this.logger));
    this.filterMap.set(SensorType.TEMPERATURE, new KalmanFilterService('TEMP', this.logger));
    this.filterMap.set(SensorType.HUMIDITY, new KalmanFilterService('HUM', this.logger));
    this.logger.log('多通道卡尔曼滤波器已初始化 (5 通道)');
  }

  apply(sensor: DecodedSensorData): FilteredSensorReading | null {
    const filter = this.filterMap.get(sensor.sensorType);
    if (!filter) return null;

    const result = filter.filter(sensor.value, sensor.timestamp);
    return {
      timestamp: sensor.timestamp,
      sensorType: sensor.sensorType,
      rawValue: sensor.value,
      filteredValue: result.filtered,
      unit: sensor.unit,
      innovation: result.innovation,
      kalmanGain: result.kalmanGain,
      isSpikeRejected: result.isSpike,
      adaptiveFactor: result.adaptiveFactor,
    };
  }

  getChannelState(sensorType: SensorType) {
    return this.filterMap.get(sensorType)?.getStats();
  }

  getAllChannelStates() {
    const result: Record<string, unknown> = {};
    for (const [key, filter] of this.filterMap.entries()) {
      result[key] = filter.getStats();
    }
    return result;
  }

  resetChannel(sensorType: SensorType, value?: number) {
    this.filterMap.get(sensorType)?.reset(value);
  }
}
