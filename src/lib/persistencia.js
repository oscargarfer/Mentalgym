/**
 * Dónde vive el progreso, según dónde se esté ejecutando la app.
 *
 * Los cuatro destinos cumplen el mismo contrato, así que `sync.js` no sabe en
 * cuál está: `leer`, `escribir`, `salir` y, opcionalmente, `registrarVolcado`.
 *
 *   electron  → IPC contra el proceso principal, que escribe en la carpeta de
 *               datos del usuario.
 *   capacitor → sistema de ficheros del móvil.
 *   http      → `/api/estado` del servidor local de siempre.
 *   navegador → nada: `storage.js` ya guarda en localStorage y no hay más sitio
 *               donde replicar.
 *
 * El orden importa: Electron y Capacitor también corren sobre un origen http,
 * así que se comprueban antes.
 */
import { Capacitor } from '@capacitor/core'

const RUTA = 'progreso.json'
const RUTA_RESPALDO = 'progreso.anterior.json'
const API = '/api/estado'

const hayVentana = typeof window !== 'undefined'
const vacio = (datos) => !datos || typeof datos !== 'object' || !Object.keys(datos).length

/* ---------- Escritorio (Electron) ---------- */

const electron = {
  nombre: 'electron',
  async leer() {
    const j = await window.gimnasio.cargarEstado()
    return j?.datos ?? null
  },
  async escribir(sobre) {
    await window.gimnasio.guardarEstado(sobre)
  },
  salir(sobre) {
    // Sin esperar: el cierre ordenado lo coordina `registrarVolcado`.
    window.gimnasio.guardarEstado(sobre)
  },
  registrarVolcado(fn) {
    window.gimnasio.alVolcar(fn)
  },
}

/* ---------- Móvil (Capacitor) ---------- */

// Importación diferida: así el plugin no entra en el paquete de escritorio ni
// en el del navegador, donde no serviría de nada.
let modulo = null
const ficheros = async () => (modulo ??= await import('@capacitor/filesystem'))

const leerFichero = async (ruta) => {
  const { Filesystem, Directory, Encoding } = await ficheros()
  const r = await Filesystem.readFile({
    path: ruta,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  })
  return JSON.parse(r.data)
}

const escribirFichero = async (ruta, obj) => {
  const { Filesystem, Directory, Encoding } = await ficheros()
  await Filesystem.writeFile({
    path: ruta,
    data: JSON.stringify(obj, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

const capacitor = {
  nombre: 'capacitor',
  async leer() {
    try {
      return (await leerFichero(RUTA))?.datos ?? null
    } catch {
      return null
    }
  },
  async escribir(sobre) {
    let previo = null
    try {
      previo = await leerFichero(RUTA)
    } catch {
      /* aún no hay archivo */
    }

    // Misma protección que en disco: una foto en blanco no puede llevarse por
    // delante un progreso real.
    if (vacio(sobre?.datos) && !vacio(previo?.datos) && !sobre?.forzar) return

    // El sistema de ficheros del móvil no da un renombrado atómico, así que la
    // red de seguridad es la copia anterior: si una escritura queda a medias,
    // el archivo de ayer sigue completo.
    if (previo) await escribirFichero(RUTA_RESPALDO, previo)
    await escribirFichero(RUTA, sobre)
  },
  salir(sobre) {
    this.escribir(sobre)
  },
}

/* ---------- Servidor local (navegador) ---------- */

const http = {
  nombre: 'http',
  async leer() {
    const r = await fetch(API, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return j?.datos ?? null
  },
  async escribir(sobre) {
    await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sobre),
    })
  },
  salir(sobre) {
    const cuerpo = JSON.stringify(sobre)
    try {
      // `sendBeacon` sigue vivo aunque la página ya se esté descargando, cosa
      // que un fetch normal no garantiza.
      const blob = new Blob([cuerpo], { type: 'application/json' })
      if (navigator.sendBeacon?.(API, blob)) return
    } catch {
      /* cae al fetch de abajo */
    }
    this.escribir(sobre).catch(() => {})
  },
}

/* ---------- Sin sitio donde replicar ---------- */

const soloNavegador = {
  nombre: 'navegador',
  async leer() {
    return null
  },
  async escribir() {},
  salir() {},
}

function elegir() {
  if (!hayVentana) return soloNavegador
  // `window.gimnasio` lo pone el preload antes de que corra nada de la página.
  if (window.gimnasio?.plataforma === 'electron') return electron
  // Se pregunta a la API de Capacitor y no al global `window.Capacitor`: en el
  // móvil la app también se sirve por http, así que si la detección llegara
  // tarde caería en la rama del servidor local, que allí no existe, y el
  // progreso se quedaría solo en localStorage sin avisar de nada.
  if (Capacitor.isNativePlatform()) return capacitor
  if (/^https?:$/.test(window.location.protocol)) return http
  return soloNavegador
}

export const backend = elegir()
