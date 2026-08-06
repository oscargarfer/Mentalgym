/**
 * Fusiona un lote nuevo dentro del mazo de un idioma, sin duplicar.
 *
 *   node scripts/merge-vocab.mjs <id> <archivo-lote.json>
 *   node scripts/merge-vocab.mjs en scripts/batches/en-t1.json
 *
 * La clave de deduplicacion es la palabra extranjera normalizada (sin acentos,
 * sin articulo inicial), asi que "das Fenster" y "Fenster" cuentan como la misma.
 * Las filas nuevas se anaden al final: el orden del mazo refleja los tramos.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vocabKey } from './vocab-key.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const [id, batchPath] = process.argv.slice(2)

if (!id || !batchPath) {
  console.error('uso: node scripts/merge-vocab.mjs <id> <archivo-lote.json>')
  process.exit(1)
}

const deckPath = join(here, '..', 'src', 'data', 'vocab', `${id}.json`)
if (!existsSync(deckPath)) {
  console.error(`no existe el mazo ${deckPath}`)
  process.exit(1)
}

const key = vocabKey

const deck = JSON.parse(readFileSync(deckPath, 'utf8'))
const batch = JSON.parse(readFileSync(join(here, '..', batchPath), 'utf8'))

const seen = new Set(deck.map((r) => key(r[0])))
const added = []
const skipped = []

for (const row of batch) {
  if (!Array.isArray(row) || !row[0] || !row[1]) {
    skipped.push(`invalida: ${JSON.stringify(row)}`)
    continue
  }
  const k = key(row[0])
  if (seen.has(k)) {
    skipped.push(`duplicada: ${row[0]}`)
    continue
  }
  seen.add(k)
  added.push(row)
}

const out = [...deck, ...added]
writeFileSync(deckPath, `[\n${out.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`, 'utf8')

console.log(`${id}: ${deck.length} -> ${out.length} (+${added.length}, ${skipped.length} descartadas)`)
skipped.slice(0, 10).forEach((s) => console.log(`   · ${s}`))
if (skipped.length > 10) console.log(`   · ... y ${skipped.length - 10} mas`)
