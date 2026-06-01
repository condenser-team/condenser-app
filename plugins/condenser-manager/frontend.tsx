/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { useSend, Focusable } from 'condenser:api';
import type { RegistryPlugin, PluginVersion, MediaObject } from './backend.js';

export const key   = 'condenser-manager';
export const title = 'Condenser';

// ---- Local types ----

interface InstalledPlugin { id: string; dev?: boolean; }
interface SystemInfo { platform: string; arch: string; }

// ---- Helpers ----

function pluginSlug(atId: string): string {
  try { return new URL(atId).pathname.split('/').filter(Boolean).at(-1) ?? atId; }
  catch { return atId; }
}

function platformToOs(platform: string): string {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

function nodeArchToRegistry(arch: string): string {
  if (arch === 'x64') return 'x86_64';
  if (arch === 'ia32') return 'x86';
  return arch;
}

function isCompatible(plugin: RegistryPlugin, sys: SystemInfo): boolean {
  const media = plugin.latestVersion?.associatedMedia ?? [];
  if (media.length === 0) return true;
  const sysOs = platformToOs(sys.platform);
  const sysArch = nodeArchToRegistry(sys.arch);
  return media.some(
    (m: MediaObject) =>
      (m.operatingSystem == null || m.operatingSystem.includes(sysOs)) &&
      (m.processorRequirements == null || m.processorRequirements.includes(sysArch)),
  );
}

function localPlugin(id: string): RegistryPlugin {
  return {
    '@type': 'SoftwareApplication',
    '@id': id,
    name: id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: 'Locally installed plugin (not in registry).',
    applicationCategory: 'utilities',
    author: { '@id': '', '@type': 'Organization', name: '—' },
    url: '',
  };
}

function pluginVersion(plugin: RegistryPlugin): string {
  return plugin.latestVersion?.version ?? '—';
}

// Spread onto Focusable to enable column d-pad navigation.
const flowCol = { 'flow-children': 'column' } as const;

const filterOptionBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 'auto', fontSize: 12, opacity: active ? 1 : 0.5, padding: '0 15px',
});

// ---- Tab ----

export const Tab = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24" width={24} height={24} fill="currentColor">
    <path d="M9.6696 0.29267C9.3285 -0.0975568 8.6715 -0.0975568 8.32995 0.29267C7.47765 1.26801 0 9.95829 0 14.7639C0 19.8567 4.0374 24 9 24C13.9626 24 18 19.8567 18 14.7639C18 9.95829 10.5223 1.26801 9.6696 0.29267ZM9 20.3055C6.02235 20.3055 3.6 17.8196 3.6 14.7639C3.6 14.254 4.0032 13.8402 4.5 13.8402C4.9968 13.8402 5.4 14.254 5.4 14.7639C5.4 16.8009 7.01505 18.4583 9 18.4583C9.4968 18.4583 9.9 18.8721 9.9 19.3819C9.9 19.8918 9.4968 20.3055 9 20.3055Z" />
  </svg>
);

// ---- Shared sub-components ----

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 10, fontWeight: 'bold', background: color, color: 'white',
      marginLeft: 2, flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

interface PluginRowProps {
  plugin: RegistryPlugin;
  installed: boolean;
  dev: boolean;
  onDetail: () => void;
}

function PluginRow({ plugin, installed, dev, onDetail }: PluginRowProps) {
  return (
    <Focusable
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
      }}
      onClick={onDetail}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{plugin.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, flexShrink: 0 }}>v{pluginVersion(plugin)}</span>
          {dev && <Badge label="DEV" color="#e65100" />}
          {installed && !dev && <Badge label="Installed" color="#2e7d32" />}
        </div>
        <span style={{
          color: 'var(--gpSystemLighterGrey)', fontSize: 11,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {plugin.description}
        </span>
      </div>
      <span style={{ flexShrink: 0, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>›</span>
    </Focusable>
  );
}

// ---- Plugin detail ----

interface PluginDetailProps {
  plugin: RegistryPlugin;
  installed: boolean;
  dev: boolean;
  send: ReturnType<typeof useSend>;
  onBack: () => void;
}

function PluginDetail({ plugin, installed, dev, send, onBack }: PluginDetailProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const slug = pluginSlug(plugin['@id']);
  const version = plugin.latestVersion;
  const downloadUrl = version?.associatedMedia[0]?.contentUrl;

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    try {
      const r = await send(action, { id: slug, ...extra }) as { success: boolean; message: string };
      setMessage(r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Focusable {...flowCol} style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 }}>
      <button className="DialogButton _DialogLayout Secondary Focusable" style={{ width: 'auto', fontSize: 12 }} onClick={onBack}>
        ← Back
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{plugin.name}</span>
        <span style={{ color: 'var(--gpSystemLighterGrey)', fontSize: 11 }}>
          {version ? `v${version.version} · ` : ''}{plugin.author.name} · {version?.datePublished ?? '—'}
        </span>
      </div>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.5 }}>
        {plugin.description}
      </p>
      {version?.releaseNotes && (
        <p style={{ margin: 0, color: 'var(--gpSystemLighterGrey)', fontSize: 11 }}>{version.releaseNotes}</p>
      )}
      {message && <p style={{ margin: 0, fontSize: 11, color: '#aef' }}>{message}</p>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {dev ? (
          <span style={{ fontSize: 11, color: '#ff9800' }}>Dev mode — running from local source</span>
        ) : installed ? (
          <button className="DialogButton _DialogLayout Secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => doAction('uninstallPlugin')}>
            Uninstall
          </button>
        ) : (
          <button
            className="DialogButton _DialogLayout Primary"
            style={{ fontSize: 12 }}
            disabled={busy || !downloadUrl}
            onClick={() => doAction('installPlugin', { contentUrl: downloadUrl })}
          >
            {busy ? 'Installing…' : 'Install'}
          </button>
        )}
      </div>
    </Focusable>
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
  const devIds = new Set(installed.filter((p) => p.dev).map((p) => p.id));
  return { registry, installed, installedIds, devIds, systemInfo, loading };
}

// ---- Panel ----

export function Panel() {
  const send = useSend('condenser-manager');
  const { registry, installed, installedIds, devIds, systemInfo, loading } = useRegistryData(send);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'installed'>('all');

  // Detail view
  if (selectedId) {
    const plugin =
      registry.find((p) => pluginSlug(p['@id']) === selectedId) ??
      (installedIds.has(selectedId) ? localPlugin(selectedId) : null);
    if (plugin) {
      return (
        <PluginDetail
          plugin={plugin}
          installed={installedIds.has(selectedId)}
          dev={devIds.has(selectedId)}
          send={send}
          onBack={() => setSelectedId(null)}
        />
      );
    }
  }

  // Unified list: registry plugins + locally installed plugins not in registry
  const registrySlugs = new Set(registry.map((p) => pluginSlug(p['@id'])));
  const localOnly = installed.filter((i) => !registrySlugs.has(i.id)).map((i) => localPlugin(i.id));
  const allPlugins = [...registry, ...localOnly];

  // Filter out plugins incompatible with current OS/arch (local-only plugins always shown)
  const compatible = allPlugins.filter(
    (p) => !p.latestVersion || !systemInfo || isCompatible(p, systemInfo),
  );
  const hiddenCount = allPlugins.length - compatible.length;
  const activeFilterCount = filterStatus !== 'all' ? 1 : 0;

  const filtered = compatible
    .filter((p) => filterStatus === 'all' || installedIds.has(pluginSlug(p['@id'])))
    .filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <Focusable {...flowCol} style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="DialogButton _DialogLayout Secondary Focusable"
          style={{ fontSize: 12, padding: '5px 15px', flexShrink: 0, width: 'auto' }}
          onClick={() => setShowFilters((v) => !v)}
        >
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
        </button>
        <div className="DialogInput_Wrapper _DialogLayout Panel" style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            className="DialogInput DialogInputPlaceholder DialogTextInputBase Focusable"
            size={1}
          />
        </div>
      </div>

      {showFilters && (
        <div style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: 6,
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--gpSystemLighterGrey)', fontSize: 11, minWidth: 44 }}>Status</span>
            <button className="DialogButton _DialogLayout Secondary Focusable" style={filterOptionBtnStyle(filterStatus === 'all')} onClick={() => setFilterStatus('all')}>All</button>
            <button className="DialogButton _DialogLayout Secondary Focusable" style={filterOptionBtnStyle(filterStatus === 'installed')} onClick={() => setFilterStatus('installed')}>Installed</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--gpSystemLighterGrey)', fontSize: 12 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--gpSystemLighterGrey)', fontSize: 12 }}>
          {filterStatus === 'installed' ? 'No plugins installed' : 'No plugins found'}
        </div>
      ) : (
        <Focusable {...flowCol} style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((p) => (
            <PluginRow
              key={p['@id']}
              plugin={p}
              installed={installedIds.has(pluginSlug(p['@id']))}
              dev={devIds.has(pluginSlug(p['@id']))}
              onDetail={() => setSelectedId(pluginSlug(p['@id']))}
            />
          ))}
          {hiddenCount > 0 && !search && (
            <div style={{ paddingTop: 8, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              {hiddenCount} incompatible plugin{hiddenCount !== 1 ? 's' : ''} hidden
            </div>
          )}
        </Focusable>
      )}
    </Focusable>
  );
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

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100000, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={closeModal}
    >
      <div
        style={{
          background: '#1a1d23', borderRadius: 8, padding: 24,
          minWidth: 320, maxWidth: 600,
          color: 'white', fontFamily: 'sans-serif',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        {modal.title && <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>{modal.title}</h3>}
        {modal.content}
        <button className="DialogButton _DialogLayout Primary Focusable" style={{ marginTop: 16, width: 'auto' }} onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
}
