import './config/load-env';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './modules/app/app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const host = configService.get<string>('app.host', '0.0.0.0');
  const port = configService.get<number>('app.port', 3001);
  const corsOrigin = configService.get<string>('app.corsOrigin', 'http://localhost:3000');

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await prismaService.enableShutdownHooks(app);

  await app.listen(port, host);
}

void bootstrap();
