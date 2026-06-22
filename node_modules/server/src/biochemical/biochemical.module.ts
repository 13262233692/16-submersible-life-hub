import { Module, Global, forwardRef } from '@nestjs/common';
import { BiochemicalEngineService } from './biochemical-engine.service';
import { DiffusionGridService } from './diffusion-grid.service';
import { SensorAggregatorService } from './sensor-aggregator.service';
import { GasControlModule } from '../gas-control/gas-control.module';

@Global()
@Module({
  imports: [forwardRef(() => GasControlModule)],
  providers: [BiochemicalEngineService, DiffusionGridService, SensorAggregatorService],
  exports: [BiochemicalEngineService, DiffusionGridService, SensorAggregatorService],
})
export class BiochemicalModule {}
