/**
 * Progreso del usuario en la app instalada.
 *
 * Es la misma lógica que sirve `scripts/serve.mjs` por HTTP, con las mismas dos
 * garantías, porque los dos fallos de los que protege siguen existiendo aquí:
 *
 *  - Escritura atómica (temporal + rename): si el proceso muere a mitad, el
 *    archivo bueno sigue entero en vez de quedarse truncado.
 *  - Rechazo de escrituras vacías sobre un archivo con contenido: basta con que
 *    la app pierda su localStorage para que mande una foto en blanco, y el
 *    disco no puede quedar a merced de eso. Borrar de verdad exige `forzar`.
 *
 * La carpeta llega como argumento en vez de leerse de `app.getPath`: así este
 * módulo no depende de Electron y se puede comprobar desde Node, que es donde
 * conviene demostrar que la protección contra escrituras vacías funciona.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const rutaProgreso = (carpeta) => join(carpeta, 'progreso.json')
export const rutaRespaldo = (carpeta) => join(carpeta, 'progreso.anterior.json')

/** Contenido guardado, o `{ version: 1, datos: null }` si aún no hay nada. */
export async function leerProgreso(carpeta) {
  try {
    return JSON.parse(await readFile(rutaProgreso(carpeta), 'utf8'))
  } catch {
    return { version: 1, datos: null }
  }
}

/**
 * Guarda una foto del progreso. Devuelve `{ ok }`, nunca lanza: la app no puede
 * hacer nada útil con la excepción y no queremos tumbar un guardado automático
 * por un fallo de disco puntual.
 */
export function guardarProgreso(carpeta, entrante) {
  // En fila, uno detrás de otro. Dos guardados a la vez -el automático y el de
  // cerrar la ventana, por ejemplo- escribían el mismo `.tmp`: el primero lo
  // renombraba y el segundo fallaba con ENOENT al no encontrarlo. Peor aún, el
  // orden de llegada al disco dejaba de ser el orden en que se pidieron.
  // `guardarAhora` nunca rechaza, así que la fila no se puede atascar.
  const turno = (colas.get(carpeta) || Promise.resolve()).then(() => guardarAhora(carpeta, entrante))
  colas.set(carpeta, turno)
  return turno
}

const colas = new Map()

async function guardarAhora(carpeta, entrante) {
  try {
    const datos = entrante?.datos
    const vieneVacio = !datos || typeof datos !== 'object' || Object.keys(datos).length === 0

    let previo = null
    try {
      previo = JSON.parse(await readFile(rutaProgreso(carpeta), 'utf8'))
    } catch {
      /* aún no hay archivo */
    }
    const habiaProgreso = previo?.datos && Object.keys(previo.datos).length > 0

    if (vieneVacio && habiaProgreso && !entrante?.forzar) {
      console.warn('  [protegido] escritura vacía rechazada: el disco ya tiene progreso')
      return { ok: false, error: 'escritura vacía rechazada' }
    }

    await mkdir(carpeta, { recursive: true })
    // Copia de la versión anterior antes de pisarla
    if (previo) await writeFile(rutaRespaldo(carpeta), JSON.stringify(previo, null, 2), 'utf8')
    const destino = rutaProgreso(carpeta)
    const tmp = `${destino}.tmp`
    await writeFile(tmp, JSON.stringify(entrante, null, 2), 'utf8')
    await rename(tmp, destino)
    return { ok: true }
  } catch (e) {
    console.error('  [error al guardar]', e)
    return { ok: false, error: String(e?.message || e) }
  }
}
