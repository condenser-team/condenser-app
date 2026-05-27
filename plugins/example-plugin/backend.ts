import os from 'os';

let clickCount = 0;

export async function getCount() {
  return { count: clickCount };
}

export async function click() {
  return { count: ++clickCount };
}

export async function getInfo() {
  return {
    platform: os.platform(),
    uptime: os.uptime(),
    memory: os.freemem(),
  };
}
