import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BiochemicalEngineService } from '../biochemical/biochemical-engine.service';
import { BiochemicalState, GasDiffusionGrid } from '../common/interfaces/biochemical.interface';

@ApiTags('life-support')
@Controller('api/biochemical')
export class BiochemicalController {
  constructor(private readonly engine: BiochemicalEngineService) {}

  @Get('state')
  @ApiOperation({ summary: '获取当前生化状态', description: '极低延迟返回舱内生化状态快照（氧气占比、分压、代谢率、安全指示等）' })
  @ApiResponse({ status: 200, description: '生化状态快照' })
  getState(): { timestamp: number; latencyMs: number; state: BiochemicalState | null } {
    const t0 = Date.now();
    const state = this.engine.getCurrentState();
    return {
      timestamp: Date.now(),
      latencyMs: Date.now() - t0,
      state,
    };
  }

  @Get('grid')
  @ApiOperation({ summary: '获取气体扩散网格', description: '返回用于 WebGL 渲染的三维流体扩散梯度网格数据' })
  getGrid(): { timestamp: number; grid: GasDiffusionGrid | null } {
    return {
      timestamp: Date.now(),
      grid: this.engine.getCurrentGrid(),
    };
  }

  @Get('grid/compact')
  @ApiOperation({ summary: '获取紧凑格式扩散网格', description: '返回压缩格式网格以降低传输延迟' })
  getCompactGrid() {
    const grid = this.engine.getCurrentGrid();
    if (!grid) {
      return { timestamp: Date.now(), grid: null };
    }
    return {
      timestamp: grid.timestamp,
      w: grid.width,
      h: grid.height,
      o2: Array.from(grid.o2Grid),
      co2: Array.from(grid.co2Grid),
      vx: Array.from(grid.flowVX),
      vy: Array.from(grid.flowVY),
    };
  }
}
