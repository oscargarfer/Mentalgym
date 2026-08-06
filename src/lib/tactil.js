/**
 * Manejo táctil.
 *
 * En vez de duplicar la lógica de cada ejercicio en botones, los botones
 * *pulsan teclas*: emiten el mismo evento `keydown` sobre `window` que emitiría
 * el teclado físico. Los seis módulos escuchan ahí (`useKeydown`), así que el
 * dedo recorre exactamente el mismo camino de código que la tecla, y no hay
 * forma de que un ejercicio se comporte distinto en el móvil que en el
 * ordenador.
 */
import { useEffect, useState } from 'react'

/** Etiquetas que se pintan en pantalla, y la tecla real que representan. */
const TECLAS = {
  ESPACIO: ' ',
  ENTER: 'Enter',
  ESC: 'Escape',
  '→': 'ArrowRight',
  '←': 'ArrowLeft',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
}

/** Tecla real de una etiqueta, o null si no representa ninguna. */
export const teclaDe = (etiqueta) => {
  if (!etiqueta) return null
  if (TECLAS[etiqueta]) return TECLAS[etiqueta]
  // Las de una sola letra (S de sí, N de no, R de repetir) van tal cual.
  return etiqueta.length === 1 ? etiqueta.toLowerCase() : null
}

/** Emite la pulsación como si viniera del teclado. */
export function pulsar(tecla) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }))
}

const calcular = () => {
  if (typeof window === 'undefined') return false
  // Permite forzarlo desde Ajustes para probar los controles en el ordenador.
  const forzado = document.documentElement.dataset.tactil
  if (forzado === 'si') return true
  if (forzado === 'no') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** true cuando se maneja con el dedo: móvil, tableta o forzado desde Ajustes. */
export function usePunteroGrueso() {
  const [grueso, setGrueso] = useState(calcular)

  useEffect(() => {
    const revisar = () => setGrueso(calcular())
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener('change', revisar)
    // El ajuste manual se escribe en el <html>, así que hay que vigilarlo.
    const observador = new MutationObserver(revisar)
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-tactil'],
    })
    revisar()
    return () => {
      mq.removeEventListener('change', revisar)
      observador.disconnect()
    }
  }, [])

  return grueso
}

/**
 * Mantiene la pantalla encendida mientras dura un ejercicio.
 *
 * Una carga de cien palabras pasa varios minutos sin que nadie toque la
 * pantalla, y el móvil se apagaría en mitad de la memorización.
 */
export function useEvitarSuspension(activo) {
  useEffect(() => {
    if (!activo || !navigator.wakeLock) return undefined
    let bloqueo = null
    let cancelado = false

    const pedir = async () => {
      try {
        bloqueo = await navigator.wakeLock.request('screen')
      } catch {
        /* el navegador puede negarlo; no es motivo para interrumpir nada */
      }
    }
    // Al volver de segundo plano el bloqueo se pierde y hay que repetirlo.
    const alVolver = () => {
      if (!cancelado && document.visibilityState === 'visible') pedir()
    }

    pedir()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', alVolver)
      bloqueo?.release().catch(() => {})
    }
  }, [activo])
}
