import { HttpException, HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './modules/http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'verbose', 'log'],
    cors: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  const AllowedDomains = process.env.ALLOWED_DOMAINS.split(',') || [];

  app.enableCors({
    origin: (origin, callback) => {
      if (AllowedDomains.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new HttpException('Not allowed by CORS', HttpStatus.BAD_GATEWAY),
        );
      }
    },
  });

  await app.listen(process.env.PORT || 3333);
}
bootstrap();
