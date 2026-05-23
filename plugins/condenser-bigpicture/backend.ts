import os from 'os';

export async function getInfo() {
  console.info('Received request for system info');
  return {
    platform: os.platform(),
    uptime: os.uptime(),
    memory: os.freemem(),
  };
}
