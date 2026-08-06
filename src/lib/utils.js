/* ---------- Aleatoriedad ---------- */

export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const sample = (arr, n) => shuffle(arr).slice(0, n)
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/* ---------- Normalizacion y correccion de respuestas ---------- */

const ARTICLES = /^(el|la|los|las|un|una|unos|unas|lo|the|to|a|an|der|die|das|le|les|l|il|de)\s+/

const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g')

export const stripAccents = (s) =>
  String(s).normalize('NFD').replace(COMBINING, '')

// Conserva cualquier letra o numero Unicode: cirilico, kana, kanji y hanzi
// deben sobrevivir a la normalizacion o el test inverso seria imposible de responder.
// Se admiten tambien las marcas (\p{M}): los acentos latinos ya los ha quitado
// stripAccents, pero el dakuten japones (が = か + U+3099) es distintivo y debe seguir vivo.
const PUNCT = /[^\p{L}\p{N}\p{M}\s]/gu

export const norm = (s = '') =>
  stripAccents(String(s).toLowerCase())
    .replace(/\(.*?\)/g, ' ')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLES, '')
    .trim()

/** Trocea un significado en sus alternativas validas: "suelo, tierra" -> [suelo, tierra] */
export const alternatives = (target = '') => {
  const full = norm(target)
  const parts = String(target)
    .split(/[,;/]| o /gi)
    .map(norm)
    .filter(Boolean)
  return [...new Set([full, ...parts])].filter(Boolean)
}

/** true si la respuesta escrita coincide con alguna alternativa del objetivo */
export const answerMatches = (input, target) => {
  const a = norm(input)
  if (!a) return false
  return alternatives(target).includes(a)
}

/**
 * Acepta varios objetivos validos a la vez. Se usa en el test inverso
 * (ES -> idioma) para dar por buena tanto la grafia original como su lectura:
 * pinyin en chino, transliteracion en ruso, kana en japones.
 */
export const answerMatchesAny = (input, targets = []) =>
  targets.filter(Boolean).some((t) => answerMatches(input, t))

/**
 * Indice significado -> todas las palabras (y lecturas) que lo expresan.
 *
 * Hace falta para el test inverso (ES -> idioma): si el mazo tiene "to talk" y
 * "to speak" con el mismo significado "hablar", al usuario se le muestra "hablar"
 * sin forma humana de adivinar cual de las dos se le pide. Dar por fallada una
 * respuesta correcta es mucho peor que aceptar un sinonimo, asi que se aceptan
 * todas las palabras del mazo que compartan ese significado.
 */
export const buildMeaningIndex = (entries = []) => {
  const index = new Map()
  for (const e of entries) {
    for (const alt of alternatives(e.m)) {
      if (!index.has(alt)) index.set(alt, [])
      index.get(alt).push(e.w, e.r)
    }
  }
  return index
}

/** Objetivos validos para responder a `entry` en el sentido ES -> idioma */
export const reverseTargets = (entry, meaningIndex) => {
  const fromIndex = meaningIndex?.get(norm(entry.m)) || []
  return [...new Set([entry.w, entry.r, ...fromIndex])].filter(Boolean)
}

/* ---------- Formato ---------- */

export const fmtMs = (ms) => {
  if (ms == null || Number.isNaN(ms)) return '--'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export const fmtClock = (ms) => {
  if (ms == null || Number.isNaN(ms)) return '00:00.0'
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const d = Math.floor((total % 1000) / 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`
}

export const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

export const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

export const round = (n, d = 1) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

/* ---------- Punto optimo de reconocimiento (ORP) para RSVP ---------- */

export const orpIndex = (word = '') => {
  const len = word.length
  if (len <= 1) return 0
  const i = len <= 5 ? 1 : len <= 9 ? 2 : 3
  if (word[i] && word[i] !== ' ') return i
  // Un espacio no sirve de punto de fijacion: en entradas de varias palabras
  // ("to chase", "der Hund") se busca la letra mas cercana al punto teorico.
  for (let d = 1; d < len; d++) {
    if (word[i + d] && word[i + d] !== ' ') return i + d
    if (word[i - d] && word[i - d] !== ' ') return i - d
  }
  return i
}

/* ---------- Importacion de mazos personalizados (JSON / CSV / TSV) ---------- */

const clean = (s) => String(s ?? '').trim().replace(/^["']|["']$/g, '')

const splitCsvLine = (line, delim) => {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === delim && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/**
 * Acepta:
 *  - JSON: [{"w":"house","m":"casa","r":""}] | [{"word":"","meaning":""}] | [["house","casa"]]
 *  - CSV/TSV/;: house,casa[,lectura]  (cabecera opcional)
 * Devuelve { entries, error }
 */
export const parseDeck = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return { entries: [], error: 'El contenido está vacío.' }

  // --- Intento JSON ---
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const data = JSON.parse(text)
      const list = Array.isArray(data) ? data : data.entries || data.words || []
      const entries = list
        .map((row) => {
          if (Array.isArray(row)) return { w: clean(row[0]), m: clean(row[1]), r: clean(row[2]) }
          if (row && typeof row === 'object') {
            const w = row.w ?? row.word ?? row.palabra ?? row.front ?? row.term
            const m = row.m ?? row.meaning ?? row.significado ?? row.back ?? row.translation
            const r = row.r ?? row.reading ?? row.lectura ?? row.transliteration ?? ''
            return { w: clean(w), m: clean(m), r: clean(r) }
          }
          return null
        })
        .filter((e) => e && e.w && e.m)
      if (!entries.length) return { entries: [], error: 'JSON válido pero sin pares palabra/significado.' }
      return { entries, error: null }
    } catch {
      return { entries: [], error: 'JSON mal formado.' }
    }
  }

  // --- CSV / TSV ---
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { entries: [], error: 'Sin líneas legibles.' }
  const first = lines[0]
  const delim = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ','

  const rows = lines.map((l) => splitCsvLine(l, delim).map(clean))
  // Descarta cabecera evidente
  const head = rows[0].map((c) => c.toLowerCase())
  const isHeader =
    head.some((c) => ['word', 'palabra', 'front', 'term', 'w'].includes(c)) &&
    head.some((c) => ['meaning', 'significado', 'back', 'translation', 'm'].includes(c))
  const body = isHeader ? rows.slice(1) : rows

  const entries = body
    .map((cols) => ({ w: cols[0], m: cols[1], r: cols[2] || '' }))
    .filter((e) => e.w && e.m)

  if (!entries.length)
    return { entries: [], error: 'No se detectaron dos columnas (palabra + significado).' }
  return { entries, error: null }
}

/* ---------- Descargas ---------- */

export const downloadJSON = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
