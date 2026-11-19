import { useEffect, useState } from 'react';

const repository = 'naoshengyun/llm-metadata';
const statusUrl = `https://raw.githubusercontent.com/${repository}/cny-official-check-state/official-check.json`;
const refreshInterval = 5 * 60 * 1000;

const statuses = [
  'unchanged',
  'failed',
  'changed',
  'future-effective',
  'withdrawal',
  'withdrawn',
  'restoration',
  'deferred',
  'deprecated',
  'not-offered',
  'not-registered',
  'unsupported',
  'excluded',
  'tool-reference',
] as const;

type CheckStatus = (typeof statuses)[number];

interface PublishedVersion {
  candidateId: string;
  sourceSha: string;
}

export interface QuoteCheck {
  status: CheckStatus;
  reason: string | null;
  latestAttemptedAt: string | null;
  latestSuccessfulAt: string | null;
  effectiveAt: string | null;
  review: { url: string; open: boolean } | null;
}

interface CheckSnapshot {
  version: PublishedVersion;
  attemptedAt: number;
  results: Map<string, QuoteCheck>;
}

export interface OfficialCheckView {
  candidateId: string;
  state: 'loading' | 'unavailable' | 'different-release' | 'ready' | 'refresh-failed';
  results: ReadonlyMap<string, QuoteCheck> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : null;
}

export function officialCheckKey(providerId: string, modelId: string, quoteId: string) {
  return JSON.stringify([providerId, modelId, quoteId]);
}

function reviewLink(proposal: unknown): QuoteCheck['review'] {
  if (!isRecord(proposal) || typeof proposal.number !== 'number') return null;
  const { number, status, url } = proposal;
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    (status !== 'opened' && status !== 'reused' && status !== 'closed')
  ) {
    return null;
  }
  const expected = `https://github.com/${repository}/pull/${number}`;
  return url === expected ? { url: expected, open: status !== 'closed' } : null;
}

function readSnapshot(value: unknown): CheckSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.results)) {
    throw Error('Invalid official check status');
  }
  const version = value.publishedVersion;
  const attempt = timestamp(value.attemptedAt);
  if (
    !attempt ||
    !isRecord(version) ||
    typeof version.candidateId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(version.candidateId) ||
    typeof version.sourceSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(version.sourceSha)
  ) {
    throw Error('Invalid official check version or time');
  }

  const attemptedAt = Date.parse(attempt);
  const results = new Map<string, QuoteCheck>();
  for (const row of value.results) {
    if (
      !isRecord(row) ||
      !isRecord(row.identity) ||
      typeof row.identity.providerId !== 'string' ||
      typeof row.identity.modelId !== 'string' ||
      typeof row.quoteId !== 'string'
    )
      continue;

    const status = statuses.find((known) => known === row.status);
    if (!status) continue;
    const latestAttemptedAt = timestamp(row.latestAttemptedAt);
    const latestSuccessfulAt = timestamp(row.latestSuccessfulAt);
    if (
      (latestAttemptedAt && Date.parse(latestAttemptedAt) > attemptedAt) ||
      (latestSuccessfulAt &&
        (!latestAttemptedAt || Date.parse(latestSuccessfulAt) > Date.parse(latestAttemptedAt))) ||
      (status === 'unchanged' && (!latestSuccessfulAt || latestSuccessfulAt !== latestAttemptedAt))
    )
      continue;

    const key = officialCheckKey(row.identity.providerId, row.identity.modelId, row.quoteId);
    if (results.has(key)) throw Error('Ambiguous official quote status');
    results.set(key, {
      status,
      reason: typeof row.reason === 'string' ? row.reason.slice(0, 400) : null,
      latestAttemptedAt,
      latestSuccessfulAt,
      effectiveAt: timestamp(row.effectiveAt),
      review: reviewLink(row.proposal),
    });
  }
  return {
    version: { candidateId: version.candidateId, sourceSha: version.sourceSha },
    attemptedAt,
    results,
  };
}

export function useOfficialCheck(
  candidateId: string | undefined,
  sourceSha: string | undefined,
  active: boolean,
): OfficialCheckView | undefined {
  const [state, setState] = useState<{ snapshot: CheckSnapshot | null; failed: boolean }>({
    snapshot: null,
    failed: false,
  });

  useEffect(() => {
    if (!candidateId || !sourceSha || !active) return;
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const response = await fetch(statusUrl, {
          cache: 'no-store',
          credentials: 'omit',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) throw Error('Official check status unavailable');
        const next = readSnapshot(await response.json());
        if (controller.signal.aborted) return;

        setState(({ snapshot, failed }) => {
          if (snapshot && next.attemptedAt < snapshot.attemptedAt) return { snapshot, failed };
          return { snapshot: next, failed: false };
        });
      } catch {
        if (!controller.signal.aborted) setState(({ snapshot }) => ({ snapshot, failed: true }));
      } finally {
        pending = false;
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, refreshInterval);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, candidateId, sourceSha]);

  if (!candidateId || !sourceSha) return undefined;
  const { snapshot, failed } = state;
  if (!snapshot) return { candidateId, state: failed ? 'unavailable' : 'loading', results: null };
  if (snapshot.version.candidateId !== candidateId || snapshot.version.sourceSha !== sourceSha)
    return { candidateId, state: 'different-release', results: null };
  return { candidateId, state: failed ? 'refresh-failed' : 'ready', results: snapshot.results };
}
