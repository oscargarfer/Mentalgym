/**
 * Traducción de una ruta pedida por la app al archivo de `dist/` que le toca.
 *
 * Vive aparte de `esquema.js`, y sin importar Electron, para poder comprobarlo
 * desde Node: es la única parte del esquema `app://` donde un descuido se
 * convierte en que la aplicación sirva archivos fuera de `dist/`.
 */
import { join, extname, normalize, sep } from 'node:path'

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

export const tipoMime = (fichero) =>
  MIME[extname(fichero).toLowerCase()] || 'application/octet-stream'

/**
 * Devuelve la ruta absoluta del archivo a servir, o `null` si se sale de la
 * raíz. Un directorio o la raíz pelada caen en `index.html`.
 */
export function resolverRuta(raiz, pathname) {
  let rel
  try {
    rel = decodeURIComponent(pathname)
  } catch {
    // Porcentaje mal formado: no es una ruta legítima.
    return null
  }
  // normalize + prefijo obligatorio, igual que hace el servidor local.
  // Ojo: `normalize('')` devuelve '.', no cadena vacía.
  rel = normalize(rel).replace(/^([/\\])+/, '')
  if (rel === '' || rel === '.' || rel.endsWith('/') || rel.endsWith(sep)) rel = 'index.html'
  const fichero = join(raiz, rel)
  if (fichero !== raiz && !fichero.startsWith(raiz + sep)) return null
  return fichero
}
