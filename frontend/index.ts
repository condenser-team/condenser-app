// Evaluated in Steam's SharedJSContext via native ESM import().
// The backend bootstraps this file via CDP: await import('.../frontend/index.ts?t=...')

import * as tree                  from './library/tree.js';
import { createReactTreePatcher } from './library/treepatcher.js';
import * as steam      from './library/steam.js';
import * as tab        from './library/tab.js';
import * as page       from './library/page.js';
import * as persistent from './library/persistent.js';
import * as plugins    from './library/loader.js';
import * as nav        from './library/nav.js';
import * as css        from './library/css.js';
import * as ui         from './library/ui.js';
import * as events     from './library/events.js';
import * as plugin     from './library/plugin.js';
import * as steamApi   from './library/steam-api.js';
import { boot, installPreamble } from './library/boot.js';
import type { CondenserNamespace } from './library/types.js';

const condenser = ((window as any).condenser ||= { core: {}, components: {}, stylesheets: new Map() }) as CondenserNamespace;
condenser.tree       = { ...tree, createReactTreePatcher };
condenser.steam      = { ...steam, classes: steamApi.classes, resetClasses: steamApi.resetClasses };
condenser.tab        = tab;
condenser.page       = page;
condenser.persistent = persistent;
condenser.plugins    = plugins;
// Public API — plugins delegate to these instead of bundling duplicate logic.
condenser.nav    = nav;
condenser.css    = css;
condenser.ui     = ui;
condenser.events = events;
condenser.plugin = plugin;

installPreamble();
boot();
