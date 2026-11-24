#!/usr/bin/env node
/** Retry full public verification with bounded attempts and durable per-attempt diagnostics. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 120_000;
const DEFAULT_SLEEP_MS = 45_000;

function options(argv) {
  const positional = [];
  const values = {
    attempts: DEFAULT_ATTEMPTS,
    timeout: DEFAULT_ATTEMPT_TIMEOUT_MS,
    sleep: DEFAULT_SLEEP_MS,
    log: '',
  };
  for (const argument of argv) {
    if (!argument.startsWith('--')) positional.push(argument);
    else if (argument.startsWith('--attempts=')) values.attempts = Number(argument.slice(11));
    else if (argument.startsWith('--attempt-timeout-ms=')) values.timeout = Number(argument.slice(21));
    else if (argument.startsWith('--sleep-ms=')) values.sleep = Number(argument.slice(11));
    else if (argument.startsWith('--log=')) values.log = argument.slice(6);
    else throw new Error('Unknown option: ' + argument);
  }
  const [command, ...commandArgs] = positional;
  assert.ok(['verify', 'verify-candidate', 'verify-complete'].includes(command), 'Public verify command required');
  assert.ok(Number.isSafeInteger(values.attempts) && values.attempts >= 1 && values.attempts <= 20, 'Invalid attempts');
  assert.ok(Number.isSafeInteger(values.timeout) && values.timeout >= 1 && values.timeout <= 600_000, 'Invalid attempt timeout');
  assert.ok(Number.isSafeInteger(values.sleep) && values.sleep >= 0 && values.sleep <= 300_000, 'Invalid retry sleep');
  assert.ok(values.log, 'A diagnostic log directory is required');
  return { command, commandArgs, ...values };
}

function diagnostic(stderr, progress) {
  let last = '';
  for (const line of stderr.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.kind === 'cny-pages-verify-progress') progress = entry;
      if (entry.kind === 'cny-pages-verify-error')
        last = entry.path ? `${entry.path}: ${entry.error}` : entry.error;
      continue;
    } catch {}
    if (!last && /AssertionError|TimeoutError|HTTP [0-9]+|hash|byte length/.test(line)) last = line.trim();
  }
  return {
    progress: progress ?? { completed: 0, total: 0, lastPath: null },
    lastDiagnostic: last || progress?.lastPath || 'No verifier diagnostic emitted',
  };
}

function attempt(command, commandArgs, timeout, number, log) {
  return new Promise((resolveAttempt) => {
    const startedAt = new Date();
    const child = spawn(
      process.execPath,
      [resolve('scripts/cny-pages-release.mjs'), command, ...commandArgs],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let progress;
    const timer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      timedOut = true;
      const diagnostic = JSON.stringify({
        kind: 'cny-pages-verify-error',
        error: `Verification attempt exceeded ${timeout}ms`,
      }) + '\n';
      stderr += diagnostic;
      process.stderr.write(diagnostic);
      child.kill('SIGTERM');
    }, timeout);
    child.stdout.on('data', (bytes) => {
      stdout += bytes;
    });
    child.stderr.on('data', (bytes) => {
      stderr += bytes;
      process.stderr.write(bytes);
    });
    child.on('error', (error) => {
      stderr += error.stack + '\n';
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt.getTime();
      const details = diagnostic(stderr, progress);
      progress = details.progress;
      const record = {
        kind: 'cny-pages-verify-attempt',
        attempt: number,
        command,
        startedAt: startedAt.toISOString(),
        durationMs,
        exitCode,
        signal,
        timedOut,
        progress,
        lastDiagnostic: details.lastDiagnostic,
      };
      writeFileSync(join(log, `attempt-${number}.stdout.log`), stdout);
      writeFileSync(join(log, `attempt-${number}.stderr.log`), stderr);
      appendFileSync(join(log, 'attempts.ndjson'), JSON.stringify(record) + '\n');
      console.error(JSON.stringify(record));
      resolveAttempt({ exitCode, stdout });
    });
  });
}

const { command, commandArgs, attempts, timeout, sleep, log } = options(process.argv.slice(2));
mkdirSync(log, { recursive: true });
let verified = false;
for (let number = 1; number <= attempts; number += 1) {
  const result = await attempt(command, commandArgs, timeout, number, log);
  if (result.exitCode === 0) {
    const receipt = JSON.parse(result.stdout);
    process.stdout.write(JSON.stringify(receipt) + '\n');
    verified = true;
    break;
  }
  if (number < attempts) await delay(sleep);
}
if (!verified) {
  console.error(`Verification failed after ${attempts} attempts; see ${join(log, 'attempts.ndjson')}`);
  process.exitCode = 1;
}
