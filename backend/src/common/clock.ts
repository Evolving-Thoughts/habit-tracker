import { Global, Injectable, Module } from '@nestjs/common';
import { dayOf } from './date/local-day';
import { UserUnitOfWork } from './user-unit-of-work';

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
@Module({
  providers: [Clock, UserUnitOfWork],
  exports: [Clock, UserUnitOfWork],
})
export class CommonModule {}
