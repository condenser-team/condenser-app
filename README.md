# Condenser (prototype)

> Turns Steam 💨 into liquid 💧

Condenser allows you to customize Steam Big Picture Mode and SteamOS using plugins, on any platform (Windows, macOS, Linux, Steam Deck).

![Condenser](/condenser-screenshot.jpg)

---

## User Guide

### What Condenser does

- Adds a **Condenser tab** to Steam's Quick Access Menu (the ☰ button in-game and in Big Picture Mode)
- Lets plugins add pages to **Big Picture Mode and SteamOS** interfaces
- Plugins can show information, controls, or anything else a web page can render
- Works on **Windows, macOS, Linux desktop, and Steam Deck**

### Download and install

Download the correct installer for your system from the [GitHub Releases](../../releases) page.

The installer starts the Condenser service automatically. Open Steam in development mode  and press the **☰** button to see the Condenser tab.

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
        ├── qam.ts        patch Quick Access Menu — add tabs and panels
        ├── bigpicture.ts portal overlay for Big Picture / SteamOS pages
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

  # Linux
  apt install libnss3-tools && curl -Lo mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v*-linux-amd64 && chmod +x mkcert && sudo mv mkcert /usr/local/bin/

  # Windows
  choco install mkcert
  ```

### Setup

```bash
npm install
npm run setup        # generate and trust local HTTPS/WSS certificates
```

For remote development (Condenser running on your PC, Steam on a Steam Deck):

```bash
npm run setup:remote
```

### Development workflow

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

#### Quick Access Menu plugin (`frontend.tsx`)

Export `target`, `title`, an icon `Tab` component, and a `Panel` component.

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { useSend } from 'condenser:api';

export const target = 'quick-access-menu';
export const title  = 'My Plugin';

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

#### Big Picture / SteamOS page plugin (`frontend.tsx`)

Export `target`, `route`, and a `Page` component. Use `navigate` to open the page and `back` to close it.

```typescript
// plugins/my-plugin/frontend.tsx
/// <reference lib="dom" />
import React from 'react';
import { back } from 'condenser:api';

export const target = 'big-picture';
export const route  = '/my-plugin/home';

export function Page() {
  return React.createElement('div', { style: { padding: 24, color: 'white' } },
    React.createElement('button', { onClick: back }, '← Back'),
    React.createElement('h1', null, 'My Plugin'),
  );
}
```

To navigate to the page from a QAM panel:

```typescript
import { navigate } from 'condenser:api';
navigate('/my-plugin/home');
```

#### Plugin API (`condenser:api`)

| Export | Description |
|--------|-------------|
| `useSend(pluginId)` | Returns a `send(action, data?)` function that calls your backend |
| `useMessage(pluginId, event, handler)` | Subscribe to server-push events from your backend |
| `navigate(path)` | Open a Big Picture page by route |
| `back()` | Close the current Big Picture page |

---

## Contact

For issues or questions, open a [GitHub Issue](../../issues).
