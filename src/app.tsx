import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/readNight.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

function nightFile(runsDir: string, night: string) {
  return join(runsDir, `${night}.jsonl`);
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    const nights = status.nights.map((night) => {
      const { rows } = readNight(config.runsDir, night);
      return {
        night,
        ok: rows.filter((r) => r.lastStatus === 'ok').length,
        retry: rows.filter((r) => r.lastStatus === 'retry').length,
        fail: rows.filter((r) => r.lastStatus === 'fail').length,
      };
    });
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} nights={nights} />
      </Layout>,
    );
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!existsSync(nightFile(config.runsDir, night))) return c.body('not found', 404);
    const digest = readNight(config.runsDir, night);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!existsSync(nightFile(config.runsDir, night))) return c.json({ error: 'not found' }, 404);
    const digest = readNight(config.runsDir, night);
    return c.json(digest.rows);
  });

  return app;
}
