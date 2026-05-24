/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import {
  useSend, navigate, back,
  openQAM,
  showModal, showContextMenu,
  Focusable, SidebarNavigation,
  Menu, MenuItem,
} from 'condenser:api';

export const key   = 'condenser-system';
export const title = 'Condenser';

// QAM surface
export const Tab = () => React.createElement(
  'svg',
  { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 18 24', width: 24, height: 24, fill: 'currentColor' },
  React.createElement('path', { d: 'M9.6696 0.29267C9.3285 -0.0975568 8.6715 -0.0975568 8.32995 0.29267C7.47765 1.26801 0 9.95829 0 14.7639C0 19.8567 4.0374 24 9 24C13.9626 24 18 19.8567 18 14.7639C18 9.95829 10.5223 1.26801 9.6696 0.29267ZM9 20.3055C6.02235 20.3055 3.6 17.8196 3.6 14.7639C3.6 14.254 4.0032 13.8402 4.5 13.8402C4.9968 13.8402 5.4 14.254 5.4 14.7639C5.4 16.8009 7.01505 18.4583 9 18.4583C9.4968 18.4583 9.9 18.8721 9.9 19.3819C9.9 19.8918 9.4968 20.3055 9 20.3055Z' }),
);

export function Panel() {
  const send = useSend('condenser-system');
  const [count, setCount] = useState(0);

  useEffect(() => {
    send('getCount').then((r: any) => setCount(r.count));
  }, []);

  const handleClick = async () => {
    const r = await send('click') as { count: number };
    setCount(r.count);
  };

  const handleModal = () => showModal(
    React.createElement('p', null, 'Opened via showModal() from condenser:api.'),
    undefined,
    { strTitle: 'Modal component' },
  );

  const handleContextMenu = (e: any) => {
    e.preventDefault();
    showContextMenu(
      React.createElement(Menu, { label: 'Condenser' },
        React.createElement(MenuItem, { onClick: () => navigate('/condenser/system') }, 'Open Page'),
        React.createElement(MenuItem, { onClick: openQAM }, 'Open QAM'),
        React.createElement(MenuItem, { onClick: handleModal }, 'Show Modal'),
      ),
      e.currentTarget,
    );
  };

  return React.createElement(
    // Focusable enables controller d-pad navigation between buttons
    Focusable,
    { 'flow-children': 'column', style: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' } },
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', onClick: handleClick },
      count > 0 ? `Send Request (${count})` : 'Send Request',
    ),
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', onClick: () => navigate('/condenser/system') },
      'Open Page',
    ),
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', onClick: handleModal, onContextMenu: handleContextMenu },
      'Show Modal',
    ),
  );
}

// BPM surface
export const route = '/condenser/system';

function SystemInfoContent({ send }: { send: (action: string, data?: unknown) => Promise<unknown> }) {
  const [info, setInfo] = useState<{ platform: string; uptime: number; memory: number } | null>(null);

  useEffect(() => {
    send('getInfo')
      .then((r: any) => setInfo(r))
      .catch((err: any) => console.error('[condenser-system] getInfo failed:', err));
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return React.createElement(
    'div',
    { style: { padding: '16px', color: 'white', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '8px' } },
    info
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement('p', null, `Platform: ${info.platform}`),
          React.createElement('p', null, `Uptime: ${fmt(info.uptime)}`),
          React.createElement('p', null, `Free memory: ${Math.round(info.memory / 1024 / 1024)} MB`),
        )
      : React.createElement('p', null, 'Loading…'),
  );
}

function AboutContent() {
  return React.createElement(
    'div',
    { style: { padding: '16px', color: 'white', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '8px' } },
    React.createElement('p', null, 'condenser-system'),
    React.createElement(
      'p',
      { style: { opacity: 0.7, fontSize: '13px' } },
      'Built-in Condenser plugin — demonstrates Tab, Panel, Page, and Persistent surfaces together with condenser:api features: SidebarNavigation, Focusable, showModal, showContextMenu, openQAM.',
    ),
  );
}

export function Page(_: { websocketUrl: string }) {
  const send = useSend('condenser-system');

  const pages = [
    { title: 'System', content: React.createElement(SystemInfoContent, { send }) },
    { title: 'About', content: React.createElement(AboutContent, null) },
  ];

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    React.createElement(
      'button',
      {
        className: 'DialogButton _DialogLayout Secondary',
        style: { margin: '8px 16px', alignSelf: 'flex-start' },
        onClick: back,
      },
      '← Back',
    ),
    // SidebarNavigation: collapsible left-hand nav across sub-pages
    React.createElement(SidebarNavigation, { title: 'Condenser', pages }),
  );
}

// Persistent surface — always rendered, regardless of active page.
// Owns the modal overlay state and registers condenser.core.showModal so any plugin
// can trigger a modal by calling showModal() from condenser:api.
export function Persistent(_: { websocketUrl: string }) {
  const [modal, setModal] = useState<{ content: any; title?: string } | null>(null);

  useEffect(() => {
    (window as any).__condenser.core.showModal = (content: any, title?: string) =>
      setModal({ content, title });
    return () => { (window as any).__condenser.core.showModal = undefined; };
  }, []);

  const closeModal = () => setModal(null);

  return React.createElement(
    React.Fragment,
    null,
    // Always-visible QAM opener button
    React.createElement(
      'button',
      {
        id: 'condenser-global-indicator',
        onClick: openQAM,
        title: 'Open Quick Access Menu',
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
      },
      '☰ QAM',
    ),
    // Modal overlay — rendered inside BPM's React tree so it's visible in-window
    modal ? React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        onClick: closeModal,
      },
      React.createElement(
        'div',
        {
          style: {
            background: '#1a1d23',
            borderRadius: '8px',
            padding: '24px',
            minWidth: '320px',
            maxWidth: '600px',
            color: 'white',
            fontFamily: 'sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          },
          onClick: (e: any) => e.stopPropagation(),
        },
        modal.title ? React.createElement(
          'h3',
          { style: { marginBottom: '12px', fontSize: '18px' } },
          modal.title,
        ) : null,
        modal.content,
        React.createElement(
          'button',
          {
            style: {
              marginTop: '16px',
              padding: '8px 20px',
              background: '#4fc3f7',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#000',
              fontWeight: 'bold',
            },
            onClick: closeModal,
          },
          'Close',
        ),
      ),
    ) : null,
  );
}
