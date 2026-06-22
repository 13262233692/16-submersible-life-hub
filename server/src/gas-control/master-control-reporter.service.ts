import { Injectable } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';
import {
  MasterControlReport,
  ValveStatusReport,
} from '../common/interfaces/gas-control.interface';
import { BiochemicalState } from '../common/interfaces/biochemical.interface';
import * as crypto from 'crypto';

@Injectable()
export class MasterControlReporter {
  private latestReport: MasterControlReport | null = null;
  private reportCounter: number = 0;
  private reportHistory: MasterControlReport[] = [];

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('MCP-Reporter');
  }

  generateReport(
    state: BiochemicalState,
    valveStatuses: Record<string, ValveStatusReport>,
  ): MasterControlReport {
    this.reportCounter++;

    const payload: Omit<MasterControlReport, 'checksum' | 'reportId' | 'timestamp'> = {
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

    const report: MasterControlReport = {
      ...payload,
      reportId,
      timestamp,
      checksum,
    };

    this.latestReport = report;
    this.reportHistory.push(report);
    if (this.reportHistory.length > 256) this.reportHistory.shift();

    if (this.reportCounter % 50 === 0) {
      this.logger.debug(
        `主控上报周期完成 #${this.reportCounter}: 相位=${report.missionPhase}, ` +
        `状态=${report.controlAlgorithmState}, Checksum=${checksum.substring(0, 8)}`,
      );
    }

    return report;
  }

  private determineMissionPhase(state: BiochemicalState): string {
    if (state.safetyIndicators.overallStatus === 'fatal') return 'EMERGENCY_ASCENT';
    if (state.safetyIndicators.overallStatus === 'critical') return 'SAFETY_PROTOCOL';
    if (state.safetyIndicators.overallStatus === 'warning') return 'ACTIVE_MONITORING';
    if (state.o2ReserveMinutes < 30) return 'RESERVE_LOW';
    return 'SCIENCE_OPERATION';
  }

  getLatestReport(): MasterControlReport | null {
    return this.latestReport;
  }

  getReportHistory(limit: number = 10): MasterControlReport[] {
    return this.reportHistory.slice(-limit);
  }

  validateReport(report: MasterControlReport): boolean {
    const { checksum, reportId, timestamp, ...payload } = report;
    const material = JSON.stringify(payload) + reportId + timestamp;
    const expected = crypto.createHash('sha256').update(material).digest('hex').substring(0, 16);
    return checksum === expected;
  }
}
