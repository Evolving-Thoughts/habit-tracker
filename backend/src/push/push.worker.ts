import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PushService } from './push.service';
@Injectable()
export class PushWorker implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly logger = new Logger('TimerPush');
  constructor(private readonly push: PushService) {}
  onModuleInit(): void {
    const enabled =
      process.env.PUSH_WORKER_ENABLED ??
      (process.env.NODE_ENV === 'test' ? 'false' : 'true');
    if (enabled !== 'true' || !this.push.config().configured) return;
    this.interval = setInterval(() => {
      void this.tick();
    }, 1000);
    this.interval.unref();
    void this.tick();
  }
  tick(): Promise<void> {
    this.running ??= this.process().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async process(): Promise<void> {
    try {
      await this.push.enqueueDue();
      await this.push.sendPending();
    } catch {
      this.logger.warn(
        'Timer-Push-Verarbeitung fehlgeschlagen; wird erneut geprüft.',
      );
    }
  }
  async onModuleDestroy(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    await this.running;
  }
}
