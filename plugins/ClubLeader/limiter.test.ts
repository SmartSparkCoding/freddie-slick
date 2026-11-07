import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Blocked, Limiter } from './limiter.ts';

const clock = () => {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms), sleep: async () => {} };
};

test('runs one task at a time, in order', async () => {
  const c = clock();
  const limiter = new Limiter({ gapMs: 0, perHour: 10, backoffMs: 1000, maxBackoffMs: 4000, ...c });
  let running = 0;
  let most = 0;
  const order: number[] = [];
  await Promise.all(
    [1, 2, 3].map((n) =>
      limiter.run(async () => {
        most = Math.max(most, ++running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(n);
        running--;
      }),
    ),
  );
  assert.equal(most, 1);
  assert.deepEqual(order, [1, 2, 3]);
});

test('stops sending once the hourly budget is used, then allows more an hour later', async () => {
  const c = clock();
  const limiter = new Limiter({ gapMs: 0, perHour: 2, backoffMs: 1000, maxBackoffMs: 4000, ...c });
  let sent = 0;
  const task = async () => void sent++;
  await limiter.run(task);
  await limiter.run(task);
  await assert.rejects(limiter.run(task), Blocked);
  assert.equal(sent, 2);
  c.advance(60 * 60 * 1000);
  await limiter.run(task);
  assert.equal(sent, 3);
});

test('pause blocks for a growing time, and recovered resets it', async () => {
  const c = clock();
  const limiter = new Limiter({ gapMs: 0, perHour: 100, backoffMs: 1000, maxBackoffMs: 3000, ...c });
  const task = async () => {};
  limiter.pause();
  await assert.rejects(limiter.run(task), Blocked);
  c.advance(1000);
  await limiter.run(task);
  limiter.pause(); // second pause: 2000
  c.advance(1500);
  await assert.rejects(limiter.run(task), Blocked);
  c.advance(500);
  await limiter.run(task);
  limiter.pause(); // capped at 3000
  c.advance(3000);
  await limiter.run(task);
  limiter.recovered();
  limiter.pause(); // back to 1000
  c.advance(1000);
  await limiter.run(task);
  assert.equal(limiter.total, 4);
});

test('stop blocks for good', async () => {
  const c = clock();
  const limiter = new Limiter({ gapMs: 0, perHour: 100, backoffMs: 1000, maxBackoffMs: 3000, ...c });
  limiter.stop();
  c.advance(10 ** 12);
  await assert.rejects(limiter.run(async () => {}), Blocked);
});
