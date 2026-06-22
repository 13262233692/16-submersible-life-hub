import { Module, Global, forwardRef } from '@nestjs/common';
import { GasControlService } from './gas-control.service';
import { MasterControlReporter } from './master-control-reporter.service';
import { BiochemicalModule } from '../biochemical/biochemical.module';

@Global()
@Module({
  imports: [forwardRef(() => BiochemicalModule)],
  providers: [GasControlService, MasterControlReporter],
  exports: [GasControlService, MasterControlReporter],
})
export class GasControlModule {}
