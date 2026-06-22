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
exports.BiochemicalEngineService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
const serial_service_1 = require("../serial/serial.service");
const multi_channel_kalman_service_1 = require("../kalman/multi-channel-kalman.service");
const lock_free_ring_buffer_service_1 = require("../ring-buffer/lock-free-ring-buffer.service");
const sensor_aggregator_service_1 = require("./sensor-aggregator.service");
const diffusion_grid_service_1 = require("./diffusion-grid.service");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
const metabolic_lstm_service_1 = require("../metabolic/metabolic-lstm.service");
const acute_intervention_service_1 = require("../metabolic/acute-intervention.service");
let BiochemicalEngineService = class BiochemicalEngineService {
    logger;
    serial;
    kalman;
    ringBuffer;
    aggregator;
    diffusion;
    metabolicLstm;
    acuteIntervention;
    runLoop;
    gridLoop;
    lastState;
    lastGrid;
    diagnostics = {
        computeLatencyMs: 0,
        avgLatencyMs: 0,
        totalComputations: 0,
        framesDropped: 0,
        inputQueueSize: 0,
        lastStateAgeSec: 0,
    };
    latencies = [];
    stateListeners = [];
    gridListeners = [];
    engineStarted = false;
    computeIntervalMs = 10;
    gridIntervalMs = 33;
    backpressureLevel = 0;
    adaptiveThrottleEnabled = true;
    skippedGridTicks = 0;
    totalSkippedGrids = 0;
    alertListeners = [];
    constructor(logger, serial, kalman, ringBuffer, aggregator, diffusion, metabolicLstm, acuteIntervention) {
        this.logger = logger;
        this.serial = serial;
        this.kalman = kalman;
        this.ringBuffer = ringBuffer;
        this.aggregator = aggregator;
        this.diffusion = diffusion;
        this.metabolicLstm = metabolicLstm;
        this.acuteIntervention = acuteIntervention;
        this.logger.setContext('BiochemicalEngine');
    }
    onModuleInit() {
        this.logger.log('生化计算引擎初始化完成，启动数据管线...');
        this.serial.on('frameDecoded', (frame) => {
            if ('sensorType' in frame && 'unit' in frame) {
                this.onSensorFrame(frame);
            }
        });
        this.serial.on('vitalSigns', (sample) => {
            this.onVitalSigns(sample);
        });
        this.acuteIntervention.on('alert', (alert) => {
            for (const l of this.alertListeners) {
                try {
                    l(alert);
                }
                catch { }
            }
        });
        this.scheduleComputeLoop();
        this.scheduleGridLoop();
        this.engineStarted = true;
    }
    onModuleDestroy() {
        this.engineStarted = false;
        if (this.runLoop) {
            clearInterval(this.runLoop);
            this.runLoop = undefined;
        }
        if (this.gridLoop) {
            clearInterval(this.gridLoop);
            this.gridLoop = undefined;
        }
        this.stateListeners.length = 0;
        this.gridListeners.length = 0;
        this.lastState = undefined;
        this.lastGrid = undefined;
    }
    scheduleComputeLoop() {
        if (this.runLoop)
            clearInterval(this.runLoop);
        this.runLoop = setInterval(() => this.computeTick(), this.computeIntervalMs);
    }
    scheduleGridLoop() {
        if (this.gridLoop)
            clearInterval(this.gridLoop);
        this.gridLoop = setInterval(() => this.gridTick(), this.gridIntervalMs);
    }
    onSensorFrame(frame) {
        const filtered = this.kalman.apply(frame);
        if (filtered) {
            this.ringBuffer.push(filtered, filtered.timestamp);
        }
    }
    computeTick() {
        if (!this.engineStarted)
            return;
        const t0 = performance.now();
        const readings = this.ringBuffer.drain(4096);
        this.diagnostics.inputQueueSize = this.ringBuffer.size;
        for (const reading of readings) {
            this.aggregator.ingest(reading);
        }
        if (readings.length > 0) {
            const state = this.aggregator.computeState();
            if (state) {
                this.lastState = state;
                for (const listener of this.stateListeners) {
                    try {
                        listener(state);
                    }
                    catch (e) { }
                }
            }
        }
        const latency = performance.now() - t0;
        this.diagnostics.computeLatencyMs = +latency.toFixed(3);
        this.latencies.push(latency);
        if (this.latencies.length > 256)
            this.latencies.shift();
        this.diagnostics.avgLatencyMs = +(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(3);
        this.diagnostics.totalComputations++;
        if (latency > 50) {
            this.diagnostics.framesDropped++;
            if (this.diagnostics.framesDropped % 50 === 0) {
                this.logger.warn(`生化引擎性能告警: 单次延迟=${latency.toFixed(1)}ms, 总丢帧=${this.diagnostics.framesDropped}`);
            }
        }
        this.diagnostics.lastStateAgeSec = this.lastState
            ? +((Date.now() - this.lastState.timestamp) / 1000).toFixed(3)
            : 999;
    }
    gridTick() {
        if (!this.engineStarted || !this.lastState)
            return;
        if (this.adaptiveThrottleEnabled && this.backpressureLevel > 0) {
            const skipThreshold = Math.min(this.backpressureLevel, 5);
            if (this.skippedGridTicks < skipThreshold) {
                this.skippedGridTicks++;
                this.totalSkippedGrids++;
                return;
            }
            this.skippedGridTicks = 0;
        }
        try {
            const grid = this.diffusion.simulate(this.lastState);
            this.lastGrid = grid;
            for (const listener of this.gridListeners) {
                try {
                    listener(grid);
                }
                catch (e) { }
            }
        }
        catch (err) {
            this.logger.error(`扩散网格模拟失败: ${err.message}`, err.stack);
        }
    }
    onBiochemicalState(listener) {
        this.stateListeners.push(listener);
        return () => {
            const idx = this.stateListeners.indexOf(listener);
            if (idx >= 0)
                this.stateListeners.splice(idx, 1);
        };
    }
    onDiffusionGrid(listener) {
        this.gridListeners.push(listener);
        return () => {
            const idx = this.gridListeners.indexOf(listener);
            if (idx >= 0)
                this.gridListeners.splice(idx, 1);
        };
    }
    onAcuteCo2Alert(listener) {
        this.alertListeners.push(listener);
        return () => {
            const idx = this.alertListeners.indexOf(listener);
            if (idx >= 0)
                this.alertListeners.splice(idx, 1);
        };
    }
    getCurrentState() {
        return this.lastState || null;
    }
    getCurrentGrid() {
        return this.lastGrid || null;
    }
    getDiagnostics() {
        return { ...this.diagnostics };
    }
    setBackpressureLevel(level) {
        const clamped = Math.max(0, Math.min(5, level));
        if (clamped === this.backpressureLevel)
            return;
        const oldLevel = this.backpressureLevel;
        this.backpressureLevel = clamped;
        if (clamped > 0 && oldLevel === 0) {
            this.logger.warn(`生化引擎进入背压节流模式: 等级=${clamped}/5, 网格计算降频`);
        }
        else if (clamped === 0 && oldLevel > 0) {
            this.logger.log('生化引擎退出背压节流模式，恢复全速率计算');
        }
    }
    getBackpressureLevel() {
        return this.backpressureLevel;
    }
    setAdaptiveThrottle(enabled) {
        this.adaptiveThrottleEnabled = enabled;
    }
    getThrottleStats() {
        return {
            backpressureLevel: this.backpressureLevel,
            adaptiveThrottleEnabled: this.adaptiveThrottleEnabled,
            totalSkippedGrids: this.totalSkippedGrids,
            computeIntervalMs: this.computeIntervalMs,
            gridIntervalMs: this.gridIntervalMs,
        };
    }
    getKalmanChannelState(sensorType) {
        if (sensorType)
            return this.kalman.getChannelState(sensorType);
        return this.kalman.getAllChannelStates();
    }
    getRingBufferStats() {
        return this.ringBuffer.getStats();
    }
    getAggregatorStats() {
        return this.aggregator.getWindowStats();
    }
    getLatestReadings() {
        void sensor_interface_1.SensorType;
        return {};
    }
    onVitalSigns(sample) {
        if (!this.lastState)
            return;
        try {
            const prediction = this.metabolicLstm.ingestVitalSigns(sample, this.lastState);
            if (!prediction)
                return;
            const gradient = this.metabolicLstm.getLastGradient();
            if (!gradient)
                return;
            void this.acuteIntervention.evaluate(prediction, gradient, sample, this.lastState);
        }
        catch (err) {
            this.logger.error(`LSTM 代谢推演异常: ${err.message}`, err.stack);
        }
    }
    getRecentAlerts(limit = 20) {
        return this.acuteIntervention.getRecentAlerts(limit);
    }
    acknowledgeAlert(alertId) {
        return this.acuteIntervention.acknowledgeAlert(alertId);
    }
    triggerTestCrisis(diverId) {
        this.logger.warn(`⚠️ 手动触发急性 CO2 中毒危机测试 (diverId=${diverId ?? 'all'})`);
        this.serial.simulator?.triggerAcuteCo2Crisis?.(diverId);
    }
};
exports.BiochemicalEngineService = BiochemicalEngineService;
exports.BiochemicalEngineService = BiochemicalEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        serial_service_1.SerialService,
        multi_channel_kalman_service_1.MultiChannelKalmanFilter,
        lock_free_ring_buffer_service_1.LockFreeRingBuffer,
        sensor_aggregator_service_1.SensorAggregatorService,
        diffusion_grid_service_1.DiffusionGridService,
        metabolic_lstm_service_1.MetabolicLstmService,
        acute_intervention_service_1.AcuteInterventionService])
], BiochemicalEngineService);
//# sourceMappingURL=biochemical-engine.service.js.map