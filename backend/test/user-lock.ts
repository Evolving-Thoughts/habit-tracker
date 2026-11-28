import { DataSource } from 'typeorm';

/**
 * Takes the user's row lock (`lockUser`) on a connection of its own, as a
 * change of that user in progress would, and keeps it until the returned
 * release is called.
 */
export async function holdUserLock(
  db: DataSource,
  userId: string,
): Promise<() => Promise<void>> {
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query('SELECT "id" FROM "users" WHERE "id" = $1 FOR UPDATE', [
    userId,
  ]);
  return async () => {
    await runner.rollbackTransaction();
    await runner.release();
  };
}

/** The promise's value, or a rejection when it takes longer than `ms`. */
export function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`waited ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Whether the promise is still pending after `ms`. */
export async function stillPending(
  promise: Promise<unknown>,
  ms: number,
): Promise<boolean> {
  const marker = Symbol('pending');
  const result = await Promise.race([
    promise.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<symbol>((resolve) => setTimeout(() => resolve(marker), ms)),
  ]);
  return result === marker;
}
