import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { SerialService } from '../serial/serial.service';
import { AppService } from '../app.service';

@ApiTags('life-support')
@Controller('api/diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly engine: BiochemicalEngineService,
    private readonly serial: SerialService,
    private readonly app: AppService,
  ) {}

  @Get('engine')
  @ApiOperation({ summary: '生化引擎诊断信息' })
  getEngineDiag() {
    return {
      timestamp: Date.now(),
      diagnostics: this.engine.getDiagnostics(),
    };
  }

  @Get('serial')
  @ApiOperation({ summary: 'RS-485 串口状态信息' })
  getSerialStatus() {
    return {
      timestamp: Date.now(),
      status: this.serial.getStatus(),
    };
  }

  @Get('full')
  @ApiOperation({ summary: '全系统诊断快照' })
  getFullDiagnostics() {
    return {
      timestamp: Date.now(),
      health: this.app.getSystemHealth(),
      system: this.app.getSystemInfo(),
      serial: this.serial.getStatus(),
      engine: this.engine.getDiagnostics(),
      ringBuffer: this.engine.getRingBufferStats(),
      kalman: this.engine.getKalmanChannelState(),
      aggregator: this.engine.getAggregatorStats(),
    };
  }
}
