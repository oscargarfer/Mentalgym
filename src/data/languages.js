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
  { id: 'en', name: 'Inglés', tag: 'EN', accent: '#00e5ff', load: () => import('./vocab/en.json') },
  { id: 'de', name: 'Alemán', tag: 'DE', accent: '#ffb020', load: () => import('./vocab/de.json') },
  { id: 'fr', name: 'Francés', tag: 'FR', accent: '#a855f7', load: () => import('./vocab/fr.json') },
  { id: 'ru', name: 'Ruso', tag: 'RU', accent: '#ff4d6d', load: () => import('./vocab/ru.json') },
  { id: 'zh', name: 'Chino (Mandarín)', tag: 'ZH', accent: '#ff6b3d', load: () => import('./vocab/zh.json') },
  { id: 'ja', name: 'Japonés (Romaji)', tag: 'JA', accent: '#ff8ac6', load: () => import('./vocab/ja.json') },
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
