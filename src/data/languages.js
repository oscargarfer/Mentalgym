/**
 * Metadatos de idioma + cargador diferido.
 *
 * El vocabulario vive en JSON aparte y se importa solo cuando el idioma se
 * activa: con mazos de miles de palabras, meterlos todos en el bundle inicial
 * sería absurdo. Cada fila es [palabra, significado] o [palabra, significado, lectura].
 *
 * NOTA DE METODO: aqui NO se guarda ninguna "palabra puente" ni "imagen mental".
 * Esas las genera el usuario en su cabeza; la app solo mide el resultado.
 */
export const LANGUAGES = [
  { id: 'en', name: 'Inglés', tag: 'EN', accent: '#1c5e8a', load: () => import('./vocab/en.json') },
  { id: 'de', name: 'Alemán', tag: 'DE', accent: '#8a5a12', load: () => import('./vocab/de.json') },
  { id: 'fr', name: 'Francés', tag: 'FR', accent: '#5b3fa8', load: () => import('./vocab/fr.json') },
  { id: 'ru', name: 'Ruso', tag: 'RU', accent: '#a32217', load: () => import('./vocab/ru.json') },
  { id: 'zh', name: 'Chino (Mandarín)', tag: 'ZH', accent: '#9a4a12', load: () => import('./vocab/zh.json') },
  { id: 'ja', name: 'Japonés (Romaji)', tag: 'JA', accent: '#8a2f5e', load: () => import('./vocab/ja.json') },
]

const getMeta = (id) => LANGUAGES.find((l) => l.id === id) || null

const toEntries = (rows) => rows.map(([w, m, r]) => ({ w, m, r: r || '' }))

const cache = new Map()

/** Carga (y memoriza) el mazo de un idioma incorporado. */
export async function loadLanguage(id) {
  if (cache.has(id)) return cache.get(id)
  const meta = getMeta(id)
  if (!meta) return []
  const mod = await meta.load()
  const entries = toEntries(mod.default)
  cache.set(id, entries)
  return entries
}
