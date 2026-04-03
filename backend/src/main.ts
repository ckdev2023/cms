import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const bootstrapLogger = new Logger('Bootstrap');

/**
 * 解析 CORS 来源配置，兼容单个来源和逗号分隔的来源列表。
 *
 * @param corsOrigin - 环境变量中的 `CORS_ORIGIN` 原始值
 * @returns 可直接传给 Nest `enableCors` 的来源配置
 */
function resolveCorsOrigin(corsOrigin: string): string | string[] {
  if (!corsOrigin.includes(',')) {
    return corsOrigin;
  }

  return corsOrigin.split(',').map((origin) => origin.trim());
}

/**
 * 启动 Nest 应用并挂载全局校验、异常处理与 Swagger 文档。
 *
 * @returns 应用完成监听后结束启动流程
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:5173',
  );

  app.enableCors({
    origin: resolveCorsOrigin(corsOrigin),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('事務所管理システム API')
    .setDescription('行政書士 + 税理士事務所向け管理 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  const appUrl = await app.getUrl();
  bootstrapLogger.log(`API 服务已启动: ${appUrl}/api/v1`);
  bootstrapLogger.log(`Swagger 文档地址: ${appUrl}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知启动异常';
  const stack = error instanceof Error ? error.stack : undefined;

  bootstrapLogger.error(`Nest 应用启动失败: ${message}`, stack);
  process.exit(1);
});
