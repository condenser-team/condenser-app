/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import {
  useSend,
  Focusable,
  Tabs,
} from 'condenser:api';

export const key   = 'condenser-manager';
export const title = 'Condenser';

// ---- Types (mirror backend schema) ----

interface RegistrySystem {
  type: 'linux' | 'windows' | 'macos';
  variant?: string;
  versionMin?: string;
}

interface RegistryDistribution {
  '@type': 'DataDownload';
  contentUrl: string;
  encodingFormat: string;
  license?: string;
  systems: RegistrySystem[];
  architectures: string[];
  steamVersionMin?: number;
}

interface RegistryPlugin {
  '@type': 'SoftwareApplication';
  '@id': string;
  identifier: string;
  name: string;
  description: string;
  author: { '@type': 'Person'; name: string; url?: string };
  thumbnailUrl?: string;
  softwareVersion: string;
  datePublished: string;
  releaseNotes?: string;
  distribution: RegistryDistribution[];
}

interface InstalledPlugin {
  id: string;
  disabled: boolean;
}

interface SystemInfo {
  platform: string;
  arch: string;
}

// ---- Helpers ----

function platformToSystemType(platform: string): 'linux' | 'windows' | 'macos' {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

function isCompatible(plugin: RegistryPlugin, sys: SystemInfo): boolean {
  const systemType = platformToSystemType(sys.platform);
  return plugin.distribution.some(
    (d) =>
      d.systems.some((s) => s.type === systemType) &&
      d.architectures.includes(sys.arch),
  );
}

function formatName(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function localPlugin(id: string): RegistryPlugin {
  return {
    '@type': 'SoftwareApplication',
    '@id': id,
    identifier: id,
    name: formatName(id),
    description: 'Locally installed plugin (not in registry).',
    author: { '@type': 'Person', name: '—' },
    softwareVersion: '—',
    datePublished: '—',
    distribution: [],
  };
}

// ---- Tab ----

export const Tab = () => React.createElement(
  'svg',
  { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 18 24', width: 24, height: 24, fill: 'currentColor' },
  React.createElement('path', {
    d: 'M9.6696 0.29267C9.3285 -0.0975568 8.6715 -0.0975568 8.32995 0.29267C7.47765 1.26801 0 9.95829 0 14.7639C0 19.8567 4.0374 24 9 24C13.9626 24 18 19.8567 18 14.7639C18 9.95829 10.5223 1.26801 9.6696 0.29267ZM9 20.3055C6.02235 20.3055 3.6 17.8196 3.6 14.7639C3.6 14.254 4.0032 13.8402 4.5 13.8402C4.9968 13.8402 5.4 14.254 5.4 14.7639C5.4 16.8009 7.01505 18.4583 9 18.4583C9.4968 18.4583 9.9 18.8721 9.9 19.3819C9.9 19.8918 9.4968 20.3055 9 20.3055Z',
  }),
);

// ---- Shared sub-components ----

function Badge({ label, color }: { label: string; color: string }) {
  return React.createElement('span', {
    style: {
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 10, fontWeight: 'bold', background: color, color: 'white',
      marginLeft: 4, flexShrink: 0,
    },
  }, label);
}

interface PluginRowProps {
  plugin: RegistryPlugin;
  installed: boolean;
  disabled?: boolean;
  incompatible?: boolean;
  onDetail: () => void;
}

function PluginRow({ plugin, installed, disabled, incompatible, onDetail }: PluginRowProps) {
  return React.createElement(
    Focusable,
    {
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
        opacity: incompatible ? 0.4 : 1,
        cursor: 'pointer',
      },
      onClick: onDetail,
    },
    React.createElement('div', {
      style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
    },
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 4,
          color: 'white', fontSize: 13, fontWeight: 600,
        },
      },
        React.createElement('span', {
          style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, plugin.name),
        disabled ? React.createElement(Badge, { label: 'Disabled', color: '#555' }) : null,
        installed && !disabled ? React.createElement(Badge, { label: 'Installed', color: '#2e7d32' }) : null,
        incompatible ? React.createElement(Badge, { label: 'Incompatible', color: '#7f4200' }) : null,
      ),
      React.createElement('span', { style: { color: 'rgba(255,255,255,0.5)', fontSize: 11 } },
        `v${plugin.softwareVersion} · ${plugin.author.name}`,
      ),
    ),
    React.createElement('span', {
      style: { flexShrink: 0, color: 'rgba(255,255,255,0.3)', fontSize: 14 },
    }, '›'),
  );
}

// ---- Plugin detail (shown inside the Panel) ----

interface PluginDetailProps {
  plugin: RegistryPlugin;
  installed: boolean;
  isDisabled: boolean;
  send: ReturnType<typeof useSend>;
  onBack: () => void;
  onToggleDisabled: () => void;
}

function PluginDetail({ plugin, installed, isDisabled, send, onBack, onToggleDisabled }: PluginDetailProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function doAction(action: string) {
    setBusy(true);
    setMessage('');
    try {
      const r = await send(action, { id: plugin.identifier }) as { success: boolean; message: string };
      setMessage(r.message);
    } finally {
      setBusy(false);
    }
  }

  function handleToggleDisabled() {
    onToggleDisabled();
    doAction(isDisabled ? 'enablePlugin' : 'disablePlugin');
  }

  return React.createElement(Focusable, {
    'flow-children': 'column',
    style: { display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 },
  },
    React.createElement('button', {
      style: {
        alignSelf: 'flex-start', padding: '3px 10px', fontSize: 11,
        background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 4, color: 'white', cursor: 'pointer',
      },
      onClick: onBack,
    }, '← Back'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
      React.createElement('span', { style: { color: 'white', fontSize: 14, fontWeight: 600 } }, plugin.name),
      React.createElement('span', { style: { color: 'rgba(255,255,255,0.5)', fontSize: 11 } },
        `v${plugin.softwareVersion} · ${plugin.author.name} · ${plugin.datePublished}`,
      ),
    ),
    React.createElement('p', { style: { margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.5 } },
      plugin.description,
    ),
    plugin.releaseNotes
      ? React.createElement('p', { style: { margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 11 } },
          plugin.releaseNotes,
        )
      : null,
    message
      ? React.createElement('p', { style: { margin: 0, fontSize: 11, color: '#aef' } }, message)
      : null,
    React.createElement('div', { style: { display: 'flex', gap: 6 } },
      installed
        ? React.createElement(React.Fragment, null,
            React.createElement('button', {
              className: 'DialogButton _DialogLayout Secondary',
              style: { fontSize: 12 },
              disabled: busy,
              onClick: handleToggleDisabled,
            }, isDisabled ? 'Enable' : 'Disable'),
            React.createElement('button', {
              className: 'DialogButton _DialogLayout Secondary',
              style: { fontSize: 12 },
              disabled: busy,
              onClick: () => doAction('uninstallPlugin'),
            }, 'Uninstall'),
          )
        : React.createElement('button', {
            className: 'DialogButton _DialogLayout Primary',
            style: { fontSize: 12 },
            disabled: busy,
            onClick: () => doAction('installPlugin'),
          }, busy ? 'Installing…' : 'Install'),
    ),
  );
}

// ---- Data fetching hook ----

function useRegistryData(send: ReturnType<typeof useSend>) {
  const [registry, setRegistry] = useState<RegistryPlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      send('getRegistry') as Promise<RegistryPlugin[]>,
      send('getInstalledPlugins') as Promise<InstalledPlugin[]>,
      send('getSystemInfo') as Promise<SystemInfo>,
    ]).then(([reg, inst, sys]) => {
      setRegistry(reg);
      setInstalled(inst);
      setSystemInfo(sys);
      setLoading(false);
    });
  }, []);

  const installedIds = new Set(installed.map((p) => p.id));
  return { registry, installed, installedIds, systemInfo, loading };
}

// ---- Panel ----

export function Panel() {
  const send = useSend('condenser-manager');
  const { registry, installed, installedIds, systemInfo, loading } = useRegistryData(send);
  const [view, setView] = useState<'installed' | 'registry'>('installed');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDisabledIds(new Set(installed.filter((p) => p.disabled).map((p) => p.id)));
  }, [installed]);

  function toggleDisabled(id: string) {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Detail view
  if (selectedId) {
    const plugin =
      registry.find((p) => p.identifier === selectedId) ??
      (installed.find((i) => i.id === selectedId) ? localPlugin(selectedId) : null);
    if (plugin) {
      return React.createElement(PluginDetail, {
        plugin,
        installed: installedIds.has(selectedId),
        isDisabled: disabledIds.has(selectedId),
        send,
        onBack: () => setSelectedId(null),
        onToggleDisabled: () => toggleDisabled(selectedId),
      });
    }
  }

  // Build display lists
  const displayInstalled = installed.map((inst) =>
    registry.find((p) => p.identifier === inst.id) ?? localPlugin(inst.id),
  );
  const displayRegistry = registry.filter((p) => !systemInfo || isCompatible(p, systemInfo));
  const incompatible = registry.filter((p) => systemInfo != null && !isCompatible(p, systemInfo));

  function buildTabContent(tabView: 'installed' | 'registry') {
    const list = tabView === 'installed' ? displayInstalled : displayRegistry;
    const filtered = list.filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()),
    );

    return React.createElement(
      Focusable,
      { 'flow-children': 'column', style: { display: 'flex', flexDirection: 'column', padding: '8px 16px', gap: 8 } },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search plugins…',
        value: search,
        onChange: (e: any) => setSearch(e.target.value),
        style: {
          width: '100%', padding: '6px 10px', borderRadius: 4, boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'white', fontSize: 12,
        },
      }),
      loading
        ? React.createElement('div', { style: { textAlign: 'center', padding: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12 } }, 'Loading…')
        : filtered.length === 0
          ? React.createElement('div', { style: { textAlign: 'center', padding: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12 } },
              tabView === 'installed' ? 'No plugins installed' : 'No compatible plugins found',
            )
          : React.createElement(Focusable, { 'flow-children': 'column', style: { display: 'flex', flexDirection: 'column' } },
              ...filtered.map((p) =>
                React.createElement(PluginRow, {
                  key: p.identifier,
                  plugin: p,
                  installed: installedIds.has(p.identifier),
                  disabled: disabledIds.has(p.identifier),
                  onDetail: () => setSelectedId(p.identifier),
                }),
              ),
              tabView === 'registry' && incompatible.length > 0 && !search
                ? React.createElement('div', { style: { paddingTop: 8, color: 'rgba(255,255,255,0.35)', fontSize: 11 } },
                    `${incompatible.length} incompatible plugin${incompatible.length !== 1 ? 's' : ''} hidden`,
                  )
                : null,
            ),
    );
  }

  return React.createElement(Tabs, {
    activeTab: view,
    onShowTab: (tabId: string) => { setView(tabId as 'installed' | 'registry'); setSearch(''); setSelectedId(null); },
    tabs: [
      { id: 'installed', title: 'Installed', content: buildTabContent('installed') },
      { id: 'registry', title: 'Registry', content: buildTabContent('registry') },
    ],
  });
}

// ---- Persistent — modal overlay, registered as the global showModal handler ----

export function Persistent(_: { websocketUrl: string }) {
  const [modal, setModal] = useState<{ content: any; title?: string } | null>(null);

  useEffect(() => {
    (window as any).__condenser.core.showModal = (content: any, title?: string) =>
      setModal({ content, title });
    return () => { (window as any).__condenser.core.showModal = undefined; };
  }, []);

  const closeModal = () => setModal(null);

  if (!modal) return null;

  return React.createElement('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100000, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: closeModal,
  },
    React.createElement('div', {
      style: {
        background: '#1a1d23', borderRadius: 8, padding: 24,
        minWidth: 320, maxWidth: 600,
        color: 'white', fontFamily: 'sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      },
      onClick: (e: any) => e.stopPropagation(),
    },
      modal.title
        ? React.createElement('h3', { style: { margin: '0 0 12px', fontSize: 18 } }, modal.title)
        : null,
      modal.content,
      React.createElement('button', {
        style: {
          marginTop: 16, padding: '8px 20px',
          background: '#4fc3f7', border: 'none', borderRadius: 4,
          cursor: 'pointer', color: '#000', fontWeight: 'bold',
        },
        onClick: closeModal,
      }, 'Close'),
    ),
  );
}
