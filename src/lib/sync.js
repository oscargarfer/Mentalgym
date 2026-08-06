/**
 * Réplica del progreso fuera del navegador.
 *
 * localStorage solo es una caché: vive dentro del navegador, atado a su origen,
 * y desaparece si se limpian los datos de navegación. El progreso de verdad se
 * guarda en un archivo, así que sobrevive a cerrar la aplicación, a cambiar de
 * navegador y a limpiar la caché.
 *
 * Este módulo decide *qué* y *cuándo* se escribe —agrupa ráfagas de cambios y
 * descarta lo que no merece la pena—; *dónde* acaba lo resuelve
 * `persistencia.js`, que elige entre el disco de la app de escritorio, el del
 * móvil o el servidor local. Si no hay ninguno de los tres, todo esto falla en
 * silencio y la app sigue funcionando solo con localStorage.
 */
import { backend } from './persistencia.js'

const RETARDO = 500

let temporizador = null
let pendiente = null
let ultimoEnviado = ''

const sobre = (datos) => ({ version: 1, guardado: new Date().toISOString(), datos })

/** Una foto sin ninguna clave nunca es un cambio legítimo: es el navegador fallando. */
const vacio = (datos) => !datos || typeof datos !== 'object' || !Object.keys(datos).length

/** Lee el progreso guardado. Devuelve null si no hay nada o no se puede leer. */
export async function cargarEstado() {
  try {
    return await backend.leer()
  } catch {
    return null
  }
}

/** Escribe ya lo que hubiera en cola, sin esperar al temporizador. */
export async function vaciar() {
  clearTimeout(temporizador)
  temporizador = null
  const enCola = pendiente
  pendiente = null
  if (!enCola) return
  try {
    await backend.escribir(enCola.sobre)
    ultimoEnviado = enCola.huella
  } catch {
    /* sin destino donde escribir: queda la copia de localStorage */
  }
}

/** Guarda, agrupando ráfagas de cambios en una sola escritura. */
export function guardarEstado(datos) {
  if (vacio(datos)) return
  // La huella deja fuera la marca de tiempo del envoltorio: si no, dos fotos
  // idénticas parecerían distintas y se escribirían las dos.
  pendiente = { sobre: sobre(datos), huella: JSON.stringify(datos) }
  clearTimeout(temporizador)
  temporizador = setTimeout(vaciar, RETARDO)
}

/** Guardado de última hora al cerrar la ventana o la pestaña. */
export function guardarAlSalir(datos) {
  if (vacio(datos)) return
  const huella = JSON.stringify(datos)
  if (huella === ultimoEnviado) return
  clearTimeout(temporizador)
  temporizador = null
  pendiente = null
  try {
    backend.salir(sobre(datos))
    ultimoEnviado = huella
  } catch {
    /* noop */
  }
}

// En la app de escritorio el cierre no se da por bueno hasta que esto responde:
// el proceso principal pide el volcado y espera a que confirme.
backend.registrarVolcado?.(vaciar)
