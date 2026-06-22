import { Injectable } from '@nestjs/common';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: number;
  uptime: number;
  subsystems: {
    serialDriver: 'online' | 'offline' | 'simulated';
    kalmanFilter: 'active' | 'inactive';
    ringBuffer: { state: 'active'; utilization: number; capacity: number };
    biochemicalEngine: 'active' | 'inactive';
    gasControl: 'standby' | 'active';
    websocket: { state: 'online'; connectedClients: number };
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

@Injectable()
export class AppService {
  private readonly startTime: number = Date.now();

  getSystemHealth(): SystemHealth {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      subsystems: {
        serialDriver: 'simulated',
        kalmanFilter: 'active',
        ringBuffer: { state: 'active', utilization: 0, capacity: 65536 },
        biochemicalEngine: 'active',
        gasControl: 'standby',
        websocket: { state: 'online', connectedClients: 0 },
      },
    };
  }

  getSystemInfo(): SystemInfo {
    return {
      vehicleId: 'FZ-2024-1103',
      vehicleName: '奋斗者号',
      hullMaterial: 'Ti-62A 钛合金',
      maxDepthMeters: 11000,
      cabinVolumeLiters: 14500,
      crewCapacity: 3,
      systemVersion: '1.0.0',
      missionTimestamp: Date.now(),
    };
  }
}
