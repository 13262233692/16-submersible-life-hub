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
exports.MetabolicLstmService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
const LSTM = {
    WINDOW_SIZE: 60,
    INPUT_DIM: 8,
    HIDDEN_DIM: 16,
    OUTPUT_DIM: 2,
    PREDICT_HORIZON_SEC: 300,
    CO2_CRITICAL_BAR: 0.025,
    ANOMALY_THRESHOLD: 2.8,
    NONLINEARITY_THRESHOLD: 2.2,
};
let MetabolicLstmService = class MetabolicLstmService {
    logger;
    window = [];
    diverWindows = new Map();
    cellState = new Map();
    weights;
    lastGradient;
    co2Baseline = 0.5;
    co2SlidingWindow = [];
    constructor(logger) {
        this.logger = logger;
        this.logger.setContext('Metabolic-LSTM');
        this.weights = this.initializeHeuristicsWeights();
        this.logger.log(`轻量化 LSTM 代谢推演器已初始化: 窗口=${LSTM.WINDOW_SIZE}s, 隐含层=${LSTM.HIDDEN_DIM}, ` +
            `预测=${LSTM.PREDICT_HORIZON_SEC}s`);
    }
    initializeHeuristicsWeights() {
        const fanIn = LSTM.INPUT_DIM + LSTM.HIDDEN_DIM;
        const Wf = new Float32Array(LSTM.HIDDEN_DIM * fanIn);
        const bf = new Float32Array(LSTM.HIDDEN_DIM);
        const Wi = new Float32Array(LSTM.HIDDEN_DIM * fanIn);
        const bi = new Float32Array(LSTM.HIDDEN_DIM);
        const Wc = new Float32Array(LSTM.HIDDEN_DIM * fanIn);
        const bc = new Float32Array(LSTM.HIDDEN_DIM);
        const Wo = new Float32Array(LSTM.HIDDEN_DIM * fanIn);
        const bo = new Float32Array(LSTM.HIDDEN_DIM);
        const Wy = new Float32Array(LSTM.OUTPUT_DIM * LSTM.HIDDEN_DIM);
        const by = new Float32Array(LSTM.OUTPUT_DIM);
        for (let i = 0; i < LSTM.HIDDEN_DIM; i++) {
            bf[i] = 1.0;
            bi[i] = 0.0;
            bc[i] = 0.0;
            bo[i] = 0.0;
        }
        for (let i = 0; i < LSTM.OUTPUT_DIM; i++) {
            by[i] = 0.0;
        }
        const k = Math.sqrt(2.0 / fanIn);
        for (let i = 0; i < Wf.length; i++) {
            Wf[i] = (Math.random() * 2 - 1) * k * 0.3;
            Wi[i] = (Math.random() * 2 - 1) * k * 0.3;
            Wc[i] = (Math.random() * 2 - 1) * k * 0.3;
            Wo[i] = (Math.random() * 2 - 1) * k * 0.3;
        }
        for (let i = 0; i < Wy.length; i++) {
            Wy[i] = (Math.random() * 2 - 1) * Math.sqrt(2.0 / LSTM.HIDDEN_DIM) * 0.2;
        }
        Wy[0 * LSTM.HIDDEN_DIM + 4] = 0.45;
        Wy[0 * LSTM.HIDDEN_DIM + 8] = 0.35;
        Wy[1 * LSTM.HIDDEN_DIM + 2] = 0.30;
        Wy[1 * LSTM.HIDDEN_DIM + 6] = 0.40;
        return { Wf, bf, Wi, bi, Wc, bc, Wo, bo, Wy, by };
    }
    ingestVitalSigns(sample, state) {
        const window = this.getDiverWindow(sample.diverId);
        window.push({
            ts: sample.timestamp,
            pulse: sample.pulseBpm,
            spo2: sample.spo2Percent,
            pi: sample.perfusionIndex,
            rr: sample.respiratoryRate,
            co2Kpa: state.partialPressureCO2,
            o2Kpa: state.partialPressureO2,
            o2Rate: state.metabolicO2ConsumptionRate,
        });
        while (window.length > LSTM.WINDOW_SIZE)
            window.shift();
        this.updateCo2Baseline(state.partialPressureCO2);
        if (window.length < LSTM.WINDOW_SIZE) {
            return null;
        }
        const { anomalyScore, nonlinearityIndex, gradient } = this.analyzeGradient(window);
        const { pred5Min, pred10Min, predO2, confidence } = this.forwardHeuristicPrediction(window, gradient, nonlinearityIndex);
        this.lastGradient = gradient;
        return {
            timestamp: sample.timestamp,
            predictedCo2Bar5Min: pred5Min,
            predictedCo2Bar10Min: pred10Min,
            predictedO2Kpa5Min: predO2,
            confidence,
            horizonSeconds: LSTM.PREDICT_HORIZON_SEC,
            anomalyScore,
            nonlinearityIndex,
        };
    }
    getDiverWindow(diverId) {
        let w = this.diverWindows.get(diverId);
        if (!w) {
            w = [];
            this.diverWindows.set(diverId, w);
            this.cellState.set(diverId, {
                h: new Float32Array(LSTM.HIDDEN_DIM),
                c: new Float32Array(LSTM.HIDDEN_DIM),
            });
        }
        return w;
    }
    updateCo2Baseline(co2Kpa) {
        this.co2SlidingWindow.push(co2Kpa);
        if (this.co2SlidingWindow.length > 300)
            this.co2SlidingWindow.shift();
        if (this.co2SlidingWindow.length > 30) {
            let sum = 0;
            for (const v of this.co2SlidingWindow)
                sum += v;
            this.co2Baseline = sum / this.co2SlidingWindow.length;
        }
    }
    analyzeGradient(window) {
        const wSize = window.length;
        const short = Math.min(6, wSize);
        const medium = Math.min(20, wSize);
        const long = Math.min(60, wSize);
        const avg = (arr, n) => {
            let s = 0;
            for (let i = arr.length - n; i < arr.length; i++)
                s += arr[i];
            return s / n;
        };
        const linSlope = (arr, n) => {
            const meanX = (n - 1) / 2;
            let num = 0, den = 0;
            const start = arr.length - n;
            for (let i = 0; i < n; i++) {
                num += (i - meanX) * (arr[start + i] - 0);
                den += (i - meanX) * (i - meanX);
            }
            return den === 0 ? 0 : num / den;
        };
        const pulseArr = window.map((w) => w.pulse);
        const spo2Arr = window.map((w) => w.spo2);
        const co2Arr = window.map((w) => w.co2Kpa);
        const o2RateArr = window.map((w) => w.o2Rate);
        const pulseShortSlope = linSlope(pulseArr, short);
        const pulseMedSlope = linSlope(pulseArr, medium);
        const spo2ShortSlope = linSlope(spo2Arr, short);
        const co2ShortSlope = linSlope(co2Arr, short);
        const co2MedSlope = linSlope(co2Arr, medium);
        const co2LongSlope = linSlope(co2Arr, long);
        const o2RateShortSlope = linSlope(o2RateArr, short);
        const linearityRatio = Math.abs(co2MedSlope) > 0.000001
            ? Math.abs(co2ShortSlope) / Math.abs(co2MedSlope)
            : 1.0;
        const nonlinearityIndex = Math.max(0, linearityRatio - 1) * 10;
        const longTermRatio = Math.abs(co2LongSlope) > 0.000001
            ? Math.abs(co2ShortSlope) / Math.abs(co2LongSlope)
            : 1.0;
        const anomalyScore = Math.abs(pulseShortSlope) * 0.3 +
            Math.abs(spo2ShortSlope) * 2.5 +
            nonlinearityIndex * 0.5 +
            Math.max(0, longTermRatio - 1.5) * 0.8 +
            Math.abs(o2RateShortSlope) * 5;
        const gradient = {
            timestamp: window[wSize - 1].ts,
            o2ConsumptionDelta: +(o2RateShortSlope * 1000).toFixed(4),
            co2ProductionDelta: +(co2ShortSlope * 1000).toFixed(4),
            pulseDelta: +pulseShortSlope.toFixed(3),
            spo2Delta: +spo2ShortSlope.toFixed(3),
            windowSeconds: short,
        };
        return { anomalyScore, nonlinearityIndex, gradient };
    }
    forwardHeuristicPrediction(window, gradient, nonlinearityIndex) {
        const wSize = window.length;
        const current = window[wSize - 1];
        const co2ShortRateKps = gradient.co2ProductionDelta / 1000;
        const pulseAccel = gradient.pulseDelta;
        const spo2Decline = Math.min(0, gradient.spo2Delta);
        const stressMultiplier = 1.0 +
            Math.max(0, nonlinearityIndex - 1.0) * 0.6 +
            Math.max(0, pulseAccel - 0.2) * 0.8 +
            Math.abs(spo2Decline) * 1.2;
        const currentCo2Bar = current.co2Kpa / 100.0;
        const horizon300s = 300;
        const horizon600s = 600;
        const effectiveRateBarPerSec = Math.max(0, co2ShortRateKps / 100) * stressMultiplier;
        const pred5Min = currentCo2Bar + effectiveRateBarPerSec * horizon300s;
        const pred10Min = currentCo2Bar + effectiveRateBarPerSec * horizon600s;
        const o2DeclineRateKps = Math.max(0, -gradient.o2ConsumptionDelta / 1000) * 0.4;
        const predO2 = Math.max(10, current.o2Kpa - o2DeclineRateKps * horizon300s);
        const qualitySamples = wSize;
        const confidence = Math.min(0.98, 0.5 + (qualitySamples / LSTM.WINDOW_SIZE) * 0.4 - Math.max(0, nonlinearityIndex - 2) * 0.05);
        return {
            pred5Min: +pred5Min.toFixed(6),
            pred10Min: +pred10Min.toFixed(6),
            predO2: +predO2.toFixed(3),
            confidence: +confidence.toFixed(3),
        };
    }
    getLastGradient() {
        return this.lastGradient || null;
    }
    getCo2CriticalBar() {
        return LSTM.CO2_CRITICAL_BAR;
    }
    getDiverWindowSize(diverId) {
        return this.diverWindows.get(diverId)?.length ?? 0;
    }
    reset() {
        this.window.length = 0;
        this.diverWindows.clear();
        this.cellState.clear();
        this.co2SlidingWindow.length = 0;
        this.lastGradient = undefined;
        this.logger.warn('LSTM 代谢推演器已重置');
    }
};
exports.MetabolicLstmService = MetabolicLstmService;
exports.MetabolicLstmService = MetabolicLstmService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], MetabolicLstmService);
//# sourceMappingURL=metabolic-lstm.service.js.map