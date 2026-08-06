/**
 * Casillero mental fonético: la herramienta que convierte números en imágenes.
 *
 * Un número no se puede visualizar, y lo que no se visualiza no se asocia. La
 * salida clásica es fijar una consonante por dígito y dejar las vocales libres:
 * así cada par de cifras se convierte en una palabra concreta, y a partir de ahí
 * el número se memoriza como cualquier otra imagen.
 *
 * La tabla y las 100 palabras son un punto de partida EDITABLE. Un casillero
 * ajeno funciona mal: las palabras tienen que evocarte algo a ti. Se pueden
 * cambiar una a una desde Ajustes.
 *
 * Regla de lectura: solo cuentan las consonantes, en orden, y solo las dos
 * primeras. Las vocales, la h, la w, la x y la y son libres.
 */

/** Dígito → consonantes que lo representan, con la regla mnemotécnica clásica. */
export const TABLA_FONETICA = [
  { d: 0, letras: 's, z, c(e/i)', pista: 'ceRO empieza por el sonido /s/' },
  { d: 1, letras: 't, d', pista: 'la t tiene un solo trazo vertical' },
  { d: 2, letras: 'n, ñ', pista: 'la n tiene dos patas' },
  { d: 3, letras: 'm', pista: 'la m tiene tres patas' },
  { d: 4, letras: 'r, rr', pista: 'cuatRo lleva r' },
  { d: 5, letras: 'l, ll', pista: 'L es 50 en números romanos' },
  { d: 6, letras: 'ch, j, g(e/i)', pista: 'la j invertida parece un 6' },
  { d: 7, letras: 'c(a/o/u), k, q, g(a/o/u)', pista: 'dos sietes cruzados forman una K' },
  { d: 8, letras: 'f, v', pista: 'la f manuscrita se parece a un 8' },
  { d: 9, letras: 'p, b', pista: 'el 9 reflejado es una p' },
]

/**
 * Casillero 00-99. Cada palabra codifica sus dos cifras en sus dos primeras
 * consonantes, y todas son objetos concretos: hay que poder verlos.
 */
export const CASILLERO = [
  'seso', 'seta', 'cine', 'sumo', 'sierra', 'silla', 'soja', 'saco', 'sofá', 'sapo',
  'taza', 'teatro', 'atún', 'tomate', 'toro', 'tela', 'techo', 'taco', 'tofu', 'tapa',
  'nuez', 'nudo', 'neón', 'animal', 'nariz', 'nailon', 'nicho', 'nuca', 'nafta', 'nabo',
  'mesa', 'moto', 'mano', 'momia', 'mora', 'maleta', 'mecha', 'mago', 'mofeta', 'mapa',
  'rosa', 'rata', 'rana', 'remo', 'aurora', 'reloj', 'reja', 'roca', 'rifle', 'ropa',
  'lazo', 'lata', 'luna', 'lima', 'loro', 'lila', 'leche', 'laca', 'elfo', 'lupa',
  'jazmín', 'chita', 'jinete', 'jamón', 'jarra', 'chaleco', 'chichón', 'chaqueta', 'jefe', 'jabón',
  'casa', 'gato', 'cuna', 'cama', 'carro', 'cola', 'coche', 'coco', 'café', 'capa',
  'foso', 'foto', 'vino', 'fémur', 'faro', 'vela', 'faja', 'foca', 'avefría', 'vapor',
  'pesa', 'pato', 'pino', 'puma', 'pera', 'pala', 'bicho', 'boca', 'bufanda', 'pipa',
]

/** Los cuatro palos y los trece valores de la baraja francesa. */
export const PALOS = ['♠', '♥', '♦', '♣']
export const VALORES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/**
 * Las 52 cartas se apoyan en el mismo casillero: la carta n-ésima usa la palabra
 * del número n (1..52). Así solo hay una lista que aprender y que personalizar,
 * en vez de dos.
 */
export const cartas = (casillero = CASILLERO) =>
  PALOS.flatMap((palo, p) =>
    VALORES.map((valor, v) => {
      const n = p * 13 + v + 1
      return { id: `${valor}${palo}`, palo, valor, numero: n, palabra: casillero[n] }
    }),
  )

const VOCALES_E_I = 'ei'

/**
 * Lee las consonantes de una palabra y devuelve los dígitos que codifica.
 * Es la comprobación que impide que el casillero sea incoherente: cada palabra
 * tiene que devolver exactamente el número en cuya casilla está.
 */
export function palabraADigitos(palabra) {
  const s = String(palabra)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const out = []
  let i = 0
  while (i < s.length) {
    const par = s.slice(i, i + 2)
    if (par === 'ch') { out.push(6); i += 2; continue }
    if (par === 'll') { out.push(5); i += 2; continue }
    if (par === 'rr') { out.push(4); i += 2; continue }
    if (par === 'qu') { out.push(7); i += 2; continue }
    if (par === 'gu' && VOCALES_E_I.includes(s[i + 2])) { out.push(7); i += 2; continue }

    const c = s[i]
    if (c === 's' || c === 'z') out.push(0)
    else if (c === 't' || c === 'd') out.push(1)
    else if (c === 'n') out.push(2)
    else if (c === 'm') out.push(3)
    else if (c === 'r') out.push(4)
    else if (c === 'l') out.push(5)
    else if (c === 'j') out.push(6)
    else if (c === 'k' || c === 'q') out.push(7)
    else if (c === 'f' || c === 'v') out.push(8)
    else if (c === 'p' || c === 'b') out.push(9)
    else if (c === 'c') out.push(VOCALES_E_I.includes(s[i + 1]) ? 0 : 7)
    else if (c === 'g') out.push(VOCALES_E_I.includes(s[i + 1]) ? 6 : 7)
    i++
  }
  return out
}

/** Los dos dígitos que codifica una palabra, en texto ('07'), o null si no llega a dos. */
export function palabraACasilla(palabra) {
  const d = palabraADigitos(palabra)
  return d.length >= 2 ? `${d[0]}${d[1]}` : null
}

/** Trocea una secuencia de cifras en las palabras del casillero que la representan. */
export function digitosAPalabras(digitos, casillero = CASILLERO) {
  const s = String(digitos).replace(/\D/g, '')
  const out = []
  for (let i = 0; i < s.length; i += 2) {
    const par = s.slice(i, i + 2)
    out.push(par.length === 2 ? { par, palabra: casillero[Number(par)] } : { par, palabra: null })
  }
  return out
}

/** Grupos de tres bits → dígito decimal (000→0 … 111→7), el paso previo al casillero. */
export const TRIOS_BINARIOS = ['000', '001', '010', '011', '100', '101', '110', '111']

export function binarioADecimal(bits) {
  const s = String(bits).replace(/[^01]/g, '')
  const out = []
  for (let i = 0; i < s.length; i += 3) {
    const trio = s.slice(i, i + 3)
    out.push(trio.length === 3 ? String(parseInt(trio, 2)) : trio)
  }
  return out.join('')
}
