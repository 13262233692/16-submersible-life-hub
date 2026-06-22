import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { SerialModule } from './serial/serial.module';
import { KalmanFilterModule } from './kalman/kalman.module';
import { RingBufferModule } from './ring-buffer/ring-buffer.module';
import { BiochemicalModule } from './biochemical/biochemical.module';
import { GasControlModule } from './gas-control/gas-control.module';
import { BiosocketModule } from './biosocket/biosocket.module';
import { ApiModule } from './api/api.module';
import { SharedModule } from './common/shared/shared.module';

@Module({
  imports: [
    SharedModule,
    LoggerModule,
    SerialModule,
    KalmanFilterModule,
    RingBufferModule,
    BiochemicalModule,
    GasControlModule,
    BiosocketModule,
    ApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
