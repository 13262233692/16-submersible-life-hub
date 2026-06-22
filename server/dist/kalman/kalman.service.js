"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KalmanFilterService = void 0;
const DEFAULT_CONFIGS = {
    O2_PP: {
        processNoiseQ: 0.0015,
        measurementNoiseR: 0.05,
        estimationErrorP: 1.0,
        initialValue: 21.0,
        adaptiveSensitivity: 0.8,
    },
    CO2: {
        processNoiseQ: 0.08,
        measurementNoiseR: 25,
        estimationErrorP: 100,
        initialValue: 800,
        adaptiveSensitivity: 0.6,
    },
    P_ABS: {
        processNoiseQ: 0.0008,
        measurementNoiseR: 0.03,
        estimationErrorP: 0.5,
        initialValue: 101.3,
        adaptiveSensitivity: 0.9,
    },
    TEMP: {
        processNoiseQ: 0.0002,
        measurementNoiseR: 0.02,
        estimationErrorP: 0.1,
        initialValue: 23.5,
        adaptiveSensitivity: 0.95,
    },
    HUM: {
        processNoiseQ: 0.005,
        measurementNoiseR: 0.2,
        estimationErrorP: 1.0,
        initialValue: 55,
        adaptiveSensitivity: 0.7,
    },
};
class KalmanFilterService {
    logger;
    x;
    p;
    k;
    q;
    r;
    config;
    innovationBuffer = [];
    lastMeasurement;
    spikeDetectionCount = 0;
    outlierRejectedCount = 0;
    constructor(configKey, logger) {
        this.logger = logger;
        const key = configKey || 'O2_PP';
        this.logger.setContext('KalmanFilter');
        this.config = { ...(DEFAULT_CONFIGS[key] || DEFAULT_CONFIGS.O2_PP) };
        this.x = this.config.initialValue;
        this.p = this.config.estimationErrorP;
        this.q = this.config.processNoiseQ;
        this.r = this.config.measurementNoiseR;
        this.k = 0;
    }
    filter(measurement, timestamp) {
        const dt = timestamp && this.lastMeasurement !== undefined
            ? Math.max(0.001, (timestamp - (this.lastMeasurementTimestamp ?? timestamp)) / 1000)
            : 0.005;
        this.lastMeasurementTimestamp = timestamp;
        const qAdaptive = this.q * Math.sqrt(dt / 0.005) * this.adaptiveProcessFactor(measurement);
        const pPredicted = this.p + qAdaptive;
        const residual = measurement - this.x;
        this.innovationBuffer.push(residual);
        if (this.innovationBuffer.length > 64)
            this.innovationBuffer.shift();
        const { mean, std } = this.computeInnovationStats();
        const normalizedInnovation = std > 0 ? Math.abs(residual - mean) / (std + 1e-9) : 0;
        const spikeThreshold = 3.2 * this.config.adaptiveSensitivity;
        const isSpike = normalizedInnovation > spikeThreshold;
        let measurementR = this.r;
        let adaptiveFactor = 1;
        if (isSpike) {
            this.spikeDetectionCount++;
            this.outlierRejectedCount++;
            measurementR = this.r * Math.pow(2, normalizedInnovation - spikeThreshold + 1);
            adaptiveFactor = Math.min(0.15, 1 / (normalizedInnovation * 0.5));
        }
        else if (normalizedInnovation > 1.5) {
            measurementR = this.r * (1 + (normalizedInnovation - 1.5) * 0.5);
            adaptiveFactor = Math.max(0.4, 1 - (normalizedInnovation - 1.5) * 0.2);
        }
        this.k = pPredicted / (pPredicted + measurementR);
        const effectiveK = this.k * adaptiveFactor;
        this.x = this.x + effectiveK * residual;
        this.p = (1 - effectiveK) * pPredicted;
        this.lastMeasurement = measurement;
        if (this.spikeDetectionCount > 0 && this.spikeDetectionCount % 1000 === 0) {
            this.logger.warn(`卡尔曼滤波统计: 剔除离群=${this.outlierRejectedCount} 次, ` +
                `当前增益=${this.k.toFixed(4)}, 协方差=${this.p.toExponential(3)}, ` +
                `残差=±${std.toFixed(4)}`);
        }
        return {
            filtered: this.x,
            innovation: residual,
            kalmanGain: this.k,
            errorCovariance: this.p,
            isSpike,
            adaptiveFactor,
        };
    }
    adaptiveProcessFactor(measurement) {
        if (this.lastMeasurement === undefined)
            return 1;
        const absDelta = Math.abs(measurement - this.lastMeasurement);
        if (absDelta > this.r * 0.5) {
            return 1 + Math.min(5, absDelta / (this.r * 0.5));
        }
        return 1;
    }
    lastMeasurementTimestamp;
    computeInnovationStats() {
        const n = this.innovationBuffer.length;
        if (n === 0)
            return { mean: 0, std: 1 };
        let sum = 0;
        for (let i = 0; i < n; i++)
            sum += this.innovationBuffer[i];
        const mean = sum / n;
        let sqSum = 0;
        for (let i = 0; i < n; i++) {
            const d = this.innovationBuffer[i] - mean;
            sqSum += d * d;
        }
        const std = Math.sqrt(sqSum / Math.max(1, n - 1));
        return { mean, std };
    }
    getEstimate() { return this.x; }
    getErrorCovariance() { return this.p; }
    getStats() {
        return {
            spikesRejected: this.outlierRejectedCount,
            totalMeasurements: this.lastMeasurement ? this.innovationBuffer.length : 0,
            currentX: this.x,
            currentP: this.p,
        };
    }
    reset(value) {
        this.x = value ?? this.config.initialValue;
        this.p = this.config.estimationErrorP;
        this.innovationBuffer.length = 0;
    }
}
exports.KalmanFilterService = KalmanFilterService;
//# sourceMappingURL=kalman.service.js.map