/**
 * Réplica del progreso en disco, contra el servidor local.
 *
 * localStorage solo es una caché: vive dentro del navegador, atado a su origen,
 * y desaparece si se limpian los datos de navegación. El progreso de verdad se
 * guarda en `datos/progreso.json`, junto al proyecto, así que sobrevive a cerrar
 * el navegador, a cambiar de navegador y a limpiar la caché.
 *
 * Si el servidor no está (por ejemplo al abrir con `npm run dev`), todo esto
 * falla en silencio y la app sigue funcionando solo con localStorage.
 */
const API = '/api/estado'
const RETARDO = 500

let temporizador = null
let ultimoEnviado = ''

const sobre = (datos) => ({ version: 1, guardado: new Date().toISOString(), datos })

/** Lee el progreso guardado en disco. Devuelve null si no hay servidor o no hay nada. */
export async function cargarEstado() {
  try {
    const r = await fetch(API, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    if (!j || typeof j !== 'object' || !j.datos) return null
    return j.datos
  } catch {
    return null
  }
}

async function enviar(cuerpo) {
  try {
    await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
    })
    ultimoEnviado = cuerpo
  } catch {
    /* sin servidor: queda solo la copia de localStorage */
  }
}

/** Una foto sin ninguna clave nunca es un cambio legítimo: es el navegador fallando. */
const vacio = (datos) => !datos || typeof datos !== 'object' || !Object.keys(datos).length

/** Guarda a disco, agrupando ráfagas de cambios en una sola escritura. */
export function guardarEstado(datos) {
  if (vacio(datos)) return
  const cuerpo = JSON.stringify(sobre(datos))
  clearTimeout(temporizador)
  temporizador = setTimeout(() => enviar(cuerpo), RETARDO)
}

/**
 * Guardado de última hora al cerrar la pestaña. `sendBeacon` sigue vivo aunque
 * la página ya se esté descargando, cosa que un fetch normal no garantiza.
 */
export function guardarAlSalir(datos) {
  if (vacio(datos)) return
  const cuerpo = JSON.stringify(sobre(datos))
  if (cuerpo === ultimoEnviado) return
  clearTimeout(temporizador)
  try {
    const blob = new Blob([cuerpo], { type: 'application/json' })
    if (!navigator.sendBeacon?.(API, blob)) enviar(cuerpo)
  } catch {
    /* noop */
  }
}
