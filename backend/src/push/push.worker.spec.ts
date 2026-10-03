import { PushWorker } from './push.worker';
import { PushService } from './push.service';
describe('Push polling lifecycle', () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
    jest.useRealTimers();
  });
  it('serializes overlapping ticks and shutdown waits for the in-flight pass', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const push = {
      config: () => ({ configured: true }),
      enqueueDue: jest.fn(() => gate),
      sendPending: jest.fn(async () => {
        await Promise.resolve();
      }),
    };
    const worker = new PushWorker(push as unknown as PushService);
    const first = worker.tick();
    const second = worker.tick();
    expect(first).toBe(second);
    expect(push.enqueueDue).toHaveBeenCalledTimes(1);
    let closed = false;
    const closing = worker.onModuleDestroy().then(() => {
      closed = true;
    });
    expect(closed).toBe(false);
    release();
    await closing;
    expect(push.sendPending).toHaveBeenCalledTimes(1);
  });
  it('does not start a background interval in test mode or without keys', async () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'test';
    delete process.env.PUSH_WORKER_ENABLED;
    const push = {
      config: () => ({ configured: true }),
      enqueueDue: jest.fn(),
      sendPending: jest.fn(),
    };
    const worker = new PushWorker(push as unknown as PushService);
    worker.onModuleInit();
    expect(jest.getTimerCount()).toBe(0);
    await worker.onModuleDestroy();
    process.env.PUSH_WORKER_ENABLED = 'true';
    push.config = () => ({ configured: false });
    worker.onModuleInit();
    expect(jest.getTimerCount()).toBe(0);
  });
});
