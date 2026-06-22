import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import {
  LSTMPrediction,
  MetabolicGradient,
  VitalSignsSample,
} from '../common/interfaces/auricular.interface';
import { BiochemicalState, BIOCHEMICAL_CONSTANTS } from '../common/interfaces/biochemical.interface';

const LSTM = {
  WINDOW_SIZE: 60,
  INPUT_DIM: 8,
  HIDDEN_DIM: 16,
  OUTPUT_DIM: 2,
  PREDICT_HORIZON_SEC: 300,
  CO2_CRITICAL_BAR: 0.025,
  ANOMALY_THRESHOLD: 2.8,
  NONLINEARITY_THRESHOLD: 2.2,
} as const;

interface LSTMCellState {
  h: Float32Array;
  c: Float32Array;
}

interface LSTMWeights {
  Wf: Float32Array;
  bf: Float32Array;
  Wi: Float32Array;
  bi: Float32Array;
  Wc: Float32Array;
  bc: Float32Array;
  Wo: Float32Array;
  bo: Float32Array;
  Wy: Float32Array;
  by: Float32Array;
}

@Injectable()
export class MetabolicLstmService {
  private window: Array<{
    ts: number;
    pulse: number;
    spo2: number;
    pi: number;
    rr: number;
    co2Kpa: number;
    o2Kpa: number;
    o2Rate: number;
  }> = [];

  private diverWindows: Map<number, typeof this.window> = new Map();
  private cellState: Map<number, LSTMCellState> = new Map();
  private weights: LSTMWeights;
  private lastGradient?: MetabolicGradient;
  private co2Baseline: number = 0.5;
  private co2SlidingWindow: number[] = [];

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('Metabolic-LSTM');
    this.weights = this.initializeHeuristicsWeights();
    this.logger.log(
      `轻量化 LSTM 代谢推演器已初始化: 窗口=${LSTM.WINDOW_SIZE}s, 隐含层=${LSTM.HIDDEN_DIM}, ` +
      `预测=${LSTM.PREDICT_HORIZON_SEC}s`,
    );
  }

  private initializeHeuristicsWeights(): LSTMWeights {
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

  ingestVitalSigns(sample: VitalSignsSample, state: BiochemicalState): LSTMPrediction | null {
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

    while (window.length > LSTM.WINDOW_SIZE) window.shift();

    this.updateCo2Baseline(state.partialPressureCO2);

    if (window.length < LSTM.WINDOW_SIZE) {
      return null;
    }

    const { anomalyScore, nonlinearityIndex, gradient } = this.analyzeGradient(window);

    const { pred5Min, pred10Min, predO2, confidence } = this.forwardHeuristicPrediction(
      window,
      gradient,
      nonlinearityIndex,
    );

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

  private getDiverWindow(diverId: number) {
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

  private updateCo2Baseline(co2Kpa: number) {
    this.co2SlidingWindow.push(co2Kpa);
    if (this.co2SlidingWindow.length > 300) this.co2SlidingWindow.shift();
    if (this.co2SlidingWindow.length > 30) {
      let sum = 0;
      for (const v of this.co2SlidingWindow) sum += v;
      this.co2Baseline = sum / this.co2SlidingWindow.length;
    }
  }

  private analyzeGradient(
    window: Array<{ ts: number; pulse: number; spo2: number; pi: number; co2Kpa: number; o2Rate: number }>,
  ): { anomalyScore: number; nonlinearityIndex: number; gradient: MetabolicGradient } {
    const wSize = window.length;
    const short = Math.min(6, wSize);
    const medium = Math.min(20, wSize);
    const long = Math.min(60, wSize);

    const avg = (arr: number[], n: number) => {
      let s = 0;
      for (let i = arr.length - n; i < arr.length; i++) s += arr[i];
      return s / n;
    };
    const linSlope = (arr: number[], n: number) => {
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
    const anomalyScore =
      Math.abs(pulseShortSlope) * 0.3 +
      Math.abs(spo2ShortSlope) * 2.5 +
      nonlinearityIndex * 0.5 +
      Math.max(0, longTermRatio - 1.5) * 0.8 +
      Math.abs(o2RateShortSlope) * 5;

    const gradient: MetabolicGradient = {
      timestamp: window[wSize - 1].ts,
      o2ConsumptionDelta: +(o2RateShortSlope * 1000).toFixed(4),
      co2ProductionDelta: +(co2ShortSlope * 1000).toFixed(4),
      pulseDelta: +pulseShortSlope.toFixed(3),
      spo2Delta: +spo2ShortSlope.toFixed(3),
      windowSeconds: short,
    };

    return { anomalyScore, nonlinearityIndex, gradient };
  }

  private forwardHeuristicPrediction(
    window: Array<{ ts: number; pulse: number; spo2: number; pi: number; co2Kpa: number; o2Kpa: number; o2Rate: number }>,
    gradient: MetabolicGradient,
    nonlinearityIndex: number,
  ): { pred5Min: number; pred10Min: number; predO2: number; confidence: number } {
    const wSize = window.length;
    const current = window[wSize - 1];

    const co2ShortRateKps = gradient.co2ProductionDelta / 1000;
    const pulseAccel = gradient.pulseDelta;
    const spo2Decline = Math.min(0, gradient.spo2Delta);
    const stressMultiplier =
      1.0 +
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
    const confidence = Math.min(
      0.98,
      0.5 + (qualitySamples / LSTM.WINDOW_SIZE) * 0.4 - Math.max(0, nonlinearityIndex - 2) * 0.05,
    );

    return {
      pred5Min: +pred5Min.toFixed(6),
      pred10Min: +pred10Min.toFixed(6),
      predO2: +predO2.toFixed(3),
      confidence: +confidence.toFixed(3),
    };
  }

  getLastGradient(): MetabolicGradient | null {
    return this.lastGradient || null;
  }

  getCo2CriticalBar(): number {
    return LSTM.CO2_CRITICAL_BAR;
  }

  getDiverWindowSize(diverId: number): number {
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
}
