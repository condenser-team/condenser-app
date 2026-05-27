import os from 'os';
import path from 'path';
import fs from 'fs';

const IS_PROD = process.env.NODE_ENV === 'production';
const pluginsDir = IS_PROD
  ? path.join(process.cwd(), 'dist', 'plugins')
  : path.join(process.cwd(), 'plugins');

// ---- Registry schema ----

export interface RegistrySystem {
  type: 'linux' | 'windows' | 'macos';
  variant?: string;
  versionMin?: string;
}

export interface RegistryDistribution {
  '@type': 'DataDownload';
  contentUrl: string;
  encodingFormat: string;
  license?: string;
  systems: RegistrySystem[];
  architectures: string[];
  steamVersionMin?: number;
}

export interface RegistryPlugin {
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

// ---- Mock registry (replace with real fetch once the API is live) ----

const MOCK_REGISTRY: RegistryPlugin[] = [
  {
    '@type': 'SoftwareApplication',
    '@id': 'https://registry.condenser.app/plugins/condenser-system',
    identifier: 'example-plugin',
    name: 'Example Plugin',
    description:
      'Demo plugin demonstrating all Condenser surfaces: Tab, Panel, Page, Persistent, Toast, Modal, and Context Menu.',
    author: { '@type': 'Person', name: 'Kim Turley', url: 'https://github.com/kmturley' },
    thumbnailUrl: '',
    softwareVersion: '1.0.0',
    datePublished: '2026-01-01',
    releaseNotes: 'Initial release — demonstrates all Condenser plugin surfaces.',
    distribution: [
      {
        '@type': 'DataDownload',
        contentUrl:
          'https://github.com/kmturley/example-plugin/releases/download/v1.0.0/example-plugin-1.0.0.zip',
        encodingFormat: 'application/zip',
        license: 'https://spdx.org/licenses/MIT.html',
        systems: [
          { type: 'linux' },
          { type: 'linux', variant: 'steamos', versionMin: '3.0' },
          { type: 'macos' },
          { type: 'windows' },
        ],
        architectures: ['x64', 'arm64'],
      },
    ],
  },
];

// ---- Exported RPC actions ----

export async function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
  };
}

export async function getRegistry(): Promise<RegistryPlugin[]> {
  return MOCK_REGISTRY;
}

export async function getInstalledPlugins(): Promise<Array<{ id: string; disabled: boolean }>> {
  if (!fs.existsSync(pluginsDir)) return [];
  return fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d: fs.Dirent) => d.isDirectory() && d.name !== 'condenser-manager')
    .map((d: fs.Dirent) => ({ id: d.name, disabled: false }));
}

export async function installPlugin(_data: { id: string }) {
  return { success: false, message: 'Install not yet implemented' };
}

export async function uninstallPlugin(_data: { id: string }) {
  return { success: false, message: 'Uninstall not yet implemented' };
}

export async function enablePlugin(_data: { id: string }) {
  return { success: false, message: 'Enable not yet implemented' };
}

export async function disablePlugin(_data: { id: string }) {
  return { success: false, message: 'Disable not yet implemented' };
}
