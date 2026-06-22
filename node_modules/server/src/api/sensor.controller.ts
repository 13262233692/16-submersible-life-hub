import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { SensorType } from '../common/interfaces/sensor.interface';

@ApiTags('sensors')
@Controller('api/sensors')
export class SensorController {
  constructor(private readonly engine: BiochemicalEngineService) {}

  @Get('kalman/channels')
  @ApiOperation({ summary: '获取所有卡尔曼滤波通道状态' })
  getAllKalmanChannels() {
    return {
      timestamp: Date.now(),
      channels: this.engine.getKalmanChannelState(),
    };
  }

  @Get('kalman/:sensorType')
  @ApiOperation({ summary: '获取指定传感器卡尔曼滤波状态' })
  getKalmanChannel(@Param('sensorType') sensorType: string) {
    const st = sensorType as SensorType;
    return {
      timestamp: Date.now(),
      sensorType: st,
      state: this.engine.getKalmanChannelState(st),
    };
  }

  @Get('ringbuffer')
  @ApiOperation({ summary: '获取无锁滑动缓冲状态' })
  getRingBuffer() {
    return {
      timestamp: Date.now(),
      stats: this.engine.getRingBufferStats(),
    };
  }

  @Get('aggregator')
  @ApiOperation({ summary: '获取传感器聚合窗口统计' })
  getAggregator() {
    return {
      timestamp: Date.now(),
      stats: this.engine.getAggregatorStats(),
    };
  }
}
