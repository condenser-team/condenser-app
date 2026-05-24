import os from 'os';

export async function getInfo() {
  return {
    platform: os.platform(),
    uptime: os.uptime(),
    memory: os.freemem(),
  };
}
