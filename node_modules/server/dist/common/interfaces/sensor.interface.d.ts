export interface RawSensorFrame {
    timestamp: number;
    frameId: number;
    sensorType: SensorType;
    rawHex: string;
    rawValue: number;
    checksumValid: boolean;
}
export declare enum SensorType {
    OXYGEN_PARTIAL_PRESSURE = "O2_PP",
    CARBON_DIOXIDE = "CO2",
    ABSOLUTE_PRESSURE = "P_ABS",
    TEMPERATURE = "TEMP",
    HUMIDITY = "HUM"
}
export interface DecodedSensorData {
    timestamp: number;
    sensorType: SensorType;
    value: number;
    unit: string;
    rawHex: string;
    filteredValue?: number;
}
export interface OxygenSensorData extends DecodedSensorData {
    sensorType: SensorType.OXYGEN_PARTIAL_PRESSURE;
    value: number;
    unit: 'kPa';
}
export interface CO2SensorData extends DecodedSensorData {
    sensorType: SensorType.CARBON_DIOXIDE;
    value: number;
    unit: 'ppm' | 'kPa';
}
export interface PressureSensorData extends DecodedSensorData {
    sensorType: SensorType.ABSOLUTE_PRESSURE;
    value: number;
    unit: 'kPa' | 'bar';
}
export declare const SENSOR_FRAME_CONFIG: {
    PREAMBLE: number;
    FRAME_SIZE: number;
    SENSOR_ID_BYTE: number;
    DATA_START_BYTE: number;
    DATA_LENGTH: number;
    CHECKSUM_BYTE: number;
    END_BYTE: number;
    SENSOR_ID_MAP: {
        1: SensorType;
        2: SensorType;
        3: SensorType;
        4: SensorType;
        5: SensorType;
    };
    SENSOR_SCALING: {
        O2_PP: {
            scale: number;
            offset: number;
            unit: string;
            min: number;
            max: number;
        };
        CO2: {
            scale: number;
            offset: number;
            unit: string;
            min: number;
            max: number;
        };
        P_ABS: {
            scale: number;
            offset: number;
            unit: string;
            min: number;
            max: number;
        };
        TEMP: {
            scale: number;
            offset: number;
            unit: string;
            min: number;
            max: number;
        };
        HUM: {
            scale: number;
            offset: number;
            unit: string;
            min: number;
            max: number;
        };
    };
};
