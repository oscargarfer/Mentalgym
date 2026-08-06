/**
 * Comprobación automática de la app de escritorio.
 *
 *   npx electron scripts/probar-electron.mjs
 *
 * Arranca Electron de verdad, con el mismo esquema `app://`, el mismo preload y
 * la misma capa de progreso que usa la aplicación, y comprueba lo que no se ve
 * a simple vista: que los fragmentos dinámicos —los seis diccionarios y el
 * panel de métricas— se sirven bien, que el puente de progreso hace el viaje de
 * ida y vuelta, y que no se puede salir de `dist/` pidiendo rutas con `..`.
 *
 * Escribe en una carpeta de datos aparte, así que no toca el progreso real.
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { declararEsquema, registrarEsquema, ORIGEN } from '../electron/esquema.js'
import { leerProgreso, guardarProgreso } from '../electron/persistencia.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// Aislado: la prueba no debe rozar el progreso real del usuario.
app.setPath('userData', join(tmpdir(), 'gimnasio-prueba-' + Date.now()))
declararEsquema()

const errores = []
const fallosDeCarga = []

const salir = (codigo) => {
  app.exit(codigo)
}

app.whenReady().then(async () => {
  registrarEsquema()

  // Mismos manejadores que monta `main.js`, contra la carpeta aislada.
  const carpeta = join(app.getPath('userData'), 'datos')
  ipcMain.handle('estado:cargar', () => leerProgreso(carpeta))
  ipcMain.handle('estado:guardar', (_e, entrante) => guardarProgreso(carpeta, entrante))

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 832,
    webPreferences: {
      preload: join(RAIZ, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') errores.push(`[${e.level}] ${e.message}`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    fallosDeCarga.push(`${code} ${desc} ${url}`)
  })
  win.webContents.on('preload-error', (_e, ruta, err) => {
    errores.push(`preload ${ruta}: ${err}`)
  })

  try {
    await win.loadURL(`${ORIGEN}/index.html`)
  } catch (e) {
    console.log(JSON.stringify({ ok: false, fase: 'carga', error: String(e) }, null, 2))
    return salir(1)
  }

  // La app hidrata desde disco antes de montar nada, y el panel de métricas se
  // carga aparte. Se espera a que el árbol esté de verdad en pantalla.
  const listo = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const empezo = Date.now()
      const mirar = () => {
        const nav = document.querySelectorAll('aside nav button').length
        const hidratando = document.body.innerText.includes('recuperando tu progreso')
        if (nav >= 9 && !hidratando) return resolve({ listo: true, ms: Date.now() - empezo })
        if (Date.now() - empezo > 15000) return resolve({ listo: false, ms: Date.now() - empezo })
        setTimeout(mirar, 100)
      }
      mirar()
    })
  `)

  // Los seis diccionarios son fragmentos aparte que solo se piden al cambiar de
  // idioma: se comprueban contra el esquema directamente.
  const assets = await readdir(join(RAIZ, 'dist', 'assets'))
  const idiomas = ['en', 'de', 'fr', 'ru', 'zh', 'ja']
  const chunks = idiomas
    .map((id) => assets.find((f) => new RegExp(`^${id}-[^/]+\\.js$`).test(f)))
    .filter(Boolean)

  const informe = await win.webContents.executeJavaScript(`
    (async () => {
      const chunks = ${JSON.stringify(chunks)}
      const servidos = {}
      for (const c of chunks) {
        const r = await fetch('${ORIGEN}/assets/' + c)
        servidos[c.split('-')[0]] = r.status + ' ' + (r.headers.get('content-type') || '')
      }

      // El panel de métricas también es un fragmento dinámico, y es la vista por
      // defecto: si ha pintado, el import() dinámico funciona sobre app://.
      const texto = document.body.innerText

      // Ida y vuelta por el puente de progreso.
      const marca = 'prueba-' + Date.now()
      const escrito = await window.gimnasio.guardarEstado({
        version: 1, guardado: new Date().toISOString(), datos: { marca },
      })
      const leido = await window.gimnasio.cargarEstado()

      // Una foto vacía no puede llevarse por delante lo que ya hay.
      const vacia = await window.gimnasio.guardarEstado({ version: 1, datos: {} })
      const trasVacia = await window.gimnasio.cargarEstado()

      // No se puede salir de dist/ pidiendo rutas con '..' codificado.
      let fuga = 'sin respuesta'
      try {
        const r = await fetch('${ORIGEN}/%2e%2e/package.json')
        fuga = r.status === 200 ? 'FUGA: 200' : 'bloqueado (' + r.status + ')'
      } catch (e) { fuga = 'bloqueado (excepcion)' }

      return {
        vistas: document.querySelectorAll('aside nav button').length,
        puenteExpuesto: typeof window.gimnasio === 'object',
        nodeFuera: typeof window.require === 'undefined' && typeof window.process === 'undefined',
        dashboardPintado: texto.includes('VRN') || texto.includes('Retención') || texto.includes('sesiones'),
        diccionariosServidos: servidos,
        escrituraOk: escrito?.ok === true,
        marcaRecuperada: leido?.datos?.marca === marca,
        vaciaRechazada: vacia?.ok === false && trasVacia?.datos?.marca === marca,
        travesiaDeRutas: fuga,
      }
    })()
  `)

  const diccionariosOk = Object.values(informe.diccionariosServidos).filter((v) =>
    v.startsWith('200'),
  ).length

  const veredicto = {
    hidratado: listo,
    ...informe,
    diccionariosOk: `${diccionariosOk}/6`,
    erroresDeConsola: errores,
    fallosDeCarga,
  }

  const bien =
    listo.listo &&
    informe.vistas === 9 &&
    informe.puenteExpuesto &&
    informe.nodeFuera &&
    informe.dashboardPintado &&
    diccionariosOk === 6 &&
    informe.escrituraOk &&
    informe.marcaRecuperada &&
    informe.vaciaRechazada &&
    informe.travesiaDeRutas.startsWith('bloqueado') &&
    errores.length === 0 &&
    fallosDeCarga.length === 0

  console.log(JSON.stringify({ ok: bien, ...veredicto }, null, 2))
  salir(bien ? 0 : 1)
})
