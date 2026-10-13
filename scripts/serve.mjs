/**
 * Servidor estático mínimo para la app ya construida (dist/).
 *
 * Sin dependencias: solo módulos de Node. Arranca en ~50 ms, busca un puerto
 * libre, abre el navegador y se queda escuchando. No se puede abrir dist/index.html
 * con doble clic porque el navegador bloquea los módulos ES sobre file://; por eso
 * hace falta servirlo por HTTP aunque sea todo local.
 */
import { createServer, get } from 'node:http'
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const PROYECTO = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = join(PROYECTO, 'dist')
const DATOS = join(PROYECTO, 'datos')
const PROGRESO = join(DATOS, 'progreso.json')
const RESPALDO = join(DATOS, 'progreso.anterior.json')
const MAX_CUERPO = 8 * 1024 * 1024
const HOST = '127.0.0.1'
const PORT_BASE = 4123
const PORT_TRIES = 20

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' })
  res.end(body)
}

const MARKER = 'gimnasio-mental'

const json = (res, code, obj) =>
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8')

const leerCuerpo = (req) =>
  new Promise((resolve, reject) => {
    let total = 0
    const trozos = []
    req.on('data', (c) => {
      total += c.length
      if (total > MAX_CUERPO) {
        reject(new Error('cuerpo demasiado grande'))
        req.destroy()
        return
      }
      trozos.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')))
    req.on('error', reject)
  })

/**
 * Progreso del usuario en disco.
 *
 * Se escribe primero en un temporal y luego se renombra: si el proceso muere a
 * mitad, el archivo bueno sigue intacto en vez de quedarse truncado.
 *
 * Y se rechaza toda escritura vacía sobre un archivo que sí tiene contenido. El
 * navegador es la parte frágil —basta con que se limpien sus datos con la página
 * abierta para que mande una foto en blanco— y el disco no puede quedar a merced
 * de eso. Borrar de verdad exige `forzar: true`, que solo manda el botón de
 * borrar historial.
 */
async function guardarProgreso(texto) {
  const entrante = JSON.parse(texto) // revienta aquí si no es JSON válido
  const datos = entrante?.datos
  const vieneVacio = !datos || typeof datos !== 'object' || Object.keys(datos).length === 0

  let previo = null
  try {
    previo = JSON.parse(await readFile(PROGRESO, 'utf8'))
  } catch {
    /* aún no hay archivo */
  }
  const habiaProgreso = previo?.datos && Object.keys(previo.datos).length > 0

  if (vieneVacio && habiaProgreso && !entrante.forzar) {
    const err = new Error('escritura vacía rechazada: el disco ya tiene progreso guardado')
    err.rechazo = true
    throw err
  }

  await mkdir(DATOS, { recursive: true })
  // Copia de la versión anterior antes de pisarla
  if (previo) await writeFile(RESPALDO, JSON.stringify(previo, null, 2), 'utf8')
  const tmp = `${PROGRESO}.tmp`
  await writeFile(tmp, JSON.stringify(entrante, null, 2), 'utf8')
  await rename(tmp, PROGRESO)
}

let fila = Promise.resolve()

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`)
    // Latido: permite que un segundo arranque detecte esta instancia
    if (url.pathname === '/__alive') return send(res, 200, MARKER)

    if (url.pathname === '/api/estado') {
      if (req.method === 'GET') {
        try {
          return send(res, 200, await readFile(PROGRESO), 'application/json; charset=utf-8')
        } catch {
          return json(res, 200, { version: 1, datos: null })
        }
      }
      // PUT desde la app; POST es lo que usa sendBeacon al cerrar la pestaña
      if (req.method === 'PUT' || req.method === 'POST') {
        try {
          // En fila, por lo mismo que en electron/persistencia.js: dos
          // guardados a la vez compartían el .tmp y el segundo daba ENOENT.
          const texto = await leerCuerpo(req)
          const turno = fila.then(() => guardarProgreso(texto))
          fila = turno.catch(() => {})
          await turno
          return json(res, 200, { ok: true })
        } catch (e) {
          if (e.rechazo) console.warn(`  [protegido] ${e.message}`)
          return json(res, e.rechazo ? 409 : 400, { ok: false, error: String(e.message || e) })
        }
      }
      return json(res, 405, { ok: false, error: 'método no admitido' })
    }
    // normalize + prefijo obligatorio: evita salir de dist/ con ../
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    if (rel === '' || rel.endsWith('/')) rel = 'index.html'
    let file = join(ROOT, rel)
    if (!file.startsWith(ROOT)) return send(res, 403, 'Prohibido')

    try {
      const info = await stat(file)
      if (info.isDirectory()) file = join(file, 'index.html')
    } catch {
      // La app es de una sola página: cualquier ruta desconocida cae en index.html
      file = join(ROOT, 'index.html')
    }

    const data = await readFile(file)
    send(res, 200, data, MIME[extname(file).toLowerCase()] || 'application/octet-stream')
  } catch {
    send(res, 404, 'No encontrado')
  }
})

/** Prueba puertos consecutivos hasta encontrar uno libre. */
const listen = (port, left) =>
  new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && left > 0) {
        server.removeListener('error', onError)
        listen(port + 1, left - 1).then(resolve, reject)
      } else reject(err)
    }
    server.once('error', onError)
    server.listen(port, HOST, () => {
      server.removeListener('error', onError)
      resolve(port)
    })
  })

const openBrowser = (target) =>
  spawn('cmd', ['/c', 'start', '""', target], { detached: true, stdio: 'ignore' }).unref()

/** ¿Hay ya una instancia nuestra escuchando en ese puerto? */
const probe = (port) =>
  new Promise((resolve) => {
    const req = get({ host: HOST, port, path: '/__alive', timeout: 400 }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve(body.trim() === MARKER))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })

// Doble clic sobre el acceso directo con el gimnasio ya abierto: reabre la
// pestaña en lugar de levantar un segundo servidor.
for (let p = PORT_BASE; p < PORT_BASE + PORT_TRIES; p++) {
  if (await probe(p)) {
    console.log(`  Ya estaba en marcha en http://${HOST}:${p}/`)
    if (!process.argv.includes('--no-open')) openBrowser(`http://${HOST}:${p}/`)
    process.exit(0)
  }
}

try {
  await stat(join(ROOT, 'index.html'))
} catch {
  console.error('No existe dist/index.html. Ejecuta antes:  npm run build')
  process.exit(1)
}

const port = await listen(PORT_BASE, PORT_TRIES)
const url = `http://${HOST}:${port}/`
console.log(`\n  GIMNASIO MENTAL en marcha\n  ${url}\n\n  Cierra esta ventana para detenerlo.\n`)

if (!process.argv.includes('--no-open')) openBrowser(url)
