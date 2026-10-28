import { Global, Injectable, Module } from '@nestjs/common';
import { dayOf } from './date/local-day';

/** The only source of "now" and "today"; tests override this provider. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
  today(): string {
    return dayOf(this.now());
  }
}

@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
