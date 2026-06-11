import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const requestLogger = new Logger('HTTP');

  app.setGlobalPrefix('api');
  app.enableCors();
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      requestLogger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`,
      );
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get<number>('port', 3000);
  await app.listen(port);
}

void bootstrap();
