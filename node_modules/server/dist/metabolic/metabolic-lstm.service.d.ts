import { LoggerService } from '../common/logger/logger.service';
import { LSTMPrediction, MetabolicGradient, VitalSignsSample } from '../common/interfaces/auricular.interface';
import { BiochemicalState } from '../common/interfaces/biochemical.interface';
export declare class MetabolicLstmService {
    private readonly logger;
    private window;
    private diverWindows;
    private cellState;
    private weights;
    private lastGradient?;
    private co2Baseline;
    private co2SlidingWindow;
    constructor(logger: LoggerService);
    private initializeHeuristicsWeights;
    ingestVitalSigns(sample: VitalSignsSample, state: BiochemicalState): LSTMPrediction | null;
    private getDiverWindow;
    private updateCo2Baseline;
    private analyzeGradient;
    private forwardHeuristicPrediction;
    getLastGradient(): MetabolicGradient | null;
    getCo2CriticalBar(): number;
    getDiverWindowSize(diverId: number): number;
    reset(): void;
}
