export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'critical';
    timestamp: number;
    uptime: number;
    subsystems: {
        serialDriver: 'online' | 'offline' | 'simulated';
        kalmanFilter: 'active' | 'inactive';
        ringBuffer: {
            state: 'active';
            utilization: number;
            capacity: number;
        };
        biochemicalEngine: 'active' | 'inactive';
        gasControl: 'standby' | 'active';
        websocket: {
            state: 'online';
            connectedClients: number;
        };
    };
}
export interface SystemInfo {
    vehicleId: string;
    vehicleName: string;
    hullMaterial: string;
    maxDepthMeters: number;
    cabinVolumeLiters: number;
    crewCapacity: number;
    systemVersion: string;
    missionTimestamp: number;
}
export declare class AppService {
    private readonly startTime;
    getSystemHealth(): SystemHealth;
    getSystemInfo(): SystemInfo;
}
