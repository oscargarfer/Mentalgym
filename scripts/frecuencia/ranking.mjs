/**
 * Top 2000 de contenido con lematización de verdad, y hueco frente al mazo.
 * Sustituye al intento anterior con expresiones regulares, que no juntaba los
 * verbos irregulares (go/went/gone) —justo los mas frecuentes— e inflaba el
 * hueco varios cientos de palabras por idioma.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRAMATICALES } from './gramaticales.mjs'

const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
// El corpus descargado vive fuera del repositorio: son ~53 MB y licencias que
// no conviene arrastrar. Ver el README de esta carpeta.
const CORPUS = process.env.CORPUS || join(RAIZ, '..', 'corpus-frecuencia')
const SALIDA = process.env.SALIDA || join(CORPUS, 'salida')
mkdirSync(SALIDA, { recursive: true })

const simplificadas = new Set()
for (const linea of readFileSync(join(CORPUS, 'cedict.txt'), 'utf8').split('\n')) {
  const m = linea.startsWith('#') ? null : linea.match(/^\S+ (\S+) \[/)
  if (m) simplificadas.add(m[1])
}

const valida = {
  en: (w) => /^[a-z]{2,}$/.test(w),
  de: (w) => /^[a-zäöüß]{2,}$/.test(w),
  fr: (w) => /^[a-zàâçéèêëîïôûùüÿñæœ-]{2,}$/.test(w),
  ru: (w) => /^[а-яё-]{2,}$/.test(w),
  zh: (w) => !/[A-Za-z0-9]/.test(w) && /[\u4e00-\u9fff]/.test(w) && simplificadas.has(w),
}

/** forma -> lema, del diccionario de lematización. */
function cargarLemas(lang) {
  const mapa = new Map()
  if (lang === 'zh') return mapa // el chino no flexiona
  for (const linea of readFileSync(join(CORPUS, `lemas_${lang}.txt`), 'utf8').split('\n')) {
    const t = linea.indexOf('\t')
    if (t < 1) continue
    const lema = linea.slice(0, t).trim().toLowerCase()
    const forma = linea.slice(t + 1).trim().toLowerCase()
    if (forma && lema && !mapa.has(forma)) mapa.set(forma, lema)
  }
  return mapa
}

const desnudar = {
  en: (w) => w.replace(/^to /, '').trim().toLowerCase(),
  de: (w) => w.replace(/^(der|die|das) /, '').trim().toLowerCase(),
  fr: (w) => w.replace(/^(le |la |les |l'|un |une |des )/, '').trim().toLowerCase(),
  ru: (w) => w.trim().toLowerCase(),
  zh: (w) => w.trim(),
}

console.log('=== TOP 2000 DE CONTENIDO CON LEMATIZACION REAL ===\n')
console.log('idioma   lemas    ya_tienes   faltan   fuera_del_top')

for (const lang of ['en', 'de', 'fr', 'ru', 'zh']) {
  const aLema = cargarLemas(lang)
  const lema = (w) => aLema.get(w) || w

  const cuenta = new Map()
  const mejorForma = new Map()
  for (const linea of readFileSync(join(CORPUS, `${lang}_50k.txt`), 'utf8').trim().split('\n')) {
    const [w, n] = linea.split(' ')
    if (!w || !n || !valida[lang](w) || GRAMATICALES[lang].has(w)) continue
    const l = lema(w)
    if (GRAMATICALES[lang].has(l)) continue
    cuenta.set(l, (cuenta.get(l) || 0) + Number(n))
    if (!mejorForma.has(l)) mejorForma.set(l, w)
  }

  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  const top = orden.slice(0, 2000).map(([l, f], i) => ({ lema: l, forma: mejorForma.get(l), frec: f, rango: i + 1 }))

  const mazo = JSON.parse(readFileSync(join(RAIZ, `src/data/vocab/${lang}.json`), 'utf8'))
  const nuestras = new Set()
  for (const e of mazo) {
    const d = desnudar[lang](e[0])
    nuestras.add(d)
    nuestras.add(lema(d))
  }

  const faltan = top.filter((t) => !nuestras.has(t.lema) && !nuestras.has(t.forma))
  const enTop = new Set(top.flatMap((t) => [t.lema, t.forma]))
  const fuera = mazo.filter((e) => {
    const d = desnudar[lang](e[0])
    return !enTop.has(d) && !enTop.has(lema(d))
  })

  console.log(
    `  ${lang}   ${String(cuenta.size).padStart(6)}   ${String(2000 - faltan.length).padStart(9)}` +
      `   ${String(faltan.length).padStart(6)}   ${String(fuera.length).padStart(11)}`,
  )

  writeFileSync(join(SALIDA, `top-${lang}.txt`), top.map((t) => `${t.rango}\t${t.lema}`).join('\n'), 'utf8')
  writeFileSync(join(SALIDA, `hueco-${lang}.txt`), faltan.map((t) => `${t.rango}\t${t.lema}`).join('\n'), 'utf8')
  writeFileSync(join(SALIDA, `fuera-${lang}.txt`), fuera.map((e) => `${e[0]}\t${e[1]}`).join('\n'), 'utf8')
}
