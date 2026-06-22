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
exports.DiagnosticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const biochemical_engine_service_1 = require("../biochemical/biochemical-engine.service");
const serial_service_1 = require("../serial/serial.service");
const app_service_1 = require("../app.service");
let DiagnosticsController = class DiagnosticsController {
    engine;
    serial;
    app;
    constructor(engine, serial, app) {
        this.engine = engine;
        this.serial = serial;
        this.app = app;
    }
    getEngineDiag() {
        return {
            timestamp: Date.now(),
            diagnostics: this.engine.getDiagnostics(),
        };
    }
    getSerialStatus() {
        return {
            timestamp: Date.now(),
            status: this.serial.getStatus(),
        };
    }
    getFullDiagnostics() {
        return {
            timestamp: Date.now(),
            health: this.app.getSystemHealth(),
            system: this.app.getSystemInfo(),
            serial: this.serial.getStatus(),
            engine: this.engine.getDiagnostics(),
            ringBuffer: this.engine.getRingBufferStats(),
            kalman: this.engine.getKalmanChannelState(),
            aggregator: this.engine.getAggregatorStats(),
        };
    }
};
exports.DiagnosticsController = DiagnosticsController;
__decorate([
    (0, common_1.Get)('engine'),
    (0, swagger_1.ApiOperation)({ summary: '生化引擎诊断信息' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DiagnosticsController.prototype, "getEngineDiag", null);
__decorate([
    (0, common_1.Get)('serial'),
    (0, swagger_1.ApiOperation)({ summary: 'RS-485 串口状态信息' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DiagnosticsController.prototype, "getSerialStatus", null);
__decorate([
    (0, common_1.Get)('full'),
    (0, swagger_1.ApiOperation)({ summary: '全系统诊断快照' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DiagnosticsController.prototype, "getFullDiagnostics", null);
exports.DiagnosticsController = DiagnosticsController = __decorate([
    (0, swagger_1.ApiTags)('life-support'),
    (0, common_1.Controller)('api/diagnostics'),
    __metadata("design:paramtypes", [biochemical_engine_service_1.BiochemicalEngineService,
        serial_service_1.SerialService,
        app_service_1.AppService])
], DiagnosticsController);
//# sourceMappingURL=diagnostics.controller.js.map