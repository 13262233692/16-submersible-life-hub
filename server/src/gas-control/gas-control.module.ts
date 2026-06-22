import { Module, Global } from '@nestjs/common';
import { GasControlService } from './gas-control.service';
import { MasterControlReporter } from './master-control-reporter.service';

@Global()
@Module({
  providers: [GasControlService, MasterControlReporter],
  exports: [GasControlService, MasterControlReporter],
})
export class GasControlModule {}
