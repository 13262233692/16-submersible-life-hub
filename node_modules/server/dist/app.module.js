"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const logger_module_1 = require("./common/logger/logger.module");
const serial_module_1 = require("./serial/serial.module");
const kalman_module_1 = require("./kalman/kalman.module");
const ring_buffer_module_1 = require("./ring-buffer/ring-buffer.module");
const biochemical_module_1 = require("./biochemical/biochemical.module");
const gas_control_module_1 = require("./gas-control/gas-control.module");
const biosocket_module_1 = require("./biosocket/biosocket.module");
const api_module_1 = require("./api/api.module");
const shared_module_1 = require("./common/shared/shared.module");
const metabolic_module_1 = require("./metabolic/metabolic.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            shared_module_1.SharedModule,
            logger_module_1.LoggerModule,
            serial_module_1.SerialModule,
            kalman_module_1.KalmanFilterModule,
            ring_buffer_module_1.RingBufferModule,
            biochemical_module_1.BiochemicalModule,
            gas_control_module_1.GasControlModule,
            metabolic_module_1.MetabolicModule,
            biosocket_module_1.BiosocketModule,
            api_module_1.ApiModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map