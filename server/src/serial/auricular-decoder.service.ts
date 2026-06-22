import { Injectable } from '@nestjs/common';
import {
  AURICULAR_FRAME_CONFIG,
  AuricularRawFrame,
  DecodedAuricularData,
  AuricularSensorType,
  VitalSignsSample,
} from '../common/interfaces/auricular.interface';

@Injectable()
export class AuricularDecoderService {
  private readonly buffer: number[] = [];
  private readonly frameSize = AURICULAR_FRAME_CONFIG.FRAME_SIZE;
  private diverWindows: Map<number, Partial<VitalSignsSample>> = new Map();
  private lastDiverSamples: Map<number, VitalSignsSample> = new Map();

  constructor() {}

  consumeBuffer(chunk: Buffer): Array<AuricularRawFrame | DecodedAuricularData | VitalSignsSample> {
    const results: Array<AuricularRawFrame | DecodedAuricularData | VitalSignsSample> = [];
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
        const decoded = this.decodeAuricularData(rawFrame);
        if (decoded) {
          results.push(decoded);
          const sample = this.aggregateVitalSigns(decoded);
          if (sample) results.push(sample);
        }
      }
      this.buffer.splice(0, this.frameSize);
    }

    return results;
  }

  private findPreamble(): number {
    const len = this.buffer.length;
    const { PREAMBLE, END_BYTE } = AURICULAR_FRAME_CONFIG;
    for (let i = 0; i <= len - this.frameSize; i++) {
      if (
        this.buffer[i] === PREAMBLE &&
        this.buffer[i + this.frameSize - 1] === END_BYTE
      ) {
        return i;
      }
    }
    for (let i = 0; i < len; i++) {
      if (this.buffer[i] === PREAMBLE) return i;
    }
    return -1;
  }

  private validateAndExtractFrame(bytes: number[]): AuricularRawFrame | null {
    const { DIVER_ID_BYTE, SENSOR_ID_BYTE, DATA_START_BYTE, DATA_LENGTH, CHECKSUM_BYTE, SENSOR_ID_MAP } =
      AURICULAR_FRAME_CONFIG;

    const diverId = bytes[DIVER_ID_BYTE] & 0xFF;
    const sensorId = bytes[SENSOR_ID_BYTE];
    const chkIdx = CHECKSUM_BYTE;

    let calcChecksum = 0;
    for (let i = 0; i < chkIdx; i++) {
      calcChecksum = (calcChecksum + bytes[i]) & 0xFF;
    }
    calcChecksum = ((~calcChecksum + 1) & 0xFF);

    const checksumValid = bytes[chkIdx] === calcChecksum;

    let rawValue = 0;
    for (let i = 0; i < DATA_LENGTH; i++) {
      rawValue = (rawValue << 8) | (bytes[DATA_START_BYTE + i] & 0xFF);
    }

    const hexArr: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      hexArr.push(bytes[i].toString(16).padStart(2, '0'));
    }

    const sensorType =
      SENSOR_ID_MAP[sensorId as keyof typeof SENSOR_ID_MAP] ||
      AuricularSensorType.PPG_EAR;

    return {
      timestamp: Date.now(),
      diverId,
      sensorType,
      rawHex: hexArr.join(' '),
      rawValue,
      checksumValid,
    };
  }

  private decodeAuricularData(raw: AuricularRawFrame): DecodedAuricularData | null {
    if (!raw.checksumValid) return null;

    const scaling = AURICULAR_FRAME_CONFIG.SENSOR_SCALING[raw.sensorType];
    if (!scaling) return null;

    const value = raw.rawValue * scaling.scale + scaling.offset;
    const clamped = Math.max(scaling.min, Math.min(scaling.max, value));

    return {
      timestamp: raw.timestamp,
      diverId: raw.diverId,
      sensorType: raw.sensorType,
      value: clamped,
      unit: scaling.unit,
      rawHex: raw.rawHex,
      quality: 1.0,
    };
  }

  private aggregateVitalSigns(decoded: DecodedAuricularData): VitalSignsSample | null {
    const { diverId, sensorType, value, timestamp } = decoded;

    let window = this.diverWindows.get(diverId) || {};

    switch (sensorType) {
      case AuricularSensorType.BLOOD_OXYGEN:
        window.spo2Percent = value;
        break;
      case AuricularSensorType.PULSE_RATE:
        window.pulseBpm = value;
        break;
      case AuricularSensorType.PERFUSION_INDEX:
        window.perfusionIndex = value;
        break;
      case AuricularSensorType.PPG_EAR:
        window.ppgAmplitude = value;
        break;
    }

    window.timestamp = timestamp;
    window.diverId = diverId;
    this.diverWindows.set(diverId, window);

    if (
      window.pulseBpm !== undefined &&
      window.spo2Percent !== undefined &&
      window.perfusionIndex !== undefined &&
      window.ppgAmplitude !== undefined
    ) {
      const prev = this.lastDiverSamples.get(diverId);
      const prevRR = prev?.respiratoryRate ?? 16;
      const pulse = window.pulseBpm;
      const estimatedRR = prevRR * 0.9 + (pulse / 4) * 0.1;

      const sample: VitalSignsSample = {
        timestamp,
        diverId,
        pulseBpm: window.pulseBpm,
        spo2Percent: window.spo2Percent,
        perfusionIndex: window.perfusionIndex,
        ppgAmplitude: window.ppgAmplitude,
        respiratoryRate: estimatedRR,
      };

      this.lastDiverSamples.set(diverId, sample);
      this.diverWindows.delete(diverId);
      return sample;
    }

    return null;
  }

  getLastVitalSigns(diverId?: number): VitalSignsSample[] {
    if (diverId !== undefined) {
      const s = this.lastDiverSamples.get(diverId);
      return s ? [s] : [];
    }
    return Array.from(this.lastDiverSamples.values());
  }

  encodeAuricularCommand(diverId: number, sensorId: number, payload: number[]): Buffer {
    const cmd: number[] = [];
    cmd.push(AURICULAR_FRAME_CONFIG.PREAMBLE);
    cmd.push(diverId & 0xFF);
    cmd.push(sensorId & 0xFF);

    for (let i = 0; i < 8; i++) {
      cmd.push((payload[i] ?? 0) & 0xFF);
    }

    cmd.push(0x00);
    cmd.push(0x00);
    cmd.push(0x00);

    let chk = 0;
    for (let i = 0; i < cmd.length; i++) {
      chk = (chk + cmd[i]) & 0xFF;
    }
    cmd.push((~chk + 1) & 0xFF);
    cmd.push(0x00);
    cmd.push(AURICULAR_FRAME_CONFIG.END_BYTE);

    return Buffer.from(cmd);
  }
}
