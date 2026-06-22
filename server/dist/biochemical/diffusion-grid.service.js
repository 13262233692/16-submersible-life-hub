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
exports.DiffusionGridService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
const biochemical_interface_1 = require("../common/interfaces/biochemical.interface");
let DiffusionGridService = class DiffusionGridService {
    logger;
    gridWidth = 64;
    gridHeight = 64;
    o2Grid;
    co2Grid;
    pressureGrid;
    vX;
    vY;
    lastFrame = 0;
    timeStep = 0;
    cabinMask;
    diffusionCoefO2 = 2.1e-5;
    diffusionCoefCO2 = 1.6e-5;
    constructor(logger) {
        this.logger = logger;
        const n = this.gridWidth * this.gridHeight;
        this.o2Grid = new Float32Array(n);
        this.co2Grid = new Float32Array(n);
        this.pressureGrid = new Float32Array(n);
        this.vX = new Float32Array(n);
        this.vY = new Float32Array(n);
        this.cabinMask = new Uint8Array(n);
    }
    onModuleInit() {
        this.logger.setContext('DiffusionGrid');
        this.generateCabinMask();
        this.initializeGrids();
        this.logger.log(`流体扩散网格初始化: ${this.gridWidth}x${this.gridHeight} = ${this.gridWidth * this.gridHeight} 格点`);
    }
    generateCabinMask() {
        const cx = this.gridWidth / 2;
        const cy = this.gridHeight / 2;
        const rx = this.gridWidth * 0.44;
        const ry = this.gridHeight * 0.38;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const idx = y * this.gridWidth + x;
                const nx = (x - cx) / rx;
                const ny = (y - cy) / ry;
                const d = nx * nx + ny * ny;
                this.cabinMask[idx] = d <= 1.0 ? 1 : 0;
            }
        }
    }
    initializeGrids() {
        const baseO2 = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_O2_FRACTION;
        const baseCO2 = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.NOMINAL_CO2_PPM / 1_000_000;
        const baseP = biochemical_interface_1.BIOCHEMICAL_CONSTANTS.STANDARD_ATMOSPHERE_KPA;
        for (let i = 0; i < this.o2Grid.length; i++) {
            if (this.cabinMask[i]) {
                this.o2Grid[i] = baseO2;
                this.co2Grid[i] = baseCO2;
                this.pressureGrid[i] = baseP;
                this.vX[i] = (Math.random() - 0.5) * 0.002;
                this.vY[i] = (Math.random() - 0.5) * 0.002;
            }
        }
    }
    simulate(state) {
        const now = performance.now();
        const dt = this.lastFrame > 0 ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.05;
        this.lastFrame = now;
        this.timeStep += dt;
        this.injectBoundaryConditions(state);
        this.applyDiffusion(dt);
        this.applyAdvection(dt);
        this.enforceBoundaryMask();
        this.stirFlow(dt);
        return {
            timestamp: Date.now(),
            width: this.gridWidth,
            height: this.gridHeight,
            o2Grid: new Float32Array(this.o2Grid),
            co2Grid: new Float32Array(this.co2Grid),
            pressureGrid: new Float32Array(this.pressureGrid),
            flowVX: new Float32Array(this.vX),
            flowVY: new Float32Array(this.vY),
        };
    }
    injectBoundaryConditions(state) {
        const sources = this.getSourceLocations();
        const sinks = this.getSinkLocations();
        for (const [sx, sy, strength] of sources) {
            const idx = sy * this.gridWidth + sx;
            if (!this.cabinMask[idx])
                continue;
            const o2Boost = 0.002 * strength;
            const co2Dilute = 0.000001 * strength;
            this.o2Grid[idx] = Math.min(0.4, this.o2Grid[idx] + o2Boost);
            this.co2Grid[idx] = Math.max(0, this.co2Grid[idx] - co2Dilute);
            this.vX[idx] += (Math.random() - 0.5) * 0.003;
            this.vY[idx] += (Math.random() - 0.5) * 0.003;
        }
        for (const [sx, sy] of sinks) {
            const idx = sy * this.gridWidth + sx;
            if (!this.cabinMask[idx])
                continue;
            const crewO2Draw = state.metabolicO2ConsumptionRate / 20000;
            const crewCO2Emit = state.metabolicCO2ProductionRate / 10000000;
            this.o2Grid[idx] = Math.max(0.1, this.o2Grid[idx] - crewO2Draw);
            this.co2Grid[idx] = Math.min(0.05, this.co2Grid[idx] + crewCO2Emit);
        }
    }
    getSourceLocations() {
        return [
            [15, Math.floor(this.gridHeight * 0.5), 1.0],
            [this.gridWidth - 15, Math.floor(this.gridHeight * 0.5), 1.0],
            [Math.floor(this.gridWidth * 0.5), 10, 0.6],
        ];
    }
    getSinkLocations() {
        return [
            [Math.floor(this.gridWidth * 0.32), Math.floor(this.gridHeight * 0.62)],
            [Math.floor(this.gridWidth * 0.5), Math.floor(this.gridHeight * 0.66)],
            [Math.floor(this.gridWidth * 0.68), Math.floor(this.gridHeight * 0.62)],
        ];
    }
    applyDiffusion(dt) {
        const w = this.gridWidth;
        const h = this.gridHeight;
        const nextO2 = new Float32Array(this.o2Grid.length);
        const nextCO2 = new Float32Array(this.co2Grid.length);
        const dx = 1;
        const dCoefO2 = Math.min(0.12, this.diffusionCoefO2 * 1e6 * dt / (dx * dx));
        const dCoefCO2 = Math.min(0.12, this.diffusionCoefCO2 * 1e6 * dt / (dx * dx));
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                if (!this.cabinMask[i])
                    continue;
                const neighbors = [
                    i - 1, i + 1, i - w, i + w,
                ];
                let o2Sum = 0, co2Sum = 0, count = 0;
                for (const nIdx of neighbors) {
                    if (this.cabinMask[nIdx]) {
                        o2Sum += this.o2Grid[nIdx];
                        co2Sum += this.co2Grid[nIdx];
                        count++;
                    }
                }
                if (count > 0) {
                    const o2Lap = (o2Sum / count) - this.o2Grid[i];
                    const co2Lap = (co2Sum / count) - this.co2Grid[i];
                    nextO2[i] = this.o2Grid[i] + dCoefO2 * o2Lap;
                    nextCO2[i] = this.co2Grid[i] + dCoefCO2 * co2Lap;
                }
                else {
                    nextO2[i] = this.o2Grid[i];
                    nextCO2[i] = this.co2Grid[i];
                }
            }
        }
        for (let i = 0; i < this.o2Grid.length; i++) {
            if (this.cabinMask[i] && nextO2[i] > 0) {
                this.o2Grid[i] = nextO2[i];
                this.co2Grid[i] = nextCO2[i];
            }
        }
    }
    applyAdvection(dt) {
        const w = this.gridWidth;
        const h = this.gridHeight;
        const velScale = dt * 12;
        const srcO2 = new Float32Array(this.o2Grid);
        const srcCO2 = new Float32Array(this.co2Grid);
        for (let y = 2; y < h - 2; y++) {
            for (let x = 2; x < w - 2; x++) {
                const i = y * w + x;
                if (!this.cabinMask[i])
                    continue;
                const vx = this.vX[i] * velScale;
                const vy = this.vY[i] * velScale;
                const srcX = x - vx;
                const srcY = y - vy;
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const fx = srcX - x0;
                const fy = srcY - y0;
                const clampedX0 = Math.max(1, Math.min(w - 2, x0));
                const clampedY0 = Math.max(1, Math.min(h - 2, y0));
                const clampedX1 = Math.max(1, Math.min(w - 2, x0 + 1));
                const clampedY1 = Math.max(1, Math.min(h - 2, y0 + 1));
                const i00 = clampedY0 * w + clampedX0;
                const i10 = clampedY0 * w + clampedX1;
                const i01 = clampedY1 * w + clampedX0;
                const i11 = clampedY1 * w + clampedX1;
                this.o2Grid[i] = this.bilinear(srcO2, i00, i10, i01, i11, fx, fy);
                this.co2Grid[i] = this.bilinear(srcCO2, i00, i10, i01, i11, fx, fy);
            }
        }
    }
    bilinear(src, i00, i10, i01, i11, fx, fy) {
        const a = src[i00] * (1 - fx) + src[i10] * fx;
        const b = src[i01] * (1 - fx) + src[i11] * fx;
        return a * (1 - fy) + b * fy;
    }
    enforceBoundaryMask() {
        for (let i = 0; i < this.cabinMask.length; i++) {
            if (!this.cabinMask[i]) {
                this.o2Grid[i] = 0;
                this.co2Grid[i] = 0;
                this.pressureGrid[i] = 0;
                this.vX[i] = 0;
                this.vY[i] = 0;
            }
        }
    }
    stirFlow(dt) {
        const w = this.gridWidth;
        const stir = Math.sin(this.timeStep * 0.8) * 0.0005;
        const stirY = Math.cos(this.timeStep * 0.6) * 0.0005;
        for (let i = 0; i < this.vX.length; i++) {
            if (!this.cabinMask[i])
                continue;
            const y = Math.floor(i / w);
            const centerY = this.gridHeight / 2;
            this.vX[i] += stir * ((y - centerY) / this.gridHeight) * 2;
            this.vY[i] += stirY * 0.5;
            this.vX[i] *= 0.985;
            this.vY[i] *= 0.985;
            const speed = Math.sqrt(this.vX[i] * this.vX[i] + this.vY[i] * this.vY[i]);
            if (speed > 0.008) {
                this.vX[i] = (this.vX[i] / speed) * 0.008;
                this.vY[i] = (this.vY[i] / speed) * 0.008;
            }
        }
        void dt;
    }
    getCabinMask() {
        return new Uint8Array(this.cabinMask);
    }
    getResolution() {
        return { w: this.gridWidth, h: this.gridHeight };
    }
};
exports.DiffusionGridService = DiffusionGridService;
exports.DiffusionGridService = DiffusionGridService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], DiffusionGridService);
//# sourceMappingURL=diffusion-grid.service.js.map