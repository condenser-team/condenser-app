// Evaluated in Steam's SharedJSContext via native ESM import().
// The backend bootstraps this file via CDP: await import('.../frontend/index.ts?t=...')

import * as tree       from './library/tree.js';
import * as steam      from './library/steam.js';
import * as tab  from './library/tab.js';
import * as page from './library/page.js';
import * as persistent from './library/persistent.js';
import * as plugins    from './library/loader.js';
import { boot, installPreamble } from './library/boot.js';
import type { CondenserNamespace } from './library/types.js';

const condenser = ((window as any).__condenser ||= { core: {}, components: {}, stylesheets: new Map() }) as CondenserNamespace;
condenser.tree       = tree;
condenser.steam      = steam;
condenser.tab  = tab;
condenser.page = page;
condenser.persistent = persistent;
condenser.plugins    = plugins;

installPreamble();
boot();
