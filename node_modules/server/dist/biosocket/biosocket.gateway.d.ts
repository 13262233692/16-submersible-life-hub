import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../common/logger/logger.service';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { GasControlService } from '../gas-control/gas-control.service';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';
import { ValveAction, ValveId, CommandPriority, ValveControlCommand } from '../common/interfaces/gas-control.interface';
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
export declare class BiosocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger;
    private readonly engine;
    private readonly gasControl;
    server: Server;
    private clients;
    private totalPacketsSent;
    private bandwidthBytes;
    private watchdogTimer?;
    private stats;
    private globalBackpressure;
    private cachedLatestState?;
    private cachedLatestGrid?;
    constructor(logger: LoggerService, engine: BiochemicalEngineService, gasControl: GasControlService);
    afterInit(): void;
    handleConnection(client: Socket, ..._args: unknown[]): void;
    handleDisconnect(client: Socket): void;
    private enqueueState;
    private enqueueGrid;
    private enterBackpressure;
    private exitBackpressure;
    private clientSendLoop;
    private isClientBufferFull;
    private serializeGrid;
    private estimatePayloadSize;
    private backpressureWatchdogTick;
    private evictSlowClient;
    private pushTelemetry;
    private getAverageQueueDepth;
    isBackpressured(): boolean;
    getBackpressureStats(): BackpressureStats;
    handleSubscribeConfig(client: Socket, config: Partial<ClientSubscription>): {
        ok: boolean;
        error: string;
        config?: undefined;
    } | {
        ok: boolean;
        config: {
            stateQueue: undefined;
            gridQueue: undefined;
            telemetryQueue: undefined;
            id: string;
            state: boolean;
            grid: boolean;
            telemetry: boolean;
            throttleMs: number;
            lastStatePush: number;
            lastGridPush: number;
            backpressure: boolean;
            highWaterSince: number;
            droppedFrames: number;
            totalSent: number;
            sendLoopTimer?: NodeJS.Timeout;
            isSlowClient: boolean;
        };
        error?: undefined;
    };
    handleRequestState(client: Socket): {
        ok: boolean;
        timestamp: number;
    };
    handleRequestGrid(client: Socket): {
        ok: boolean;
        timestamp: number;
    };
    handleValveCommand(client: Socket, data: {
        valveId: ValveId;
        action: ValveAction;
        pulseWidthMs?: number;
        priority?: CommandPriority;
    }): Promise<{
        ok: boolean;
        command?: ValveControlCommand;
        error?: string;
    }>;
    handleManualOverride(data: {
        enabled: boolean;
    }): {
        ok: boolean;
    };
}
export {};
