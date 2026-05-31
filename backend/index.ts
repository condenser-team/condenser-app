import { getModeFromArg } from '../shared/runtime.js';
import { startServer } from './library/server.js';
import { startDiscovery } from './library/target.js';
import { runUninstall } from './library/uninstall.js';

const args = process.argv.slice(2);

if (args[0] === 'uninstall') {
  runUninstall();
} else {
  const mode = getModeFromArg(args);
  startServer(mode);
  startDiscovery(mode);
}
