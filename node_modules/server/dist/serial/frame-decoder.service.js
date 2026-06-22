"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrameDecoderService = void 0;
const common_1 = require("@nestjs/common");
const sensor_interface_1 = require("../common/interfaces/sensor.interface");
let FrameDecoderService = class FrameDecoderService {
    buffer = [];
    frameSize = sensor_interface_1.SENSOR_FRAME_CONFIG.FRAME_SIZE;
    consumeBuffer(chunk) {
        const results = [];
        for (let i = 0; i < chunk.length; i++) {
            this.buffer.push(chunk[i]);
        }
        while (this.buffer.length >= this.frameSize) {
            const preambleIndex = this.findPreamble();
            if (preambleIndex === -1) {
                this.buffer.splice(0, Math.max(0, this.buffer.length - this.frameSize + 1));
                break;
            }
            if (preambleIndex > 0) {
                this.buffer.splice(0, preambleIndex);
            }
            if (this.buffer.length < this.frameSize)
                break;
            const frameBytes = this.buffer.slice(0, this.frameSize);
            const rawFrame = this.validateAndExtractFrame(frameBytes);
            if (rawFrame) {
                results.push(rawFrame);
                const decoded = this.decodeSensorData(rawFrame);
                if (decoded)
                    results.push(decoded);
            }
            this.buffer.splice(0, this.frameSize);
        }
        return results;
    }
    findPreamble() {
        const len = this.buffer.length;
        for (let i = 0; i <= len - this.frameSize; i++) {
            if (this.buffer[i] === sensor_interface_1.SENSOR_FRAME_CONFIG.PREAMBLE &&
                this.buffer[i + this.frameSize - 1] === sensor_interface_1.SENSOR_FRAME_CONFIG.END_BYTE) {
                return i;
            }
        }
        for (let i = 0; i < len; i++) {
            if (this.buffer[i] === sensor_interface_1.SENSOR_FRAME_CONFIG.PREAMBLE)
                return i;
        }
        return -1;
    }
    validateAndExtractFrame(bytes) {
        const sensorId = bytes[sensor_interface_1.SENSOR_FRAME_CONFIG.SENSOR_ID_BYTE];
        const dataStart = sensor_interface_1.SENSOR_FRAME_CONFIG.DATA_START_BYTE;
        const dataLen = sensor_interface_1.SENSOR_FRAME_CONFIG.DATA_LENGTH;
        const chkIdx = sensor_interface_1.SENSOR_FRAME_CONFIG.CHECKSUM_BYTE;
        let calcChecksum = 0;
        for (let i = 0; i < chkIdx; i++) {
            calcChecksum = (calcChecksum + bytes[i]) & 0xFF;
        }
        calcChecksum = ((~calcChecksum + 1) & 0xFF);
        const checksumValid = bytes[chkIdx] === calcChecksum;
        let rawValue = 0;
        for (let i = 0; i < dataLen; i++) {
            rawValue = (rawValue << 8) | (bytes[dataStart + i] & 0xFF);
        }
        const hexArr = [];
        for (let i = 0; i < bytes.length; i++) {
            hexArr.push(bytes[i].toString(16).padStart(2, '0'));
        }
        return {
            timestamp: Date.now(),
            frameId: 0,
            sensorType: sensor_interface_1.SENSOR_FRAME_CONFIG.SENSOR_ID_MAP[sensorId] || sensor_interface_1.SensorType.TEMPERATURE,
            rawHex: hexArr.join(' '),
            rawValue,
            checksumValid,
        };
    }
    decodeSensorData(raw) {
        if (!raw.checksumValid)
            return null;
        const scaling = sensor_interface_1.SENSOR_FRAME_CONFIG.SENSOR_SCALING[raw.sensorType];
        if (!scaling)
            return null;
        const value = raw.rawValue * scaling.scale + scaling.offset;
        const clamped = Math.max(scaling.min, Math.min(scaling.max, value));
        return {
            timestamp: raw.timestamp,
            sensorType: raw.sensorType,
            value: clamped,
            unit: scaling.unit,
            rawHex: raw.rawHex,
        };
    }
    encodeCommand(sensorId, payload) {
        const cmd = [];
        cmd.push(sensor_interface_1.SENSOR_FRAME_CONFIG.PREAMBLE);
        cmd.push(sensorId & 0xFF);
        for (let i = 0; i < 4; i++) {
            cmd.push((payload[i] ?? 0) & 0xFF);
        }
        let chk = 0;
        for (let i = 0; i < cmd.length; i++) {
            chk = (chk + cmd[i]) & 0xFF;
        }
        cmd.push((~chk + 1) & 0xFF);
        cmd.push(0x00);
        cmd.push(sensor_interface_1.SENSOR_FRAME_CONFIG.END_BYTE);
        return Buffer.from(cmd);
    }
};
exports.FrameDecoderService = FrameDecoderService;
exports.FrameDecoderService = FrameDecoderService = __decorate([
    (0, common_1.Injectable)()
], FrameDecoderService);
//# sourceMappingURL=frame-decoder.service.js.map