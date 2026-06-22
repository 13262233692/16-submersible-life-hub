import { Module, Global } from '@nestjs/common';
import { MultiChannelKalmanFilter } from './multi-channel-kalman.service';

@Global()
@Module({
  providers: [MultiChannelKalmanFilter],
  exports: [MultiChannelKalmanFilter],
})
export class KalmanFilterModule {}
