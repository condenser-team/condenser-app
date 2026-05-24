/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { useSend, navigate, back } from 'condenser:api';

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
    send('getCount').then((result: any) => setCount(result.count));
  }, []);

  const handleClick = async () => {
    const result = await send('click') as { count: number };
    setCount(result.count);
  };

  const handleNavigate = () => navigate('/condenser/system');

  return React.createElement(
    'div',
    { style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } },
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', onClick: handleClick },
      count > 0 ? `Send Request (${count})` : 'Send Request',
    ),
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', onClick: handleNavigate },
      'Open Page',
    ),
  );
}

// BPM surface
export const route = '/condenser/system';

export function Page(_: { websocketUrl: string }) {
  const send = useSend('condenser-system');
  const [info, setInfo] = useState<{ platform: string; uptime: number; memory: number } | null>(null);

  useEffect(() => {
    console.info('[condenser-system] Page mounted');
    send('getInfo')
      .then((result: any) => setInfo(result))
      .catch((err: any) => console.error('[condenser-system] getInfo failed:', err));
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return React.createElement(
    'div',
    { style: { padding: '24px', color: 'white', fontFamily: 'sans-serif' } },
    React.createElement('h2', { style: { marginBottom: '16px' } }, 'Page component'),
    info
      ? React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          React.createElement('p', null, `Platform: ${info.platform}`),
          React.createElement('p', null, `Uptime: ${fmt(info.uptime)}`),
          React.createElement('p', null, `Free memory: ${Math.round(info.memory / 1024 / 1024)} MB`),
        )
      : React.createElement('p', null, 'Loading…'),
    React.createElement(
      'button',
      { className: 'DialogButton _DialogLayout Secondary', style: { marginBottom: '16px' }, onClick: back },
      '← Back',
    ),
  );
}

// Persistent surface — always rendered, regardless of active page
export function Persistent(_: { websocketUrl: string }) {
  return React.createElement(
    'div',
    {
      id: 'condenser-global-indicator',
      style: {
        position: 'fixed',
        top: '60px',
        right: '32px',
        background: 'rgba(0,0,0,0.6)',
        color: '#4fc3f7',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: 9999,
      },
    },
    'Global component',
  );
}
