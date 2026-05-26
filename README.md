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
    └── condenser shim (frontend/index.ts)
        ├── steam.ts      discover React, webpack registry, router
        ├── tab.ts        patch Quick Access Menu — add Tab and Panel surfaces
        ├── page.ts       inject Page routes into Big Picture / SteamOS router
        ├── persistent.ts inject Persistent components (always rendered)
        ├── fc.ts         FC trampoline — convert function components to patchable classes
        ├── toast.ts      native toast notifications via ValveToastRenderer + NotificationStore
        └── loader.ts     load plugin frontends, route WS calls to backend

Condenser server (Node.js / backend/)
├── server.ts       HTTPS + WebSocket server, serves frontend build
├── target.ts       CDP scan — find SharedJSContext, inject shim
├── ws-router.ts    route plugin RPC calls to plugin backends
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

- **Node.js 20+**
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
npm run build:binaries # package binaries for all platforms (requires pkg)
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

#### Quick Access Menu (`Tab` + `Panel`)

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { useSend } from 'condenser:api';

export const key   = 'my-plugin';
export const title = 'My Plugin';

export const Tab = () => React.createElement('span', null, '⚡');

export function Panel() {
  const send = useSend('my-plugin');
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

Export `route` and a `Page` component. Use `navigate` to open the page and `back` to close it.

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React from 'react';
import { back } from 'condenser:api';

export const route = '/my-plugin/home';

export function Page() {
  return React.createElement('div', { style: { padding: 24, color: 'white' } },
    React.createElement('button', { onClick: back }, '← Back'),
    React.createElement('h1', null, 'My Plugin'),
  );
}
```

To navigate to the page from a Panel:

```typescript
import { navigate } from 'condenser:api';
navigate('/my-plugin/home');
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

#### Plugin API (`condenser:api`)

**Hooks**

| Export | Description |
|--------|-------------|
| `useSend(pluginId)` | Returns a `send(action, data?)` function that calls your backend |
| `useMessage(pluginId, event, handler)` | Subscribe to server-push events from your backend |

**Navigation**

| Export | Description |
|--------|-------------|
| `navigate(path)` | Open a Big Picture page by route |
| `back()` | Close the current Big Picture page |
| `openQAM()` | Open the Quick Access Menu |
| `openSideMenu()` | Open the Steam side menu |
| `closeSideMenus()` | Close all side menus |

**Imperative UI**

| Export | Description |
|--------|-------------|
| `showToast({ title, body?, duration?, sound?, playSound?, critical? })` | Show a native Steam toast notification with sound, visible over the QAM |
| `showModal(content, parent?, { strTitle? })` | Show a modal dialog using Steam's modal system |
| `showContextMenu(children, parent?)` | Open a Steam-native context menu anchored to an element |

**Steam UI components**

| Export | Description |
|--------|-------------|
| `Focusable` | Enables gamepad d-pad navigation between child elements |
| `SidebarNavigation` | Collapsible left-hand nav across sub-pages (for use in BPM pages) |
| `Menu` | Container for context menu items |
| `MenuItem` | Individual item inside a `Menu` |

#### Toast notifications

```typescript
import { showToast } from 'condenser:api';

// Minimal — title only
showToast({ title: 'My Plugin' });

// With body and custom duration
showToast({ title: 'Download complete', body: 'my-mod-v1.2.zip', duration: 4000 });

// Silent
showToast({ title: 'Background sync', playSound: false });
```

Toasts appear using Steam's native `ValveToastRenderer` and `NotificationStore`, so they render over the QAM, play Steam's notification sound, and animate with the same timing as system notifications.

---

## Contact

For issues or questions, open a [GitHub Issue](../../issues).
