export declare enum AuricularSensorType {
    PPG_FINGER = "PPG_FINGER",
    PPG_EAR = "PPG_EAR",
    BLOOD_OXYGEN = "SPO2",
    PULSE_RATE = "PULSE",
    PERFUSION_INDEX = "PI"
}
export interface AuricularRawFrame {
    timestamp: number;
    sensorType: AuricularSensorType;
    rawHex: string;
    rawValue: number;
    checksumValid: boolean;
    diverId: number;
}
export interface DecodedAuricularData {
    timestamp: number;
    diverId: number;
    sensorType: AuricularSensorType;
    value: number;
    unit: string;
    rawHex: string;
    quality: number;
}
export interface VitalSignsSample {
    timestamp: number;
    diverId: number;
    pulseBpm: number;
    spo2Percent: number;
    perfusionIndex: number;
    ppgAmplitude: number;
    respiratoryRate: number;
}
export declare const AURICULAR_FRAME_CONFIG: {
    PREAMBLE: number;
    FRAME_SIZE: number;
    DIVER_ID_BYTE: number;
    SENSOR_ID_BYTE: number;
    DATA_START_BYTE: number;
    DATA_LENGTH: number;
    QUALITY_BYTE: number;
    CHECKSUM_BYTE: number;
    END_BYTE: number;
    SENSOR_ID_MAP: {
        160: AuricularSensorType;
        161: AuricularSensorType;
        162: AuricularSensorType;
        163: AuricularSensorType;
        164: AuricularSensorType;
    };
    SENSOR_SCALING: Record<AuricularSensorType, {
        scale: number;
        offset: number;
        unit: string;
        min: number;
        max: number;
    }>;
};
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'fatal';
export type InterventionType = 'CO2_SCRUBBER_BOOST' | 'O2_PURGE_PULSE' | 'EMERGENCY_O2_FLOOD' | 'CREW_ALERT' | 'MASTER_ABORT';
export interface MetabolicGradient {
    o2ConsumptionDelta: number;
    co2ProductionDelta: number;
    pulseDelta: number;
    spo2Delta: number;
    timestamp: number;
    windowSeconds: number;
}
export interface LSTMPrediction {
    timestamp: number;
    predictedCo2Bar5Min: number;
    predictedCo2Bar10Min: number;
    predictedO2Kpa5Min: number;
    confidence: number;
    horizonSeconds: number;
    anomalyScore: number;
    nonlinearityIndex: number;
}
export interface AcuteCo2Alert {
    alertId: string;
    timestamp: number;
    severity: AlertSeverity;
    title: string;
    message: string;
    triggeringDiverId: number;
    lstmPrediction: LSTMPrediction;
    gradient: MetabolicGradient;
    interventionCommands: InterventionType[];
    co2CriticalBar: number;
    timeToBreachSec: number;
    acknowledged: boolean;
}
