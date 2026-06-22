import { AuricularRawFrame, DecodedAuricularData, VitalSignsSample } from '../common/interfaces/auricular.interface';
export declare class AuricularDecoderService {
    private readonly buffer;
    private readonly frameSize;
    private diverWindows;
    private lastDiverSamples;
    constructor();
    consumeBuffer(chunk: Buffer): Array<AuricularRawFrame | DecodedAuricularData | VitalSignsSample>;
    private findPreamble;
    private validateAndExtractFrame;
    private decodeAuricularData;
    private aggregateVitalSigns;
    getLastVitalSigns(diverId?: number): VitalSignsSample[];
    encodeAuricularCommand(diverId: number, sensorId: number, payload: number[]): Buffer;
}
