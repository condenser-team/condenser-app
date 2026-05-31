import os from 'os';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const REGISTRY_BASE = process.env.CONDENSER_REGISTRY_URL
  ?? 'https://condenser-team.github.io/condenser-registry';

const IS_PROD = process.env.NODE_ENV === 'production';
const userPluginsDir = path.join(os.homedir(), '.condenser', 'plugins');

// ---- Registry transport ----
// In dev, falls back to reading the sibling condenser-registry/out/ directory from disk.
// Set CONDENSER_REGISTRY_PATH to override, or CONDENSER_REGISTRY_URL for a remote registry.

function localRegistryPath(): string | null {
  if (process.env.CONDENSER_REGISTRY_PATH) return process.env.CONDENSER_REGISTRY_PATH;
  if (!IS_PROD) {
    const candidate = path.resolve(process.cwd(), '..', 'condenser-registry', 'out');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function registryFetch(relPath: string): Promise<any> {
  const localBase = localRegistryPath();
  if (localBase) {
    const filePath = path.join(localBase, relPath);
    if (!fs.existsSync(filePath)) throw new Error(`Registry file not found: ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const res = await fetch(`${REGISTRY_BASE}/${relPath}`);
  if (!res.ok) throw new Error(`Registry fetch failed: ${res.status} ${relPath}`);
  return res.json();
}

// ---- Types matching condenser-registry PluginOutputSchema / PluginVersionOutputSchema ----

export interface MediaObject {
  '@type': 'MediaObject';
  name: string;
  contentUrl: string;
  encodingFormat: string;
  license: string;
  sha256?: string;
  contentSize?: number;
  operatingSystem?: string[];
  processorRequirements?: string[];
}

export interface PluginVersion {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: string;
  version: string;
  datePublished: string;
  releaseNotes: string;
  isPartOf: { '@id': string; '@type': 'SoftwareApplication'; name?: string };
  associatedMedia: MediaObject[];
}

export interface RegistryPlugin {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: string;
  description: string;
  applicationCategory: string;
  keywords?: string[];
  author: { '@id': string; '@type': 'Organization'; name?: string };
  url: string;
  image?: string | null;
  // Hydrated from the latest version endpoint
  latestVersion?: PluginVersion;
}

// ---- Helpers ----

function pluginSlug(atId: string): string {
  try { return new URL(atId).pathname.split('/').filter(Boolean).at(-1) ?? atId; }
  catch { return atId; }
}

// ---- Registry fetching ----

async function fetchRegistry(): Promise<RegistryPlugin[]> {
  const collection = await registryFetch('plugins/index.json') as {
    itemListElement?: Array<{ item: { '@id': string } }>;
  };

  const refs = (collection.itemListElement ?? []).map((li) => li.item);

  const plugins = await Promise.all(refs.map(async (ref) => {
    try {
      const slug = pluginSlug(ref['@id']);
      const [pluginDoc, latestVersion] = await Promise.all([
        registryFetch(`plugins/${slug}/index.json`) as Promise<RegistryPlugin>,
        registryFetch(`plugins/${slug}/versions/latest/index.json`).catch(() => undefined) as Promise<PluginVersion | undefined>,
      ]);
      return { ...pluginDoc, latestVersion };
    } catch {
      return null;
    }
  }));

  return plugins.filter((p): p is RegistryPlugin => p !== null);
}

// ---- Install / uninstall ----

const ALLOWED_PLUGIN_FILES = ['frontend.js', 'backend.cjs'];

async function downloadZip(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractPluginZip(buffer: Buffer, destDir: string): void {
  const zip = new AdmZip(buffer);
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of zip.getEntries()) {
    const filename = path.basename(entry.entryName);
    // Only extract known plugin files — prevents zip-slip path traversal.
    if (!ALLOWED_PLUGIN_FILES.includes(filename)) continue;
    fs.writeFileSync(path.join(destDir, filename), entry.getData());
  }
}

// ---- Exported RPC actions ----

export async function getSystemInfo() {
  return { platform: os.platform(), arch: os.arch() };
}

export async function getRegistry(): Promise<RegistryPlugin[]> {
  return fetchRegistry();
}

export async function getInstalledPlugins(): Promise<Array<{ id: string }>> {
  if (!fs.existsSync(userPluginsDir)) return [];
  return fs
    .readdirSync(userPluginsDir, { withFileTypes: true })
    .filter((d: fs.Dirent) => d.isDirectory())
    .map((d: fs.Dirent) => ({ id: d.name }));
}

export async function installPlugin(data: { id: string; contentUrl: string }) {
  try {
    const { id, contentUrl } = data;
    if (!id || !contentUrl) return { success: false, message: 'Missing id or contentUrl' };
    const buffer = await downloadZip(contentUrl);
    extractPluginZip(buffer, path.join(userPluginsDir, id));
    return { success: true, message: 'Installed — restart Condenser to activate the plugin.' };
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Install failed' };
  }
}

export async function uninstallPlugin(data: { id: string }) {
  try {
    const { id } = data;
    if (!id) return { success: false, message: 'Missing id' };
    const destDir = path.join(userPluginsDir, id);
    if (!fs.existsSync(destDir)) return { success: false, message: 'Plugin not installed' };
    fs.rmSync(destDir, { recursive: true, force: true });
    return { success: true, message: 'Uninstalled — restart Condenser to complete removal.' };
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Uninstall failed' };
  }
}

export async function enablePlugin(_data: { id: string }) {
  return { success: false, message: 'Enable not yet implemented' };
}

export async function disablePlugin(_data: { id: string }) {
  return { success: false, message: 'Disable not yet implemented' };
}
