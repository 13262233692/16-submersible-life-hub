import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('life-support')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: '系统健康检查', description: '返回生命维持中枢各子系统运行状态' })
  @ApiResponse({ status: 200, description: '系统运行正常' })
  getHealth() {
    return this.appService.getSystemHealth();
  }

  @Get('system-info')
  @ApiOperation({ summary: '获取系统信息', description: '返回潜水器标识、舱体型号等元数据' })
  getSystemInfo() {
    return this.appService.getSystemInfo();
  }
}
