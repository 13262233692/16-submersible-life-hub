import { Injectable } from '@nestjs/common';
import {
  SENSOR_FRAME_CONFIG,
  RawSensorFrame,
  DecodedSensorData,
  SensorType,
} from '../common/interfaces/sensor.interface';

@Injectable()
export class FrameDecoderService {
  private readonly buffer: number[] = [];
  private readonly frameSize = SENSOR_FRAME_CONFIG.FRAME_SIZE;

  consumeBuffer(chunk: Buffer): Array<RawSensorFrame | DecodedSensorData> {
    const results: Array<RawSensorFrame | DecodedSensorData> = [];
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

      if (this.buffer.length < this.frameSize) break;

      const frameBytes = this.buffer.slice(0, this.frameSize);
      const rawFrame = this.validateAndExtractFrame(frameBytes);
      if (rawFrame) {
        results.push(rawFrame);
        const decoded = this.decodeSensorData(rawFrame);
        if (decoded) results.push(decoded);
      }
      this.buffer.splice(0, this.frameSize);
    }

    return results;
  }

  private findPreamble(): number {
    const len = this.buffer.length;
    for (let i = 0; i <= len - this.frameSize; i++) {
      if (
        this.buffer[i] === SENSOR_FRAME_CONFIG.PREAMBLE &&
        this.buffer[i + this.frameSize - 1] === SENSOR_FRAME_CONFIG.END_BYTE
      ) {
        return i;
      }
    }
    for (let i = 0; i < len; i++) {
      if (this.buffer[i] === SENSOR_FRAME_CONFIG.PREAMBLE) return i;
    }
    return -1;
  }

  private validateAndExtractFrame(bytes: number[]): RawSensorFrame | null {
    const sensorId = bytes[SENSOR_FRAME_CONFIG.SENSOR_ID_BYTE];
    const dataStart = SENSOR_FRAME_CONFIG.DATA_START_BYTE;
    const dataLen = SENSOR_FRAME_CONFIG.DATA_LENGTH;
    const chkIdx = SENSOR_FRAME_CONFIG.CHECKSUM_BYTE;

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

    const hexArr: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      hexArr.push(bytes[i].toString(16).padStart(2, '0'));
    }

    return {
      timestamp: Date.now(),
      frameId: 0,
      sensorType: SENSOR_FRAME_CONFIG.SENSOR_ID_MAP[sensorId as keyof typeof SENSOR_FRAME_CONFIG.SENSOR_ID_MAP] || SensorType.TEMPERATURE,
      rawHex: hexArr.join(' '),
      rawValue,
      checksumValid,
    };
  }

  private decodeSensorData(raw: RawSensorFrame): DecodedSensorData | null {
    if (!raw.checksumValid) return null;

    const scaling = SENSOR_FRAME_CONFIG.SENSOR_SCALING[raw.sensorType];
    if (!scaling) return null;

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

  encodeCommand(sensorId: number, payload: number[]): Buffer {
    const cmd: number[] = [];
    cmd.push(SENSOR_FRAME_CONFIG.PREAMBLE);
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
    cmd.push(SENSOR_FRAME_CONFIG.END_BYTE);

    return Buffer.from(cmd);
  }
}
