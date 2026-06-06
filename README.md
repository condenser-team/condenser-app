# Condenser (prototype)

> Turns Steam 💨 into liquid 💧

Condenser allows you to customize Steam Big Picture Mode and SteamOS using plugins, on any platform (Windows, macOS, Linux, Steam Deck).

![Condenser](/condenser-screenshot.jpg)

---

## User Guide

### Introduction

Condenser is a plugin loader for Steam Big Picture Mode and SteamOS. Install it on your PC to extend the Steam interface with community-made plugins — adding new features that Steam doesn't offer out-of-the-box.

### Download and install

Download the correct installer for your system from the [GitHub Releases](../../releases) page.

The installer starts the Condenser service automatically. Open Steam in development mode and press the **☰** button to see the Condenser tab.

### Uninstall

| System | How to uninstall |
|--------|-----------------|
| macOS | Open **Condenser (uninstall)** from your Applications folder |
| Linux | Open **Condenser (uninstall)** from your Applications menu |
| Windows | **Settings → Apps → Condenser → Uninstall** |

---

## Developer Guide

### Comparison with other loaders

[Decky](https://decky.xyz/) and [Millennium](https://steambrew.app/) are established alternatives. Condenser's main differences:

| Feature | **Condenser** | Decky | Millennium |
|---------|---------------|-------|------------|
| **Platform** | SteamOS, Steam App (Linux, Mac, Win) | SteamOS only | Steam App (Linux, Win) |
| **Language** | TypeScript/Node.js | Python + TypeScript | C++ + TypeScript |
| **Hot reload** | ✅ React Fast Refresh | ❌ Manual restart | ❌ Build required |
| **Cross-platform dev** | ✅ Linux, Mac, Win | ❌ SteamOS only | ❌ Linux, Win |
| **Setup** | `npm install` | Linux VM required | C++ build tools |
| **Plugin size** | 2 files, ~30 lines | Template-based | Template + build |

### Features

- **Tabs and Panels** to Steam's Quick Access Menu (the ☰ button in-game and in Big Picture Mode)
- **Pages** to Big Picture Mode and SteamOS navigation
- **Persistent** (always-on) overlays across all Big Picture pages
- **Toast notifications** (with sound) visible over the Quick Access Menu
- Plugins can show information, controls, or anything else a web page can render
- Works on **Windows, macOS, Linux desktop, and Steam Deck**

### How it works

Steam's UI is a Chromium-based application. All Steam windows (store, library, Quick Access Menu, Big Picture Mode) share a single JavaScript context called **SharedJSContext**. Condenser uses Chrome DevTools Protocol (CDP) to locate that context, then injects a React shim that:

1. Discovers Steam's own React and webpack module registry
2. Patches Steam's component tree to add Condenser tabs and pages
3. Loads plugin frontends as ES modules over a local HTTPS/WSS server
4. Routes plugin backend calls over WebSocket to Node.js plugin handlers

Hot Module Replacement works end-to-end: editing a plugin file reloads only that plugin inside Steam without restarting anything.

### Architecture

```
Steam (Chromium)
└── SharedJSContext ← CDP injection point
    └── window.condenser  (frontend/index.ts)
        ├── steam.ts      discover React, webpack registry, router
        ├── tab.ts        patch Quick Access Menu — add Tab and Panel surfaces
        ├── page.ts       inject Page routes into Big Picture / SteamOS router
        ├── persistent.ts inject Persistent components (always rendered)
        ├── fc.ts         FC trampoline — convert function components to patchable classes
        ├── toast.ts      native toast notifications via ValveToastRenderer + NotificationStore
        └── loader.ts     load plugin frontends, route WS calls to backend

Condenser server (Node.js / backend/)
├── server.ts         HTTPS + WebSocket server, serves frontend build
├── target.ts         CDP scan — find SharedJSContext, inject shim
├── ws-router.ts      route plugin RPC calls to plugin backends
└── plugin-loader.ts  load and call compiled plugin backends
```

### Directory structure

```
/backend      CDP target discovery, WebSocket server, plugin loader
/frontend     Vite dev server, React shims injected into Steam's UI
/shared       Types and utilities shared across backend, frontend, scripts
/plugins      One subdirectory per plugin (frontend.tsx + backend.ts)
/scripts      Dev utilities: launch Steam, generate certs, debug CLI
/installers   Platform-specific installer scripts (macOS pkg, Linux deb/rpm, Windows NSIS)
/certs        Generated TLS certificates (created by npm run setup)
```

### Prerequisites

- **Node.js 24 LTS** (required — earlier versions are not supported)
- **mkcert** — for trusted local HTTPS certificates

  ```bash
  # macOS
  brew install mkcert

  # Linux (Debian/Ubuntu/Pop!_OS/Mint)
  sudo apt install -y libnss3-tools mkcert

  # Linux (Fedora)
  sudo dnf install -y nss-tools mkcert

  # Linux (Arch)
  sudo pacman -S --noconfirm mkcert nss

  # Windows
  choco install mkcert
  ```

### Setup

```bash
npm install
npm run check        # verify prerequisites (node, mkcert, libnss3-tools)
npm run setup        # generate and trust local HTTPS/WSS certificates
```

For remote development (Condenser running on your PC, Steam on a Steam Deck):

```bash
npm run setup:remote
```

### Development workflow

The easiest way to start everything is one of the combined scripts, which launch the dev server and Steam together, track PIDs, and tear down both on Ctrl+C:

```bash
npm run dev:game             # server + Steam Big Picture
npm run dev:desktop          # server + Steam desktop mode
npm run dev:game:remote      # server on network IP + Steam BPM (for Deck)
npm run dev:desktop:remote   # server on network IP + Steam desktop
```

Or run the pieces separately if you prefer:

```bash
npm run dev          # start Vite + backend with hot reload (local mode)
npm run dev:remote   # same, but binds to network IP for Steam Deck access
```

```bash
npm run app          # launch Steam in Big Picture / game mode
npm run app:desktop  # launch Steam in desktop mode
npm run app:browser  # launch a plain browser for UI testing
npm run dev:tools    # inject React DevTools into Steam
```

### Steam Deck setup

1. **Enable developer mode**: Settings → System → Developer → Enable Developer Mode + CEF Remote Debugging
2. **Enable SSH** (from Deck Desktop Mode / Konsole):
   ```bash
   passwd           # set a password for the deck user
   sudo systemctl enable --now sshd
   ```
3. On your PC, run `npm run setup:remote` then `npm run dev:remote`
4. Launch Steam on the Deck — Condenser connects automatically

### Build and release

```bash
npm run build          # frontend + plugins + backend
npm run build:binaries # package self-contained binaries for all platforms via Node SEA
npm run build:installer # build platform installer from pre-built binaries
npm run build:release  # build:binaries + build:installer in one step
```

Binaries are built by GitHub Actions and published automatically to GitHub Releases on each tagged commit.

### Writing a plugin

A plugin is two files in `/plugins/<your-plugin-name>/`:

```
plugins/
  my-plugin/
    frontend.tsx   ← React UI injected into Steam
    backend.ts     ← Node.js handlers called by the frontend
```

#### Backend (`backend.ts`)

Export async functions. Each function becomes a callable RPC endpoint.

```typescript
// plugins/my-plugin/backend.ts
import os from 'os';

export async function getInfo() {
  return { platform: os.platform(), uptime: os.uptime() };
}
```

#### Plugin surfaces

Condenser uses **presence-based detection**: whichever surfaces your `frontend.tsx` exports are automatically activated. There is no `target` discriminator — just export the components you need.

| Export | Surface | When rendered |
|--------|---------|---------------|
| `Tab` + `Panel` | Quick Access Menu | When the player opens the ☰ menu |
| `route` + `Page` | Big Picture page | When the player navigates to your route |
| `Persistent` | Always-on overlay | Rendered on every Big Picture page |

A single plugin can export any combination of surfaces.

#### Plugin API (`window.condenser`)

Condenser injects a `condenser` global into Steam's browser context before any plugin loads. Plugins access the API by destructuring from it — no imports required.

```typescript
const { navigate, back } = condenser.nav;
const { showToast, showModal, Focusable } = condenser.ui;
const { createStyleToggle } = condenser.css;
```

#### Quick Access Menu (`Tab` + `Panel`)

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';

export const key   = 'my-plugin';
export const title = 'My Plugin';

export const Tab = () => React.createElement('span', null, '⚡');

export function Panel() {
  const send = condenser.plugin.useSend('my-plugin');
  const [info, setInfo] = useState<{ platform: string } | null>(null);

  useEffect(() => {
    send('getInfo').then((r: any) => setInfo(r));
  }, []);

  return React.createElement('div', { style: { padding: 16 } },
    info ? `Platform: ${info.platform}` : 'Loading…',
  );
}
```

#### Big Picture / SteamOS page (`route` + `Page`)

Export `route` and a `Page` component. Use `condenser.nav` to open the page and navigate back.

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React from 'react';

export const route = '/my-plugin/home';

export function Page() {
  return React.createElement('div', { style: { padding: 24, color: 'white' } },
    React.createElement('button', { onClick: condenser.nav.back }, '← Back'),
    React.createElement('h1', null, 'My Plugin'),
  );
}
```

To navigate to the page from a Panel:

```typescript
condenser.nav.navigate('/my-plugin/home');
```

#### Always-on overlay (`Persistent`)

A `Persistent` component renders on every Big Picture page, outside any route guard. Useful for HUD elements, notifications, or indicators.

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React from 'react';

export function Persistent() {
  return React.createElement('div', {
    style: {
      position: 'fixed', top: 60, right: 32,
      background: 'rgba(0,0,0,0.6)', color: 'white',
      fontSize: 12, padding: '2px 8px', borderRadius: 4,
      pointerEvents: 'none', zIndex: 9999,
    },
  }, 'My Plugin active');
}
```

#### Lifecycle hooks

Export `onMount` and `onUnmount` alongside your surfaces. Condenser calls them automatically — `onUnmount` is guaranteed to run before any disable or hot-reload.

```typescript
export function onMount(): void {
  // plugin enabled or first load — start timers, subscribe to events, etc.
}

export function onUnmount(): void {
  // plugin disabled or hot-reloaded — clean up CSS, patches, timers
}
```

#### CSS injection

Use `condenser.css` to inject styles into Steam windows. Styles are always defined as JavaScript objects — never raw CSS strings.

Two source formats are accepted:

- **`StyleProperties`** — flat camelCase property bag applied to the target element itself  
  `{ borderRadius: '10px', color: 'white' }`
- **`StyleSheet`** — map of CSS selector → property bag; when a section target is used, selectors are automatically scoped to that section's root element  
  `{ '.Panel': { borderRadius: '10px' }, '.Header': { color: 'white' } }`

##### Targets

The `Target` constant lists every injectable location. Pass it as the third argument to `inject`, `createStyleToggle`, and `createStyleVars`.

**Window targets** — inject globally into a whole CEF popup window:

| Target | Window |
|--------|--------|
| `Target.BigPicture` | Main BPM window |
| `Target.MainMenu` | Steam button overlay (home/STEAM button) |
| `Target.QuickAccess` | Quick Access Menu (controller right button) |
| `Target.Keyboard` | On-screen keyboard popup |
| `Target.OverlayBrowser` | In-game overlay browser (game must be running) |
| `Target.Global` | BigPicture + MainMenu + QuickAccess simultaneously |

**Section targets** — styles are auto-scoped to that section's root element. These use `[class*="module_ClassName_"]` selectors that are only reliable on SteamOS/Steam Deck; class names are obfuscated on desktop Steam:

`Target.Background`, `Target.Downloads`, `Target.Friends`, `Target.Home`, `Target.Library`, `Target.LockScreen`, `Target.Media`, `Target.Settings`, `Target.Store`

**Custom scope** — pass a `CSSTargetSpec` to target any selector, including stable IDs and `aria-label` attributes that work on all platforms:

```typescript
const { inject, Target } = condenser.css;

// Stable selectors — work on desktop Steam and SteamOS alike:
inject(key, { outline: '3px solid red' }, { window: Target.BigPicture, scope: '#header' });
inject(key, { outline: '3px solid blue' }, { window: Target.BigPicture, scope: '#Main' });
inject(key, { filter: 'sepia(0.6)' }, { window: Target.BigPicture, scope: '[aria-label="Recent Games"]' });
```

##### createStyleToggle

The recommended pattern for styles that need to be enabled and disabled at runtime. The toggle object is safe to create outside React — its state survives hot-reload as long as you call `disable()` in `onUnmount`.

```typescript
const { createStyleToggle, Target } = condenser.css;

const headerStyle = createStyleToggle(
  'my-plugin',
  { outline: '3px solid #ff6b6b', outlineOffset: '-3px' },
  { window: Target.BigPicture, scope: '#header' },
);

headerStyle.enable();
headerStyle.disable();
console.log(headerStyle.enabled); // boolean

export function onUnmount() {
  headerStyle.disable();
}
```

StyleSheet syntax for scoped multi-selector rules:

```typescript
const settingsStyle = createStyleToggle(
  'my-plugin',
  {
    '> *':     { outline: '1px dashed rgba(255,100,100,0.8)' },
    '> * > *': { backgroundColor: 'rgba(255,100,100,0.05)' },
  },
  Target.Settings, // SteamOS only
);
```

##### inject

One-shot injection — returns a cleanup function to remove the style later.

```typescript
const { inject, Target } = condenser.css;

// Whole BPM window — font applied globally:
const remove = inject('my-plugin', { fontFamily: 'Inter, sans-serif' }, Target.Global);

// Section-scoped (SteamOS only):
const remove2 = inject('my-plugin', { filter: 'sepia(0.6)' }, Target.Library);

// Custom scope — stable cross-platform selector:
const remove3 = inject('my-plugin',
  { outline: '3px solid #4fc3f7', outlineOffset: '-3px' },
  { window: Target.BigPicture, scope: '#Main' },
);

// Later: remove(); remove2(); remove3();
```

##### createStyleVars

Injects CSS custom properties that can be updated live without removing and re-injecting the style block.

```typescript
const { createStyleVars, Target } = condenser.css;

const vars = createStyleVars('my-plugin', {
  '--accent': '#4fc3f7',
  '--radius': '10px',
}, Target.BigPicture);

vars.update({ '--accent': '#ff6b6b', '--radius': '4px' }); // live update
vars.remove(); // cleanup
```

Injected `<style>` elements are tagged with `data-condenser-plugin="my-plugin"` for DevTools identification.

#### Navigation API

| Method | Description |
|--------|-------------|
| `condenser.nav.navigate(path)` | Open a Big Picture page by route |
| `condenser.nav.back()` | Close the current Big Picture page |
| `condenser.nav.openQAM()` | Open the Quick Access Menu |
| `condenser.nav.openSideMenu()` | Open the Steam side menu |
| `condenser.nav.closeSideMenus()` | Close all side menus |

#### Plugin hooks

| Method | Description |
|--------|-------------|
| `condenser.plugin.useSend(pluginId)` | Returns a `send(action, data?)` function that calls your backend |
| `condenser.plugin.useMessage(pluginId, event, handler)` | Subscribe to server-push events from your backend |

#### UI API

| Method | Description |
|--------|-------------|
| `condenser.ui.showToast({ title, body?, duration?, sound?, playSound?, critical? })` | Show a native Steam toast notification |
| `condenser.ui.showModal(content, parent?, { strTitle? })` | Show a modal dialog |
| `condenser.ui.showContextMenu(children, parent?)` | Open a Steam-native context menu |
| `condenser.ui.Focusable` | Enables gamepad d-pad navigation between child elements |
| `condenser.ui.SidebarNavigation` | Collapsible left-hand nav across sub-pages |
| `condenser.ui.Menu` | Container for context menu items |
| `condenser.ui.MenuItem` | Individual item inside a `Menu` |

#### Toast notifications

```typescript
// Minimal — title only
condenser.ui.showToast({ title: 'My Plugin' });

// With body and custom duration
condenser.ui.showToast({ title: 'Download complete', body: 'my-mod-v1.2.zip', duration: 4000 });

// Silent
condenser.ui.showToast({ title: 'Background sync', playSound: false });
```

Toasts appear using Steam's native `ValveToastRenderer` and `NotificationStore`, so they render over the QAM, play Steam's notification sound, and animate with the same timing as system notifications.

---

## Contact

For issues or questions, open a [GitHub Issue](../../issues).
