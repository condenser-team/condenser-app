/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { useSend, back } from 'condenser:api';

export const target = 'big-picture';
export const route  = '/condenser/system';

export function Page(_: { websocketUrl: string }) {
  const send = useSend('condenser-bigpicture');
  const [info, setInfo] = useState<{ platform: string; uptime: number; memory: number } | null>(null);

  useEffect(() => {
    console.info('[condenser-bigpicture] Page mounted');
    send('getInfo')
      .then((result: any) => setInfo(result))
      .catch((err: any) => console.error('[condenser-bigpicture] getInfo failed:', err));
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return React.createElement(
    'div',
    { style: { padding: '24px', color: 'white', fontFamily: 'sans-serif' } },
    React.createElement('h2', { style: { marginBottom: '16px' } }, 'System Info'),
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
