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
exports.MasterControlReporter = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../common/logger/logger.service");
const crypto = require("crypto");
let MasterControlReporter = class MasterControlReporter {
    logger;
    latestReport = null;
    reportCounter = 0;
    reportHistory = [];
    constructor(logger) {
        this.logger = logger;
        this.logger.setContext('MCP-Reporter');
    }
    generateReport(state, valveStatuses) {
        this.reportCounter++;
        const payload = {
            vehicleId: 'FZ-2024-1103',
            missionPhase: this.determineMissionPhase(state),
            allValvesStatus: valveStatuses,
            biochemicalSnapshot: state,
            controlAlgorithmState: state.safetyIndicators.overallStatus === 'normal' ? 'NOMINAL' : 'ACTIVE_CORRECTION',
        };
        const reportId = `MCP-${Date.now().toString(36)}-${this.reportCounter.toString(16).padStart(6, '0')}`;
        const timestamp = Date.now();
        const checksumMaterial = JSON.stringify(payload) + reportId + timestamp;
        const checksum = crypto
            .createHash('sha256')
            .update(checksumMaterial)
            .digest('hex')
            .substring(0, 16);
        const report = {
            ...payload,
            reportId,
            timestamp,
            checksum,
        };
        this.latestReport = report;
        this.reportHistory.push(report);
        if (this.reportHistory.length > 256)
            this.reportHistory.shift();
        if (this.reportCounter % 50 === 0) {
            this.logger.debug(`主控上报周期完成 #${this.reportCounter}: 相位=${report.missionPhase}, ` +
                `状态=${report.controlAlgorithmState}, Checksum=${checksum.substring(0, 8)}`);
        }
        return report;
    }
    determineMissionPhase(state) {
        if (state.safetyIndicators.overallStatus === 'fatal')
            return 'EMERGENCY_ASCENT';
        if (state.safetyIndicators.overallStatus === 'critical')
            return 'SAFETY_PROTOCOL';
        if (state.safetyIndicators.overallStatus === 'warning')
            return 'ACTIVE_MONITORING';
        if (state.o2ReserveMinutes < 30)
            return 'RESERVE_LOW';
        return 'SCIENCE_OPERATION';
    }
    getLatestReport() {
        return this.latestReport;
    }
    getReportHistory(limit = 10) {
        return this.reportHistory.slice(-limit);
    }
    validateReport(report) {
        const { checksum, reportId, timestamp, ...payload } = report;
        const material = JSON.stringify(payload) + reportId + timestamp;
        const expected = crypto.createHash('sha256').update(material).digest('hex').substring(0, 16);
        return checksum === expected;
    }
};
exports.MasterControlReporter = MasterControlReporter;
exports.MasterControlReporter = MasterControlReporter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], MasterControlReporter);
//# sourceMappingURL=master-control-reporter.service.js.map