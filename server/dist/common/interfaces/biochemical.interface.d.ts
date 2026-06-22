export interface BiochemicalState {
    timestamp: number;
    oxygenFraction: number;
    partialPressureO2: number;
    partialPressureCO2: number;
    partialPressureN2: number;
    absolutePressure: number;
    temperature: number;
    humidity: number;
    metabolicO2ConsumptionRate: number;
    metabolicCO2ProductionRate: number;
    respiratoryQuotient: number;
    o2ReserveMinutes: number;
    cabinAirVolume: number;
    safetyIndicators: SafetyIndicators;
}
export interface SafetyIndicators {
    o2Status: 'normal' | 'warning' | 'critical' | 'fatal';
    co2Status: 'normal' | 'warning' | 'critical' | 'fatal';
    pressureStatus: 'normal' | 'warning' | 'critical' | 'fatal';
    overallStatus: 'normal' | 'warning' | 'critical' | 'fatal';
}
export interface GasDiffusionGrid {
    timestamp: number;
    width: number;
    height: number;
    o2Grid: Float32Array;
    co2Grid: Float32Array;
    pressureGrid: Float32Array;
    flowVX: Float32Array;
    flowVY: Float32Array;
}
export declare const BIOCHEMICAL_CONSTANTS: {
    readonly STANDARD_ATMOSPHERE_KPA: 101.325;
    readonly NOMINAL_O2_FRACTION: 0.2095;
    readonly NOMINAL_CO2_PPM: 400;
    readonly SAFETY_THRESHOLDS: {
        readonly O2: {
            readonly MIN_OPERATIONAL: 0.195;
            readonly MIN_SAFE: 0.16;
            readonly MAX_OPERATIONAL: 0.235;
            readonly MAX_SAFE: 0.25;
            readonly MAX_TOXIC: 0.4;
        };
        readonly CO2: {
            readonly NOMINAL: 400;
            readonly WARNING: 1000;
            readonly CRITICAL: 5000;
            readonly FATAL: 40000;
        };
        readonly PRESSURE: {
            readonly MIN_KPA: 70;
            readonly OPTIMAL_MIN: 95;
            readonly OPTIMAL_MAX: 105;
            readonly MAX_KPA: 120;
        };
    };
    readonly METABOLIC: {
        readonly RESTING_O2_CONSUMPTION_LPM: 0.28;
        readonly ACTIVE_O2_CONSUMPTION_LPM: 0.75;
        readonly RESPIRATORY_QUOTIENT: 0.85;
        readonly CREW_COUNT: 3;
    };
    readonly STANDARD_GAS_DENSITY: {
        readonly O2: 1.429;
        readonly N2: 1.251;
        readonly CO2: 1.977;
    };
    readonly MOLAR_MASS: {
        readonly O2: 31.998;
        readonly CO2: 44.01;
        readonly N2: 28.013;
        readonly AIR: 28.97;
    };
    readonly IDEAL_GAS_CONSTANT: 8.314462618;
    readonly CABIN_VOLUME_LITERS: 14500;
};
