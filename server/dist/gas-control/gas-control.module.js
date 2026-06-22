"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GasControlModule = void 0;
const common_1 = require("@nestjs/common");
const gas_control_service_1 = require("./gas-control.service");
const master_control_reporter_service_1 = require("./master-control-reporter.service");
let GasControlModule = class GasControlModule {
};
exports.GasControlModule = GasControlModule;
exports.GasControlModule = GasControlModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [gas_control_service_1.GasControlService, master_control_reporter_service_1.MasterControlReporter],
        exports: [gas_control_service_1.GasControlService, master_control_reporter_service_1.MasterControlReporter],
    })
], GasControlModule);
//# sourceMappingURL=gas-control.module.js.map