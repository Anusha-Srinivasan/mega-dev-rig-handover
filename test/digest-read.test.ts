import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (night === null) return;
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));

    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['digest/render']).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
    // Times keep the log's offset; the truncated last line is not counted as a run.
    expect(byJob['lane/sync']).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight(tmp, '../etc/passwd')).toBeNull();
  });

  it('returns empty rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('ignores blank lines and counts invalid ones', () => {
    const lines = [
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      '',
      '   ',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok"}',
      '[1,2]',
      'not json',
      '{"at":"2026-01-02T02:00:00+02:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '{"at":"2026-01-02T03:00:00+02:00","job":"a","status":"ok","owner":"x"}',
    ];
    writeFileSync(join(tmp, '2026-01-02.jsonl'), lines.join('\r\n') + '\n');
    const night = readNight(tmp, '2026-01-02');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 3,
        retries: 0,
        lastStatus: 'ok',
        lastError: 'boom',
        firstAt: '2026-01-02T01:00:00+02:00',
        lastAt: '2026-01-02T03:00:00+02:00',
      },
    ]);
  });
});
