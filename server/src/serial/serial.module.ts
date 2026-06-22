import { Module, Global } from '@nestjs/common';
import { SerialService } from './serial.service';
import { FrameDecoderService } from './frame-decoder.service';
import { AuricularDecoderService } from './auricular-decoder.service';
import { SimulatorService } from './simulator.service';

@Global()
@Module({
  providers: [SerialService, FrameDecoderService, AuricularDecoderService, SimulatorService],
  exports: [SerialService, FrameDecoderService, AuricularDecoderService, SimulatorService],
})
export class SerialModule {}
