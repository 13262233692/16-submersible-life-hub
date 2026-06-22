import { Module, Global } from '@nestjs/common';
import { BiochemicalEngineService } from './biochemical-engine.service';
import { DiffusionGridService } from './diffusion-grid.service';
import { SensorAggregatorService } from './sensor-aggregator.service';

@Global()
@Module({
  providers: [BiochemicalEngineService, DiffusionGridService, SensorAggregatorService],
  exports: [BiochemicalEngineService, DiffusionGridService, SensorAggregatorService],
})
export class BiochemicalModule {}
