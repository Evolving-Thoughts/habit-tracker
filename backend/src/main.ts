import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Rate limits count per client, not per proxy.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
