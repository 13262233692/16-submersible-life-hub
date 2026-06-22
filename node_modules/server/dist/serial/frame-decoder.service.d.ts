import { RawSensorFrame, DecodedSensorData } from '../common/interfaces/sensor.interface';
export declare class FrameDecoderService {
    private readonly buffer;
    private readonly frameSize;
    consumeBuffer(chunk: Buffer): Array<RawSensorFrame | DecodedSensorData>;
    private findPreamble;
    private validateAndExtractFrame;
    private decodeSensorData;
    encodeCommand(sensorId: number, payload: number[]): Buffer;
}
