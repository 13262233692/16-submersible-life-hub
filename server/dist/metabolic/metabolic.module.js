"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetabolicModule = void 0;
const common_1 = require("@nestjs/common");
const metabolic_lstm_service_1 = require("./metabolic-lstm.service");
const acute_intervention_service_1 = require("./acute-intervention.service");
const serial_module_1 = require("../serial/serial.module");
const gas_control_module_1 = require("../gas-control/gas-control.module");
let MetabolicModule = class MetabolicModule {
};
exports.MetabolicModule = MetabolicModule;
exports.MetabolicModule = MetabolicModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => serial_module_1.SerialModule), (0, common_1.forwardRef)(() => gas_control_module_1.GasControlModule)],
        providers: [metabolic_lstm_service_1.MetabolicLstmService, acute_intervention_service_1.AcuteInterventionService],
        exports: [metabolic_lstm_service_1.MetabolicLstmService, acute_intervention_service_1.AcuteInterventionService],
    })
], MetabolicModule);
//# sourceMappingURL=metabolic.module.js.map