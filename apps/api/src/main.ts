import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(helmet());
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? '*').split(','), credentials: true });
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('Historic Broyhill API')
    .setDescription('Backend for Historic Broyhill Offices and Conference Center: suites, tenants, leads, tours, event bookings, RSVPs, payments and messaging.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Historic Broyhill API listening on :${port} (docs at /api/docs)`);
}
bootstrap();
