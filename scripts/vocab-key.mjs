/**
 * Clave de deduplicacion de vocabulario. Deliberadamente CONSERVADORA:
 * ante la duda prefiere conservar dos entradas parecidas a fundir dos palabras
 * distintas, porque un duplicado se ve a simple vista y una palabra perdida no.
 *
 * Solo se normaliza el ruido puro: puntuacion y espacios sobrantes.
 *
 * NO se toca:
 *  - la caja: en aleman "der Arm" (brazo) y "arm" (pobre) son palabras distintas,
 *    igual que "das Essen" (comida) y "essen" (comer)
 *  - los diacriticos: "zahlen" (pagar) no es "zählen" (contar), ni "schon" (ya) es "schön" (hermoso)
 *  - el "to" ingles: "to answer" (responder) no es "answer" (respuesta)
 *  - el articulo: en frances distingue pares minimos reales. "la tour" es la torre
 *    y "le tour" es el turno; "le personnel" es la plantilla y "personnel" es el
 *    adjetivo personal. Quitarlo fundia esas parejas y borraba una de las dos.
 *
 * El precio es que "das Haus" y "Haus" contarian como entradas distintas. Por eso
 * sync-vocab avisa aparte de las entradas que solo difieren en el articulo: se
 * revisan a ojo en vez de descartarlas a ciegas.
 */
export const vocabKey = (word) =>
  String(word)
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Forma sin articulo inicial: solo para avisar de posibles duplicados, nunca para descartar. */
const ARTICLES = /^(der|die|das|the|le|la|les|l|un|une|el|los|las)\s+/i
export const vocabStem = (word) => vocabKey(word).replace(ARTICLES, '').trim()
