import { Module } from '@nestjs/common';
import { BiosocketGateway } from './biosocket.gateway';

@Module({
  providers: [BiosocketGateway],
  exports: [BiosocketGateway],
})
export class BiosocketModule {}
