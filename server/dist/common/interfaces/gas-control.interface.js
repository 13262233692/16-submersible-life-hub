"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValveFaultCode = exports.CommandPriority = exports.ValveAction = exports.ValveId = void 0;
var ValveId;
(function (ValveId) {
    ValveId["O2_SUPPLY_PRIMARY"] = "V-O2-01";
    ValveId["O2_SUPPLY_SECONDARY"] = "V-O2-02";
    ValveId["CO2_SCRUBBER_A"] = "V-CO2-A";
    ValveId["CO2_SCRUBBER_B"] = "V-CO2-B";
    ValveId["N2_BALLAST"] = "V-N2-BAL";
    ValveId["EMERGENCY_O2"] = "V-O2-EMG";
    ValveId["CABIN_VENT"] = "V-VENT-01";
})(ValveId || (exports.ValveId = ValveId = {}));
var ValveAction;
(function (ValveAction) {
    ValveAction["OPEN"] = "OPEN";
    ValveAction["CLOSE"] = "CLOSE";
    ValveAction["PULSE"] = "PULSE";
    ValveAction["CALIBRATE"] = "CALIBRATE";
})(ValveAction || (exports.ValveAction = ValveAction = {}));
var CommandPriority;
(function (CommandPriority) {
    CommandPriority[CommandPriority["CRITICAL"] = 0] = "CRITICAL";
    CommandPriority[CommandPriority["HIGH"] = 1] = "HIGH";
    CommandPriority[CommandPriority["NORMAL"] = 2] = "NORMAL";
    CommandPriority[CommandPriority["LOW"] = 3] = "LOW";
})(CommandPriority || (exports.CommandPriority = CommandPriority = {}));
var ValveFaultCode;
(function (ValveFaultCode) {
    ValveFaultCode[ValveFaultCode["NONE"] = 0] = "NONE";
    ValveFaultCode[ValveFaultCode["STUCK_OPEN"] = 1] = "STUCK_OPEN";
    ValveFaultCode[ValveFaultCode["STUCK_CLOSED"] = 2] = "STUCK_CLOSED";
    ValveFaultCode[ValveFaultCode["POSITION_ERROR"] = 3] = "POSITION_ERROR";
    ValveFaultCode[ValveFaultCode["OVERCURRENT"] = 4] = "OVERCURRENT";
    ValveFaultCode[ValveFaultCode["SENSOR_FAULT"] = 5] = "SENSOR_FAULT";
    ValveFaultCode[ValveFaultCode["COMM_TIMEOUT"] = 6] = "COMM_TIMEOUT";
})(ValveFaultCode || (exports.ValveFaultCode = ValveFaultCode = {}));
//# sourceMappingURL=gas-control.interface.js.map