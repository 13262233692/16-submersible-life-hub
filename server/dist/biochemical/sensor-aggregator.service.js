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
exports.SensorAggregatorService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
const biochemical_interface_1 = require("../common/interfaces/biochemical.interface");
let SensorAggregatorService = class SensorAggregatorService {
    logger;
    windowSize = 256;
    window = {
        o2PP: [],
        co2: [],
        pressure: [],
        temperature: [],
        humidity: [],
        timestamps: [],
    };
    lastState;
    lastO2Moles = 0;
    lastComputationTime = 0;
    constructor(logger) {
        this.logger = logger;
    }
    onModuleInit() {
        this.logger.setContext('SensorAggregator');
        this.lastComputationTime = Date.now();
        const initialPressure = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA;
        const initialO2PP = initialPressure * biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION;
        this.lastO2Moles = this.idealGasMoles(initialO2PP, biochemical_interface_1.BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS, 295);
    }
    ingest(reading) {
        const key = this.mapSensorToKey(reading.sensorType);
        if (!key)
            return;
        const arr = this.window[key];
        arr.push(reading.filteredValue);
        if (arr.length > this.windowSize)
            arr.shift();
        if (this.window.timestamps.length === 0 ||
            reading.timestamp > this.window.timestamps[this.window.timestamps.length - 1]) {
            this.window.timestamps.push(reading.timestamp);
            if (this.window.timestamps.length > this.windowSize)
                this.window.timestamps.shift();
        }
    }
    computeState() {
        if (!this.hasEnoughData())
            return this.lastState || null;
        const o2PP = this.movingAverage(this.window.o2PP, 64);
        const co2PPM = this.movingAverage(this.window.co2, 64);
        const absPressure = this.movingAverage(this.window.pressure, 64);
        const temperature = this.movingAverage(this.window.temperature, 32);
        const humidity = this.movingAverage(this.window.humidity, 32);
        if (o2PP === 0 || absPressure === 0)
            return this.lastState || null;
        const temperatureK = temperature + 273.15;
        const co2KPa = this.ppmTokPa(co2PPM, absPressure);
        const o2Fraction = Math.max(0.01, Math.min(0.6, o2PP / absPressure));
        const n2PP = Math.max(0, absPressure - o2PP - co2KPa - this.waterVaporPressure(temperatureK, humidity));
        const volumeLiters = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.CABIN_VOLUME_LITERS;
        const currentO2Moles = this.idealGasMoles(o2PP, volumeLiters, temperatureK);
        const currentCO2Moles = this.idealGasMoles(co2KPa, volumeLiters, temperatureK);
        const now = Date.now();
        const dtHours = Math.max(0.0001, (now - this.lastComputationTime) / (1000 * 3600));
        const crew = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.METABOLIC.CREW_COUNT;
        const rq = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.METABOLIC.RESPIRATORY_QUOTIENT;
        const theoreticalO2MolConsumption = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.METABOLIC.RESTING_O2_CONSUMPTION_LPM * 60 * crew * dtHours / 22.4;
        const actualO2DeltaMol = this.lastO2Moles !== 0 ? (this.lastO2Moles - currentO2Moles) : theoreticalO2MolConsumption;
        const o2ConsumptionRateLPH = Math.max(0, actualO2DeltaMol * 22.4 / dtHours);
        const co2ProductionRateLPH = o2ConsumptionRateLPH * rq;
        void currentCO2Moles;
        const metabolicRateFactor = this.lastO2Moles !== 0
            ? Math.min(3, Math.max(0.3, actualO2DeltaMol / Math.max(0.0001, theoreticalO2MolConsumption)))
            : 1;
        const o2ReserveMoles = Math.max(0, currentO2Moles - o2FractionMinKPa(absPressure) / 100 * volumeLiters / (8.314 * temperatureK));
        const o2ConsumptionRateMolPerHour = o2ConsumptionRateLPH / 22.4;
        const o2ReserveMinutes = o2ConsumptionRateMolPerHour > 0
            ? Math.max(0, Math.min(99999, (o2ReserveMoles / o2ConsumptionRateMolPerHour) * 60))
            : 99999;
        const safetyIndicators = this.computeSafetyIndicators(o2Fraction, co2PPM, absPressure);
        this.lastO2Moles = currentO2Moles;
        this.lastComputationTime = now;
        const state = {
            timestamp: now,
            oxygenFraction: +o2Fraction.toFixed(6),
            partialPressureO2: +o2PP.toFixed(4),
            partialPressureCO2: +co2KPa.toFixed(6),
            partialPressureN2: +n2PP.toFixed(4),
            absolutePressure: +absPressure.toFixed(4),
            temperature: +temperature.toFixed(3),
            humidity: +humidity.toFixed(2),
            metabolicO2ConsumptionRate: +o2ConsumptionRateLPH.toFixed(4),
            metabolicCO2ProductionRate: +co2ProductionRateLPH.toFixed(4),
            respiratoryQuotient: rq,
            o2ReserveMinutes: +o2ReserveMinutes.toFixed(1),
            cabinAirVolume: volumeLiters,
            safetyIndicators,
        };
        this.lastState = state;
        void metabolicRateFactor;
        return state;
    }
    hasEnoughData() {
        return (this.window.o2PP.length >= 8 &&
            this.window.co2.length >= 8 &&
            this.window.pressure.length >= 4);
    }
    mapSensorToKey(type) {
        switch (type) {
            case sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE: return 'o2PP';
            case sensor_interface_1.SensorType.CARBON_DIOXIDE: return 'co2';
            case sensor_interface_1.SensorType.ABSOLUTE_PRESSURE: return 'pressure';
            case sensor_interface_1.SensorType.TEMPERATURE: return 'temperature';
            case sensor_interface_1.SensorType.HUMIDITY: return 'humidity';
            default: return null;
        }
    }
    movingAverage(arr, window) {
        if (arr.length === 0)
            return 0;
        const n = Math.min(window, arr.length);
        let sum = 0;
        for (let i = arr.length - n; i < arr.length; i++)
            sum += arr[i];
        return sum / n;
    }
    idealGasMoles(pKPa, vLiters, tKelvin) {
        return (pKPa * vLiters) / (biochemical_interface_1.BIOCHEMICAL_CONSTANTS.IDEAL_GAS_CONSTANT * tKelvin);
    }
    ppmTokPa(ppm, totalKPa) {
        return (ppm / 1_000_000) * totalKPa;
    }
    waterVaporPressure(tKelvin, rhPercent) {
        const tC = tKelvin - 273.15;
        const satKPa = 0.61078 * Math.exp((17.27 * tC) / (tC + 237.3));
        return satKPa * (rhPercent / 100);
    }
    computeSafetyIndicators(o2Frac, co2PPM, pressureKPa) {
        const th = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.SAFETY_THRESHOLDS;
        let o2Status = 'normal';
        if (o2Frac < th.O2.MIN_SAFE || o2Frac > th.O2.MAX_TOXIC)
            o2Status = 'fatal';
        else if (o2Frac < th.O2.MIN_OPERATIONAL || o2Frac > th.O2.MAX_SAFE)
            o2Status = 'critical';
        else if (o2Frac < 0.20 || o2Frac > th.O2.MAX_OPERATIONAL)
            o2Status = 'warning';
        let co2Status = 'normal';
        if (co2PPM > th.CO2.FATAL)
            co2Status = 'fatal';
        else if (co2PPM > th.CO2.CRITICAL)
            co2Status = 'critical';
        else if (co2PPM > th.CO2.WARNING)
            co2Status = 'warning';
        let pressureStatus = 'normal';
        if (pressureKPa < th.PRESSURE.MIN_KPA || pressureKPa > th.PRESSURE.MAX_KPA)
            pressureStatus = 'critical';
        else if (pressureKPa < th.PRESSURE.OPTIMAL_MIN || pressureKPa > th.PRESSURE.OPTIMAL_MAX)
            pressureStatus = 'warning';
        const rank = { normal: 0, warning: 1, critical: 2, fatal: 3 };
        const overall = Math.max(rank[o2Status], rank[co2Status], rank[pressureStatus]);
        const overallStatus = ['normal', 'warning', 'critical', 'fatal'][overall];
        return { o2Status, co2Status, pressureStatus, overallStatus };
    }
    getLastState() {
        return this.lastState || null;
    }
    getWindowStats() {
        return {
            windowSize: this.windowSize,
            o2Samples: this.window.o2PP.length,
            co2Samples: this.window.co2.length,
            pressureSamples: this.window.pressure.length,
            tempSamples: this.window.temperature.length,
            humiditySamples: this.window.humidity.length,
        };
    }
};
exports.SensorAggregatorService = SensorAggregatorService;
exports.SensorAggregatorService = SensorAggregatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], SensorAggregatorService);
function o2FractionMinKPa(totalKPa) {
    const minFrac = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.SAFETY_THRESHOLDS.O2.MIN_OPERATIONAL;
    return minFrac * totalKPa * 1000;
}
//# sourceMappingURL=sensor-aggregator.service.js.map