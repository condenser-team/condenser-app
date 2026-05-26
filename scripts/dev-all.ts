/**
 * dev-all.ts - start the condenser dev server + Steam in one shot
 * Tracks child PIDs and kills everything on Ctrl+C or exit.
 *
 * Usage: tsx scripts/dev-all.ts [game|desktop] [local|remote]
 *   game    = Steam Big Picture / gamepadui (default)
 *   desktop = Steam desktop mode
 *   local   = dev server binds to localhost (default)
 *   remote  = dev server binds to network IP for Steam Deck access
 */
import { spawn, ChildProcess } from 'child_process';

const args = process.argv.slice(2);
const steamMode = args.includes('desktop') ? 'desktop' : 'game';
const netMode = args.includes('remote') ? 'remote' : 'local';

const children: ChildProcess[] = [];

function cleanup() {
  console.log('\nShutting down...');
  for (const child of children) {
    if (child.pid && !child.killed) {
      // kill the process group so child processes (vite, tsx watch) also die
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      try { child.kill('SIGTERM'); } catch {}
    }
  }
  // give them a second to exit gracefully, then force kill
  setTimeout(() => {
    for (const child of children) {
      if (child.pid && !child.killed) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }
    }
    process.exit(0);
  }, 1500);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 1. start the dev server (vite + backend watcher via concurrently)
const devScript = netMode === 'remote' ? 'dev:remote' : 'dev';
console.log(`Starting dev server (${netMode} mode)...`);
const devProc = spawn('npm', ['run', devScript], {
  stdio: 'inherit',
  detached: true,
});
children.push(devProc);
console.log(`  dev server PID: ${devProc.pid}`);

devProc.on('exit', (code) => {
  console.log(`Dev server exited (code ${code})`);
  cleanup();
});

// 2. wait a beat for the server to start, then launch Steam
setTimeout(() => {
  console.log(`\nLaunching Steam (${steamMode} mode)...`);
  const appProc = spawn('npm', ['run', steamMode === 'desktop' ? 'app:desktop' : 'app'], {
    stdio: 'inherit',
    detached: true,
  });
  children.push(appProc);
  console.log(`  Steam launcher PID: ${appProc.pid}`);

  appProc.on('exit', (code) => {
    console.log(`Steam exited (code ${code})`);
    cleanup();
  });
}, 2000);
