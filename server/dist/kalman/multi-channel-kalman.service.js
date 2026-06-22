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
exports.MultiChannelKalmanFilter = void 0;
const common_1 = require("@nestjs/common");
const kalman_service_1 = require("./kalman.service");
const logger_service_1 = require("../common/logger/logger.service");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
let MultiChannelKalmanFilter = class MultiChannelKalmanFilter {
    logger;
    filterMap = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    onModuleInit() {
        this.logger.setContext('MultiKalman');
        this.filterMap.set(sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE, new kalman_service_1.KalmanFilterService('O2_PP', this.logger));
        this.filterMap.set(sensor_interface_1.SensorType.CARBON_DIOXIDE, new kalman_service_1.KalmanFilterService('CO2', this.logger));
        this.filterMap.set(sensor_interface_1.SensorType.ABSOLUTE_PRESSURE, new kalman_service_1.KalmanFilterService('P_ABS', this.logger));
        this.filterMap.set(sensor_interface_1.SensorType.TEMPERATURE, new kalman_service_1.KalmanFilterService('TEMP', this.logger));
        this.filterMap.set(sensor_interface_1.SensorType.HUMIDITY, new kalman_service_1.KalmanFilterService('HUM', this.logger));
        this.logger.log('多通道卡尔曼滤波器已初始化 (5 通道)');
    }
    apply(sensor) {
        const filter = this.filterMap.get(sensor.sensorType);
        if (!filter)
            return null;
        const result = filter.filter(sensor.value, sensor.timestamp);
        return {
            timestamp: sensor.timestamp,
            sensorType: sensor.sensorType,
            rawValue: sensor.value,
            filteredValue: result.filtered,
            unit: sensor.unit,
            innovation: result.innovation,
            kalmanGain: result.kalmanGain,
            isSpikeRejected: result.isSpike,
            adaptiveFactor: result.adaptiveFactor,
        };
    }
    getChannelState(sensorType) {
        return this.filterMap.get(sensorType)?.getStats();
    }
    getAllChannelStates() {
        const result = {};
        for (const [key, filter] of this.filterMap.entries()) {
            result[key] = filter.getStats();
        }
        return result;
    }
    resetChannel(sensorType, value) {
        this.filterMap.get(sensorType)?.reset(value);
    }
};
exports.MultiChannelKalmanFilter = MultiChannelKalmanFilter;
exports.MultiChannelKalmanFilter = MultiChannelKalmanFilter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], MultiChannelKalmanFilter);
//# sourceMappingURL=multi-channel-kalman.service.js.map