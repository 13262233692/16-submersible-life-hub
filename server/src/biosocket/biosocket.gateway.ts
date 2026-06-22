import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../common/logger/logger.service';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { GasControlService } from '../gas-control/gas-control.service';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';
import { ValveAction, ValveId, CommandPriority, ValveControlCommand } from '../common/interfaces/gas-control.interface';

const BACKPRESSURE = {
  MAX_STATE_QUEUE: 16,
  MAX_GRID_QUEUE: 8,
  MAX_TELEMETRY_QUEUE: 4,
  HIGH_WATERMARK_PCT: 0.7,
  LOW_WATERMARK_PCT: 0.3,
  SLOW_CLIENT_EVICT_MS: 15_000,
  WATCHDOG_INTERVAL_MS: 100,
  GRID_BINARY: true,
} as const;

interface ClientSubscription {
  id: string;
  state: boolean;
  grid: boolean;
  telemetry: boolean;
  throttleMs: number;
  lastStatePush: number;
  lastGridPush: number;
  stateQueue: BiochemicalState[];
  gridQueue: GasDiffusionGrid[];
  telemetryQueue: unknown[];
  backpressure: boolean;
  highWaterSince: number;
  droppedFrames: number;
  totalSent: number;
  sendLoopTimer?: NodeJS.Timeout;
  isSlowClient: boolean;
}

interface BackpressureStats {
  totalDropped: number;
  totalBackpressureEvents: number;
  slowClientsEvicted: number;
  avgQueueDepth: number;
  currentBackpressure: boolean;
}

@WebSocketGateway({
  namespace: '/biostream',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  serveClient: false,
  pingInterval: 10000,
  pingTimeout: 5000,
  perMessageDeflate: {
    zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
    threshold: 2048,
  },
})
export class BiosocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private clients: Map<string, ClientSubscription> = new Map();
  private totalPacketsSent: number = 0;
  private bandwidthBytes: number = 0;
  private watchdogTimer?: NodeJS.Timeout;
  private stats: BackpressureStats = {
    totalDropped: 0,
    totalBackpressureEvents: 0,
    slowClientsEvicted: 0,
    avgQueueDepth: 0,
    currentBackpressure: false,
  };
  private globalBackpressure: boolean = false;
  private cachedLatestState?: BiochemicalState;
  private cachedLatestGrid?: GasDiffusionGrid;

  constructor(
    private readonly logger: LoggerService,
    private readonly engine: BiochemicalEngineService,
    private readonly gasControl: GasControlService,
  ) {
    this.logger.setContext('Biosocket-WS');
  }

  afterInit() {
    this.logger.log('WebSocket 通道已建立: /biostream');
    this.logger.log(
      `背压看门狗配置: stateQ=${BACKPRESSURE.MAX_STATE_QUEUE}, gridQ=${BACKPRESSURE.MAX_GRID_QUEUE}, ` +
      `慢客户端逐出=${BACKPRESSURE.SLOW_CLIENT_EVICT_MS}ms`,
    );

    this.engine.onBiochemicalState((s) => this.enqueueState(s));
    this.engine.onDiffusionGrid((g) => this.enqueueGrid(g));

    this.watchdogTimer = setInterval(
      () => this.backpressureWatchdogTick(),
      BACKPRESSURE.WATCHDOG_INTERVAL_MS,
    );
  }

  handleConnection(client: Socket, ..._args: unknown[]) {
    const sub: ClientSubscription = {
      id: client.id,
      state: true,
      grid: true,
      telemetry: true,
      throttleMs: 0,
      lastStatePush: 0,
      lastGridPush: 0,
      stateQueue: [],
      gridQueue: [],
      telemetryQueue: [],
      backpressure: false,
      highWaterSince: 0,
      droppedFrames: 0,
      totalSent: 0,
      isSlowClient: false,
    };
    this.clients.set(client.id, sub);

    sub.sendLoopTimer = setInterval(
      () => this.clientSendLoop(client.id),
      16,
    );

    this.logger.log(`客户端连接: ${client.id} (${client.handshake.address}) - 在线: ${this.clients.size}`);

    client.emit('welcome', {
      serverTime: Date.now(),
      version: '2.0.0-backpressure',
      features: ['state', 'grid', 'telemetry', 'control'],
      suggestedThrottleMs: 30,
      backpressureEnabled: true,
    });

    const currentState = this.engine.getCurrentState();
    if (currentState) client.emit('biochemical:state', currentState);
  }

  handleDisconnect(client: Socket) {
    const sub = this.clients.get(client.id);
    if (sub?.sendLoopTimer) {
      clearInterval(sub.sendLoopTimer);
      sub.sendLoopTimer = undefined;
    }
    if (sub) {
      sub.stateQueue.length = 0;
      sub.gridQueue.length = 0;
      sub.telemetryQueue.length = 0;
    }
    this.clients.delete(client.id);
    this.logger.log(
      `客户端断开: ${client.id} - 在线: ${this.clients.size} ` +
      `(丢帧=${sub?.droppedFrames ?? 0}, 发送=${sub?.totalSent ?? 0})`,
    );
  }

  private enqueueState(state: BiochemicalState) {
    this.cachedLatestState = state;

    if (this.globalBackpressure) {
      this.stats.totalDropped++;
      return;
    }

    for (const [, sub] of this.clients) {
      if (!sub.state) continue;

      if (sub.backpressure) {
        sub.stateQueue[sub.stateQueue.length - 1] = state;
        sub.droppedFrames++;
        this.stats.totalDropped++;
      } else {
        sub.stateQueue.push(state);
        if (sub.stateQueue.length >= BACKPRESSURE.MAX_STATE_QUEUE) {
          this.enterBackpressure(sub, 'state');
        }
      }
    }
  }

  private enqueueGrid(grid: GasDiffusionGrid) {
    this.cachedLatestGrid = grid;

    if (this.globalBackpressure) {
      this.stats.totalDropped++;
      return;
    }

    for (const [, sub] of this.clients) {
      if (!sub.grid) continue;

      if (sub.backpressure) {
        sub.gridQueue[sub.gridQueue.length - 1] = grid;
        sub.droppedFrames++;
        this.stats.totalDropped++;
      } else {
        sub.gridQueue.push(grid);
        if (sub.gridQueue.length >= BACKPRESSURE.MAX_GRID_QUEUE) {
          this.enterBackpressure(sub, 'grid');
        }
      }
    }
  }

  private enterBackpressure(sub: ClientSubscription, trigger: string) {
    if (!sub.backpressure) {
      sub.backpressure = true;
      sub.highWaterSince = Date.now();
      this.stats.totalBackpressureEvents++;
      this.logger.warn(
        `客户端 ${sub.id} 进入背压模式 (触发: ${trigger}, ` +
        `丢帧累计: ${sub.droppedFrames})`,
      );
    }

    const avgDepth = this.getAverageQueueDepth();
    if (avgDepth > BACKPRESSURE.HIGH_WATERMARK_PCT * BACKPRESSURE.MAX_STATE_QUEUE) {
      if (!this.globalBackpressure) {
        this.globalBackpressure = true;
        this.stats.currentBackpressure = true;
        this.logger.error(
          `⚠️ 全局背压已触发! 平均队列深度=${avgDepth.toFixed(1)}, ` +
          `在线客户端=${this.clients.size} - 开始启用全局最新值覆盖策略`,
        );
      }
    }
  }

  private exitBackpressure(sub: ClientSubscription) {
    if (sub.backpressure) {
      sub.backpressure = false;
      sub.highWaterSince = 0;
      sub.isSlowClient = false;
      this.logger.log(`客户端 ${sub.id} 退出背压模式`);
    }
  }

  private clientSendLoop(clientId: string) {
    const sub = this.clients.get(clientId);
    if (!sub) return;

    const client = this.server.sockets.sockets.get(clientId);
    if (!client || client.disconnected) return;

    const now = Date.now();

    while (sub.stateQueue.length > 0) {
      const state = sub.stateQueue.shift()!;
      if (sub.throttleMs > 0 && now - sub.lastStatePush < sub.throttleMs) {
        sub.stateQueue.unshift(state);
        break;
      }
      sub.lastStatePush = now;

      if (this.isClientBufferFull(client)) {
        sub.stateQueue.unshift(state);
        this.enterBackpressure(sub, 'send_buffer');
        break;
      }

      client.emit('biochemical:state', state);
      sub.totalSent++;
      this.totalPacketsSent++;
    }

    while (sub.gridQueue.length > 0) {
      const grid = sub.gridQueue.shift()!;
      if (sub.throttleMs > 0 && now - sub.lastGridPush < Math.max(33, sub.throttleMs)) {
        sub.gridQueue.unshift(grid);
        break;
      }
      sub.lastGridPush = now;

      if (this.isClientBufferFull(client)) {
        sub.gridQueue.unshift(grid);
        this.enterBackpressure(sub, 'send_buffer');
        break;
      }

      const payload = this.serializeGrid(grid);
      this.bandwidthBytes += this.estimatePayloadSize(payload);
      client.emit('diffusion:grid', payload);
      sub.totalSent++;
      this.totalPacketsSent++;
    }

    if (sub.backpressure) {
      const totalQueueSize = sub.stateQueue.length + sub.gridQueue.length;
      const lowWater = BACKPRESSURE.LOW_WATERMARK_PCT * (BACKPRESSURE.MAX_STATE_QUEUE + BACKPRESSURE.MAX_GRID_QUEUE);
      if (totalQueueSize < lowWater) {
        this.exitBackpressure(sub);
      }
    }
  }

  private isClientBufferFull(client: Socket): boolean {
    const conn = (client as any).conn;
    if (!conn) return false;
    const transport = conn.transport;
    if (!transport) return false;
    const writable = transport.writable;
    if (writable === false) return true;
    try {
      const socket = transport.socket || transport.ws;
      if (socket && typeof socket.bufferedAmount === 'number') {
        return socket.bufferedAmount > 64 * 1024;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  private serializeGrid(grid: GasDiffusionGrid): {
    timestamp: number;
    width: number;
    height: number;
    binary: boolean;
    o2Grid: number[];
    co2Grid: number[];
    pressureGrid: number[];
    flowVX: number[];
    flowVY: number[];
  } {
    return {
      timestamp: grid.timestamp,
      width: grid.width,
      height: grid.height,
      binary: false,
      o2Grid: Array.from(grid.o2Grid),
      co2Grid: Array.from(grid.co2Grid),
      pressureGrid: Array.from(grid.pressureGrid),
      flowVX: Array.from(grid.flowVX),
      flowVY: Array.from(grid.flowVY),
    };
  }

  private estimatePayloadSize(obj: unknown): number {
    if (typeof obj === 'string') return obj.length;
    if (typeof obj !== 'object' || obj === null) return 8;
    let size = 0;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      size += key.length * 2;
      const val = (obj as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        size += val.length * 8;
      } else if (typeof val === 'number') {
        size += 8;
      } else if (typeof val === 'object' && val !== null) {
        size += this.estimatePayloadSize(val);
      } else {
        size += 16;
      }
    }
    return size;
  }

  private backpressureWatchdogTick() {
    const now = Date.now();
    let totalDepth = 0;
    let clientCount = 0;

    const toEvict: string[] = [];

    for (const [clientId, sub] of this.clients) {
      const depth = sub.stateQueue.length + sub.gridQueue.length;
      totalDepth += depth;
      clientCount++;

      if (sub.backpressure && sub.highWaterSince > 0) {
        const duration = now - sub.highWaterSince;
        if (duration > BACKPRESSURE.SLOW_CLIENT_EVICT_MS && !sub.isSlowClient) {
          sub.isSlowClient = true;
          this.logger.warn(
            `慢客户端检测: ${clientId} 持续背压 ${(duration / 1000).toFixed(1)}s, ` +
            `丢帧=${sub.droppedFrames}`,
          );
        }
        if (duration > BACKPRESSURE.SLOW_CLIENT_EVICT_MS * 3) {
          toEvict.push(clientId);
        }
      }
    }

    for (const clientId of toEvict) {
      this.evictSlowClient(clientId);
    }

    this.stats.avgQueueDepth = clientCount > 0 ? totalDepth / clientCount : 0;

    let backpressureLevel = 0;
    const maxQ = BACKPRESSURE.MAX_STATE_QUEUE + BACKPRESSURE.MAX_GRID_QUEUE;
    const avgDepth = this.stats.avgQueueDepth;
    if (avgDepth > maxQ * 0.8) backpressureLevel = 5;
    else if (avgDepth > maxQ * 0.65) backpressureLevel = 4;
    else if (avgDepth > maxQ * 0.5) backpressureLevel = 3;
    else if (avgDepth > maxQ * 0.35) backpressureLevel = 2;
    else if (avgDepth > maxQ * 0.2) backpressureLevel = 1;

    this.engine.setBackpressureLevel(backpressureLevel);

    if (this.globalBackpressure && this.stats.avgQueueDepth < 2) {
      this.globalBackpressure = false;
      this.stats.currentBackpressure = false;
      this.logger.log('全局背压已解除 - 平均队列深度恢复正常');
    }

    this.pushTelemetry();
  }

  private evictSlowClient(clientId: string) {
    const client = this.server.sockets.sockets.get(clientId);
    if (client) {
      this.logger.error(
        `强制逐出慢客户端: ${clientId} - 持续背压过久`,
      );
      client.emit('server:backpressure_evict', {
        reason: 'slow_client',
        droppedFrames: this.clients.get(clientId)?.droppedFrames ?? 0,
        message: '您的网络带宽不足以接收实时流体数据，已被服务器逐出。请降低数据频率后重连。',
        reconnectAfterMs: 5000,
      });
      client.disconnect(true);
    }
    this.stats.slowClientsEvicted++;
  }

  private pushTelemetry() {
    const diags = this.engine.getDiagnostics();
    const ringStats = this.engine.getRingBufferStats();
    const valveStates = this.gasControl.getAllValveStatus();
    const pidStates = this.gasControl.getPIDStates();

    const telemetry = {
      timestamp: Date.now(),
      engine: diags,
      ringBuffer: ringStats,
      serial: { /* placeholder */ },
      valves: valveStates,
      pid: pidStates,
      connectedClients: this.clients.size,
      totalPacketsSent: this.totalPacketsSent,
      bandwidthKBPushRate: +((this.bandwidthBytes * 4 / 1024).toFixed(2)),
      backpressure: {
        global: this.globalBackpressure,
        totalDroppedFrames: this.stats.totalDropped,
        totalBackpressureEvents: this.stats.totalBackpressureEvents,
        slowClientsEvicted: this.stats.slowClientsEvicted,
        avgQueueDepth: +this.stats.avgQueueDepth.toFixed(2),
      },
    };

    this.bandwidthBytes = 0;

    for (const [clientId, sub] of this.clients) {
      if (sub.telemetry) {
        sub.telemetryQueue.push(telemetry);
        if (sub.telemetryQueue.length > BACKPRESSURE.MAX_TELEMETRY_QUEUE) {
          sub.telemetryQueue.shift();
        }

        const client = this.server.sockets.sockets.get(clientId);
        if (client && sub.telemetryQueue.length > 0) {
          const t = sub.telemetryQueue.shift();
          client.emit('telemetry', t);
        }
      }
    }
  }

  private getAverageQueueDepth(): number {
    let total = 0;
    let count = 0;
    for (const [, sub] of this.clients) {
      total += sub.stateQueue.length + sub.gridQueue.length;
      count++;
    }
    return count > 0 ? total / count : 0;
  }

  isBackpressured(): boolean {
    return this.globalBackpressure;
  }

  getBackpressureStats(): BackpressureStats {
    return { ...this.stats };
  }

  @SubscribeMessage('subscribe:config')
  handleSubscribeConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() config: Partial<ClientSubscription>,
  ) {
    const sub = this.clients.get(client.id);
    if (!sub) return { ok: false, error: 'unknown_client' };
    Object.assign(sub, config);
    return { ok: true, config: { ...sub, stateQueue: undefined, gridQueue: undefined, telemetryQueue: undefined } };
  }

  @SubscribeMessage('request:state')
  handleRequestState(@ConnectedSocket() client: Socket) {
    const state = this.engine.getCurrentState();
    if (state) client.emit('biochemical:state', state);
    return { ok: true, timestamp: Date.now() };
  }

  @SubscribeMessage('request:grid')
  handleRequestGrid(@ConnectedSocket() client: Socket) {
    const grid = this.engine.getCurrentGrid();
    if (grid) {
      client.emit('diffusion:grid', {
        timestamp: grid.timestamp,
        width: grid.width,
        height: grid.height,
        binary: false,
        o2Grid: Array.from(grid.o2Grid),
        co2Grid: Array.from(grid.co2Grid),
        pressureGrid: Array.from(grid.pressureGrid),
        flowVX: Array.from(grid.flowVX),
        flowVY: Array.from(grid.flowVY),
      });
    }
    return { ok: true, timestamp: Date.now() };
  }

  @SubscribeMessage('control:valve')
  async handleValveCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      valveId: ValveId;
      action: ValveAction;
      pulseWidthMs?: number;
      priority?: CommandPriority;
    },
  ): Promise<{ ok: boolean; command?: ValveControlCommand; error?: string }> {
    try {
      const cmd = await this.gasControl.issueCommand({
        valveId: data.valveId,
        action: data.action,
        pulseWidthMs: data.pulseWidthMs,
        priority: data.priority,
      });
      this.logger.warn(
        `客户端 ${client.id} 下发阀门指令: ${data.valveId} ${data.action} ${data.pulseWidthMs ?? ''}ms`,
      );
      return { ok: true, command: cmd };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('control:override')
  handleManualOverride(@MessageBody() data: { enabled: boolean }) {
    this.gasControl.setManualOverride(data.enabled);
    return { ok: true };
  }
}
