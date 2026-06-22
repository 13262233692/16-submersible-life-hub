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
exports.ControlController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const gas_control_service_1 = require("../gas-control/gas-control.service");
let ControlController = class ControlController {
    gasControl;
    constructor(gasControl) {
        this.gasControl = gasControl;
    }
    getAllValves() {
        return {
            timestamp: Date.now(),
            valves: this.gasControl.getAllValveStatus(),
        };
    }
    getValve(valveId) {
        return {
            timestamp: Date.now(),
            valveId,
            status: this.gasControl.getValveStatus(valveId),
        };
    }
    async issueValveCommand(valveId, body) {
        const command = await this.gasControl.issueCommand({
            valveId: valveId,
            action: body.action,
            pulseWidthMs: body.pulseWidthMs,
            targetPressureDeltaKPa: body.targetPressureDeltaKPa,
            priority: body.priority,
        });
        return { timestamp: Date.now(), command };
    }
    setOverride(body) {
        this.gasControl.setManualOverride(body.enabled);
        return { timestamp: Date.now(), manualOverride: body.enabled };
    }
    getPID() {
        return {
            timestamp: Date.now(),
            pid: this.gasControl.getPIDStates(),
        };
    }
    getMasterReport() {
        return {
            timestamp: Date.now(),
            report: this.gasControl.getLatestMasterReport(),
        };
    }
};
exports.ControlController = ControlController;
__decorate([
    (0, common_1.Get)('valves'),
    (0, swagger_1.ApiOperation)({ summary: '获取所有电磁阀状态' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ControlController.prototype, "getAllValves", null);
__decorate([
    (0, common_1.Get)('valves/:valveId'),
    (0, swagger_1.ApiOperation)({ summary: '获取单个电磁阀状态' }),
    __param(0, (0, common_1.Param)('valveId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ControlController.prototype, "getValve", null);
__decorate([
    (0, common_1.Post)('valves/:valveId/command'),
    (0, swagger_1.ApiOperation)({ summary: '下发电磁阀控制指令' }),
    __param(0, (0, common_1.Param)('valveId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ControlController.prototype, "issueValveCommand", null);
__decorate([
    (0, common_1.Post)('override'),
    (0, swagger_1.ApiOperation)({ summary: '启用或解除手动超控' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ControlController.prototype, "setOverride", null);
__decorate([
    (0, common_1.Get)('pid'),
    (0, swagger_1.ApiOperation)({ summary: '获取三路 PID 控制器状态' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ControlController.prototype, "getPID", null);
__decorate([
    (0, common_1.Get)('master-report'),
    (0, swagger_1.ApiOperation)({ summary: '获取最新宇航级主控上报包' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ControlController.prototype, "getMasterReport", null);
exports.ControlController = ControlController = __decorate([
    (0, swagger_1.ApiTags)('control'),
    (0, common_1.Controller)('api/control'),
    __metadata("design:paramtypes", [gas_control_service_1.GasControlService])
], ControlController);
//# sourceMappingURL=control.controller.js.map