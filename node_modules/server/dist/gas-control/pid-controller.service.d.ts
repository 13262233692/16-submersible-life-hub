import { PIDControllerParams } from '../common/interfaces/gas-control.interface';
export declare class PIDControllerService {
    private readonly params;
    private integral;
    private previousError;
    private lastOutput;
    private firstRun;
    constructor(params: PIDControllerParams);
    update(setpoint: number, processVariable: number, dt: number): number;
    reset(): void;
    getState(): {
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
    setParams(newParams: Partial<PIDControllerParams>): void;
}
