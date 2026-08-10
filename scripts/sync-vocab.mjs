/**
 * Recuenta y audita los mazos de vocabulario.
 *
 *   node scripts/sync-vocab.mjs
 *
 * - Regenera src/data/vocabCounts.json (lo consume la UI sin cargar los mazos).
 * - Avisa de duplicados, filas mal formadas y traducciones vacias.
 * Ejecutalo despues de ampliar cualquier idioma.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vocabKey, vocabStem } from './vocab-key.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', 'src', 'data', 'vocab')

const counts = {}
let problems = 0

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const id = file.replace(/\.json$/, '')
  const rows = JSON.parse(readFileSync(join(dir, file), 'utf8'))

  const seen = new Map()
  const byStem = new Map()
  const byMeaning = new Map()
  const dupes = []
  const broken = []

  rows.forEach((row, i) => {
    if (!Array.isArray(row) || !row[0] || !row[1]) {
      broken.push(`fila ${i + 1}: ${JSON.stringify(row)}`)
      return
    }
    const key = vocabKey(row[0])
    if (seen.has(key)) dupes.push(`"${row[0]}" (filas ${seen.get(key) + 1} y ${i + 1})`)
    else seen.set(key, i)

    const stem = vocabStem(row[0])
    if (!byStem.has(stem)) byStem.set(stem, [])
    byStem.get(stem).push(row[0])

    const gloss = String(row[1]).trim().toLowerCase()
    if (!byMeaning.has(gloss)) byMeaning.set(gloss, [])
    byMeaning.get(gloss).push(row[0])
  })

  // Entradas que solo difieren en el articulo. Pueden ser pares minimos legitimos
  // ("la tour" torre / "le tour" turno) o un descuido; se revisan a ojo.
  const sameStem = [...byStem.entries()].filter(([, ws]) => new Set(ws).size > 1)

  // Aviso, no error: varias palabras con la misma glosa exacta hacen que el test
  // ES -> idioma no se pueda adivinar. La app las acepta todas como validas, pero
  // si son conceptos distintos (no sinonimos) conviene matizar la glosa.
  const ambiguous = [...byMeaning.entries()].filter(([, ws]) => ws.length > 1)

  // Fronteras de nivel. El mazo conserva el orden en que se construyo —nucleo
  // de frecuencia, luego vocabulario comun, luego ampliacion—, asi que un nivel
  // es un corte por posicion y no hace falta marcar cada entrada.
  const enTramo = (t) => {
    const f = join(here, 'batches', `${id}-t${t}.json`)
    if (!existsSync(f)) return new Set()
    return new Set(JSON.parse(readFileSync(f, 'utf8')).map((r) => r[0]))
  }
  const t2 = enTramo(2)
  const t3 = enTramo(3)
  const nucleo = rows.filter((r) => !t2.has(r[0]) && !t3.has(r[0])).length
  const comun = rows.filter((r) => !t3.has(r[0])).length

  counts[id] = { total: rows.length, nucleo, comun }
  const flag = dupes.length || broken.length ? 'X' : 'OK'
  console.log(
    `[${flag}] ${id.padEnd(3)} ${String(rows.length).padStart(5)} entradas` +
      `  ·  nucleo ${nucleo} · comun ${comun} · completo ${rows.length}`,
  )
  if (broken.length) {
    problems += broken.length
    console.log(`      ${broken.length} filas invalidas:`)
    broken.slice(0, 5).forEach((b) => console.log(`        - ${b}`))
  }
  if (dupes.length) {
    problems += dupes.length
    console.log(`      ${dupes.length} duplicados:`)
    dupes.slice(0, 5).forEach((d) => console.log(`        - ${d}`))
    if (dupes.length > 5) console.log(`        ... y ${dupes.length - 5} mas`)
  }
  if (sameStem.length) {
    console.log(`      ${sameStem.length} pares que solo difieren en el articulo (revisar):`)
    sameStem.slice(0, 8).forEach(([, ws]) => console.log(`        - ${[...new Set(ws)].join(' / ')}`))
    if (sameStem.length > 8) console.log(`        ... y ${sameStem.length - 8} mas`)
  }
  if (ambiguous.length) {
    console.log(`      ${ambiguous.length} glosas compartidas (aviso, la app las acepta todas):`)
    ambiguous.slice(0, 5).forEach(([m, ws]) => console.log(`        - "${m}" <- ${ws.join(' / ')}`))
    if (ambiguous.length > 5) console.log(`        ... y ${ambiguous.length - 5} mas`)
  }
}

writeFileSync(
  join(here, '..', 'src', 'data', 'vocabCounts.json'),
  `${JSON.stringify(counts, null, 2)}\n`,
  'utf8',
)

console.log(`\nvocabCounts.json actualizado · ${problems} incidencias`)
process.exit(problems ? 1 : 0)
