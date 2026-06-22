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
exports.SimulatorService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
const auricular_interface_1 = require("../common/interfaces/auricular.interface");
let SimulatorService = class SimulatorService extends events_1.EventEmitter {
    sensors;
    diverVitals;
    timer;
    running = false;
    sampleIntervalMs = 5;
    tick = 0;
    co2CrisisMode = false;
    crisisTrigger = 0;
    constructor() {
        super();
        this.sensors = this.initializeSensors();
        this.diverVitals = this.initializeDiverVitals();
    }
    initializeSensors() {
        const map = new Map();
        map.set(sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE, {
            value: 21.0,
            trend: 0,
            noiseLevel: 0.08,
            spikeProbability: 0.002,
            min: 18,
            max: 25,
        });
        map.set(sensor_interface_1.SensorType.CARBON_DIOXIDE, {
            value: 800,
            trend: 0.3,
            noiseLevel: 15,
            spikeProbability: 0.003,
            min: 400,
            max: 10000,
        });
        map.set(sensor_interface_1.SensorType.ABSOLUTE_PRESSURE, {
            value: 101.3,
            trend: 0,
            noiseLevel: 0.05,
            spikeProbability: 0.001,
            min: 95,
            max: 110,
        });
        map.set(sensor_interface_1.SensorType.TEMPERATURE, {
            value: 23.5,
            trend: 0.01,
            noiseLevel: 0.05,
            spikeProbability: 0.0005,
            min: 18,
            max: 35,
        });
        map.set(sensor_interface_1.SensorType.HUMIDITY, {
            value: 55,
            trend: 0.02,
            noiseLevel: 0.3,
            spikeProbability: 0.001,
            min: 30,
            max: 80,
        });
        return map;
    }
    initializeDiverVitals() {
        const map = new Map();
        for (let i = 1; i <= 3; i++) {
            map.set(i, {
                diverId: i,
                pulseBpm: 72 + i * 3,
                spo2Percent: 98.2,
                perfusionIndex: 5.5,
                ppgAmplitude: 28000,
                stressMode: false,
                stressTimerTicks: 0,
            });
        }
        return map;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        this.sampleIntervalMs = parseInt(process.env.SIMULATOR_RATE || '5', 10);
        this.crisisTrigger = parseInt(process.env.CRISIS_TRIGGER_TICKS || '0', 10);
        this.timer = setInterval(() => this.generateTick(), this.sampleIntervalMs);
    }
    async stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    generateTick() {
        this.tick++;
        if (this.crisisTrigger > 0 && this.tick >= this.crisisTrigger && !this.co2CrisisMode) {
            this.triggerCo2Crisis();
        }
        this.generateSensorTick();
        if (this.tick % 2 === 0) {
            this.generateAuricularTick();
        }
    }
    triggerCo2Crisis() {
        this.co2CrisisMode = true;
        const co2 = this.sensors.get(sensor_interface_1.SensorType.CARBON_DIOXIDE);
        if (co2)
            co2.trend = 4.5;
        const o2 = this.sensors.get(sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE);
        if (o2)
            o2.trend = -0.01;
        for (const diver of this.diverVitals.values()) {
            diver.stressMode = true;
            diver.stressTimerTicks = 0;
            diver.pulseBpm = 120 + Math.random() * 30;
            diver.spo2Percent = 92.5;
            diver.perfusionIndex = 2.8;
        }
        this.emit('crisis:start', { timestamp: Date.now(), type: 'CO2_ACUTE' });
    }
    generateSensorTick() {
        const sensorsToEmit = [
            sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE,
            sensor_interface_1.SensorType.CARBON_DIOXIDE,
            sensor_interface_1.SensorType.ABSOLUTE_PRESSURE,
        ];
        if (this.tick % 4 === 0) {
            sensorsToEmit.push(sensor_interface_1.SensorType.TEMPERATURE, sensor_interface_1.SensorType.HUMIDITY);
        }
        for (const sensorType of sensorsToEmit) {
            const buffer = this.generateSensorFrame(sensorType);
            this.emit('data', buffer);
        }
    }
    generateAuricularTick() {
        const sensorTypes = [
            auricular_interface_1.AuricularSensorType.PULSE_RATE,
            auricular_interface_1.AuricularSensorType.BLOOD_OXYGEN,
            auricular_interface_1.AuricularSensorType.PERFUSION_INDEX,
            auricular_interface_1.AuricularSensorType.PPG_EAR,
        ];
        for (const [diverId, diver] of this.diverVitals) {
            if (diver.stressMode) {
                diver.stressTimerTicks++;
                diver.pulseBpm += (Math.random() - 0.3) * 2.0;
                diver.pulseBpm = Math.max(100, Math.min(180, diver.pulseBpm));
                diver.spo2Percent -= Math.random() * 0.08;
                diver.spo2Percent = Math.max(82, Math.min(95, diver.spo2Percent));
                diver.perfusionIndex -= Math.random() * 0.05;
                diver.perfusionIndex = Math.max(1.5, Math.min(5, diver.perfusionIndex));
            }
            else {
                diver.pulseBpm += (Math.random() - 0.5) * 0.6;
                diver.pulseBpm = Math.max(65, Math.min(90, diver.pulseBpm));
                diver.spo2Percent += (Math.random() - 0.5) * 0.05;
                diver.spo2Percent = Math.max(96, Math.min(99.5, diver.spo2Percent));
                diver.perfusionIndex += (Math.random() - 0.5) * 0.08;
                diver.perfusionIndex = Math.max(4, Math.min(7, diver.perfusionIndex));
            }
            diver.ppgAmplitude = 25000 + Math.random() * 8000;
            for (const sensorType of sensorTypes) {
                const buffer = this.generateAuricularFrame(diverId, sensorType, diver);
                this.emit('data', buffer);
            }
        }
    }
    generateSensorFrame(sensorType) {
        const sim = this.sensors.get(sensorType);
        sim.value += sim.trend * (0.5 + Math.random());
        sim.value += (Math.random() - 0.5) * sim.noiseLevel * 2;
        if (Math.random() < sim.spikeProbability) {
            const spikeAmp = (Math.random() - 0.5) * sim.value * 0.45;
            sim.value += spikeAmp;
        }
        sim.value = Math.max(sim.min, Math.min(sim.max, sim.value));
        const scaling = sensor_interface_1.SENSOR_FRAME_CONFIG.SENSOR_SCALING[sensorType];
        let rawInt = Math.round((sim.value - scaling.offset) / scaling.scale);
        if (rawInt < 0)
            rawInt = 0;
        if (rawInt > 0xFFFFFFFF)
            rawInt = 0xFFFFFFFF;
        const sensorIdKey = Object.entries(sensor_interface_1.SENSOR_FRAME_CONFIG.SENSOR_ID_MAP)
            .find(([, v]) => v === sensorType)?.[0];
        const sensorId = sensorIdKey ? parseInt(sensorIdKey, 10) : 0x01;
        const frame = [];
        frame.push(sensor_interface_1.SENSOR_FRAME_CONFIG.PREAMBLE);
        frame.push(sensorId & 0xFF);
        for (let i = 3; i >= 0; i--) {
            frame.push((rawInt >>> (i * 8)) & 0xFF);
        }
        frame.push(0x00);
        frame.push(0x00);
        let chk = 0;
        for (let i = 0; i < sensor_interface_1.SENSOR_FRAME_CONFIG.CHECKSUM_BYTE; i++) {
            while (frame.length <= i)
                frame.push(0x00);
            chk = (chk + frame[i]) & 0xFF;
        }
        frame[sensor_interface_1.SENSOR_FRAME_CONFIG.CHECKSUM_BYTE] = ((~chk + 1) & 0xFF);
        frame.push(0x00);
        frame.push(sensor_interface_1.SENSOR_FRAME_CONFIG.END_BYTE);
        while (frame.length < sensor_interface_1.SENSOR_FRAME_CONFIG.FRAME_SIZE) {
            frame.splice(frame.length - 2, 0, 0x00);
        }
        return Buffer.from(frame.slice(0, sensor_interface_1.SENSOR_FRAME_CONFIG.FRAME_SIZE));
    }
    generateAuricularFrame(diverId, sensorType, diver) {
        const scaling = auricular_interface_1.AURICULAR_FRAME_CONFIG.SENSOR_SCALING[sensorType];
        let value;
        switch (sensorType) {
            case auricular_interface_1.AuricularSensorType.PULSE_RATE:
                value = diver.pulseBpm;
                break;
            case auricular_interface_1.AuricularSensorType.BLOOD_OXYGEN:
                value = diver.spo2Percent;
                break;
            case auricular_interface_1.AuricularSensorType.PERFUSION_INDEX:
                value = diver.perfusionIndex;
                break;
            case auricular_interface_1.AuricularSensorType.PPG_EAR:
            default:
                value = diver.ppgAmplitude;
                break;
        }
        value += (Math.random() - 0.5) * scaling.scale * 10;
        value = Math.max(scaling.min, Math.min(scaling.max, value));
        let rawInt = Math.round((value - scaling.offset) / scaling.scale);
        if (rawInt < 0)
            rawInt = 0;
        if (rawInt > 0xFFFFFFFFFFFFFFFF)
            rawInt = 0xFFFFFFFFFFFFFFFF;
        const sensorIdKey = Object.entries(auricular_interface_1.AURICULAR_FRAME_CONFIG.SENSOR_ID_MAP)
            .find(([, v]) => v === sensorType)?.[0];
        const sensorId = sensorIdKey ? parseInt(sensorIdKey, 16) : 0xA1;
        const frame = [];
        frame.push(auricular_interface_1.AURICULAR_FRAME_CONFIG.PREAMBLE);
        frame.push(diverId & 0xFF);
        frame.push(sensorId & 0xFF);
        for (let i = 7; i >= 0; i--) {
            frame.push(Number((BigInt(rawInt) >> BigInt(i * 8)) & 0xffn));
        }
        frame.push(0x00);
        frame.push(0x00);
        frame.push(0x00);
        let chk = 0;
        for (let i = 0; i < auricular_interface_1.AURICULAR_FRAME_CONFIG.CHECKSUM_BYTE; i++) {
            while (frame.length <= i)
                frame.push(0x00);
            chk = (chk + frame[i]) & 0xFF;
        }
        frame[auricular_interface_1.AURICULAR_FRAME_CONFIG.CHECKSUM_BYTE] = ((~chk + 1) & 0xFF);
        frame.push(0x00);
        frame.push(auricular_interface_1.AURICULAR_FRAME_CONFIG.END_BYTE);
        return Buffer.from(frame.slice(0, auricular_interface_1.AURICULAR_FRAME_CONFIG.FRAME_SIZE));
    }
    forceSpike(sensorType, amplitudePercent = 30) {
        const sim = this.sensors.get(sensorType);
        if (sim) {
            sim.value += sim.value * (amplitudePercent / 100) * (Math.random() > 0.5 ? 1 : -1);
        }
    }
    setOxygenConsumptionRate(rateMultiplier) {
        const o2 = this.sensors.get(sensor_interface_1.SensorType.OXYGEN_PARTIAL_PRESSURE);
        if (o2) {
            o2.trend = -0.0015 * rateMultiplier;
        }
        const co2 = this.sensors.get(sensor_interface_1.SensorType.CARBON_DIOXIDE);
        if (co2) {
            co2.trend = 0.25 * rateMultiplier;
        }
    }
    triggerAcuteCo2Crisis(diverId) {
        this.triggerCo2Crisis();
        if (diverId !== undefined) {
            const d = this.diverVitals.get(diverId);
            if (d)
                d.stressMode = true;
        }
    }
    getCo2CrisisMode() {
        return this.co2CrisisMode;
    }
    getDiverVitalsSnapshot() {
        return Array.from(this.diverVitals.values()).map((d) => ({
            diverId: d.diverId,
            pulseBpm: +d.pulseBpm.toFixed(1),
            spo2Percent: +d.spo2Percent.toFixed(2),
            perfusionIndex: +d.perfusionIndex.toFixed(2),
            stressMode: d.stressMode,
        }));
    }
    onModuleDestroy() {
        void this.stop();
    }
};
exports.SimulatorService = SimulatorService;
exports.SimulatorService = SimulatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SimulatorService);
//# sourceMappingURL=simulator.service.js.map