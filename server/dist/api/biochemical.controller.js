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
exports.BiochemicalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const biochemical_engine_service_1 = require("../biochemical/biochemical-engine.service");
let BiochemicalController = class BiochemicalController {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    getState() {
        const t0 = Date.now();
        const state = this.engine.getCurrentState();
        return {
            timestamp: Date.now(),
            latencyMs: Date.now() - t0,
            state,
        };
    }
    getGrid() {
        return {
            timestamp: Date.now(),
            grid: this.engine.getCurrentGrid(),
        };
    }
    getCompactGrid() {
        const grid = this.engine.getCurrentGrid();
        if (!grid) {
            return { timestamp: Date.now(), grid: null };
        }
        return {
            timestamp: grid.timestamp,
            w: grid.width,
            h: grid.height,
            o2: Array.from(grid.o2Grid),
            co2: Array.from(grid.co2Grid),
            vx: Array.from(grid.flowVX),
            vy: Array.from(grid.flowVY),
        };
    }
};
exports.BiochemicalController = BiochemicalController;
__decorate([
    (0, common_1.Get)('state'),
    (0, swagger_1.ApiOperation)({ summary: '获取当前生化状态', description: '极低延迟返回舱内生化状态快照（氧气占比、分压、代谢率、安全指示等）' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '生化状态快照' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], BiochemicalController.prototype, "getState", null);
__decorate([
    (0, common_1.Get)('grid'),
    (0, swagger_1.ApiOperation)({ summary: '获取气体扩散网格', description: '返回用于 WebGL 渲染的三维流体扩散梯度网格数据' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], BiochemicalController.prototype, "getGrid", null);
__decorate([
    (0, common_1.Get)('grid/compact'),
    (0, swagger_1.ApiOperation)({ summary: '获取紧凑格式扩散网格', description: '返回压缩格式网格以降低传输延迟' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BiochemicalController.prototype, "getCompactGrid", null);
exports.BiochemicalController = BiochemicalController = __decorate([
    (0, swagger_1.ApiTags)('life-support'),
    (0, common_1.Controller)('api/biochemical'),
    __metadata("design:paramtypes", [biochemical_engine_service_1.BiochemicalEngineService])
], BiochemicalController);
//# sourceMappingURL=biochemical.controller.js.map