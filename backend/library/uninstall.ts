import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export function runUninstall(): void {
  const p = process.platform;

  if (p === 'darwin') {
    const script = '/usr/local/share/condenser/uninstall.sh';
    if (!existsSync(script)) {
      console.error('Uninstall script not found at', script);
      console.error('Is Condenser installed? Try reinstalling from the .pkg.');
      process.exit(1);
    }
    spawnSync('bash', [script], { stdio: 'inherit' });
  } else if (p === 'linux') {
    const script = '/opt/condenser/uninstall.sh';
    if (!existsSync(script)) {
      console.error('Uninstall script not found at', script);
      console.error('Use your package manager instead: apt remove condenser  or  rpm -e condenser');
      process.exit(1);
    }
    spawnSync('bash', [script], { stdio: 'inherit' });
  } else if (p === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const uninstaller = join(programFiles, 'Condenser', 'uninstall.exe');
    if (!existsSync(uninstaller)) {
      console.error('Uninstaller not found. Use Settings → Apps → Condenser → Uninstall.');
      process.exit(1);
    }
    spawnSync(uninstaller, [], { stdio: 'inherit' });
  } else {
    console.error('Unsupported platform:', p);
    process.exit(1);
  }
}
