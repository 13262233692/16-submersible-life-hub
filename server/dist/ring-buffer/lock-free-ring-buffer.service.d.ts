import { OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
export interface TypedBufferSlot<T> {
    sequence: number;
    data: T | null;
    written: boolean;
    padding?: number;
}
export declare class LockFreeRingBuffer<T> implements OnModuleInit {
    private readonly logger;
    private buffer;
    private capacity;
    private head;
    private tail;
    private mask;
    private totalWrites;
    private totalReads;
    private overflowCount;
    private readonly name;
    constructor(logger: LoggerService);
    onModuleInit(): void;
    push(item: T, timestamp?: number): boolean;
    pop(): T | null;
    peek(): T | null;
    drain(maxItems?: number): T[];
    drainAll(): T[];
    peekAll(maxItems?: number): T[];
    get size(): number;
    get utilization(): number;
    getStats(): {
        capacity: number;
        size: number;
        utilizationPercent: number;
        totalWrites: number;
        totalReads: number;
        overflowCount: number;
        isEmpty: boolean;
        isFull: boolean;
    };
    clear(): void;
}
