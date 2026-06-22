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

export interface DiffusionGridPayload {
  timestamp: number;
  width: number;
  height: number;
  o2Grid: number[];
  co2Grid: number[];
  pressureGrid: number[];
  flowVX: number[];
  flowVY: number[];
}

export interface ValveStatusReport {
  reportId: string;
  timestamp: number;
  valveId: string;
  currentState: 'open' | 'closed' | 'transitioning';
  lastCommandId?: string;
  totalOpenDurationMs: number;
  cycleCount: number;
  faultCode?: number;
}

export interface EngineDiagnostics {
  computeLatencyMs: number;
  avgLatencyMs: number;
  totalComputations: number;
  framesDropped: number;
  inputQueueSize: number;
  lastStateAgeSec: number;
}

export interface TelemetryPayload {
  timestamp: number;
  engine: EngineDiagnostics;
  ringBuffer: {
    capacity: number;
    size: number;
    utilizationPercent: number;
  };
  serial: Record<string, unknown>;
  valves: Record<string, ValveStatusReport>;
  pid: {
    o2: PIDState;
    co2: PIDState;
    pressure: PIDState;
    manualOverride: boolean;
    commandCounter: number;
  };
  connectedClients: number;
  totalPacketsSent: number;
  bandwidthKBPushRate: number;
}

export interface PIDState {
  integral: number;
  previousError: number;
  lastOutput: number;
}

export type DisplayMode = 'o2' | 'co2' | 'flow' | 'combined';

export interface ConnectionStatus {
  connected: boolean;
  latencyMs: number;
  lastPingAt: number;
  reconnecting: boolean;
  attempt: number;
}
