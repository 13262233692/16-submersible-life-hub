import { OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';
export declare class DiffusionGridService implements OnModuleInit {
    private readonly logger;
    private gridWidth;
    private gridHeight;
    private o2Grid;
    private co2Grid;
    private pressureGrid;
    private vX;
    private vY;
    private lastFrame;
    private timeStep;
    private cabinMask;
    private readonly diffusionCoefO2;
    private readonly diffusionCoefCO2;
    constructor(logger: LoggerService);
    onModuleInit(): void;
    private generateCabinMask;
    private initializeGrids;
    simulate(state: BiochemicalState): GasDiffusionGrid;
    private injectBoundaryConditions;
    private getSourceLocations;
    private getSinkLocations;
    private applyDiffusion;
    private applyAdvection;
    private bilinear;
    private enforceBoundaryMask;
    private stirFlow;
    getCabinMask(): Uint8Array;
    getResolution(): {
        w: number;
        h: number;
    };
}
