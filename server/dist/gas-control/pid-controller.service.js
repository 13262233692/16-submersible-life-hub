"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIDControllerService = void 0;
class PIDControllerService {
    params;
    integral = 0;
    previousError = 0;
    lastOutput = 0;
    firstRun = true;
    constructor(params) {
        this.params = params;
    }
    update(setpoint, processVariable, dt) {
        if (dt <= 0)
            dt = 0.01;
        const error = setpoint - processVariable;
        this.integral += error * dt;
        const integralMax = this.params.integralMax || this.params.outputMax / Math.max(0.0001, this.params.ki);
        this.integral = Math.max(-integralMax, Math.min(integralMax, this.integral));
        let derivative;
        if (this.firstRun) {
            derivative = 0;
            this.firstRun = false;
        }
        else {
            derivative = (error - this.previousError) / dt;
        }
        const output = this.params.kp * error +
            this.params.ki * this.integral +
            this.params.kd * derivative;
        const clamped = Math.max(this.params.outputMin, Math.min(this.params.outputMax, output));
        this.previousError = error;
        this.lastOutput = clamped;
        return clamped;
    }
    reset() {
        this.integral = 0;
        this.previousError = 0;
        this.lastOutput = 0;
        this.firstRun = true;
    }
    getState() {
        return {
            integral: this.integral,
            previousError: this.previousError,
            lastOutput: this.lastOutput,
            params: { ...this.params },
        };
    }
    setParams(newParams) {
        Object.assign(this.params, newParams);
    }
}
exports.PIDControllerService = PIDControllerService;
//# sourceMappingURL=pid-controller.service.js.map