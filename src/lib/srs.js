/**
 * Repaso espaciado: la pata que convierte "cargar rápido" en "retener".
 *
 * El módulo 2 mide codificación —cuántas palabras entran por minuto— pero el
 * test ocurre segundos después de memorizar, así que no dice nada sobre lo que
 * quedará mañana. Aquí se programa cuándo hay que volver a preguntar cada
 * palabra, con intervalos crecientes mientras se acierte y vuelta al principio
 * cuando se falle.
 *
 * Lógica pura, sin React ni almacenamiento: así se puede probar desde Node.
 */

const DIA = 86_400_000

/** Días hasta el siguiente repaso según la etapa alcanzada. */
export const INTERVALOS = [1, 3, 7, 21, 60, 180]

/** Etapa a partir de la cual se considera consolidada (más de una semana aguantando). */
export const ETAPA_CONSOLIDADA = 3

export const idFicha = (lang, w) => `${lang}::${w}`

const dias = (intervalos, etapa) => intervalos[Math.min(etapa, intervalos.length - 1)]

/**
 * Alta de una palabra recién memorizada. Entra en etapa 0 con repaso a 24 h
 * aunque se acabe de acertar: acertar treinta segundos después de memorizar no
 * demuestra retención, solo que el dato sigue en memoria de trabajo.
 */
export function crearFicha(lang, entrada, ahora = Date.now(), intervalos = INTERVALOS) {
  return {
    id: idFicha(lang, entrada.w),
    lang,
    w: entrada.w,
    m: entrada.m,
    r: entrada.r || '',
    etapa: 0,
    vence: ahora + dias(intervalos, 0) * DIA,
    aciertos: 0,
    fallos: 0,
    repasos: 0,
    altaTs: ahora,
    ultimoRepaso: null,
  }
}

/** Reprograma una ficha tras responderla. */
export function programar(ficha, acierto, ahora = Date.now(), intervalos = INTERVALOS) {
  const etapa = acierto ? Math.min(ficha.etapa + 1, intervalos.length - 1) : 0
  return {
    ...ficha,
    etapa,
    vence: ahora + dias(intervalos, etapa) * DIA,
    aciertos: ficha.aciertos + (acierto ? 1 : 0),
    fallos: ficha.fallos + (acierto ? 0 : 1),
    repasos: ficha.repasos + 1,
    ultimoRepaso: ahora,
  }
}

/**
 * Incorpora al repaso las palabras de un lote recién memorizado.
 * Las que ya estaban y se acaban de fallar vuelven a etapa 0.
 */
export function altaLote(fichas, lang, respuestas, ahora = Date.now(), intervalos = INTERVALOS) {
  const porId = new Map(fichas.map((f) => [f.id, f]))
  for (const a of respuestas) {
    if (!a || !a.w) continue
    const id = idFicha(lang, a.w)
    const previa = porId.get(id)
    if (!previa) {
      porId.set(id, crearFicha(lang, a, ahora, intervalos))
    } else if (!a.ok) {
      porId.set(id, {
        ...previa,
        etapa: 0,
        vence: ahora + dias(intervalos, 0) * DIA,
        fallos: previa.fallos + 1,
      })
    }
  }
  return [...porId.values()]
}

/** Fichas que tocan hoy, las más atrasadas primero. */
export function vencidas(fichas, ahora = Date.now(), tope = Infinity) {
  return fichas
    .filter((f) => f.vence <= ahora)
    .sort((a, b) => a.vence - b.vence)
    .slice(0, tope === Infinity ? undefined : Math.max(0, tope))
}

/** Momento del próximo repaso pendiente, o null si no queda ninguno programado. */
export function proximoVencimiento(fichas, ahora = Date.now()) {
  let min = null
  for (const f of fichas) {
    if (f.vence > ahora && (min === null || f.vence < min)) min = f.vence
  }
  return min
}

/** Estado global del repaso, para la barra lateral y el dashboard. */
export function resumen(fichas, ahora = Date.now()) {
  let pendientes = 0
  let consolidadas = 0
  let frescas = 0
  for (const f of fichas) {
    if (f.vence <= ahora) pendientes++
    if (f.etapa >= ETAPA_CONSOLIDADA) consolidadas++
    if (f.repasos === 0) frescas++
  }
  return {
    total: fichas.length,
    pendientes,
    consolidadas,
    frescas,
    proximo: proximoVencimiento(fichas, ahora),
  }
}

/** Reparto por idioma, para poder repasar solo el mazo activo si se quiere. */
export const porIdioma = (fichas, lang) => fichas.filter((f) => f.lang === lang)
