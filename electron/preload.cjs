/**
 * Puente entre la app y el proceso principal.
 *
 * Va en CommonJS a propósito: los preload en módulos ES obligan a desactivar el
 * aislamiento del renderer, y aquí no hace falta pagar ese precio. Lo único que
 * cruza son dos llamadas de progreso y el aviso de volcado al cerrar; la app no
 * ve `require` ni nada de Node.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gimnasio', {
  plataforma: 'electron',

  /** Progreso guardado en disco, o `{ version: 1, datos: null }`. */
  cargarEstado: () => ipcRenderer.invoke('estado:cargar'),

  /** Guarda una foto del progreso. Devuelve `{ ok }`. */
  guardarEstado: (entrante) => ipcRenderer.invoke('estado:guardar', entrante),

  /**
   * El proceso principal avisa de que va a cerrar y espera confirmación.
   * `fn` debe vaciar lo que tenga pendiente y devolver una promesa.
   */
  alVolcar: (fn) => {
    ipcRenderer.on('volcar', async () => {
      try {
        await fn()
      } finally {
        ipcRenderer.send('estado:volcado')
      }
    })
  },
})
