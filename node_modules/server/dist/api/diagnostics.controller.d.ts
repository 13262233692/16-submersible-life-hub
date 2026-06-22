import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { SerialService } from '../serial/serial.service';
import { AppService } from '../app.service';
export declare class DiagnosticsController {
    private readonly engine;
    private readonly serial;
    private readonly app;
    constructor(engine: BiochemicalEngineService, serial: SerialService, app: AppService);
    getEngineDiag(): {
        timestamp: number;
        diagnostics: import("../biochemical/biochemical-engine.service").EngineDiagnostics;
    };
    getSerialStatus(): {
        timestamp: number;
        status: {
            isOpen: boolean;
            mode: string;
            frameCount: number;
            byteCount: number;
            frameRateFps: number;
            frameSizeBytes: number;
            uptimeSec: number;
            reconnectAttempts: number;
            reconnecting: boolean;
        };
    };
    getFullDiagnostics(): {
        timestamp: number;
        health: import("../app.service").SystemHealth;
        system: import("../app.service").SystemInfo;
        serial: {
            isOpen: boolean;
            mode: string;
            frameCount: number;
            byteCount: number;
            frameRateFps: number;
            frameSizeBytes: number;
            uptimeSec: number;
            reconnectAttempts: number;
            reconnecting: boolean;
        };
        engine: import("../biochemical/biochemical-engine.service").EngineDiagnostics;
        ringBuffer: {
            capacity: number;
            size: number;
            utilizationPercent: number;
            totalWrites: number;
            totalReads: number;
            overflowCount: number;
            isEmpty: boolean;
            isFull: boolean;
        };
        kalman: Record<string, unknown> | {
            spikesRejected: number;
            totalMeasurements: number;
            currentX: number;
            currentP: number;
        } | undefined;
        aggregator: {
            windowSize: number;
            o2Samples: number;
            co2Samples: number;
            pressureSamples: number;
            tempSamples: number;
            humiditySamples: number;
        };
    };
}
