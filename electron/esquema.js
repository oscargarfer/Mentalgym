/**
 * Esquema `app://`, que es como la app de escritorio sirve `dist/`.
 *
 * No se usa `loadFile` por el mismo motivo que `scripts/serve.mjs` levanta un
 * servidor HTTP en vez de abrir el archivo directamente: Chromium bloquea los
 * módulos ES sobre `file://`, y la salida de Vite son módulos que además cargan
 * los seis diccionarios y el panel de métricas como fragmentos aparte. Con
 * `loadFile` la ventana se queda en negro.
 *
 * Frente a incrustar aquí el servidor HTTP, un esquema propio no abre ningún
 * puerto, arranca antes y da un origen estable, que es lo que hace que el
 * `localStorage` sobreviva de un arranque a otro.
 */
import { app, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolverRuta, tipoMime } from './rutas.js'

export const ORIGEN = 'app://gimnasio'

// La app no hace una sola llamada de red ni carga nada de fuera, así que la
// política puede cerrarse del todo. `unsafe-inline` en estilos es inevitable:
// React escribe los `style={{…}}` como atributos del elemento.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/**
 * Debe llamarse antes de que la aplicación esté lista. Sin `standard` no hay
 * origen estable, y sin origen estable el almacenamiento del navegador no
 * persiste entre arranques.
 */
export function declararEsquema() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

/**
 * Sirve `dist/` bajo `app://gimnasio/`. Se llama con la aplicación ya lista.
 *
 * La raíz se puede pasar porque `getAppPath()` es la carpeta del punto de
 * entrada: en la app es la del proyecto, pero al arrancar Electron sobre
 * `scripts/probar-electron.mjs` es `scripts/`, y la prueba buscaba
 * `scripts/dist` y recibía 404 en todo.
 */
export function registrarEsquema(raiz = join(app.getAppPath(), 'dist')) {

  protocol.handle('app', async (peticion) => {
    const { pathname } = new URL(peticion.url)
    let fichero = resolverRuta(raiz, pathname)
    if (!fichero) return new Response('Prohibido', { status: 403 })

    let datos
    try {
      datos = await readFile(fichero)
    } catch {
      // Una sola página: cualquier ruta desconocida cae en index.html.
      fichero = join(raiz, 'index.html')
      try {
        datos = await readFile(fichero)
      } catch {
        return new Response('No encontrado', { status: 404 })
      }
    }

    return new Response(datos, {
      headers: {
        'Content-Type': tipoMime(fichero),
        'Content-Security-Policy': CSP,
        'Cache-Control': 'no-cache',
      },
    })
  })
}
