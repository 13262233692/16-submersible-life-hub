import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
  });

  app.useLogger(app.get(LoggerService));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('深海潜水器生命维持中枢 API')
    .setDescription('万米级深海载人潜水器钛合金舱体生命维持状态监测与主动配气控制系统')
    .setVersion('1.0.0')
    .addTag('life-support', '生命维持核心服务')
    .addTag('sensors', '传感器数据接入')
    .addTag('control', '配气控制指令')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.SERVER_PORT || 3001;
  await app.listen(port);

  const logger = app.get(LoggerService);
  logger.log(`🚀 生命维持中枢服务已启动: http://localhost:${port}`);
  logger.log(`📖 API 文档地址: http://localhost:${port}/api/docs`);
  logger.log(`🔌 WebSocket 通道: ws://localhost:${port}/biostream`);
}

bootstrap();
