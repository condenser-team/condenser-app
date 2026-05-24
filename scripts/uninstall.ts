/**
 * Cross-platform uninstall for the installed Condenser service.
 * Usage: tsx scripts/uninstall.ts
 *
 * macOS   — runs /usr/local/share/condenser/uninstall.sh (bundled in the .pkg)
 * Linux   — runs installers/linux/uninstall.sh
 * Windows — launches %PROGRAMFILES%\Condenser\uninstall.exe
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const p = process.platform;

if (p === 'darwin') {
  const script = '/usr/local/share/condenser/uninstall.sh';
  if (!existsSync(script)) {
    console.error('Uninstall script not found. Is Condenser installed?');
    process.exit(1);
  }
  spawnSync('bash', [script], { stdio: 'inherit' });
} else if (p === 'linux') {
  const script = join(process.cwd(), 'installers', 'linux', 'uninstall.sh');
  if (!existsSync(script)) {
    console.error('Uninstall script not found:', script);
    process.exit(1);
  }
  spawnSync('bash', [script], { stdio: 'inherit' });
} else if (p === 'win32') {
  const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
  const uninstaller = join(programFiles, 'Condenser', 'uninstall.exe');
  if (!existsSync(uninstaller)) {
    console.error('Uninstaller not found. Use Settings → Apps → Condenser → Uninstall');
    process.exit(1);
  }
  spawnSync(uninstaller, [], { stdio: 'inherit' });
} else {
  console.error('Unsupported platform:', p);
  process.exit(1);
}
