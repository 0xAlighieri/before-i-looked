import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function appWith(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe('digest routes', () => {
  const config = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: 'runs',
  };

  it('renders 2026-10-28 and matches JSON jobs and order', async () => {
    const app = createApp(config);
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(json.status).toBe(200);
    const rows = await json.json() as { job: string }[];
    const jobs = rows.map((r) => r.job);
    expect(jobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    for (const job of jobs) expect(html).toContain(job);
    const htmlOrder = jobs.map((j) => html.indexOf(j));
    expect(htmlOrder).toEqual([...htmlOrder].sort((a, b) => a - b));
  });

  it('returns 404 for a night with no file', async () => {
    const app = createApp(config);
    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'digest-empty-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    const app = appWith(dir);
    const page = await app.request('/digest/2026-01-01');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const json = await app.request('/api/digest/2026-01-01');
    expect(await json.json()).toEqual([]);
  });

  it('counts a bad line and still renders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'digest-bad-'));
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      '{"at":"2026-01-02T00:00:00+00:00","job":"a/job","status":"ok","owner":"x"}\nnot-json\n',
    );
    const app = appWith(dir);
    const page = await app.request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('a/job');
    const rows = await (await app.request('/api/digest/2026-01-02')).json() as { job: string }[];
    expect(rows).toHaveLength(1);
  });
});
