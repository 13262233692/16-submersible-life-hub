import { PIDControllerParams } from '../common/interfaces/gas-control.interface';

export class PIDControllerService {
  private integral: number = 0;
  private previousError: number = 0;
  private lastOutput: number = 0;
  private firstRun: boolean = true;

  constructor(private readonly params: PIDControllerParams) {}

  update(setpoint: number, processVariable: number, dt: number): number {
    if (dt <= 0) dt = 0.01;

    const error = setpoint - processVariable;

    this.integral += error * dt;
    const integralMax = this.params.integralMax || this.params.outputMax / Math.max(0.0001, this.params.ki);
    this.integral = Math.max(-integralMax, Math.min(integralMax, this.integral));

    let derivative: number;
    if (this.firstRun) {
      derivative = 0;
      this.firstRun = false;
    } else {
      derivative = (error - this.previousError) / dt;
    }

    const output =
      this.params.kp * error +
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

  setParams(newParams: Partial<PIDControllerParams>) {
    Object.assign(this.params, newParams);
  }
}
