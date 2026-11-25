import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LiveController } from './live.controller';
import { LiveInterceptor } from './live.interceptor';
import { LiveService } from './live.service';

/** Live updates between a person's open apps (docs/live-sync.md). */
@Global()
@Module({
  controllers: [LiveController],
  providers: [
    LiveService,
    { provide: APP_INTERCEPTOR, useClass: LiveInterceptor },
  ],
  exports: [LiveService],
})
export class LiveModule {}
