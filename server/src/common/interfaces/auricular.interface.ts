export enum AuricularSensorType {
  PPG_FINGER = 'PPG_FINGER',
  PPG_EAR = 'PPG_EAR',
  BLOOD_OXYGEN = 'SPO2',
  PULSE_RATE = 'PULSE',
  PERFUSION_INDEX = 'PI',
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

const PPG_SCALING = { scale: 1, offset: 0, unit: 'counts', min: 0, max: 65535 } as const;
const SPO2_SCALING = { scale: 0.01, offset: 0, unit: '%', min: 50, max: 100 } as const;
const PULSE_SCALING = { scale: 0.01, offset: 0, unit: 'bpm', min: 30, max: 220 } as const;
const PI_SCALING = { scale: 0.001, offset: 0, unit: '%', min: 0, max: 20 } as const;

export const AURICULAR_FRAME_CONFIG = {
  PREAMBLE: 0xEB,
  FRAME_SIZE: 16,
  DIVER_ID_BYTE: 1,
  SENSOR_ID_BYTE: 2,
  DATA_START_BYTE: 3,
  DATA_LENGTH: 8,
  QUALITY_BYTE: 11,
  CHECKSUM_BYTE: 14,
  END_BYTE: 0x90,
  SENSOR_ID_MAP: {
    0xA0: AuricularSensorType.PPG_FINGER,
    0xA1: AuricularSensorType.PPG_EAR,
    0xA2: AuricularSensorType.BLOOD_OXYGEN,
    0xA3: AuricularSensorType.PULSE_RATE,
    0xA4: AuricularSensorType.PERFUSION_INDEX,
  },
  SENSOR_SCALING: {
    [AuricularSensorType.PPG_FINGER]: PPG_SCALING,
    [AuricularSensorType.PPG_EAR]: PPG_SCALING,
    [AuricularSensorType.BLOOD_OXYGEN]: SPO2_SCALING,
    [AuricularSensorType.PULSE_RATE]: PULSE_SCALING,
    [AuricularSensorType.PERFUSION_INDEX]: PI_SCALING,
  } as Record<AuricularSensorType, { scale: number; offset: number; unit: string; min: number; max: number }>,
};

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'fatal';

export type InterventionType =
  | 'CO2_SCRUBBER_BOOST'
  | 'O2_PURGE_PULSE'
  | 'EMERGENCY_O2_FLOOD'
  | 'CREW_ALERT'
  | 'MASTER_ABORT';

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
