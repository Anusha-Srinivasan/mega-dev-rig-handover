import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'digest-api-'));
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta', 'ok', 'ann'),
      line('2026-01-01T01:05:00+01:00', 'alpha', 'retry', 'bob', 'boom'),
      line('2026-01-01T01:10:00+01:00', 'alpha', 'retry', 'bob'),
      line('2026-01-01T01:15:00+01:00', 'alpha', 'ok', 'bob'),
      line('2026-01-01T01:20:00+01:00', 'mid', 'fail', null, 'dead'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [line('2026-01-03T01:00:00+01:00', 'job', 'ok', 'ann'), 'not json'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-01-01T00:00:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job with runs, retries and lastStatus', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'mid', 'zeta']);
    const alpha = body.rows[0]!;
    expect(alpha).toMatchObject({ runs: 3, retries: 2, lastStatus: 'ok', lastError: 'boom' });
  });

  it('404s with an error for a night with no file', async () => {
    const res = await app.request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'no such night' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('counts a bad line and still returns the good rows', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['job']);
  });

  it('keeps a null owner null', async () => {
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    expect(body.rows.find((r) => r.job === 'mid')?.owner).toBeNull();
  });

  it('lists jobs in the same order as the page', async () => {
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    const html = await (await app.request('/digest/2026-01-01')).text();
    const pageJobs = [...html.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)]
      .flatMap((m) => [...m[0].matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)])
      .map((m) => m[1]);
    expect(pageJobs).toEqual(body.rows.map((r) => r.job));
  });
});
