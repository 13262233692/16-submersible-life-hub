import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';
export declare class BiochemicalController {
    private readonly engine;
    constructor(engine: BiochemicalEngineService);
    getState(): {
        timestamp: number;
        latencyMs: number;
        state: BiochemicalState | null;
    };
    getGrid(): {
        timestamp: number;
        grid: GasDiffusionGrid | null;
    };
    getCompactGrid(): {
        timestamp: number;
        grid: null;
        w?: undefined;
        h?: undefined;
        o2?: undefined;
        co2?: undefined;
        vx?: undefined;
        vy?: undefined;
    } | {
        timestamp: number;
        w: number;
        h: number;
        o2: number[];
        co2: number[];
        vx: number[];
        vy: number[];
        grid?: undefined;
    };
}
