"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockFreeRingBuffer = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
let LockFreeRingBuffer = class LockFreeRingBuffer {
    logger;
    buffer;
    capacity;
    head = 0;
    tail = 0;
    mask;
    totalWrites = 0;
    totalReads = 0;
    overflowCount = 0;
    name;
    constructor(logger) {
        this.logger = logger;
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
        this.logger.log(`无锁环形缓冲初始化: 容量=${this.capacity} 槽 (${(this.capacity / 1024).toFixed(0)}K), ` +
            `单槽对齐=8 字节边界`);
    }
    push(item, timestamp) {
        const nextHead = (this.head + 1) & this.mask;
        if (nextHead === this.tail) {
            this.overflowCount++;
            if (this.overflowCount % 100 === 0) {
                this.logger.warn(`缓冲区溢出! 溢出次数=${this.overflowCount}, ` +
                    `利用率=${(this.size / this.capacity * 100).toFixed(2)}%`);
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
    pop() {
        if (this.head === this.tail)
            return null;
        const slot = this.buffer[this.tail];
        const data = slot.data;
        slot.written = false;
        slot.data = null;
        this.tail = (this.tail + 1) & this.mask;
        this.totalReads++;
        return data;
    }
    peek() {
        if (this.head === this.tail)
            return null;
        return this.buffer[this.tail].data;
    }
    drain(maxItems = 1024) {
        const results = [];
        const limit = Math.min(maxItems, this.size);
        for (let i = 0; i < limit; i++) {
            const item = this.pop();
            if (item === null)
                break;
            results.push(item);
        }
        return results;
    }
    drainAll() {
        return this.drain(this.size);
    }
    peekAll(maxItems = 1024) {
        const results = [];
        let cursor = this.tail;
        let count = 0;
        while (cursor !== this.head && count < maxItems) {
            const data = this.buffer[cursor].data;
            if (data !== null)
                results.push(data);
            cursor = (cursor + 1) & this.mask;
            count++;
        }
        return results;
    }
    get size() {
        return (this.head - this.tail + this.capacity) & this.mask;
    }
    get utilization() {
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
};
exports.LockFreeRingBuffer = LockFreeRingBuffer;
exports.LockFreeRingBuffer = LockFreeRingBuffer = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], LockFreeRingBuffer);
//# sourceMappingURL=lock-free-ring-buffer.service.js.map