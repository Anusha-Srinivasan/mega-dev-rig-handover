import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };

const l = (o: object) => JSON.stringify(o);

beforeAll(() => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      l({ at: '2026-01-01T01:00:00Z', job: 'backup-db', status: 'ok', owner: 'ana' }),
      l({ at: '2026-01-01T02:00:00Z', job: 'orphan-job', status: 'ok', owner: null }),
      l({ at: '2026-01-01T03:00:00Z', job: 'broken-job', status: 'fail', owner: 'bo', error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [l({ at: '2026-01-03T01:00:00Z', job: 'good-job', status: 'ok', owner: 'ana' }), 'not json'].join('\n') + '\n',
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('200 with the job names and the lane banner', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup-db');
    expect(html).toContain('TEST-MARKER');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-12-31');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no such night');
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('a bad line still renders the rows and a notice', async () => {
    const res = await createApp(config).request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('good-job');
    expect(html).toContain('1 line could not be read');
  });

  it('shows a dash for a null owner', async () => {
    const html = await (await createApp(config).request('/digest/2026-01-01')).text();
    expect(html).toMatch(/<td>orphan-job<\/td><td>—<\/td>/);
  });

  it('marks a fail row', async () => {
    const html = await (await createApp(config).request('/digest/2026-01-01')).text();
    expect(html).toMatch(/<tr class="warn"><td>broken-job<\/td>/);
    expect(html).toContain('⚠ fail');
  });
});
