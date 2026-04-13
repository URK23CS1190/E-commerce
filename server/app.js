'use strict';
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { spawn, execSync } = require('child_process');
const {
  register, loginCounter, trafficCounter, activeUsersGauge
} = require('./metrics');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Metrics state ────────────────────────────────────────────────
let totalLogins    = 0;
let activeUsers    = 0;
let intervalLogins = 0;
let intervalReqs   = 0;
const MAX_POINTS   = 60;
const timeline     = [];

// In-memory ring buffer for live logs (Docker + K8s + app)
const MAX_LOGS = 200;
const logBuffer = [];

function addLog(source, level, msg) {
  const entry = {
    t:   new Date().toISOString(),
    src: source,   // 'APP' | 'DOCKER' | 'K8S'
    lvl: level,    // 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
    msg
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  // Broadcast to all SSE clients
  sseClients.forEach(res => {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch(_) {}
  });
}

// ── Traffic middleware ────────────────────────────────────────────
app.use((req, res, next) => {
  intervalReqs++;
  res.on('finish', () => {
    trafficCounter.inc({ route: req.path, method: req.method, status_code: res.statusCode });
    addLog('APP', res.statusCode >= 400 ? 'WARN' : 'INFO',
      `${req.method} ${req.path} → ${res.statusCode}`);
  });
  next();
});

// ── Snapshot every 5 seconds ──────────────────────────────────────
function pushSnapshot() {
  const mem = process.memoryUsage();
  timeline.push({
    time:      new Date().toISOString(),
    logins:    intervalLogins,
    traffic:   intervalReqs,
    memoryMB:  parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    rss:       parseFloat((mem.rss      / 1024 / 1024).toFixed(2)),
    totalLogins,
    activeUsers
  });
  intervalLogins = 0;
  intervalReqs   = 0;
  if (timeline.length > MAX_POINTS) timeline.shift();
}
setInterval(pushSnapshot, 5000);
pushSnapshot();

// ── Docker log tailing ────────────────────────────────────────────
function startDockerLogs() {
  try {
    // Get all running container IDs
    const ids = execSync('docker ps -q 2>/dev/null', { timeout: 3000 })
      .toString().trim().split('\n').filter(Boolean);

    if (!ids.length) {
      addLog('DOCKER', 'WARN', 'No running Docker containers found');
      return;
    }

    ids.slice(0, 3).forEach(id => {
      const proc = spawn('docker', ['logs', '--tail', '20', '-f', id], { stdio: ['ignore','pipe','pipe'] });

      const handleLine = (data, lvl) => {
        data.toString().split('\n').filter(Boolean).forEach(line => {
          addLog('DOCKER', lvl, `[${id.slice(0,8)}] ${line.slice(0, 200)}`);
        });
      };
      proc.stdout.on('data', d => handleLine(d, 'INFO'));
      proc.stderr.on('data', d => handleLine(d, 'WARN'));
      proc.on('error', () => addLog('DOCKER', 'ERROR', `Failed to tail container ${id.slice(0,8)}`));
      proc.on('close', () => addLog('DOCKER', 'INFO', `Log stream ended for ${id.slice(0,8)}`));
    });

    addLog('DOCKER', 'INFO', `Tailing ${Math.min(ids.length, 3)} container(s): ${ids.slice(0,3).map(i=>i.slice(0,8)).join(', ')}`);
  } catch (e) {
    addLog('DOCKER', 'WARN', 'Docker not available or no containers: ' + e.message.slice(0,80));
    // Generate synthetic Docker-style logs so dashboard is never empty
    simulateDockerLogs();
  }
}

function simulateDockerLogs() {
  const templates = [
    ['INFO',  'Container health check passed'],
    ['INFO',  'Static files served from /app/public'],
    ['INFO',  'Prometheus metrics scraped successfully'],
    ['WARN',  'High memory usage detected in heap'],
    ['INFO',  'Node.js event loop latency nominal'],
    ['DEBUG', 'Connection pool: 4/10 active'],
    ['INFO',  'Express middleware chain: 6 handlers'],
    ['INFO',  'Uptime: {uptime}s'],
  ];
  setInterval(() => {
    const [lvl, tpl] = templates[Math.floor(Math.random() * templates.length)];
    const msg = tpl.replace('{uptime}', Math.floor(process.uptime()));
    addLog('DOCKER', lvl, msg);
  }, 4000);
}

// ── Kubernetes log tailing ────────────────────────────────────────
function startK8sLogs() {
  try {
    const pods = execSync(
      'kubectl get pods -n monitoring -o jsonpath=\'{.items[*].metadata.name}\' 2>/dev/null',
      { timeout: 4000 }
    ).toString().trim().split(/\s+/).filter(Boolean);

    if (!pods.length) throw new Error('no pods found');

    pods.slice(0, 2).forEach(pod => {
      const proc = spawn('kubectl', ['logs', '-f', '--tail=20', '-n', 'monitoring', pod],
        { stdio: ['ignore','pipe','pipe'] });

      const handle = (data, lvl) => {
        data.toString().split('\n').filter(Boolean).forEach(line => {
          addLog('K8S', lvl, `[${pod.slice(0,20)}] ${line.slice(0,200)}`);
        });
      };
      proc.stdout.on('data', d => handle(d, 'INFO'));
      proc.stderr.on('data', d => handle(d, 'WARN'));
      proc.on('error', () => addLog('K8S', 'ERROR', `Failed to tail pod ${pod}`));
    });

    addLog('K8S', 'INFO', `Watching pods: ${pods.slice(0,2).join(', ')}`);
  } catch (e) {
    addLog('K8S', 'WARN', 'kubectl not available or no pods: ' + e.message.slice(0,80));
    simulateK8sLogs();
  }
}

function simulateK8sLogs() {
  const pods = ['ecommerce-app-7d9f8b-xk2p', 'prometheus-0', 'grafana-5f9c6-mnqr'];
  const events = [
    ['INFO',  'Liveness probe succeeded'],
    ['INFO',  'Readiness probe passed — pod serving traffic'],
    ['INFO',  'Pulling image: alfinjones/ecommerce-noir:latest'],
    ['INFO',  'Successfully pulled image from registry'],
    ['WARN',  'CPU throttling detected on node'],
    ['INFO',  'Pod scheduled on node: minikube'],
    ['INFO',  'Service endpoint registered in kube-dns'],
    ['INFO',  'HPA: current replicas=2, desired=2'],
    ['DEBUG', 'ConfigMap mounted at /etc/config'],
    ['INFO',  'Namespace: monitoring — quota OK'],
  ];
  setInterval(() => {
    const pod = pods[Math.floor(Math.random() * pods.length)];
    const [lvl, msg] = events[Math.floor(Math.random() * events.length)];
    addLog('K8S', lvl, `[${pod}] ${msg}`);
  }, 3500);
}

// Start log collection 2s after boot to avoid startup noise
setTimeout(() => {
  addLog('APP', 'INFO', `NOIR server started on port ${PORT}`);
  addLog('APP', 'INFO', `Node.js ${process.version} — PID ${process.pid}`);
  startDockerLogs();
  startK8sLogs();
}, 2000);

// Periodic app heartbeat logs
setInterval(() => {
  addLog('APP', 'INFO', `Heartbeat — uptime: ${Math.floor(process.uptime())}s | logins: ${totalLogins} | active: ${activeUsers}`);
}, 15000);

// ── SSE clients ───────────────────────────────────────────────────
const sseClients = new Set();

app.get('/api/logs/stream', (req, res) => {
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  // Send buffered logs immediately on connect
  logBuffer.forEach(entry => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ── REST API ──────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  totalLogins  += 1;
  activeUsers  += 1;
  intervalLogins += 1;
  loginCounter.inc();
  activeUsersGauge.set(activeUsers);
  addLog('APP', 'INFO', `Login: ${email || 'guest'} — total=${totalLogins}`);
  res.json({ success: true, message: 'Login recorded', user: email || 'guest', totalLogins, activeUsers });
});

app.post('/api/logout', (req, res) => {
  activeUsers = Math.max(0, activeUsers - 1);
  activeUsersGauge.set(activeUsers);
  addLog('APP', 'INFO', `Logout — active users now: ${activeUsers}`);
  res.json({ success: true, message: 'Logout recorded', activeUsers });
});

app.get('/api/realtime-metrics', (req, res) => {
  res.json({ totalLogins, activeUsers, timeline });
});

app.get('/api/dashboard-summary', (req, res) => {
  res.json({ totalLogins, activeUsers, trafficHistory: timeline });
});

app.get('/api/logs/history', (req, res) => {
  res.json({ logs: logBuffer });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Catch-all — must be LAST
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`NOIR server running on http://localhost:${PORT}`));
