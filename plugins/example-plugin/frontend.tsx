/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import {
  useSend, navigate, back,
  showModal, showContextMenu, showToast,
  Focusable,
  Menu, MenuItem,
} from 'condenser:api';

export const key   = 'example-plugin';
export const title = 'Example Plugin';

// BPM surface
export const route = '/example-plugin/home';

export function Page(_: { websocketUrl: string }) {
  const send = useSend('example-plugin');
  const [count, setCount] = useState(0);
  const [info, setInfo] = useState<{ platform: string; uptime: number; memory: number } | null>(null);

  useEffect(() => {
    send('getCount').then((r: any) => setCount(r.count));
    send('getInfo').then((r: any) => setInfo(r)).catch(() => {});
  }, []);

  const handleClick = async () => {
    const r = await send('click') as { count: number };
    setCount(r.count);
  };

  const handleToast = () => showToast({
    title: 'Example Plugin',
    body: 'showToast() called from condenser:api.',
    duration: 4000,
  });

  const handleModal = () => showModal(
    React.createElement('p', null, 'Opened via showModal() from condenser:api.'),
    undefined,
    { strTitle: 'Modal component' },
  );

  const handleContextMenu = (e: any) => {
    e.preventDefault();
    showContextMenu(
      React.createElement(Menu, { label: 'Example Plugin' },
        React.createElement(MenuItem, { onClick: handleModal }, 'Show Modal'),
        React.createElement(MenuItem, { onClick: handleToast }, 'Show Toast'),
      ),
      e.currentTarget,
    );
  };

  const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', color: 'white' } },
    React.createElement('button', {
      className: 'DialogButton _DialogLayout Secondary',
      style: { margin: '8px 16px', alignSelf: 'flex-start' },
      onClick: back,
    }, '← Back'),
    React.createElement(Focusable, {
      'flow-children': 'column',
      style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px' },
    },
      React.createElement('button', {
        className: 'DialogButton _DialogLayout Secondary',
        onClick: handleClick,
        onContextMenu: handleContextMenu,
      }, count > 0 ? `Send Request (${count})` : 'Send Request'),
      React.createElement('button', { className: 'DialogButton _DialogLayout Secondary', onClick: handleModal },
        'Show Modal',
      ),
      React.createElement('button', { className: 'DialogButton _DialogLayout Secondary', onClick: handleToast },
        'Show Toast',
      ),
      info ? React.createElement('div', { style: { fontSize: 12, opacity: 0.6, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 } },
        React.createElement('span', null, `Platform: ${info.platform}`),
        React.createElement('span', null, `Uptime: ${fmt(info.uptime)}`),
        React.createElement('span', null, `Free memory: ${Math.round(info.memory / 1024 / 1024)} MB`),
      ) : null,
    ),
  );
}

// Persistent surface — always-visible button that opens the example plugin page.
export function Persistent(_: { websocketUrl: string }) {
  return React.createElement('button', {
    id: 'example-plugin-indicator',
    onClick: () => navigate('/example-plugin/home'),
    title: 'Open Example Plugin',
    style: {
      position: 'fixed',
      top: '60px',
      right: '32px',
      background: 'rgba(0,0,0,0.7)',
      color: '#4fc3f7',
      fontSize: '11px',
      fontWeight: 'bold',
      padding: '4px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(79,195,247,0.4)',
      cursor: 'pointer',
      zIndex: 9999,
      letterSpacing: '0.5px',
    },
  }, 'Example Plugin');
}
