"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIOCHEMICAL_CONSTANTS = void 0;
exports.BIOCHEMICAL_CONSTANTS = {
    STANDARD_ATMOSPHERE_KPA: 101.325,
    NOMINAL_O2_FRACTION: 0.2095,
    NOMINAL_CO2_PPM: 400,
    SAFETY_THRESHOLDS: {
        O2: {
            MIN_OPERATIONAL: 0.195,
            MIN_SAFE: 0.16,
            MAX_OPERATIONAL: 0.235,
            MAX_SAFE: 0.25,
            MAX_TOXIC: 0.40,
        },
        CO2: {
            NOMINAL: 400,
            WARNING: 1000,
            CRITICAL: 5000,
            FATAL: 40000,
        },
        PRESSURE: {
            MIN_KPA: 70,
            OPTIMAL_MIN: 95,
            OPTIMAL_MAX: 105,
            MAX_KPA: 120,
        },
    },
    METABOLIC: {
        RESTING_O2_CONSUMPTION_LPM: 0.28,
        ACTIVE_O2_CONSUMPTION_LPM: 0.75,
        RESPIRATORY_QUOTIENT: 0.85,
        CREW_COUNT: 3,
    },
    STANDARD_GAS_DENSITY: {
        O2: 1.429,
        N2: 1.251,
        CO2: 1.977,
    },
    MOLAR_MASS: {
        O2: 31.998,
        CO2: 44.01,
        N2: 28.013,
        AIR: 28.97,
    },
    IDEAL_GAS_CONSTANT: 8.314462618,
    CABIN_VOLUME_LITERS: 14500,
};
//# sourceMappingURL=biochemical.interface.js.map