import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const PORT = Number(process.env.NOVA_BRIDGE_PORT ?? 8787);
const HOST = process.env.NOVA_BRIDGE_HOST ?? '127.0.0.1';
const CODE_PUPPY_BIN = process.env.CODE_PUPPY_BIN ?? 'code-puppy';
const CODE_PUPPY_AGENT = process.env.CODE_PUPPY_AGENT ?? 'nova';
const CODE_PUPPY_MODEL = process.env.CODE_PUPPY_MODEL ?? '';
const TASK_TIMEOUT_MS = Number(process.env.NOVA_TASK_TIMEOUT_MS ?? 180000);
const VERSION = '0.1.0';

let activeTask = null;
let lastCliCheck = null;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);

    if (request.method === 'GET' && url.pathname === '/api/nova/health') {
      sendJson(response, 200, buildHealthPayload('NOVA bridge is online. Code Puppy tasks can run after explicit approval.'));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/nova/start') {
      lastCliCheck = checkCodePuppyAvailability();
      sendJson(response, 200, buildHealthPayload(lastCliCheck.available ? 'NOVA bridge is ready and Code Puppy CLI is available.' : `NOVA bridge is online, but Code Puppy CLI was not verified: ${lastCliCheck.error}`));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/nova/task/approve') {
      const payload = await readJson(request);
      const plan = payload?.plan ?? payload;
      const result = await runApprovedTask(plan);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/nova/task/status') {
      sendJson(response, 200, { activeTask, timestamp: new Date().toISOString() });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/nova/stop') {
      sendJson(response, 200, { status: 'offline', mode: 'unknown', timestamp: new Date().toISOString(), message: 'NOVA bridge stop requested. Close this terminal to stop the local bridge process.' });
      return;
    }

    sendJson(response, 404, { error: 'NOVA bridge route not found.' });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unknown NOVA bridge error.' });
  }
});

server.listen(PORT, HOST, () => {
  lastCliCheck = checkCodePuppyAvailability();
  console.log(`NOVA bridge listening on http://${HOST}:${PORT}`);
  console.log(`Code Puppy command: ${CODE_PUPPY_BIN} --agent ${CODE_PUPPY_AGENT}${CODE_PUPPY_MODEL ? ` --model ${CODE_PUPPY_MODEL}` : ''} --prompt <approved task>`);
  if (lastCliCheck.available) {
    console.log(`Code Puppy verified: ${lastCliCheck.version || 'available'}`);
  } else {
    console.warn(`Code Puppy was not verified: ${lastCliCheck.error}`);
  }
});

function buildHealthPayload(message) {
  const cli = lastCliCheck ?? checkCodePuppyAvailability();
  return {
    status: 'online',
    mode: 'live-cli',
    version: VERSION,
    timestamp: new Date().toISOString(),
    message,
    cli: {
      available: cli.available,
      command: CODE_PUPPY_BIN,
      agent: CODE_PUPPY_AGENT,
      model: CODE_PUPPY_MODEL || undefined,
      version: cli.version,
      error: cli.error,
    },
  };
}

async function runApprovedTask(plan) {
  validatePlan(plan);

  const prompt = buildPrompt(plan);
  const task = {
    id: plan.id ?? `nova-task-${Date.now()}`,
    title: plan.title ?? 'NOVA approved Code Puppy task',
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  activeTask = task;

  try {
    const cliResult = await runCodePuppy(prompt);
    const completed = {
      ...plan,
      status: cliResult.exitCode === 0 ? 'completed' : 'failed',
      resultSummary: cliResult.exitCode === 0
        ? summarizeOutput(cliResult.stdout || cliResult.stderr || 'Code Puppy completed without output.')
        : undefined,
      error: cliResult.exitCode === 0 ? undefined : summarizeOutput(cliResult.stderr || cliResult.stdout || `Code Puppy exited with code ${cliResult.exitCode}.`),
      bridgeOutput: {
        exitCode: cliResult.exitCode,
        stdout: cliResult.stdout,
        stderr: cliResult.stderr,
      },
    };
    activeTask = { ...task, status: completed.status, completedAt: new Date().toISOString() };
    return completed;
  } catch (error) {
    const failed = {
      ...plan,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown Code Puppy execution error.',
    };
    activeTask = { ...task, status: 'failed', completedAt: new Date().toISOString(), error: failed.error };
    return failed;
  }
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Approved NOVA task plan is required.');
  if (plan.requiresApproval !== true) throw new Error('Task rejected: requiresApproval must be true.');
  if (!['awaiting-approval', 'running'].includes(plan.status)) throw new Error(`Task rejected: invalid status ${plan.status}.`);
  if (!['code-puppy-task', 'task-plan', 'draft', 'analysis', 'recommendation'].includes(plan.intent)) throw new Error(`Task rejected: unsupported intent ${plan.intent}.`);
  if (typeof plan.requestedAction !== 'string' || !plan.requestedAction.trim()) throw new Error('Task rejected: requestedAction is required.');
}

function buildPrompt(plan) {
  const steps = Array.isArray(plan.steps) ? plan.steps.map((step, index) => `${index + 1}. ${step}`).join('\n') : 'No steps provided.';
  return [
    'You are Code Puppy operating as the NOVA helper for the FPI dashboard.',
    'Follow these guardrails: do not make destructive changes, do not access external systems, and summarize before suggesting file edits.',
    'Only perform the approved task described below. If code changes are needed, propose a safe plan first unless the prompt explicitly asks for implementation.',
    '',
    `Task title: ${plan.title ?? 'NOVA approved task'}`,
    `Requested action: ${plan.requestedAction}`,
    `Approval reason: ${plan.approvalReason ?? 'User approved from NOVA.'}`,
    'Planned steps:',
    steps,
  ].join('\n');
}

function runCodePuppy(prompt) {
  const args = ['--agent', CODE_PUPPY_AGENT, '--prompt', prompt];
  if (CODE_PUPPY_MODEL) args.splice(2, 0, '--model', CODE_PUPPY_MODEL);

  return new Promise((resolve, reject) => {
    const child = spawn(CODE_PUPPY_BIN, args, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Code Puppy task timed out after ${TASK_TIMEOUT_MS}ms.`));
    }, TASK_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? 1, stdout: trimOutput(stdout), stderr: trimOutput(stderr) });
    });
  });
}

function checkCodePuppyAvailability() {
  try {
    const result = spawnSync(CODE_PUPPY_BIN, ['--version'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: 20000,
      env: process.env,
    });

    if (result.error) throw result.error;
    return {
      available: result.status === 0,
      version: trimOutput(result.stdout || result.stderr),
      error: result.status === 0 ? undefined : trimOutput(result.stderr || result.stdout || `Exited with code ${result.status}`),
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unable to run code-puppy --version.',
    };
  }
}

function summarizeOutput(output) {
  const cleaned = trimOutput(output);
  if (cleaned.length <= 1200) return cleaned;
  return `${cleaned.slice(0, 1200)}...`;
}

function trimOutput(value) {
  return String(value ?? '').replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}
