import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { LoggerService } from '../common/logger/logger.service';
import { SENSOR_FRAME_CONFIG, DecodedSensorData, RawSensorFrame } from '../common/interfaces/sensor.interface';
import { FrameDecoderService } from './frame-decoder.service';
import { SimulatorService } from './simulator.service';

export type SerialEvents = {
  rawData: (buf: Buffer) => void;
  frameDecoded: (frame: RawSensorFrame | DecodedSensorData) => void;
  error: (err: Error) => void;
  open: () => void;
  close: () => void;
  reconnect: (attempt: number) => void;
};

interface SerialPortLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
  removeAllListeners(event?: string): unknown;
  close(callback?: (err?: Error) => void): unknown;
  destroy?(): unknown;
  isOpen?: boolean;
  write?(data: Buffer, callback?: (err?: Error) => void): unknown;
}

const RECONNECT = {
  INITIAL_DELAY_MS: 500,
  MAX_DELAY_MS: 30_000,
  MAX_ATTEMPTS: 20,
  BACKOFF_FACTOR: 2,
} as const;

@Injectable()
export class SerialService extends (EventEmitter as unknown as new () => {
  on<K extends keyof SerialEvents>(event: K, listener: SerialEvents[K]): unknown;
  once<K extends keyof SerialEvents>(event: K, listener: SerialEvents[K]): unknown;
  off<K extends keyof SerialEvents>(event: K, listener: SerialEvents[K]): unknown;
  removeAllListeners<K extends keyof SerialEvents>(event?: K): unknown;
  emit<K extends keyof SerialEvents>(event: K, ...args: Parameters<SerialEvents[K]>): boolean;
}) implements OnModuleInit, OnModuleDestroy {
  private isOpen: boolean = false;
  private useSimulator: boolean = true;
  private frameCounter: number = 0;
  private byteCounter: number = 0;
  private startedAt?: number;
  private destroyed: boolean = false;

  private port: SerialPortLike | null = null;
  private portPath: string = '';
  private baudRate: number = 115200;

  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnecting: boolean = false;

  private boundHandleData: (buf: Buffer) => void;
  private boundHandleError: (err: Error) => void;
  private boundHandleOpen: () => void;
  private boundHandleClose: () => void;
  private boundSimulatorData: (buf: Buffer) => void;

  constructor(
    private readonly logger: LoggerService,
    private readonly frameDecoder: FrameDecoderService,
    private readonly simulator: SimulatorService,
  ) {
    super();
    this.logger.setContext('Serial485');

    this.boundHandleData = (buf: Buffer) => this.handleIncomingData(buf);
    this.boundHandleError = (err: Error) => this.handleError(err);
    this.boundHandleOpen = () => this.handlePortOpen();
    this.boundHandleClose = () => this.handlePortClose();
    this.boundSimulatorData = (buf: Buffer) => this.handleIncomingData(buf);
  }

  async onModuleInit() {
    this.useSimulator = process.env.USE_SIMULATOR !== 'false';
    this.logger.log(`RS-485 驱动初始化: 模式=${this.useSimulator ? '仿真数据' : '真实硬件'}`);
    this.startedAt = Date.now();

    if (this.useSimulator) {
      this.attachSimulator();
      await this.simulator.start();
      this.isOpen = true;
      this.emit('open');
    } else {
      await this.openRealSerialPort();
    }
  }

  async onModuleDestroy() {
    this.destroyed = true;
    this.logger.log('RS-485 串口驱动正在关闭...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.useSimulator) {
      this.detachSimulator();
      await this.simulator.stop();
    } else {
      await this.destroyPort();
    }

    this.isOpen = false;
    this.removeAllListeners();
    this.logger.log('RS-485 串口驱动已安全关闭');
  }

  private attachSimulator() {
    this.simulator.on('data', this.boundSimulatorData);
  }

  private detachSimulator() {
    try {
      this.simulator.off('data', this.boundSimulatorData);
    } catch {
      /* ignore */
    }
  }

  private async openRealSerialPort(): Promise<boolean> {
    if (this.destroyed) return false;

    try {
      await this.destroyPort();

      const { SerialPort } = await import('serialport');
      this.portPath = process.env.SERIAL_PORT || 'COM3';
      this.baudRate = parseInt(process.env.SERIAL_BAUD || '115200', 10);

      const port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        autoOpen: false,
      });

      this.port = port as unknown as SerialPortLike;

      port.on('open', this.boundHandleOpen);
      port.on('data', this.boundHandleData);
      port.on('error', this.boundHandleError);
      port.on('close', this.boundHandleClose);

      await new Promise<void>((resolve, reject) => {
        port.open((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return true;
    } catch (err) {
      this.handleError(err as Error);
      this.scheduleReconnect();
      return false;
    }
  }

  private async destroyPort(): Promise<void> {
    const oldPort = this.port;
    this.port = null;

    if (!oldPort) return;

    try {
      oldPort.removeListener('data', this.boundHandleData);
      oldPort.removeListener('error', this.boundHandleError);
      oldPort.removeListener('open', this.boundHandleOpen);
      oldPort.removeListener('close', this.boundHandleClose);
    } catch {
      /* ignore cleanup errors */
    }

    try {
      oldPort.removeAllListeners?.();
    } catch {
      /* ignore */
    }

    try {
      if (oldPort.isOpen) {
        await new Promise<void>((resolve) => {
          try {
            oldPort.close?.(() => resolve());
          } catch {
            resolve();
          }
        });
      }
    } catch {
      /* ignore close errors */
    }

    try {
      (oldPort as any).destroy?.();
    } catch {
      /* ignore destroy errors */
    }
  }

  private handlePortOpen() {
    if (this.destroyed) return;
    this.isOpen = true;
    this.reconnectAttempts = 0;
    this.reconnecting = false;
    this.logger.log(`RS-485 串口已打开: ${this.portPath} @ ${this.baudRate}bps`);
    this.emit('open');
  }

  private handlePortClose() {
    this.isOpen = false;
    this.emit('close');

    if (!this.useSimulator && !this.destroyed && !this.reconnecting) {
      this.logger.warn('RS-485 串口意外断开，准备重连...');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnecting || this.useSimulator) return;
    if (this.reconnectAttempts >= RECONNECT.MAX_ATTEMPTS) {
      this.logger.error(
        `RS-485 串口重连失败 (已尝试 ${RECONNECT.MAX_ATTEMPTS} 次)，切换至仿真模式`,
      );
      this.switchToSimulator();
      return;
    }

    this.reconnecting = true;
    const delay = Math.min(
      RECONNECT.INITIAL_DELAY_MS * Math.pow(RECONNECT.BACKOFF_FACTOR, this.reconnectAttempts),
      RECONNECT.MAX_DELAY_MS,
    );

    this.reconnectAttempts++;
    this.logger.log(
      `RS-485 串口重连计划: 第 ${this.reconnectAttempts} 次, 延迟 ${delay}ms`,
    );
    this.emit('reconnect', this.reconnectAttempts);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      if (this.destroyed) return;
      const success = await this.openRealSerialPort();
      if (!success) {
        this.reconnecting = false;
      }
    }, delay);
  }

  private switchToSimulator() {
    this.useSimulator = true;
    this.attachSimulator();
    this.simulator.start().then(() => {
      this.isOpen = true;
      this.emit('open');
    });
    this.logger.warn('已切换至仿真数据模式运行');
  }

  private handleIncomingData(buffer: Buffer) {
    if (this.destroyed) return;

    this.byteCounter += buffer.length;
    this.emit('rawData', buffer);

    const frames = this.frameDecoder.consumeBuffer(buffer);
    for (const frame of frames) {
      this.frameCounter++;
      const frameAny = frame as unknown as Record<string, unknown>;
      frameAny.frameId = this.frameCounter;
      this.emit('frameDecoded', frame);
    }

    if (this.frameCounter % 10000 === 0) {
      const elapsed = (Date.now() - (this.startedAt || Date.now())) / 1000;
      this.logger.debug(
        `帧吞吐统计: ${this.frameCounter} 帧 / ${this.byteCounter} 字节 ` +
        `@ ${(this.frameCounter / elapsed).toFixed(1)} fps / ` +
        `${(this.byteCounter / elapsed / 1024).toFixed(2)} KB/s`,
      );
    }
  }

  private handleError(err: Error) {
    if (this.destroyed) return;
    this.logger.error(`RS-485 串口错误: ${err.message}`, err.stack);
    this.emit('error', err);
  }

  getStatus() {
    const elapsed = (Date.now() - (this.startedAt || Date.now())) / 1000;
    return {
      isOpen: this.isOpen,
      mode: this.useSimulator ? 'simulator' : 'hardware',
      frameCount: this.frameCounter,
      byteCount: this.byteCounter,
      frameRateFps: this.startedAt ? +(this.frameCounter / elapsed).toFixed(2) : 0,
      frameSizeBytes: SENSOR_FRAME_CONFIG.FRAME_SIZE,
      uptimeSec: +elapsed.toFixed(2),
      reconnectAttempts: this.reconnectAttempts,
      reconnecting: this.reconnecting,
    };
  }

  sendCommand(commandBuffer: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isOpen) {
        this.logger.warn('串口未打开，命令丢弃');
        resolve(false);
        return;
      }

      if (this.useSimulator) {
        this.logger.debug(`仿真模式下忽略控制命令: ${commandBuffer.toString('hex')}`);
        resolve(true);
        return;
      }

      if (this.port && typeof (this.port as any).write === 'function') {
        try {
          (this.port as any).write(commandBuffer, (err?: Error) => {
            if (err) {
              this.logger.error(`串口写失败: ${err.message}`);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } catch {
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }
}
