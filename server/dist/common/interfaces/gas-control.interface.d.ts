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
export declare enum ValveId {
    O2_SUPPLY_PRIMARY = "V-O2-01",
    O2_SUPPLY_SECONDARY = "V-O2-02",
    CO2_SCRUBBER_A = "V-CO2-A",
    CO2_SCRUBBER_B = "V-CO2-B",
    N2_BALLAST = "V-N2-BAL",
    EMERGENCY_O2 = "V-O2-EMG",
    CABIN_VENT = "V-VENT-01"
}
export declare enum ValveAction {
    OPEN = "OPEN",
    CLOSE = "CLOSE",
    PULSE = "PULSE",
    CALIBRATE = "CALIBRATE"
}
export declare enum CommandPriority {
    CRITICAL = 0,
    HIGH = 1,
    NORMAL = 2,
    LOW = 3
}
export declare enum ValveFaultCode {
    NONE = 0,
    STUCK_OPEN = 1,
    STUCK_CLOSED = 2,
    POSITION_ERROR = 3,
    OVERCURRENT = 4,
    SENSOR_FAULT = 5,
    COMM_TIMEOUT = 6
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
