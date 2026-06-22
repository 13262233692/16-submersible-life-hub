"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiosocketGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const logger_service_1 = require("../common/logger/logger.service");
const biochemical_engine_service_1 = require("../biochemical/biochemical-engine.service");
const gas_control_service_1 = require("../gas-control/gas-control.service");
const BACKPRESSURE = {
    MAX_STATE_QUEUE: 16,
    MAX_GRID_QUEUE: 8,
    MAX_TELEMETRY_QUEUE: 4,
    HIGH_WATERMARK_PCT: 0.7,
    LOW_WATERMARK_PCT: 0.3,
    SLOW_CLIENT_EVICT_MS: 15_000,
    WATCHDOG_INTERVAL_MS: 100,
    GRID_BINARY: true,
};
let BiosocketGateway = class BiosocketGateway {
    logger;
    engine;
    gasControl;
    server;
    clients = new Map();
    totalPacketsSent = 0;
    bandwidthBytes = 0;
    watchdogTimer;
    stats = {
        totalDropped: 0,
        totalBackpressureEvents: 0,
        slowClientsEvicted: 0,
        avgQueueDepth: 0,
        currentBackpressure: false,
    };
    globalBackpressure = false;
    cachedLatestState;
    cachedLatestGrid;
    constructor(logger, engine, gasControl) {
        this.logger = logger;
        this.engine = engine;
        this.gasControl = gasControl;
        this.logger.setContext('Biosocket-WS');
    }
    afterInit() {
        this.logger.log('WebSocket 通道已建立: /biostream');
        this.logger.log(`背压看门狗配置: stateQ=${BACKPRESSURE.MAX_STATE_QUEUE}, gridQ=${BACKPRESSURE.MAX_GRID_QUEUE}, ` +
            `慢客户端逐出=${BACKPRESSURE.SLOW_CLIENT_EVICT_MS}ms`);
        this.engine.onBiochemicalState((s) => this.enqueueState(s));
        this.engine.onDiffusionGrid((g) => this.enqueueGrid(g));
        this.watchdogTimer = setInterval(() => this.backpressureWatchdogTick(), BACKPRESSURE.WATCHDOG_INTERVAL_MS);
    }
    handleConnection(client, ..._args) {
        const sub = {
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
        sub.sendLoopTimer = setInterval(() => this.clientSendLoop(client.id), 16);
        this.logger.log(`客户端连接: ${client.id} (${client.handshake.address}) - 在线: ${this.clients.size}`);
        client.emit('welcome', {
            serverTime: Date.now(),
            version: '2.0.0-backpressure',
            features: ['state', 'grid', 'telemetry', 'control'],
            suggestedThrottleMs: 30,
            backpressureEnabled: true,
        });
        const currentState = this.engine.getCurrentState();
        if (currentState)
            client.emit('biochemical:state', currentState);
    }
    handleDisconnect(client) {
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
        this.logger.log(`客户端断开: ${client.id} - 在线: ${this.clients.size} ` +
            `(丢帧=${sub?.droppedFrames ?? 0}, 发送=${sub?.totalSent ?? 0})`);
    }
    enqueueState(state) {
        this.cachedLatestState = state;
        if (this.globalBackpressure) {
            this.stats.totalDropped++;
            return;
        }
        for (const [, sub] of this.clients) {
            if (!sub.state)
                continue;
            if (sub.backpressure) {
                sub.stateQueue[sub.stateQueue.length - 1] = state;
                sub.droppedFrames++;
                this.stats.totalDropped++;
            }
            else {
                sub.stateQueue.push(state);
                if (sub.stateQueue.length >= BACKPRESSURE.MAX_STATE_QUEUE) {
                    this.enterBackpressure(sub, 'state');
                }
            }
        }
    }
    enqueueGrid(grid) {
        this.cachedLatestGrid = grid;
        if (this.globalBackpressure) {
            this.stats.totalDropped++;
            return;
        }
        for (const [, sub] of this.clients) {
            if (!sub.grid)
                continue;
            if (sub.backpressure) {
                sub.gridQueue[sub.gridQueue.length - 1] = grid;
                sub.droppedFrames++;
                this.stats.totalDropped++;
            }
            else {
                sub.gridQueue.push(grid);
                if (sub.gridQueue.length >= BACKPRESSURE.MAX_GRID_QUEUE) {
                    this.enterBackpressure(sub, 'grid');
                }
            }
        }
    }
    enterBackpressure(sub, trigger) {
        if (!sub.backpressure) {
            sub.backpressure = true;
            sub.highWaterSince = Date.now();
            this.stats.totalBackpressureEvents++;
            this.logger.warn(`客户端 ${sub.id} 进入背压模式 (触发: ${trigger}, ` +
                `丢帧累计: ${sub.droppedFrames})`);
        }
        const avgDepth = this.getAverageQueueDepth();
        if (avgDepth > BACKPRESSURE.HIGH_WATERMARK_PCT * BACKPRESSURE.MAX_STATE_QUEUE) {
            if (!this.globalBackpressure) {
                this.globalBackpressure = true;
                this.stats.currentBackpressure = true;
                this.logger.error(`⚠️ 全局背压已触发! 平均队列深度=${avgDepth.toFixed(1)}, ` +
                    `在线客户端=${this.clients.size} - 开始启用全局最新值覆盖策略`);
            }
        }
    }
    exitBackpressure(sub) {
        if (sub.backpressure) {
            sub.backpressure = false;
            sub.highWaterSince = 0;
            sub.isSlowClient = false;
            this.logger.log(`客户端 ${sub.id} 退出背压模式`);
        }
    }
    clientSendLoop(clientId) {
        const sub = this.clients.get(clientId);
        if (!sub)
            return;
        const client = this.server.sockets.sockets.get(clientId);
        if (!client || client.disconnected)
            return;
        const now = Date.now();
        while (sub.stateQueue.length > 0) {
            const state = sub.stateQueue.shift();
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
            const grid = sub.gridQueue.shift();
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
    isClientBufferFull(client) {
        const conn = client.conn;
        if (!conn)
            return false;
        const transport = conn.transport;
        if (!transport)
            return false;
        const writable = transport.writable;
        if (writable === false)
            return true;
        try {
            const socket = transport.socket || transport.ws;
            if (socket && typeof socket.bufferedAmount === 'number') {
                return socket.bufferedAmount > 64 * 1024;
            }
        }
        catch {
        }
        return false;
    }
    serializeGrid(grid) {
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
    estimatePayloadSize(obj) {
        if (typeof obj === 'string')
            return obj.length;
        if (typeof obj !== 'object' || obj === null)
            return 8;
        let size = 0;
        for (const key of Object.keys(obj)) {
            size += key.length * 2;
            const val = obj[key];
            if (Array.isArray(val)) {
                size += val.length * 8;
            }
            else if (typeof val === 'number') {
                size += 8;
            }
            else if (typeof val === 'object' && val !== null) {
                size += this.estimatePayloadSize(val);
            }
            else {
                size += 16;
            }
        }
        return size;
    }
    backpressureWatchdogTick() {
        const now = Date.now();
        let totalDepth = 0;
        let clientCount = 0;
        const toEvict = [];
        for (const [clientId, sub] of this.clients) {
            const depth = sub.stateQueue.length + sub.gridQueue.length;
            totalDepth += depth;
            clientCount++;
            if (sub.backpressure && sub.highWaterSince > 0) {
                const duration = now - sub.highWaterSince;
                if (duration > BACKPRESSURE.SLOW_CLIENT_EVICT_MS && !sub.isSlowClient) {
                    sub.isSlowClient = true;
                    this.logger.warn(`慢客户端检测: ${clientId} 持续背压 ${(duration / 1000).toFixed(1)}s, ` +
                        `丢帧=${sub.droppedFrames}`);
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
        if (avgDepth > maxQ * 0.8)
            backpressureLevel = 5;
        else if (avgDepth > maxQ * 0.65)
            backpressureLevel = 4;
        else if (avgDepth > maxQ * 0.5)
            backpressureLevel = 3;
        else if (avgDepth > maxQ * 0.35)
            backpressureLevel = 2;
        else if (avgDepth > maxQ * 0.2)
            backpressureLevel = 1;
        this.engine.setBackpressureLevel(backpressureLevel);
        if (this.globalBackpressure && this.stats.avgQueueDepth < 2) {
            this.globalBackpressure = false;
            this.stats.currentBackpressure = false;
            this.logger.log('全局背压已解除 - 平均队列深度恢复正常');
        }
        this.pushTelemetry();
    }
    evictSlowClient(clientId) {
        const client = this.server.sockets.sockets.get(clientId);
        if (client) {
            this.logger.error(`强制逐出慢客户端: ${clientId} - 持续背压过久`);
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
    pushTelemetry() {
        const diags = this.engine.getDiagnostics();
        const ringStats = this.engine.getRingBufferStats();
        const valveStates = this.gasControl.getAllValveStatus();
        const pidStates = this.gasControl.getPIDStates();
        const telemetry = {
            timestamp: Date.now(),
            engine: diags,
            ringBuffer: ringStats,
            serial: {},
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
    getAverageQueueDepth() {
        let total = 0;
        let count = 0;
        for (const [, sub] of this.clients) {
            total += sub.stateQueue.length + sub.gridQueue.length;
            count++;
        }
        return count > 0 ? total / count : 0;
    }
    isBackpressured() {
        return this.globalBackpressure;
    }
    getBackpressureStats() {
        return { ...this.stats };
    }
    handleSubscribeConfig(client, config) {
        const sub = this.clients.get(client.id);
        if (!sub)
            return { ok: false, error: 'unknown_client' };
        Object.assign(sub, config);
        return { ok: true, config: { ...sub, stateQueue: undefined, gridQueue: undefined, telemetryQueue: undefined } };
    }
    handleRequestState(client) {
        const state = this.engine.getCurrentState();
        if (state)
            client.emit('biochemical:state', state);
        return { ok: true, timestamp: Date.now() };
    }
    handleRequestGrid(client) {
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
    async handleValveCommand(client, data) {
        try {
            const cmd = await this.gasControl.issueCommand({
                valveId: data.valveId,
                action: data.action,
                pulseWidthMs: data.pulseWidthMs,
                priority: data.priority,
            });
            this.logger.warn(`客户端 ${client.id} 下发阀门指令: ${data.valveId} ${data.action} ${data.pulseWidthMs ?? ''}ms`);
            return { ok: true, command: cmd };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    }
    handleManualOverride(data) {
        this.gasControl.setManualOverride(data.enabled);
        return { ok: true };
    }
};
exports.BiosocketGateway = BiosocketGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], BiosocketGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe:config'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], BiosocketGateway.prototype, "handleSubscribeConfig", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('request:state'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BiosocketGateway.prototype, "handleRequestState", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('request:grid'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BiosocketGateway.prototype, "handleRequestGrid", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('control:valve'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], BiosocketGateway.prototype, "handleValveCommand", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('control:override'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BiosocketGateway.prototype, "handleManualOverride", null);
exports.BiosocketGateway = BiosocketGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
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
    }),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        biochemical_engine_service_1.BiochemicalEngineService,
        gas_control_service_1.GasControlService])
], BiosocketGateway);
//# sourceMappingURL=biosocket.gateway.js.map