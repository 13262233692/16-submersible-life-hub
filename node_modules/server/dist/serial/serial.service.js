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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const logger_service_1 = require("../common/logger/logger.service");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
const frame_decoder_service_1 = require("./frame-decoder.service");
const simulator_service_1 = require("./simulator.service");
const RECONNECT = {
    INITIAL_DELAY_MS: 500,
    MAX_DELAY_MS: 30_000,
    MAX_ATTEMPTS: 20,
    BACKOFF_FACTOR: 2,
};
let SerialService = class SerialService extends events_1.EventEmitter {
    logger;
    frameDecoder;
    simulator;
    isOpen = false;
    useSimulator = true;
    frameCounter = 0;
    byteCounter = 0;
    startedAt;
    destroyed = false;
    port = null;
    portPath = '';
    baudRate = 115200;
    reconnectAttempts = 0;
    reconnectTimer;
    reconnecting = false;
    boundHandleData;
    boundHandleError;
    boundHandleOpen;
    boundHandleClose;
    boundSimulatorData;
    constructor(logger, frameDecoder, simulator) {
        super();
        this.logger = logger;
        this.frameDecoder = frameDecoder;
        this.simulator = simulator;
        this.logger.setContext('Serial485');
        this.boundHandleData = (buf) => this.handleIncomingData(buf);
        this.boundHandleError = (err) => this.handleError(err);
        this.boundHandleOpen = () => this.handlePortOpen();
        this.boundHandleClose = () => this.handlePortClose();
        this.boundSimulatorData = (buf) => this.handleIncomingData(buf);
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
        }
        else {
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
        }
        else {
            await this.destroyPort();
        }
        this.isOpen = false;
        this.removeAllListeners();
        this.logger.log('RS-485 串口驱动已安全关闭');
    }
    attachSimulator() {
        this.simulator.on('data', this.boundSimulatorData);
    }
    detachSimulator() {
        try {
            this.simulator.off('data', this.boundSimulatorData);
        }
        catch {
        }
    }
    async openRealSerialPort() {
        if (this.destroyed)
            return false;
        try {
            await this.destroyPort();
            const { SerialPort } = await Promise.resolve().then(() => require('serialport'));
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
            this.port = port;
            port.on('open', this.boundHandleOpen);
            port.on('data', this.boundHandleData);
            port.on('error', this.boundHandleError);
            port.on('close', this.boundHandleClose);
            await new Promise((resolve, reject) => {
                port.open((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            return true;
        }
        catch (err) {
            this.handleError(err);
            this.scheduleReconnect();
            return false;
        }
    }
    async destroyPort() {
        const oldPort = this.port;
        this.port = null;
        if (!oldPort)
            return;
        try {
            oldPort.removeListener('data', this.boundHandleData);
            oldPort.removeListener('error', this.boundHandleError);
            oldPort.removeListener('open', this.boundHandleOpen);
            oldPort.removeListener('close', this.boundHandleClose);
        }
        catch {
        }
        try {
            oldPort.removeAllListeners?.();
        }
        catch {
        }
        try {
            if (oldPort.isOpen) {
                await new Promise((resolve) => {
                    try {
                        oldPort.close?.(() => resolve());
                    }
                    catch {
                        resolve();
                    }
                });
            }
        }
        catch {
        }
        try {
            oldPort.destroy?.();
        }
        catch {
        }
    }
    handlePortOpen() {
        if (this.destroyed)
            return;
        this.isOpen = true;
        this.reconnectAttempts = 0;
        this.reconnecting = false;
        this.logger.log(`RS-485 串口已打开: ${this.portPath} @ ${this.baudRate}bps`);
        this.emit('open');
    }
    handlePortClose() {
        this.isOpen = false;
        this.emit('close');
        if (!this.useSimulator && !this.destroyed && !this.reconnecting) {
            this.logger.warn('RS-485 串口意外断开，准备重连...');
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.destroyed || this.reconnecting || this.useSimulator)
            return;
        if (this.reconnectAttempts >= RECONNECT.MAX_ATTEMPTS) {
            this.logger.error(`RS-485 串口重连失败 (已尝试 ${RECONNECT.MAX_ATTEMPTS} 次)，切换至仿真模式`);
            this.switchToSimulator();
            return;
        }
        this.reconnecting = true;
        const delay = Math.min(RECONNECT.INITIAL_DELAY_MS * Math.pow(RECONNECT.BACKOFF_FACTOR, this.reconnectAttempts), RECONNECT.MAX_DELAY_MS);
        this.reconnectAttempts++;
        this.logger.log(`RS-485 串口重连计划: 第 ${this.reconnectAttempts} 次, 延迟 ${delay}ms`);
        this.emit('reconnect', this.reconnectAttempts);
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(async () => {
            if (this.destroyed)
                return;
            const success = await this.openRealSerialPort();
            if (!success) {
                this.reconnecting = false;
            }
        }, delay);
    }
    switchToSimulator() {
        this.useSimulator = true;
        this.attachSimulator();
        this.simulator.start().then(() => {
            this.isOpen = true;
            this.emit('open');
        });
        this.logger.warn('已切换至仿真数据模式运行');
    }
    handleIncomingData(buffer) {
        if (this.destroyed)
            return;
        this.byteCounter += buffer.length;
        this.emit('rawData', buffer);
        const frames = this.frameDecoder.consumeBuffer(buffer);
        for (const frame of frames) {
            this.frameCounter++;
            const frameAny = frame;
            frameAny.frameId = this.frameCounter;
            this.emit('frameDecoded', frame);
        }
        if (this.frameCounter % 10000 === 0) {
            const elapsed = (Date.now() - (this.startedAt || Date.now())) / 1000;
            this.logger.debug(`帧吞吐统计: ${this.frameCounter} 帧 / ${this.byteCounter} 字节 ` +
                `@ ${(this.frameCounter / elapsed).toFixed(1)} fps / ` +
                `${(this.byteCounter / elapsed / 1024).toFixed(2)} KB/s`);
        }
    }
    handleError(err) {
        if (this.destroyed)
            return;
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
            frameSizeBytes: sensor_interface_1.SENSOR_FRAME_CONFIG.FRAME_SIZE,
            uptimeSec: +elapsed.toFixed(2),
            reconnectAttempts: this.reconnectAttempts,
            reconnecting: this.reconnecting,
        };
    }
    sendCommand(commandBuffer) {
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
            if (this.port && typeof this.port.write === 'function') {
                try {
                    this.port.write(commandBuffer, (err) => {
                        if (err) {
                            this.logger.error(`串口写失败: ${err.message}`);
                            resolve(false);
                        }
                        else {
                            resolve(true);
                        }
                    });
                }
                catch {
                    resolve(false);
                }
            }
            else {
                resolve(false);
            }
        });
    }
};
exports.SerialService = SerialService;
exports.SerialService = SerialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        frame_decoder_service_1.FrameDecoderService,
        simulator_service_1.SimulatorService])
], SerialService);
//# sourceMappingURL=serial.service.js.map