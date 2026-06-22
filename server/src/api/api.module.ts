import { Module } from '@nestjs/common';
import { BiochemicalController } from './biochemical.controller';
import { SensorController } from './sensor.controller';
import { ControlController } from './control.controller';
import { DiagnosticsController } from './diagnostics.controller';

@Module({
  controllers: [
    BiochemicalController,
    SensorController,
    ControlController,
    DiagnosticsController,
  ],
})
export class ApiModule {}
