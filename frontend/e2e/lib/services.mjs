import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export function startProcess(executable, args, options) {
  const child = spawn(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  return { child, logs };
}

export async function stopProcess(processInfo) {
  const child = processInfo?.child;
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(3_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

export async function stopServices(services) {
  await Promise.all([stopProcess(services?.frontend), stopProcess(services?.backend)]);
  if (services?.authUsersDirectory) {
    await fsPromises.rm(services.authUsersDirectory, { recursive: true, force: true });
  }
}

async function waitFor(check, processInfo, description, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`${description} exited early:\n${processInfo.logs.join('')}`);
    }
    if (await check()) return;
    await sleep(200);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`);
}

function httpReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => { response.resume(); resolve(response.statusCode === 200); });
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
  });
}

function websocketReady(port) {
  return new Promise((resolve) => {
    const request = http.request({ host: '127.0.0.1', port, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' } });
    request.once('upgrade', (_response, socket) => { socket.destroy(); resolve(true); });
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
    request.end();
  });
}

function resolveBackendPython(backendRoot) {
  const candidates = process.platform === 'win32'
    ? [path.join(backendRoot, '.venv', 'Scripts', 'python.exe')]
    : [path.join(backendRoot, '.venv', 'bin', 'python')];
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) throw new Error('Backend virtual environment is missing. Run `uv sync --project backend --frozen` first.');
  return executable;
}

export async function startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed, enableScenarios = false }) {
  const viteEntry = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const websocketUrl = `ws://127.0.0.1:${backendPort}`;
  // The backend also starts a local admin HTTP service. Give each E2E run its
  // own port so a developer's running game cannot prevent browser verification.
  const adminHttpPort = await findFreePort();
  const sharedEnv = {
    ...process.env,
    VITE_WS_URL: websocketUrl,
    ...(enableScenarios ? { VITE_E2E_SCENARIOS: 'true' } : {}),
  };
  const build = spawnSync(process.execPath, [viteEntry, 'build'], { cwd: frontendRoot, env: sharedEnv, stdio: 'inherit' });
  if (build.status !== 0) throw new Error(`Frontend production build failed with exit code ${build.status}`);

  // Avatar selection persists to AUTH_USERS_FILE. Keep ordinary E2E suites
  // from rewriting the checked-in demo accounts while preserving an explicit
  // test fixture supplied by a suite such as avatar-profile.mjs.
  let authUsersDirectory;
  let authUsersFile = process.env.AUTH_USERS_FILE;
  if (!authUsersFile) {
    authUsersDirectory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'mini-card-game-e2e-users-'));
    authUsersFile = path.join(authUsersDirectory, 'users.json');
    await fsPromises.copyFile(path.join(backendRoot, 'auth', 'users.json'), authUsersFile);
  }

  const backend = startProcess(resolveBackendPython(backendRoot), ['main.py'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(backendPort),
      ADMIN_HTTP_PORT: String(adminHttpPort),
      AUTH_USERS_FILE: authUsersFile,
      E2E_RANDOM_SEED: String(seed),
      ...(enableScenarios ? { APP_ENV: 'e2e', ENABLE_E2E_SCENARIOS: 'true' } : {}),
    },
  });
  const frontend = startProcess(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], { cwd: frontendRoot, env: sharedEnv });
  const appUrl = `http://127.0.0.1:${frontendPort}`;
  try {
    await Promise.all([waitFor(() => websocketReady(backendPort), backend, `backend on ${backendPort}`), waitFor(() => httpReady(appUrl), frontend, `frontend on ${frontendPort}`)]);
  } catch (error) {
    await Promise.all([stopProcess(frontend), stopProcess(backend)]);
    if (authUsersDirectory) await fsPromises.rm(authUsersDirectory, { recursive: true, force: true });
    throw error;
  }
  return { backend, frontend, appUrl, websocketUrl, adminHttpPort, authUsersDirectory };
}

export async function prepareOutput(frontendRoot, requestedOutput) {
  const outputRoot = path.resolve(frontendRoot, requestedOutput ?? path.join('test-results', 'full-game'));
  const allowedRoot = `${path.join(frontendRoot, 'test-results')}${path.sep}`;
  if (!outputRoot.startsWith(allowedRoot)) throw new Error('E2E output must stay inside frontend/test-results');
  await fsPromises.rm(outputRoot, { recursive: true, force: true });
  await fsPromises.mkdir(outputRoot, { recursive: true });
  return outputRoot;
}
