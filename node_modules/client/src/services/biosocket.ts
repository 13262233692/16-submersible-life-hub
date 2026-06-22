import { io, Socket } from 'socket.io-client';
import { useLifeHubStore } from '../store/store';
import type { BiochemicalState, DiffusionGridPayload, TelemetryPayload } from '../types';

type EventMap = {
  welcome: (data: { serverTime: number; suggestedThrottleMs: number }) => void;
  'biochemical:state': (state: BiochemicalState) => void;
  'diffusion:grid': (grid: DiffusionGridPayload) => void;
  telemetry: (t: TelemetryPayload) => void;
  connect: () => void;
  disconnect: () => void;
  connect_error: () => void;
  reconnect_attempt: (n: number) => void;
  ping: () => void;
  pong: (latency: number) => void;
};

let socketInstance: Socket | null = null;

export function createBioSocket(): Socket<EventMap> {
  if (socketInstance) return socketInstance as Socket<EventMap>;

  const socket = io('/biostream', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 300,
    reconnectionDelayMax: 5000,
    timeout: 8000,
    forceNew: false,
  }) as Socket<EventMap>;

  socket.on('connect', () => {
    useLifeHubStore.getState().setConnection({
      connected: true,
      reconnecting: false,
      attempt: 0,
    });
  });

  socket.on('disconnect', () => {
    useLifeHubStore.getState().setConnection({ connected: false });
  });

  socket.on('connect_error', () => {
    useLifeHubStore.getState().setConnection({ connected: false, reconnecting: true });
  });

  socket.on('reconnect_attempt', (n) => {
    useLifeHubStore.getState().setConnection({ reconnecting: true, attempt: n });
  });

  socket.on('pong', (latency) => {
    useLifeHubStore.getState().setConnection({
      latencyMs: latency,
      lastPingAt: Date.now(),
    });
  });

  socket.on('biochemical:state', (s) => {
    useLifeHubStore.getState().setState(s);
  });

  socket.on('diffusion:grid', (g) => {
    useLifeHubStore.getState().setGrid(g);
  });

  socket.on('telemetry', (t) => {
    useLifeHubStore.getState().setTelemetry(t);
  });

  socketInstance = socket;
  return socket as Socket<EventMap>;
}

export function getBioSocket(): Socket<EventMap> | null {
  return socketInstance as Socket<EventMap> | null;
}
