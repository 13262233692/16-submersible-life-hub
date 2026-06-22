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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensorController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const biochemical_engine_service_1 = require("../biochemical/biochemical-engine.service");
let SensorController = class SensorController {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    getAllKalmanChannels() {
        return {
            timestamp: Date.now(),
            channels: this.engine.getKalmanChannelState(),
        };
    }
    getKalmanChannel(sensorType) {
        const st = sensorType;
        return {
            timestamp: Date.now(),
            sensorType: st,
            state: this.engine.getKalmanChannelState(st),
        };
    }
    getRingBuffer() {
        return {
            timestamp: Date.now(),
            stats: this.engine.getRingBufferStats(),
        };
    }
    getAggregator() {
        return {
            timestamp: Date.now(),
            stats: this.engine.getAggregatorStats(),
        };
    }
};
exports.SensorController = SensorController;
__decorate([
    (0, common_1.Get)('kalman/channels'),
    (0, swagger_1.ApiOperation)({ summary: '获取所有卡尔曼滤波通道状态' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SensorController.prototype, "getAllKalmanChannels", null);
__decorate([
    (0, common_1.Get)('kalman/:sensorType'),
    (0, swagger_1.ApiOperation)({ summary: '获取指定传感器卡尔曼滤波状态' }),
    __param(0, (0, common_1.Param)('sensorType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SensorController.prototype, "getKalmanChannel", null);
__decorate([
    (0, common_1.Get)('ringbuffer'),
    (0, swagger_1.ApiOperation)({ summary: '获取无锁滑动缓冲状态' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SensorController.prototype, "getRingBuffer", null);
__decorate([
    (0, common_1.Get)('aggregator'),
    (0, swagger_1.ApiOperation)({ summary: '获取传感器聚合窗口统计' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SensorController.prototype, "getAggregator", null);
exports.SensorController = SensorController = __decorate([
    (0, swagger_1.ApiTags)('sensors'),
    (0, common_1.Controller)('api/sensors'),
    __metadata("design:paramtypes", [biochemical_engine_service_1.BiochemicalEngineService])
], SensorController);
//# sourceMappingURL=sensor.controller.js.map