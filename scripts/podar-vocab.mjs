/**
 * Retira del tramo 3 los conceptos que no son de uso corriente.
 *
 *   node scripts/podar-vocab.mjs --simular   enseña qué haría, sin tocar nada
 *   node scripts/podar-vocab.mjs             aplica la poda
 *
 * Por qué existe: los mazos se construyeron en tres tramos y solo el primero
 * está ordenado por frecuencia real. El tercero es un barrido alfabético de
 * verbos, adjetivos y sustantivos, y llega a palabras que ni un nativo usa —ni
 * en el idioma que se aprende ni en la glosa española que se le enseña—. La
 * lista de lo que sale, con su motivo, está en `poda.json`.
 *
 * Se poda por concepto español, no por palabra: los seis mazos son traducciones
 * de la misma lista, así que retirar el concepto los deja alineados. Y solo
 * afecta a entradas del tramo 3; el 1 y el 2 no se tocan.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['en', 'de', 'fr', 'ru', 'zh', 'ja']
const simular = process.argv.includes('--simular')

const limpia = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Concepto: primera acepción de la glosa. */
const concepto = (m) => limpia(String(m).split(',')[0])

/** Glosa entera, para las claves que necesitan distinguir acepciones. */
const glosaEntera = (m) => limpia(m)

const poda = JSON.parse(readFileSync(join(RAIZ, 'scripts', 'poda.json'), 'utf8'))
// Dos formas de emparejar. Una clave sin coma vale contra la primera acepción;
// con coma exige la glosa entera. Sin esta distinción, "mantener, confirmar"
// (de `to uphold`) se llevaba por delante `to maintain = mantener`, que es
// palabra de uso diario.
const porConcepto = new Map()
const porGlosa = new Map()
for (const [motivo, lista] of Object.entries(poda)) {
  if (motivo === '_') continue
  for (const c of lista) {
    if (c.includes(',')) porGlosa.set(glosaEntera(c), motivo)
    else porConcepto.set(limpia(c), motivo)
  }
}
const motivoDe = (glosa) => porGlosa.get(glosaEntera(glosa)) ?? porConcepto.get(concepto(glosa))
const motivos = { size: porConcepto.size + porGlosa.size }

console.log(`Conceptos marcados para retirar: ${motivos.size}\n`)

const resumen = []
const sinUsar = new Set([...porConcepto.keys(), ...porGlosa.keys()])

// Palabras que jamás pueden desaparecer: si alguna cae, la poda tiene un falso
// positivo y hay que pararla antes de escribir nada.
const INTOCABLES = [
  'to maintain', 'to arrest', 'to include', 'to continue', 'to change',
  'to understand', 'to follow', 'to remember', 'to build', 'to open',
]

for (const lang of LANGS) {
  const ruta = join(RAIZ, 'src', 'data', 'vocab', `${lang}.json`)
  const mazo = JSON.parse(readFileSync(ruta, 'utf8'))

  // Solo el tramo 3 es podable.
  const t3 = new Set(
    JSON.parse(readFileSync(join(RAIZ, 'scripts', 'batches', `${lang}-t3.json`), 'utf8')).map(
      (f) => f[0],
    ),
  )

  const quedan = []
  const fuera = []
  // Un concepto marcado como duplicado conserva su primera aparición: si no,
  // los tres sinónimos de "prosperar" se irían juntos y el concepto se quedaría
  // sin ninguna palabra que lo exprese. Se resuelve por mazo, sin listas por
  // idioma que haya que acertar a mano.
  // Se parte de los conceptos que ya cubre el núcleo (tramos 1 y 2): si el
  // concepto ya está ahí, el duplicado del tramo 3 no aporta nada y se va.
  const yaConservado = new Set(
    mazo.filter((f) => !t3.has(f[0])).map((f) => concepto(f[1])),
  )
  for (const fila of mazo) {
    const w = fila[0]
    let motivo = t3.has(w) ? motivoDe(fila[1]) : undefined
    if (motivo === 'duplicado') {
      const c = concepto(fila[1])
      if (!yaConservado.has(c)) {
        yaConservado.add(c)
        motivo = undefined
      }
    }
    if (motivo) {
      fuera.push([w, fila[1], motivo])
      sinUsar.delete(concepto(fila[1]))
      sinUsar.delete(glosaEntera(fila[1]))
    } else {
      quedan.push(fila)
    }
  }

  if (lang === 'en') {
    const perdidas = INTOCABLES.filter((w) => !quedan.some((f) => f[0] === w))
    if (perdidas.length) {
      console.error(`\nPARADA: la poda se lleva palabras intocables: ${perdidas.join(', ')}`)
      console.error('Revisa scripts/poda.json antes de aplicar nada.')
      process.exit(1)
    }
    if (process.argv.includes('--detalle')) {
      console.log('Todo lo que sale (inglés):')
      for (const [w, m, motivo] of fuera) console.log(`  [${motivo.padEnd(9)}] ${w} = ${m}`)
      console.log()
    }
  }

  resumen.push({ lang, antes: mazo.length, fuera: fuera.length, quedan: quedan.length })
  // Una entrada por línea, como estaban: en un solo renglón el diff de cualquier
  // cambio futuro sería el archivo entero y no se podría revisar.
  if (!simular) {
    const cuerpo = quedan.map((f) => `  ${JSON.stringify(f)}`).join(',\n')
    writeFileSync(ruta, `[\n${cuerpo}\n]\n`, 'utf8')
  }
}

console.log('Resultado por idioma:')
for (const r of resumen) {
  console.log(`  ${r.lang}: ${r.antes} -> ${r.quedan}  (retiradas ${r.fuera})`)
}

if (sinUsar.size) {
  console.log(`\nAviso: ${sinUsar.size} conceptos de poda.json no encontrados en ningún tramo 3:`)
  console.log(`  ${[...sinUsar].join(', ')}`)
}

console.log(simular ? '\n(simulación: no se ha escrito nada)' : '\nMazos actualizados.')
