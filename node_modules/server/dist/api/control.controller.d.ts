import { GasControlService } from '../gas-control/gas-control.service';
import { ValveAction, CommandPriority, ValveControlCommand } from '../common/interfaces/gas-control.interface';
export declare class ControlController {
    private readonly gasControl;
    constructor(gasControl: GasControlService);
    getAllValves(): {
        timestamp: number;
        valves: Record<string, import("../common/interfaces/gas-control.interface").ValveStatusReport>;
    };
    getValve(valveId: string): {
        timestamp: number;
        valveId: string;
        status: import("../common/interfaces/gas-control.interface").ValveStatusReport | null;
    };
    issueValveCommand(valveId: string, body: {
        action: ValveAction;
        pulseWidthMs?: number;
        targetPressureDeltaKPa?: number;
        priority?: CommandPriority;
    }): Promise<{
        timestamp: number;
        command: ValveControlCommand;
    }>;
    setOverride(body: {
        enabled: boolean;
    }): {
        timestamp: number;
        manualOverride: boolean;
    };
    getPID(): {
        timestamp: number;
        pid: {
            o2: {
                integral: number;
                previousError: number;
                lastOutput: number;
                params: {
                    kp: number;
                    ki: number;
                    kd: number;
                    setpoint: number;
                    outputMin: number;
                    outputMax: number;
                    integralMax: number;
                };
            };
            co2: {
                integral: number;
                previousError: number;
                lastOutput: number;
                params: {
                    kp: number;
                    ki: number;
                    kd: number;
                    setpoint: number;
                    outputMin: number;
                    outputMax: number;
                    integralMax: number;
                };
            };
            pressure: {
                integral: number;
                previousError: number;
                lastOutput: number;
                params: {
                    kp: number;
                    ki: number;
                    kd: number;
                    setpoint: number;
                    outputMin: number;
                    outputMax: number;
                    integralMax: number;
                };
            };
            manualOverride: boolean;
            commandCounter: number;
        };
    };
    getMasterReport(): {
        timestamp: number;
        report: import("../common/interfaces/gas-control.interface").MasterControlReport | null;
    };
}
