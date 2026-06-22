"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSOR_FRAME_CONFIG = exports.SensorType = void 0;
var SensorType;
(function (SensorType) {
    SensorType["OXYGEN_PARTIAL_PRESSURE"] = "O2_PP";
    SensorType["CARBON_DIOXIDE"] = "CO2";
    SensorType["ABSOLUTE_PRESSURE"] = "P_ABS";
    SensorType["TEMPERATURE"] = "TEMP";
    SensorType["HUMIDITY"] = "HUM";
})(SensorType || (exports.SensorType = SensorType = {}));
exports.SENSOR_FRAME_CONFIG = {
    PREAMBLE: 0xAA,
    FRAME_SIZE: 12,
    SENSOR_ID_BYTE: 2,
    DATA_START_BYTE: 3,
    DATA_LENGTH: 4,
    CHECKSUM_BYTE: 10,
    END_BYTE: 0x55,
    SENSOR_ID_MAP: {
        0x01: SensorType.OXYGEN_PARTIAL_PRESSURE,
        0x02: SensorType.CARBON_DIOXIDE,
        0x03: SensorType.ABSOLUTE_PRESSURE,
        0x04: SensorType.TEMPERATURE,
        0x05: SensorType.HUMIDITY,
    },
    SENSOR_SCALING: {
        [SensorType.OXYGEN_PARTIAL_PRESSURE]: { scale: 0.001, offset: 0, unit: 'kPa', min: 0, max: 50 },
        [SensorType.CARBON_DIOXIDE]: { scale: 0.01, offset: 0, unit: 'ppm', min: 0, max: 10000 },
        [SensorType.ABSOLUTE_PRESSURE]: { scale: 0.01, offset: 0, unit: 'kPa', min: 80, max: 150 },
        [SensorType.TEMPERATURE]: { scale: 0.01, offset: -273.15, unit: '°C', min: -20, max: 60 },
        [SensorType.HUMIDITY]: { scale: 0.01, offset: 0, unit: '%RH', min: 0, max: 100 },
    },
};
//# sourceMappingURL=sensor.interface.js.map