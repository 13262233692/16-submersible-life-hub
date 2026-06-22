import { Module, Global } from '@nestjs/common';
import { AppService } from '../../app.service';

@Global()
@Module({
  providers: [AppService],
  exports: [AppService],
})
export class SharedModule {}
