const NS = 'gam.v1.'

/** Aviso de "algo se ha guardado", para replicar a disco. Lo engancha AppContext. */
let alGuardar = null
export const onSave = (fn) => {
  alGuardar = fn
}

export const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(NS + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export const save = (key, value) => {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
    alGuardar?.()
    return true
  } catch {
    return false
  }
}

/**
 * Copia de todo lo que la app guarda: ajustes, mazos propios, historial y las
 * bolsas de reparto. Al recorrer el prefijo entero, cualquier cosa que se guarde
 * en el futuro entra en la copia sin tocar este archivo.
 */
export const snapshot = () => {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i)
      if (!full || !full.startsWith(NS)) continue
      try {
        out[full.slice(NS.length)] = JSON.parse(localStorage.getItem(full))
      } catch {
        /* clave corrupta: se omite en vez de tumbar la copia entera */
      }
    }
  } catch {
    /* sin localStorage disponible */
  }
  return out
}

/** Reemplaza lo guardado por el contenido de una copia. */
export const restore = (data) => {
  if (!data || typeof data !== 'object') return false
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const full = localStorage.key(i)
      if (full && full.startsWith(NS)) localStorage.removeItem(full)
    }
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(NS + k, JSON.stringify(v))
    }
    return true
  } catch {
    return false
  }
}

export const KEYS = {
  settings: 'settings',
  decks: 'decks',
  sessions: 'sessions',
  reviews: 'reviews',
  palaces: 'palaces',
  pegs: 'pegs',
}
