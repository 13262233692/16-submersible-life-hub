import { LoggerService } from '../common/logger/logger.service';
import { MasterControlReport, ValveStatusReport } from '../common/interfaces/gas-control.interface';
import { BiochemicalState } from '../common/interfaces/biochemical.interface';
export declare class MasterControlReporter {
    private readonly logger;
    private latestReport;
    private reportCounter;
    private reportHistory;
    constructor(logger: LoggerService);
    generateReport(state: BiochemicalState, valveStatuses: Record<string, ValveStatusReport>): MasterControlReport;
    private determineMissionPhase;
    getLatestReport(): MasterControlReport | null;
    getReportHistory(limit?: number): MasterControlReport[];
    validateReport(report: MasterControlReport): boolean;
}
