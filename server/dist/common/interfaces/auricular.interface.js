"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AURICULAR_FRAME_CONFIG = exports.AuricularSensorType = void 0;
var AuricularSensorType;
(function (AuricularSensorType) {
    AuricularSensorType["PPG_FINGER"] = "PPG_FINGER";
    AuricularSensorType["PPG_EAR"] = "PPG_EAR";
    AuricularSensorType["BLOOD_OXYGEN"] = "SPO2";
    AuricularSensorType["PULSE_RATE"] = "PULSE";
    AuricularSensorType["PERFUSION_INDEX"] = "PI";
})(AuricularSensorType || (exports.AuricularSensorType = AuricularSensorType = {}));
const PPG_SCALING = { scale: 1, offset: 0, unit: 'counts', min: 0, max: 65535 };
const SPO2_SCALING = { scale: 0.01, offset: 0, unit: '%', min: 50, max: 100 };
const PULSE_SCALING = { scale: 0.01, offset: 0, unit: 'bpm', min: 30, max: 220 };
const PI_SCALING = { scale: 0.001, offset: 0, unit: '%', min: 0, max: 20 };
exports.AURICULAR_FRAME_CONFIG = {
    PREAMBLE: 0xEB,
    FRAME_SIZE: 16,
    DIVER_ID_BYTE: 1,
    SENSOR_ID_BYTE: 2,
    DATA_START_BYTE: 3,
    DATA_LENGTH: 8,
    QUALITY_BYTE: 11,
    CHECKSUM_BYTE: 14,
    END_BYTE: 0x90,
    SENSOR_ID_MAP: {
        0xA0: AuricularSensorType.PPG_FINGER,
        0xA1: AuricularSensorType.PPG_EAR,
        0xA2: AuricularSensorType.BLOOD_OXYGEN,
        0xA3: AuricularSensorType.PULSE_RATE,
        0xA4: AuricularSensorType.PERFUSION_INDEX,
    },
    SENSOR_SCALING: {
        [AuricularSensorType.PPG_FINGER]: PPG_SCALING,
        [AuricularSensorType.PPG_EAR]: PPG_SCALING,
        [AuricularSensorType.BLOOD_OXYGEN]: SPO2_SCALING,
        [AuricularSensorType.PULSE_RATE]: PULSE_SCALING,
        [AuricularSensorType.PERFUSION_INDEX]: PI_SCALING,
    },
};
//# sourceMappingURL=auricular.interface.js.map