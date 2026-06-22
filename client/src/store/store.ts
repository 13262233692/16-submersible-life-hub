import { create } from 'zustand';
import type {
  BiochemicalState,
  DiffusionGridPayload,
  TelemetryPayload,
  ConnectionStatus,
  DisplayMode,
  AcuteCo2Alert,
} from '../types';

interface LifeHubStore {
  state: BiochemicalState | null;
  grid: DiffusionGridPayload | null;
  telemetry: TelemetryPayload | null;
  connection: ConnectionStatus;
  displayMode: DisplayMode;
  showLegend: boolean;
  wireframe: boolean;
  activeAlert: AcuteCo2Alert | null;
  alertHistory: AcuteCo2Alert[];
  setDisplayMode: (mode: DisplayMode) => void;
  setShowLegend: (v: boolean) => void;
  setWireframe: (v: boolean) => void;
  setState: (s: BiochemicalState) => void;
  setGrid: (g: DiffusionGridPayload) => void;
  setTelemetry: (t: TelemetryPayload) => void;
  setConnection: (c: Partial<ConnectionStatus>) => void;
  pushAcuteAlert: (a: AcuteCo2Alert) => void;
  dismissAlert: () => void;
  acknowledgeAlert: (alertId: string) => void;
  fps: number;
  setFps: (f: number) => void;
}

export const useLifeHubStore = create<LifeHubStore>((set, get) => ({
  state: null,
  grid: null,
  telemetry: null,
  connection: {
    connected: false,
    latencyMs: -1,
    lastPingAt: 0,
    reconnecting: false,
    attempt: 0,
  },
  displayMode: 'combined',
  showLegend: true,
  wireframe: false,
  fps: 0,
  activeAlert: null,
  alertHistory: [],
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setShowLegend: (v) => set({ showLegend: v }),
  setWireframe: (v) => set({ wireframe: v }),
  setState: (s) => set({ state: s }),
  setGrid: (g) => set({ grid: g }),
  setTelemetry: (t) => set({ telemetry: t }),
  setConnection: (c) =>
    set((prev) => ({ connection: { ...prev.connection, ...c } })),
  setFps: (f) => set({ fps: f }),
  pushAcuteAlert: (a) => {
    const existing = get().alertHistory;
    const filtered = existing.filter((x) => x.alertId !== a.alertId).slice(0, 49);
    set({
      activeAlert: a,
      alertHistory: [a, ...filtered],
    });
  },
  dismissAlert: () => set({ activeAlert: null }),
  acknowledgeAlert: (alertId) => {
    const cur = get().activeAlert;
    if (cur && cur.alertId === alertId) {
      set({ activeAlert: { ...cur, acknowledged: true } });
    }
    set({
      alertHistory: get().alertHistory.map((a) =>
        a.alertId === alertId ? { ...a, acknowledged: true } : a,
      ),
    });
  },
}));
