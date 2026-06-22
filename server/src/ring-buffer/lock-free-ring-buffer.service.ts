import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

export interface TypedBufferSlot<T> {
  sequence: number;
  data: T | null;
  written: boolean;
  padding?: number;
}

@Injectable()
export class LockFreeRingBuffer<T> implements OnModuleInit {
  private buffer: Array<TypedBufferSlot<T>>;
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private mask: number;
  private totalWrites: number = 0;
  private totalReads: number = 0;
  private overflowCount: number = 0;
  private readonly name: string;

  constructor(private readonly logger: LoggerService) {
    this.name = 'SensorRingBuf';
    this.capacity = 1 << 16;
    this.mask = this.capacity - 1;
    this.buffer = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = { sequence: 0, data: null, written: false };
    }
  }

  onModuleInit() {
    this.logger.setContext('RingBuffer');
    this.logger.log(
      `无锁环形缓冲初始化: 容量=${this.capacity} 槽 (${(this.capacity / 1024).toFixed(0)}K), ` +
      `单槽对齐=8 字节边界`,
    );
  }

  push(item: T, timestamp?: number): boolean {
    const nextHead = (this.head + 1) & this.mask;

    if (nextHead === this.tail) {
      this.overflowCount++;
      if (this.overflowCount % 100 === 0) {
        this.logger.warn(
          `缓冲区溢出! 溢出次数=${this.overflowCount}, ` +
          `利用率=${(this.size / this.capacity * 100).toFixed(2)}%`,
        );
      }
      this.tail = (this.tail + 1) & this.mask;
    }

    const slot = this.buffer[this.head];
    slot.data = item;
    slot.sequence = this.totalWrites;
    slot.written = true;
    void timestamp;

    this.head = nextHead;
    this.totalWrites++;
    return true;
  }

  pop(): T | null {
    if (this.head === this.tail) return null;

    const slot = this.buffer[this.tail];
    const data = slot.data;
    slot.written = false;
    slot.data = null;

    this.tail = (this.tail + 1) & this.mask;
    this.totalReads++;
    return data;
  }

  peek(): T | null {
    if (this.head === this.tail) return null;
    return this.buffer[this.tail].data;
  }

  drain(maxItems: number = 1024): T[] {
    const results: T[] = [];
    const limit = Math.min(maxItems, this.size);
    for (let i = 0; i < limit; i++) {
      const item = this.pop();
      if (item === null) break;
      results.push(item);
    }
    return results;
  }

  drainAll(): T[] {
    return this.drain(this.size);
  }

  peekAll(maxItems: number = 1024): T[] {
    const results: T[] = [];
    let cursor = this.tail;
    let count = 0;
    while (cursor !== this.head && count < maxItems) {
      const data = this.buffer[cursor].data;
      if (data !== null) results.push(data);
      cursor = (cursor + 1) & this.mask;
      count++;
    }
    return results;
  }

  get size(): number {
    return (this.head - this.tail + this.capacity) & this.mask;
  }

  get utilization(): number {
    return this.size / this.capacity;
  }

  getStats() {
    return {
      capacity: this.capacity,
      size: this.size,
      utilizationPercent: +(this.utilization * 100).toFixed(3),
      totalWrites: this.totalWrites,
      totalReads: this.totalReads,
      overflowCount: this.overflowCount,
      isEmpty: this.size === 0,
      isFull: ((this.head + 1) & this.mask) === this.tail,
    };
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i].data = null;
      this.buffer[i].written = false;
    }
    this.head = 0;
    this.tail = 0;
  }
}
