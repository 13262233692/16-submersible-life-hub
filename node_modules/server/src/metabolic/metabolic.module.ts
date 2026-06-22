import { Module, Global, forwardRef } from '@nestjs/common';
import { MetabolicLstmService } from './metabolic-lstm.service';
import { AcuteInterventionService } from './acute-intervention.service';
import { SerialModule } from '../serial/serial.module';
import { GasControlModule } from '../gas-control/gas-control.module';

@Global()
@Module({
  imports: [forwardRef(() => SerialModule), forwardRef(() => GasControlModule)],
  providers: [MetabolicLstmService, AcuteInterventionService],
  exports: [MetabolicLstmService, AcuteInterventionService],
})
export class MetabolicModule {}
