#!/usr/bin/env node
/** Retry full public verification with bounded attempts and durable per-attempt diagnostics. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  createWriteStream,
  mkdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 480_000;
const DEFAULT_SLEEP_MS = 45_000;
const DEFAULT_KILL_GRACE_MS = 5000;

function options(argv) {
  const positional = [];
  const values = {
    attempts: DEFAULT_ATTEMPTS,
    timeout: DEFAULT_ATTEMPT_TIMEOUT_MS,
    sleep: DEFAULT_SLEEP_MS,
    killGrace: DEFAULT_KILL_GRACE_MS,
    log: '',
  };
  for (const argument of argv) {
    if (!argument.startsWith('--')) positional.push(argument);
    else if (argument.startsWith('--attempts=')) values.attempts = Number(argument.slice(11));
    else if (argument.startsWith('--attempt-timeout-ms=')) values.timeout = Number(argument.slice(21));
    else if (argument.startsWith('--sleep-ms=')) values.sleep = Number(argument.slice(11));
    else if (argument.startsWith('--kill-grace-ms=')) values.killGrace = Number(argument.slice(16));
    else if (argument.startsWith('--log=')) values.log = argument.slice(6);
    else throw new Error('Unknown option: ' + argument);
  }
  const [command, ...commandArgs] = positional;
  assert.ok(['verify', 'verify-candidate', 'verify-complete'].includes(command), 'Public verify command required');
  assert.ok(Number.isSafeInteger(values.attempts) && values.attempts >= 1 && values.attempts <= 20, 'Invalid attempts');
  assert.ok(Number.isSafeInteger(values.timeout) && values.timeout >= 1 && values.timeout <= 600_000, 'Invalid attempt timeout');
  assert.ok(Number.isSafeInteger(values.sleep) && values.sleep >= 0 && values.sleep <= 300_000, 'Invalid retry sleep');
  assert.ok(Number.isSafeInteger(values.killGrace) && values.killGrace >= 1 && values.killGrace <= 30_000, 'Invalid kill grace');
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

let activeAttempt;
let interruptedBy;
const sleepController = new AbortController();

async function attempt(command, commandArgs, timeout, killGrace, number, log) {
  const startedAt = new Date();
  const record = {
    kind: 'cny-pages-verify-attempt',
    attempt: number,
    command,
    status: 'running',
    childPid: null,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    interruptedBy: null,
    escalated: false,
    progress: { completed: 0, total: 0, lastPath: null },
    lastDiagnostic: 'Verification started',
  };
  const snapshot = join(log, `attempt-${number}.json`);
  const persist = () => {
    const temporary = snapshot + '.tmp';
    writeFileSync(temporary, JSON.stringify(record) + '\n');
    renameSync(temporary, snapshot);
  };
  const stdoutFile = createWriteStream(join(log, `attempt-${number}.stdout.log`));
  const stderrFile = createWriteStream(join(log, `attempt-${number}.stderr.log`));
  persist();
  const child = spawn(
    process.execPath,
    [resolve('scripts/cny-pages-release.mjs'), command, ...commandArgs],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  record.childPid = child.pid ?? null;
  persist();
  let stdout = '';
  let stderr = '';
  let progress;
  let closing = false;
  let terminating = false;
  let terminationDiagnostic = '';
  let killTimer;
  const updateDiagnostics = () => {
    const details = diagnostic(stderr, progress);
    progress = details.progress;
    record.progress = progress;
    record.lastDiagnostic = details.lastDiagnostic;
    record.durationMs = Date.now() - startedAt.getTime();
    persist();
  };
  const writeStderr = (text) => {
    stderr += text;
    stderrFile.write(text);
    process.stderr.write(text);
    updateDiagnostics();
  };
  const escalate = () => {
    if (closing || record.escalated) return;
    record.escalated = true;
    writeStderr(JSON.stringify({
      kind: 'cny-pages-verify-error',
      error: `${terminationDiagnostic}; child did not exit after SIGTERM; sending SIGKILL`,
    }) + '\n');
    child.kill('SIGKILL');
  };
  const terminate = (signal, timedOut) => {
    if (closing || terminating) return;
    terminating = true;
    record.timedOut = timedOut;
    if (!timedOut) record.interruptedBy = signal;
    terminationDiagnostic = timedOut
      ? `Verification attempt exceeded ${timeout}ms`
      : `Verification attempt interrupted by ${signal}`;
    writeStderr(JSON.stringify({ kind: 'cny-pages-verify-error', error: terminationDiagnostic }) + '\n');
    child.kill('SIGTERM');
    killTimer = setTimeout(escalate, killGrace);
  };
  activeAttempt = { interrupt: (signal) => terminate(signal, false), escalate };
  const timer = setTimeout(() => terminate('SIGTERM', true), timeout);
  child.stdout.on('data', (bytes) => {
    stdout += bytes;
    stdoutFile.write(bytes);
  });
  child.stderr.on('data', (bytes) => writeStderr(bytes.toString()));
  child.on('error', (error) => writeStderr(error.stack + '\n'));
  const closed = new Promise((resolveClose) => {
    child.on('close', (exitCode, signal) => {
      closing = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolveClose([exitCode, signal]);
    });
  });
  const [exitCode, signal] = await closed;
  if (activeAttempt?.interrupt) activeAttempt = undefined;
  updateDiagnostics();
  record.status = 'finished';
  record.durationMs = Date.now() - startedAt.getTime();
  record.exitCode = exitCode;
  record.signal = signal;
  stdoutFile.end();
  stderrFile.end();
  await Promise.all([finished(stdoutFile), finished(stderrFile)]);
  appendFileSync(join(log, 'attempts.ndjson'), JSON.stringify(record) + '\n');
  persist();
  console.error(JSON.stringify(record));
  return { exitCode, stdout };
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (interruptedBy) {
      activeAttempt?.escalate();
      return;
    }
    interruptedBy = signal;
    sleepController.abort();
    activeAttempt?.interrupt(signal);
  });
}

const { command, commandArgs, attempts, timeout, sleep, killGrace, log } = options(process.argv.slice(2));
mkdirSync(log, { recursive: true });
let verified = false;
for (let number = 1; number <= attempts && !interruptedBy; number += 1) {
  const result = await attempt(command, commandArgs, timeout, killGrace, number, log);
  if (interruptedBy) break;
  if (result.exitCode === 0) {
    const receipt = JSON.parse(result.stdout);
    process.stdout.write(JSON.stringify(receipt) + '\n');
    verified = true;
    break;
  }
  if (number < attempts && !interruptedBy) {
    try {
      await delay(sleep, { signal: sleepController.signal });
    } catch (error) {
      if (!interruptedBy) throw error;
    }
  }
}
for (const signal of ['SIGTERM', 'SIGINT']) process.removeAllListeners(signal);
if (interruptedBy) process.kill(process.pid, interruptedBy);
else if (!verified) {
  console.error(`Verification failed after ${attempts} attempts; see ${join(log, 'attempts.ndjson')}`);
  process.exitCode = 1;
}
