"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiModule = void 0;
const common_1 = require("@nestjs/common");
const biochemical_controller_1 = require("./biochemical.controller");
const sensor_controller_1 = require("./sensor.controller");
const control_controller_1 = require("./control.controller");
const diagnostics_controller_1 = require("./diagnostics.controller");
let ApiModule = class ApiModule {
};
exports.ApiModule = ApiModule;
exports.ApiModule = ApiModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            biochemical_controller_1.BiochemicalController,
            sensor_controller_1.SensorController,
            control_controller_1.ControlController,
            diagnostics_controller_1.DiagnosticsController,
        ],
    })
], ApiModule);
//# sourceMappingURL=api.module.js.map