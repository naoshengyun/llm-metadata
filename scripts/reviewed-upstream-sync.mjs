import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';

const fullSha = /^[a-f0-9]{40}$/;
const policyPath = 'data/cny/unified-policy.json';
const originPath = 'data/upstream/24d3f35c/source.json';
const snapshotPaths = {
  'en.json': 'dist/api/all.json',
  'zh.json': 'dist/api/i18n/zh/all.json',
  'ja.json': 'dist/api/i18n/ja/all.json',
  'native.json': 'data/native-providers.json',
};
const activeWorkflows = '.github/workflows/';
const quarantine = '.github/upstream-workflows/';
const protectedRoots = ['data/cny', 'data/upstream', 'data/naoshengyun', 'scripts', 'src/cny', 'tests', '.github'];
const gitEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  GIT_ATTR_NOSYSTEM: '1',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_NO_LAZY_FETCH: '1',
};
delete gitEnv.GIT_CONFIG_PARAMETERS;

function gitBytes(repo, args, input, env = gitEnv) {
  return execFileSync('git', ['-C', repo, '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], {
    env,
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function git(repo, ...args) {
  return gitBytes(repo, args).toString('utf8').trim();
}

function fileEntry(repo, revision, path) {
  const entry = git(repo, 'ls-tree', revision, '--', path);
  const match = /^(100644|100755) blob ([a-f0-9]{40})\t/.exec(entry);
  if (!match) throw new Error(`Expected regular file at ${revision}:${path}`);
  return match[2];
}

function readFile(repo, revision, path) {
  return gitBytes(repo, ['cat-file', 'blob', fileEntry(repo, revision, path)]);
}

function readJson(bytes, path) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // Invalid payloads are reported with their repository path.
  }
  throw new Error(`Expected JSON object in ${path}`);
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function readReviewedSnapshot(repo, business) {
  const policyBytes = readFile(repo, business, policyPath);
  const { upstreamDirectory } = readJson(policyBytes, policyPath);
  if (typeof upstreamDirectory !== 'string' || !/^data\/upstream\/[a-f0-9]{8}$/.test(upstreamDirectory))
    throw new Error(`Invalid upstreamDirectory in ${policyPath}`);
  const origin = readJson(readFile(repo, business, originPath), originPath);
  const sourcePath = `${upstreamDirectory}/source.json`;
  const source = readJson(readFile(repo, business, sourcePath), sourcePath);
  if (origin.repository !== 'https://github.com/basellm/llm-metadata' || source.repository !== origin.repository)
    throw new Error(`Invalid repository in ${sourcePath}`);
  const previousUpstream = source.upstreamSha;
  if (typeof previousUpstream !== 'string' || !fullSha.test(previousUpstream) ||
      !upstreamDirectory.endsWith(previousUpstream.slice(0, 8)) || git(repo, 'cat-file', '-t', previousUpstream) !== 'commit')
    throw new Error(`Invalid upstreamSha in ${sourcePath}`);
  if (Object.keys(source.files ?? {}).length !== Object.keys(snapshotPaths).length)
    throw new Error(`Invalid snapshot file list in ${sourcePath}`);
  for (const [name, path] of Object.entries(snapshotPaths)) {
    const snapshotPath = `${upstreamDirectory}/${name}`;
    const localBlob = fileEntry(repo, business, snapshotPath);
    if (source.files[name]?.path !== path || localBlob !== fileEntry(repo, previousUpstream, path) ||
        source.files[name].sha256 !== sha256(gitBytes(repo, ['cat-file', 'blob', localBlob])))
      throw new Error(`Reviewed snapshot does not match its upstream source: ${snapshotPath}`);
  }
  return { policyBytes, upstreamDirectory, source, previousUpstream };
}

function treeEntries(repo, tree) {
  const listing = new TextDecoder('utf-8', { fatal: true }).decode(gitBytes(repo, ['ls-tree', '-rz', '--full-tree', tree]));
  return new Map(listing.split('\0').filter(Boolean).map(line => {
    const separator = line.indexOf('\t');
    const [mode, , oid] = line.slice(0, separator).split(' ');
    return [line.slice(separator + 1), { mode, oid }];
  }));
}

function changedPaths(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])].filter(path => {
    const oldEntry = before.get(path);
    const newEntry = after.get(path);
    return oldEntry?.mode !== newEntry?.mode || oldEntry?.oid !== newEntry?.oid;
  }).sort();
}

function intersects(path, root) {
  const file = path.toLowerCase();
  const prefix = root.toLowerCase();
  return file === prefix || file.startsWith(`${prefix}/`) || prefix.startsWith(`${file}/`);
}

function validateTree(entries) {
  for (const [path, entry] of entries) {
    if (!['100644', '100755'].includes(entry.mode) || path.toLowerCase().split('/').includes('.gitattributes'))
      throw new Error(`Unsupported Git entry in reviewed sync: ${path}`);
  }
}

function protectChanges(paths, roots) {
  const protectedChanges = paths.filter(path => roots.some(root => intersects(path, root)));
  if (protectedChanges.length) throw new Error(`Protected paths changed: ${protectedChanges.join(', ')}`);
}

function writeTree(repo, base, changes) {
  git(repo, 'read-tree', base);
  const deletions = [];
  const additions = [];
  for (const [path, entry] of changes) {
    if (entry) additions.push(`${entry.mode} ${entry.oid}\t${path}\0`);
    else deletions.push(`0 ${'0'.repeat(40)}\t${path}\0`);
  }
  gitBytes(repo, ['update-index', '-z', '--index-info'], [...deletions, ...additions].join(''));
  return git(repo, 'write-tree');
}

function commitTree(repo, tree, parent, date, message) {
  return gitBytes(repo, ['commit-tree', tree, '-p', parent, '-m', message], undefined, {
    ...gitEnv,
    GIT_AUTHOR_NAME: 'CNY upstream sync',
    GIT_AUTHOR_EMAIL: 'cny-sync@example.invalid',
    GIT_COMMITTER_NAME: 'CNY upstream sync',
    GIT_COMMITTER_EMAIL: 'cny-sync@example.invalid',
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  }).toString('utf8').trim();
}

function simulateMerge(repo, upstream, business, previousUpstream, upstreamWorkflows, previousTree, date) {
  // Projects the upstream workflow changes out of the merge. Upstream workflow
  // changes have a separate review path, including modify/delete collisions.
  const normalizedUpstream = writeTree(repo, upstream, upstreamWorkflows.map(path => [path, previousTree.get(path)]));
  // The pinned catalog can precede or follow the business Git merge base.
  // Give merge-tree the pinned base without importing upstream into candidate ancestry.
  const ourSide = commitTree(repo, `${business}^{tree}`, previousUpstream, date, 'Business side of reviewed sync');
  const theirSide = commitTree(repo, normalizedUpstream, previousUpstream, date, 'Upstream side of reviewed sync');
  try {
    // Conflict diagnostics below are parsed in English; do not inherit the host locale.
    return gitBytes(repo, ['merge-tree', '--write-tree', ourSide, theirSide], undefined, {
      ...gitEnv, LC_ALL: 'C', LANGUAGE: 'C',
    }).toString('utf8').split('\n')[0];
  } catch (error) {
    if (error.status !== 1) throw error;
    const conflicts = error.stdout.toString('utf8').split('\n').filter(line => line.startsWith('CONFLICT'));
    throw new Error(`Upstream merge conflicts: ${conflicts.join('; ')}`);
  }
}

function updatedPolicy(bytes, previousDirectory, directory) {
  const text = bytes.toString('utf8');
  const properties = [...text.matchAll(/("upstreamDirectory"\s*:\s*)("(?:[^"\\]|\\.)*")/g)];
  const [property] = properties;
  if (properties.length !== 1 || JSON.parse(property[2]) !== previousDirectory)
    throw new Error(`Could not update exactly one upstreamDirectory in ${policyPath}`);
  return text.slice(0, property.index) + property[1] + JSON.stringify(directory) + text.slice(property.index + property[0].length);
}

function newBlob(repo, bytes, mode = '100644') {
  return { mode, oid: gitBytes(repo, ['hash-object', '-w', '--stdin'], bytes).toString('utf8').trim() };
}

function snapshotEntries(repo, upstream, snapshot, mergedTree, snapshotAt) {
  const directory = `data/upstream/${upstream.slice(0, 8)}`;
  if ([...mergedTree.keys()].some(path => intersects(path, directory)))
    throw new Error(`Upstream snapshot directory already exists: ${directory}`);
  const changes = [];
  const files = {};
  for (const [name, path] of Object.entries(snapshotPaths)) {
    const oid = fileEntry(repo, upstream, path);
    const bytes = gitBytes(repo, ['cat-file', 'blob', oid]);
    readJson(bytes, path);
    files[name] = { path, sha256: sha256(bytes) };
    changes.push([`${directory}/${name}`, { mode: '100644', oid }]);
  }
  const source = { upstreamSha: upstream, repository: snapshot.source.repository, files, snapshotAt };
  changes.push([`${directory}/source.json`, newBlob(repo, `${JSON.stringify(source, null, 2)}\n`)]);
  const policy = updatedPolicy(snapshot.policyBytes, snapshot.upstreamDirectory, directory);
  changes.push([policyPath, newBlob(repo, policy, mergedTree.get(policyPath).mode)]);
  return changes;
}

export function prepareReviewedSync({ repo, upstream, business, output, protect }, report) {
  Object.assign(report, { upstream, business, output, stage: 'source' });
  for (const [label, value] of Object.entries({ upstream, business })) {
    if (!fullSha.test(value) || git(repo, 'cat-file', '-t', value) !== 'commit')
      throw new Error(`--${label} must be a full Git commit SHA`);
  }
  const snapshot = readReviewedSnapshot(repo, business);
  const { previousUpstream } = snapshot;
  report.previousUpstream = previousUpstream;
  if (upstream === previousUpstream) {
    report.status = 'unchanged';
    return;
  }
  try {
    git(repo, 'merge-base', '--is-ancestor', previousUpstream, upstream);
  } catch (error) {
    if (error.status !== 1) throw error;
    throw new Error(`Upstream ${upstream} does not descend from reviewed pin ${previousUpstream}`);
  }

  report.stage = 'protected-data';
  if (protect.some(path => path.startsWith(':') || path.split('/').some(part => ['', '.', '..'].includes(part))))
    throw new Error('Protected paths must be plain relative repository paths');
  const roots = [...new Set([...protectedRoots, ...protect])];
  const previousTree = treeEntries(repo, previousUpstream);
  const upstreamTree = treeEntries(repo, upstream);
  const businessTree = treeEntries(repo, business);
  for (const tree of [previousTree, upstreamTree, businessTree]) validateTree(tree);
  const upstreamChanges = changedPaths(previousTree, upstreamTree);
  const upstreamWorkflows = upstreamChanges.filter(path => path.startsWith(activeWorkflows));
  protectChanges(upstreamChanges.filter(path => !path.startsWith(activeWorkflows)), roots);

  const date = new Date(git(repo, 'show', '-s', '--format=%cI', upstream)).toISOString().replace('.000Z', 'Z');
  report.stage = 'clone';
  mkdirSync(output);
  try {
    gitBytes(repo, ['clone', '--no-hardlinks', '--no-checkout', '--template=', '--', repo, output]);
    report.stage = 'merge';
    const merged = simulateMerge(output, upstream, business, previousUpstream, upstreamWorkflows, previousTree, date);
    const mergedTree = treeEntries(output, merged);
    report.stage = 'protected-data';
    validateTree(mergedTree);
    protectChanges(changedPaths(businessTree, mergedTree), roots);

    report.stage = 'snapshot';
    const changes = snapshotEntries(output, upstream, snapshot, mergedTree, date);
    const quarantinedWorkflows = [];
    const occupied = new Set(mergedTree.keys());
    for (const path of upstreamWorkflows) {
      const entry = upstreamTree.get(path);
      if (!entry) continue;
      const name = path.slice(activeWorkflows.length);
      const target = `${quarantine}${name}`;
      if ([...occupied].some(path => path !== target && intersects(path, target)))
        throw new Error(`Workflow quarantine path conflicts with existing data: ${target}`);
      changes.push([target, { mode: '100644', oid: entry.oid }]);
      occupied.add(target);
      quarantinedWorkflows.push(name);
    }
    const tree = writeTree(output, merged, changes);
    const candidate = commitTree(output, tree, business, date, `Review upstream ${upstream}`);
    git(output, '-c', 'core.protectHFS=true', '-c', 'core.protectNTFS=true', 'switch', '--discard-changes', '-c', 'naoshengyun-sync-candidate', candidate);
    Object.assign(report, { status: 'candidate-ready', stage: 'review', candidate, mergeCommit: candidate, quarantinedWorkflows });
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}
