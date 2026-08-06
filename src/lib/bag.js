import { load, save } from './storage.js'
import { shuffle } from './utils.js'

/**
 * Extracción "de bolsa": sin reemplazo y con memoria entre sesiones.
 *
 * Sortear cada palabra por separado (con reemplazo) parece aleatorio pero no
 * sirve para entrenar: en un bloque de 20 parejas salían de media 4,6 palabras
 * repetidas, y una misma palabra en dos parejas distintas destroza la asociación
 * porque la segunda imagen pisa a la primera.
 *
 * El modelo correcto es una bolsa de fichas: se sacan sin devolverlas, y solo
 * cuando se agota se rellena y se baraja de nuevo. Eso garantiza dos cosas:
 *
 *  - dentro de un bloque no se repite ninguna palabra (mientras quepan);
 *  - entre bloques, una palabra no vuelve a salir hasta que han salido todas
 *    las demás, así que la cobertura del banco es uniforme.
 *
 * La bolsa se guarda en localStorage, de modo que dos calentamientos seguidos
 * continúan la misma vuelta en lugar de volver a empezar con las mismas.
 */

const KEY = (name) => `bag.${name}`
/** Cuántas extracciones recientes se recuerdan para no repetir en la costura entre vueltas. */
const SEAM = 8

const fresh = (n) => shuffle(Array.from({ length: n }, (_, i) => i))

/**
 * Rellena la bolsa evitando que las primeras fichas de la vuelta nueva sean las
 * últimas de la anterior (sin esto, el cambio de vuelta puede repetir en seco).
 */
function refill(n, recent) {
  const q = fresh(n)
  if (!recent.length || n <= SEAM + 1) return q
  const evitar = new Set(recent.slice(-Math.min(SEAM, Math.floor(n / 3))))
  // Busca un corte cuya cabeza no esté entre las recientes y rota por ahí
  for (let corte = 0; corte < q.length; corte++) {
    if (!evitar.has(q[corte])) return corte === 0 ? q : [...q.slice(corte), ...q.slice(0, corte)]
  }
  return q
}

/**
 * Devuelve `count` índices de un conjunto de `poolSize` elementos.
 * Si `count` supera el tamaño del conjunto, un índice solo puede repetirse
 * después de que hayan salido todos los demás.
 */
export function drawIndices(name, poolSize, count) {
  const n = Math.max(0, Math.floor(poolSize))
  const k = Math.max(0, Math.floor(count))
  if (!n || !k) return []

  const key = KEY(name)
  const saved = load(key, null)
  // Si el conjunto ha cambiado de tamaño (mazo importado, banco ampliado) la
  // bolsa antigua ya no vale: sus índices apuntarían a otras palabras.
  let queue = saved && saved.n === n && Array.isArray(saved.queue) ? saved.queue : []
  let recent = saved && saved.n === n && Array.isArray(saved.recent) ? saved.recent : []

  const out = []
  const yaSalidas = new Set()
  while (out.length < k) {
    if (!queue.length) {
      queue = refill(n, recent)
      // Si la bolsa se agota a mitad de extracción, la vuelta nueva contiene
      // palabras que ya han salido en esta misma tirada. Se posponen al final
      // para que no se repitan dentro del bloque (posible mientras k <= n).
      if (yaSalidas.size && yaSalidas.size < n) {
        const libres = queue.filter((i) => !yaSalidas.has(i))
        const repetidas = queue.filter((i) => yaSalidas.has(i))
        queue = [...libres, ...repetidas]
      }
    }
    const idx = queue.shift()
    yaSalidas.add(idx)
    out.push(idx)
    recent.push(idx)
    if (recent.length > SEAM) recent = recent.slice(-SEAM)
  }

  save(key, { n, queue, recent })
  return out
}

/** Vacía la bolsa de un conjunto (la próxima extracción empieza vuelta nueva). */
export function resetBag(name) {
  save(KEY(name), null)
}
