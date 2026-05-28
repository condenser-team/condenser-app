/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { useSend, Focusable } from 'condenser:api';

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

// Spread onto Focusable to enable column d-pad navigation (hyphen can't be a bare JSX prop).
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
  disabled?: boolean;
  onDetail: () => void;
}

function PluginRow({ plugin, installed, disabled, onDetail }: PluginRowProps) {
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
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, flexShrink: 0 }}>v{plugin.softwareVersion}</span>
          {disabled && <Badge label="Disabled" color="#555" />}
          {installed && !disabled && <Badge label="Installed" color="#2e7d32" />}
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

  return (
    <Focusable {...flowCol} style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 }}>
      <button className="DialogButton _DialogLayout Secondary Focusable" style={{ width: 'auto', fontSize: 12 }} onClick={onBack}>
        ← Back
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{plugin.name}</span>
        <span style={{ color: 'var(--gpSystemLighterGrey)', fontSize: 11 }}>
          v{plugin.softwareVersion} · {plugin.author.name} · {plugin.datePublished}
        </span>
      </div>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 1.5 }}>
        {plugin.description}
      </p>
      {plugin.releaseNotes && (
        <p style={{ margin: 0, color: 'var(--gpSystemLighterGrey)', fontSize: 11 }}>{plugin.releaseNotes}</p>
      )}
      {message && <p style={{ margin: 0, fontSize: 11, color: '#aef' }}>{message}</p>}
      <div style={{ display: 'flex', gap: 6 }}>
        {installed ? (
          <>
            <button className="DialogButton _DialogLayout Secondary" style={{ fontSize: 12 }} disabled={busy} onClick={handleToggleDisabled}>
              {isDisabled ? 'Enable' : 'Disable'}
            </button>
            <button className="DialogButton _DialogLayout Secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => doAction('uninstallPlugin')}>
              Uninstall
            </button>
          </>
        ) : (
          <button className="DialogButton _DialogLayout Primary" style={{ fontSize: 12 }} disabled={busy} onClick={() => doAction('installPlugin')}>
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
  return { registry, installed, installedIds, systemInfo, loading };
}

// ---- Panel ----

export function Panel() {
  const send = useSend('condenser-manager');
  const { registry, installed, installedIds, systemInfo, loading } = useRegistryData(send);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'installed'>('all');

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
      return (
        <PluginDetail
          plugin={plugin}
          installed={installedIds.has(selectedId)}
          isDisabled={disabledIds.has(selectedId)}
          send={send}
          onBack={() => setSelectedId(null)}
          onToggleDisabled={() => toggleDisabled(selectedId)}
        />
      );
    }
  }

  // Build unified list: registry plugins + locally installed plugins not in registry
  const registryIds = new Set(registry.map((p) => p.identifier));
  const localOnly = installed.filter((i) => !registryIds.has(i.id)).map((i) => localPlugin(i.id));
  const allPlugins = [...registry, ...localOnly];

  // Auto-filter: hide plugins incompatible with current OS/arch (local-only plugins always shown)
  const compatible = allPlugins.filter(
    (p) => p.distribution.length === 0 || !systemInfo || isCompatible(p, systemInfo),
  );
  const hiddenCount = allPlugins.length - compatible.length;

  const activeFilterCount = filterStatus !== 'all' ? 1 : 0;

  const filtered = compatible
    .filter((p) => filterStatus === 'all' || installedIds.has(p.identifier))
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
              key={p.identifier}
              plugin={p}
              installed={installedIds.has(p.identifier)}
              disabled={disabledIds.has(p.identifier)}
              onDetail={() => setSelectedId(p.identifier)}
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
