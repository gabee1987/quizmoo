// `pnpm dev:lan`: dev servers reachable from phones on the same network.
// Picks the laptop's LAN address, a free web port, points APP_ORIGIN (QR codes,
// join links) at it, and starts the API and Vite. Override with LAN_IP / WEB_PORT.
import { spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'

const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vmware|docker|bluetooth|loopback/i

function lanAddress() {
  if (process.env.LAN_IP) return process.env.LAN_IP
  const candidates = Object.entries(os.networkInterfaces())
    .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => a.address)
  // Home and office routers almost always hand out 192.168.x.x or 10.x.x.x.
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2)
  return candidates.sort((a, b) => rank(a) - rank(b))[0]
}

function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '0.0.0.0')
  })
}

async function freePort(start) {
  for (let port = start; port < start + 20; port++) if (await isFree(port)) return port
  throw new Error(`no free port between ${start} and ${start + 19}`)
}

const ip = lanAddress()
if (!ip) {
  console.error('No LAN address found. Connect to wifi or set LAN_IP, e.g. $env:LAN_IP="192.168.1.50".')
  process.exit(1)
}
const webPort = await freePort(Number(process.env.WEB_PORT ?? 15173))
const origin = `http://${ip}:${webPort}`

console.log(`
  Quizmoo on your local network
  Players (phones):  ${origin}
  Host login:        ${origin}/login
  Phones must be on the same wifi. If they cannot connect, allow Node.js
  through the Windows firewall for private networks.
`)

// APP_ORIGIN from here wins over .env: Node's --env-file never overrides existing variables.
const env = { ...process.env, APP_ORIGIN: origin }
// Fixed command strings (the port is a number we chose), so running them through the shell is safe.
const run = (command) => spawn(command, { stdio: 'inherit', shell: true, env })
const children = [
  run('pnpm --filter @quizmoo/server dev'),
  run(`pnpm --filter @quizmoo/web exec vite --host 0.0.0.0 --port ${webPort} --strictPort`),
]
for (const child of children) {
  child.on('exit', (code) => {
    for (const other of children) if (other !== child) other.kill()
    process.exit(code ?? 0)
  })
}
