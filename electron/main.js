/**
 * Proceso principal de la app de escritorio.
 *
 * Aquí solo viven la ventana, el menú y el puente de progreso. Cómo se sirven
 * los archivos de la app está en `esquema.js`, y dónde se guarda el progreso en
 * `persistencia.js`.
 */
import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { declararEsquema, registrarEsquema, ORIGEN } from './esquema.js'
import { leerProgreso, guardarProgreso } from './persistencia.js'

const ID = 'com.oscargarcia.gimnasiomental'
const desarrollo = !app.isPackaged
// Permite iterar contra el servidor de Vite sin recompilar en cada cambio.
const urlDev = process.env.GIMNASIO_DEV_URL

declararEsquema()

let ventana = null

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 900,
    minHeight: 600,
    // Sin esto la ventana parpadea antes de pintar la aplicación.
    backgroundColor: '#f5f4f1',
    autoHideMenuBar: true,
    show: false,
    title: 'Gimnasio Mental',
    // `assets/` no entra en el paquete: instalada, la ventana toma el icono que
    // el instalador graba en el .exe. Solo en desarrollo hay que dárselo.
    icon: app.isPackaged ? undefined : join(app.getAppPath(), 'assets', 'gimnasio.ico'),
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // Se muestra ya pintada, no a medio cargar.
  ventana.once('ready-to-show', () => ventana.show())

  // La app no tiene un solo enlace externo. Si algún día lo tiene, que se abra
  // en el navegador del sistema y nunca dentro de la aplicación.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  ventana.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN) && url !== urlDev) e.preventDefault()
  })

  volcadoAlCerrar(ventana)

  ventana.loadURL(urlDev || `${ORIGEN}/index.html`)

  if (desarrollo) ventana.webContents.openDevTools({ mode: 'detach' })
}

/**
 * Guardado de última hora al cerrar.
 *
 * La app agrupa las escrituras en ráfagas de medio segundo, así que al cerrar
 * puede quedar una pendiente. En vez de confiar en que el `pagehide` llegue
 * antes de que se destruya la ventana, se le pide expresamente que vuelque y se
 * espera su confirmación, con un tope de un segundo para que una app colgada no
 * deje la ventana sin poder cerrarse.
 */
function volcadoAlCerrar(win) {
  let volcando = false
  let listo = false

  win.on('close', (e) => {
    if (listo) return
    e.preventDefault()
    if (volcando) return
    volcando = true

    const cerrar = () => {
      listo = true
      clearTimeout(temporizador)
      ipcMain.removeListener('estado:volcado', cerrar)
      win.close()
    }

    const temporizador = setTimeout(cerrar, 1000)
    ipcMain.once('estado:volcado', cerrar)
    win.webContents.send('volcar')
  })
}

// Una sola instancia: al abrir el acceso directo con el gimnasio ya en marcha,
// se enfoca la ventana que hay en lugar de levantar otra.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!ventana) return
    if (ventana.isMinimized()) ventana.restore()
    ventana.focus()
  })

  app.setAppUserModelId(ID)

  app.whenReady().then(() => {
    registrarEsquema()

    // El menú por defecto trae aceleradores que chocarían con la navegación por
    // dígitos de la app. Se queda solo lo imprescindible.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Gimnasio',
          submenu: [
            { role: 'reload', accelerator: 'F5' },
            { role: 'togglefullscreen', accelerator: 'F11' },
            ...(desarrollo ? [{ role: 'toggleDevTools' }] : []),
            { type: 'separator' },
            { role: 'quit', label: 'Salir', accelerator: 'Alt+F4' },
          ],
        },
      ]),
    )

    // El progreso vive en la carpeta de datos del usuario, no en la del
    // programa: `Program Files` no es escribible, y así sobrevive a
    // desinstalar y reinstalar la aplicación.
    const carpeta = join(app.getPath('userData'), 'datos')
    ipcMain.handle('estado:cargar', () => leerProgreso(carpeta))
    ipcMain.handle('estado:guardar', (_e, entrante) => guardarProgreso(carpeta, entrante))

    crearVentana()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
