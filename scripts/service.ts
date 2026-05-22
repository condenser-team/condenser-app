/**
 * Cross-platform service management for the installed Condenser service.
 * Usage: tsx scripts/service.ts <start|stop|restart|status|logs>
 *
 * macOS  — LaunchAgent (launchctl load/unload)
 * Linux  — systemd user service
 * Windows — Task Scheduler task + taskkill
 */
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

type Cmd = 'start' | 'stop' | 'restart' | 'status' | 'logs';

const VALID: Cmd[] = ['start', 'stop', 'restart', 'status', 'logs'];
const cmd = process.argv[2] as Cmd;

if (!VALID.includes(cmd)) {
  console.error(`Usage: tsx scripts/service.ts <${VALID.join('|')}>`);
  process.exit(1);
}

function run(command: string, args: string[]) {
  spawnSync(command, args, { stdio: 'inherit' });
}

function mac(c: Cmd) {
  const plist = join(homedir(), 'Library', 'LaunchAgents', 'com.condenser.plist');
  const log   = '/usr/local/share/condenser/condenser.log';
  switch (c) {
    // unload stops the process and prevents launchd from restarting it (KeepAlive ignored)
    case 'stop':    return run('launchctl', ['unload', plist]);
    case 'start':   return run('launchctl', ['load', '-w', plist]);
    case 'restart': mac('stop'); mac('start'); break;
    case 'status':  return run('launchctl', ['list', 'com.condenser']);
    case 'logs':    return run('tail', ['-f', log]);
  }
}

function linux(c: Cmd) {
  switch (c) {
    case 'stop':    return run('systemctl', ['--user', 'stop',    'condenser']);
    case 'start':   return run('systemctl', ['--user', 'start',   'condenser']);
    case 'restart': return run('systemctl', ['--user', 'restart', 'condenser']);
    case 'status':  return run('systemctl', ['--user', 'status',  'condenser']);
    case 'logs':    return run('journalctl', ['--user', '-u', 'condenser', '-f']);
  }
}

function windows(c: Cmd) {
  const appData = process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming');
  const log = join(appData, 'condenser', 'condenser.log');
  switch (c) {
    case 'stop':    return run('schtasks', ['/end', '/tn', 'Condenser']);
    case 'start':   return run('schtasks', ['/run', '/tn', 'Condenser']);
    case 'restart': windows('stop'); windows('start'); break;
    case 'status':  return run('schtasks', ['/query', '/tn', 'Condenser', '/fo', 'LIST']);
    case 'logs':    return run('powershell', ['-Command', `Get-Content "${log}" -Wait -Tail 50`]);
  }
}

const p = process.platform;
if      (p === 'darwin') mac(cmd);
else if (p === 'linux')  linux(cmd);
else if (p === 'win32')  windows(cmd);
else { console.error('Unsupported platform:', p); process.exit(1); }
