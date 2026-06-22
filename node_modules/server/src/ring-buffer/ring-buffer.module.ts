import { Module, Global } from '@nestjs/common';
import { LockFreeRingBuffer } from './lock-free-ring-buffer.service';

@Global()
@Module({
  providers: [LockFreeRingBuffer],
  exports: [LockFreeRingBuffer],
})
export class RingBufferModule {}
