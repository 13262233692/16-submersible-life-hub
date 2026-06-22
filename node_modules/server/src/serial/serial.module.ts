import { Module, Global } from '@nestjs/common';
import { SerialService } from './serial.service';
import { FrameDecoderService } from './frame-decoder.service';
import { SimulatorService } from './simulator.service';

@Global()
@Module({
  providers: [SerialService, FrameDecoderService, SimulatorService],
  exports: [SerialService, FrameDecoderService, SimulatorService],
})
export class SerialModule {}
