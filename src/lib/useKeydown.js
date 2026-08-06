import { useEffect, useRef } from 'react'

/**
 * Escucha global de teclado. El handler siempre ve la ultima closure.
 * `enabled` permite silenciar atajos mientras otro contexto los captura.
 */
export function useKeydown(handler, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    if (!enabled) return undefined
    const fn = (e) => ref.current(e)
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [enabled])
}

/** true si el evento viene de un campo de texto */
export const isTyping = (e) => {
  const t = e.target
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/** Evita el scroll por defecto de espacio y flechas */
export const blockScroll = (e) => {
  if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)) {
    e.preventDefault()
  }
}
