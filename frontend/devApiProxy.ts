import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import type { Duplex } from 'node:stream'
import { fileURLToPath } from 'node:url'
import type { Connect, ViteDevServer } from 'vite'

/**
 * Windows fills the ephemeral port range with TIME_WAIT sockets. A normal
 * connect then fails with EADDRINUSE even though the API is listening, and
 * Vite turns that into HTTP 502. Binding one reserved local port avoids that
 * allocator. The port stays outside the dynamic range, so this does not change
 * any Windows setting. The same socket is kept open for later API calls.
 *
 * Ports 44720–44751 are only the dev proxy's outbound side toward
 * 127.0.0.1:8000. Port 44718 is used once to ask whether the API is up.
 */
const API_PORT = 8000
const RESERVED_START = 44720
const RESERVED_COUNT = 32
const PROBE_PORT = 44718

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let preferredPort = RESERVED_START
let apiChild: ChildProcess | null = null
let apiOwned = false
let starting: Promise<void> | null = null

export function createDevProxyAgent(): http.Agent {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 2, maxFreeSockets: 2 })
  agent.createConnection = (options, callback) => {
    const host = typeof options.host === 'string' && options.host ? options.host : '127.0.0.1'
    const port = Number(options.port) || API_PORT
    openApiSocket(host, port).then(
      (socket) => callback?.(null, socket),
      (error: Error) => callback?.(error, undefined as unknown as Duplex),
    )
    return undefined as unknown as Duplex
  }
  return agent
}

export async function ensureDevApi(server: ViteDevServer): Promise<void> {
  starting ??= startIfClosed(server)
  await starting
}

export function forwardApi(req: Connect.IncomingMessage, res: http.ServerResponse, agent: http.Agent, attempt = 0): void {
  const headers = { ...req.headers, host: `127.0.0.1:${API_PORT}` }
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: API_PORT,
      method: req.method,
      path: req.url,
      headers,
      agent,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', (error: NodeJS.ErrnoException) => {
    const staleSocket = error.code === 'ECONNRESET' || error.code === 'EPIPE'
    if (attempt < 1 && staleSocket && (req.method === 'GET' || req.method === 'HEAD')) {
      forwardApi(req, res, agent, attempt + 1)
      return
    }
    if (res.headersSent) return
    const message =
      error.code === 'ECONNREFUSED'
        ? 'The API on 127.0.0.1:8000 is not running.'
        : `The dev proxy could not reach the API (${error.code ?? 'error'}).`
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ detail: { code: 'api_unreachable', message } }))
  })
  req.pipe(proxyReq)
}

async function startIfClosed(server: ViteDevServer): Promise<void> {
  if ((await probeApi()) === 'open') return
  const python = path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
  const env = { ...process.env }
  delete env.HDS_WORKSPACE
  apiChild = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', String(API_PORT)], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    windowsHide: true,
  })
  apiOwned = true
  const stop = () => {
    if (apiOwned && apiChild && !apiChild.killed) apiChild.kill()
  }
  server.httpServer?.on('close', stop)
  process.once('exit', stop)
  const opened = await waitUntilOpen(20000)
  if (!opened) {
    console.error('HDL Design Studio could not start the API on 127.0.0.1:8000.')
  }
}

function waitUntilOpen(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const tick = () => {
      probeApi().then((state) => {
        if (state === 'open') {
          resolve(true)
          return
        }
        if (Date.now() >= deadline) {
          resolve(false)
          return
        }
        setTimeout(tick, 250)
      })
    }
    tick()
  })
}

function probeApi(): Promise<'open' | 'closed'> {
  return connectProbe(PROBE_PORT)
}

function connectProbe(localPort: number): Promise<'open' | 'closed'> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: API_PORT, family: 4, localAddress: '127.0.0.1', localPort })
    const finish = (state: 'open' | 'closed') => {
      socket.destroy()
      resolve(state)
    }
    socket.setTimeout(1000, () => finish('closed'))
    socket.once('connect', () => finish('open'))
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && localPort > PROBE_PORT - 4) {
        connectProbe(localPort - 1).then(resolve)
        return
      }
      finish('closed')
    })
  })
}

async function openApiSocket(host: string, port: number): Promise<net.Socket> {
  let last: unknown = new Error(`connect EADDRINUSE ${host}:${port}`)
  for (let offset = 0; offset < RESERVED_COUNT; offset += 1) {
    const localPort = RESERVED_START + ((preferredPort - RESERVED_START + offset) % RESERVED_COUNT)
    try {
      const socket = await connect({ host, port, family: 4, localAddress: '127.0.0.1', localPort })
      preferredPort = localPort
      return socket
    } catch (error) {
      last = error
      if (!isAddrInUse(error)) throw error
    }
  }
  throw last
}

function connect(options: net.NetConnectOpts): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(options)
    const fail = (error: Error) => {
      socket.destroy()
      reject(error)
    }
    socket.once('connect', () => {
      socket.removeListener('error', fail)
      resolve(socket)
    })
    socket.once('error', fail)
  })
}

function isAddrInUse(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'EADDRINUSE'
}
