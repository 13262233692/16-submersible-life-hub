"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiochemicalModule = void 0;
const common_1 = require("@nestjs/common");
const biochemical_engine_service_1 = require("./biochemical-engine.service");
const diffusion_grid_service_1 = require("./diffusion-grid.service");
const sensor_aggregator_service_1 = require("./sensor-aggregator.service");
const gas_control_module_1 = require("../gas-control/gas-control.module");
let BiochemicalModule = class BiochemicalModule {
};
exports.BiochemicalModule = BiochemicalModule;
exports.BiochemicalModule = BiochemicalModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => gas_control_module_1.GasControlModule)],
        providers: [biochemical_engine_service_1.BiochemicalEngineService, diffusion_grid_service_1.DiffusionGridService, sensor_aggregator_service_1.SensorAggregatorService],
        exports: [biochemical_engine_service_1.BiochemicalEngineService, diffusion_grid_service_1.DiffusionGridService, sensor_aggregator_service_1.SensorAggregatorService],
    })
], BiochemicalModule);
//# sourceMappingURL=biochemical.module.js.map