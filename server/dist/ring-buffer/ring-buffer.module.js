"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingBufferModule = void 0;
const common_1 = require("@nestjs/common");
const lock_free_ring_buffer_service_1 = require("./lock-free-ring-buffer.service");
let RingBufferModule = class RingBufferModule {
};
exports.RingBufferModule = RingBufferModule;
exports.RingBufferModule = RingBufferModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [lock_free_ring_buffer_service_1.LockFreeRingBuffer],
        exports: [lock_free_ring_buffer_service_1.LockFreeRingBuffer],
    })
], RingBufferModule);
//# sourceMappingURL=ring-buffer.module.js.map