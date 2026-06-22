import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GasControlService } from '../gas-control/gas-control.service';
import {
  ValveId,
  ValveAction,
  CommandPriority,
  ValveControlCommand,
} from '../common/interfaces/gas-control.interface';

@ApiTags('control')
@Controller('api/control')
export class ControlController {
  constructor(private readonly gasControl: GasControlService) {}

  @Get('valves')
  @ApiOperation({ summary: '获取所有电磁阀状态' })
  getAllValves() {
    return {
      timestamp: Date.now(),
      valves: this.gasControl.getAllValveStatus(),
    };
  }

  @Get('valves/:valveId')
  @ApiOperation({ summary: '获取单个电磁阀状态' })
  getValve(@Param('valveId') valveId: string) {
    return {
      timestamp: Date.now(),
      valveId,
      status: this.gasControl.getValveStatus(valveId as ValveId),
    };
  }

  @Post('valves/:valveId/command')
  @ApiOperation({ summary: '下发电磁阀控制指令' })
  async issueValveCommand(
    @Param('valveId') valveId: string,
    @Body() body: {
      action: ValveAction;
      pulseWidthMs?: number;
      targetPressureDeltaKPa?: number;
      priority?: CommandPriority;
    },
  ): Promise<{ timestamp: number; command: ValveControlCommand }> {
    const command = await this.gasControl.issueCommand({
      valveId: valveId as ValveId,
      action: body.action,
      pulseWidthMs: body.pulseWidthMs,
      targetPressureDeltaKPa: body.targetPressureDeltaKPa,
      priority: body.priority,
    });
    return { timestamp: Date.now(), command };
  }

  @Post('override')
  @ApiOperation({ summary: '启用或解除手动超控' })
  setOverride(@Body() body: { enabled: boolean }) {
    this.gasControl.setManualOverride(body.enabled);
    return { timestamp: Date.now(), manualOverride: body.enabled };
  }

  @Get('pid')
  @ApiOperation({ summary: '获取三路 PID 控制器状态' })
  getPID() {
    return {
      timestamp: Date.now(),
      pid: this.gasControl.getPIDStates(),
    };
  }

  @Get('master-report')
  @ApiOperation({ summary: '获取最新宇航级主控上报包' })
  getMasterReport() {
    return {
      timestamp: Date.now(),
      report: this.gasControl.getLatestMasterReport(),
    };
  }
}
