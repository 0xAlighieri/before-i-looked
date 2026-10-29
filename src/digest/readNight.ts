import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

const STATUSES = new Set<JobStatus>(['ok', 'retry', 'fail']);

function parseLine(line: string): LogLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status as JobStatus)) return null;
  const owner = o.owner === null || typeof o.owner === 'string' ? o.owner : null;
  const error = typeof o.error === 'string' ? o.error : undefined;
  return { at: o.at, job: o.job, status: o.status as JobStatus, owner, error };
}

export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = text.split(/\n/);
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines++;
      continue;
    }
    const prev = byJob.get(parsed.job);
    if (!prev) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    prev.runs += 1;
    if (parsed.status === 'retry') prev.retries += 1;
    prev.lastStatus = parsed.status;
    prev.lastError = parsed.error ?? null;
    prev.owner = parsed.owner;
    prev.lastAt = parsed.at;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { rows, badLines };
}
