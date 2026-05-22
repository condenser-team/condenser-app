// When packaged as a binary via pkg, force production mode regardless of environment.
if ((process as any).pkg) {
  process.env.NODE_ENV = 'production';
}

import { getModeFromArg } from '../shared/runtime.js';
import { startServer } from './library/server.js';
import { startDiscovery } from './library/target.js';

const mode = getModeFromArg(process.argv.slice(2));
startServer(mode);
startDiscovery(mode);
