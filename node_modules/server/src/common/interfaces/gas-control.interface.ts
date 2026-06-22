export interface ValveControlCommand {
  commandId: string;
  timestamp: number;
  valveId: ValveId;
  action: ValveAction;
  pulseWidthMs: number;
  targetPressureDeltaKPa: number;
  priority: CommandPriority;
  authorizer: 'automatic' | 'manual-override' | 'ground-control';
  expectedCompletionTime: number;
}

export interface ValveStatusReport {
  reportId: string;
  timestamp: number;
  valveId: ValveId;
  currentState: 'open' | 'closed' | 'transitioning';
  lastCommandId?: string;
  totalOpenDurationMs: number;
  cycleCount: number;
  faultCode?: ValveFaultCode;
}

export interface MasterControlReport {
  reportId: string;
  timestamp: number;
  vehicleId: string;
  missionPhase: string;
  allValvesStatus: Record<string, ValveStatusReport>;
  biochemicalSnapshot: unknown;
  controlAlgorithmState: string;
  nextScheduledAction?: string;
  checksum: string;
}

export enum ValveId {
  O2_SUPPLY_PRIMARY = 'V-O2-01',
  O2_SUPPLY_SECONDARY = 'V-O2-02',
  CO2_SCRUBBER_A = 'V-CO2-A',
  CO2_SCRUBBER_B = 'V-CO2-B',
  N2_BALLAST = 'V-N2-BAL',
  EMERGENCY_O2 = 'V-O2-EMG',
  CABIN_VENT = 'V-VENT-01',
}

export enum ValveAction {
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  PULSE = 'PULSE',
  CALIBRATE = 'CALIBRATE',
}

export enum CommandPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

export enum ValveFaultCode {
  NONE = 0x00,
  STUCK_OPEN = 0x01,
  STUCK_CLOSED = 0x02,
  POSITION_ERROR = 0x03,
  OVERCURRENT = 0x04,
  SENSOR_FAULT = 0x05,
  COMM_TIMEOUT = 0x06,
}

export interface PIDControllerParams {
  kp: number;
  ki: number;
  kd: number;
  setpoint: number;
  outputMin: number;
  outputMax: number;
  integralMax: number;
}

export interface SolenoidCalibrationData {
  valveId: ValveId;
  minPulseWidthMs: number;
  maxPulseWidthMs: number;
  flowRateLitersPerMs: number;
  responseTimeMs: number;
  kFactor: number;
}
