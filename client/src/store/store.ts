import { create } from 'zustand';
import type {
  BiochemicalState,
  DiffusionGridPayload,
  TelemetryPayload,
  ConnectionStatus,
  DisplayMode,
} from '../types';

interface LifeHubStore {
  state: BiochemicalState | null;
  grid: DiffusionGridPayload | null;
  telemetry: TelemetryPayload | null;
  connection: ConnectionStatus;
  displayMode: DisplayMode;
  showLegend: boolean;
  wireframe: boolean;
  setDisplayMode: (mode: DisplayMode) => void;
  setShowLegend: (v: boolean) => void;
  setWireframe: (v: boolean) => void;
  setState: (s: BiochemicalState) => void;
  setGrid: (g: DiffusionGridPayload) => void;
  setTelemetry: (t: TelemetryPayload) => void;
  setConnection: (c: Partial<ConnectionStatus>) => void;
  fps: number;
  setFps: (f: number) => void;
}

export const useLifeHubStore = create<LifeHubStore>((set) => ({
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
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setShowLegend: (v) => set({ showLegend: v }),
  setWireframe: (v) => set({ wireframe: v }),
  setState: (s) => set({ state: s }),
  setGrid: (g) => set({ grid: g }),
  setTelemetry: (t) => set({ telemetry: t }),
  setConnection: (c) =>
    set((prev) => ({ connection: { ...prev.connection, ...c } })),
  setFps: (f) => set({ fps: f }),
}));
