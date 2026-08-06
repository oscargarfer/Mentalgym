/**
 * Genera los iconos de las tres plataformas.
 *
 * Dibuja el mismo trazo que el favicon (zigzag cian sobre cuadrado oscuro) a
 * varios tamaños y lo empaqueta en:
 *
 *   assets/gimnasio.ico        Windows: acceso directo e instalador
 *   assets/icono-1024.png      Play Store y origen de todo lo demás
 *   assets/icono-512.png       paquete .deb y manifiesto web
 *   assets/icono-192.png       manifiesto web
 *   android/app/src/main/res/  mipmaps del lanzador, si el proyecto existe
 *
 * Sin librerías de imagen: aritmética de píxeles, Buffer y el zlib de Node. Un
 * codificador PNG mínimo son cuarenta líneas, y menos superficie que arrastrar
 * una dependencia de imágenes solo para esto.
 *
 *   node scripts/make-icon.mjs
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(RAIZ, 'assets')
const SIZES = [16, 32, 48, 64, 128, 256]

const BG = [0x0a, 0x0e, 0x18]
const CY = [0x00, 0xe5, 0xff]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Distancia de un punto al segmento ab. */
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  const t = len2 ? clamp01((wx * vx + wy * vy) / len2) : 0
  const dx = px - (ax + t * vx)
  const dy = py - (ay + t * vy)
  return Math.hypot(dx, dy)
}

/** Distancia con signo a un rectángulo redondeado centrado en (cx,cy). */
function distRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

/** Mezcla un color sobre el lienzo con la cobertura dada. */
function blend(buf, i, rgb, a) {
  if (a <= 0) return
  const inv = 1 - a
  buf[i] = rgb[2] * a + buf[i] * inv // B
  buf[i + 1] = rgb[1] * a + buf[i + 1] * inv // G
  buf[i + 2] = rgb[0] * a + buf[i + 2] * inv // R
  buf[i + 3] = 255 * a + buf[i + 3] * inv // A
}

/**
 * Lienzo BGRA de s×s con el logotipo.
 *
 * `forma` decide el fondo: redondeado para el icono normal, círculo para el
 * icono redondo de Android y ninguno para la capa frontal del icono adaptativo,
 * donde el fondo lo pone el propio sistema.
 *
 * `escala` encoge el trazo: el icono adaptativo de Android recorta hasta un 33 %
 * del lienzo, así que el dibujo tiene que caber en el centro.
 */
function render(s, { forma = 'redondeado', escala = 1 } = {}) {
  const buf = new Float64Array(s * s * 4) // transparente de partida
  const k = (s / 100) * escala // el trazo está definido en un lienzo de 100×100
  const centro = s / 2
  // Zigzag del favicon: M22,70 L38,30 L50,55 L62,30 L78,70
  const pts = [
    [22, 70],
    [38, 30],
    [50, 55],
    [62, 30],
    [78, 70],
  ].map(([x, y]) => [(x - 50) * k + centro, (y - 50) * k + centro])
  const stroke = 9 * k * 0.5 // radio del trazo
  const glow = stroke * 2.6

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const i = (y * s + x) * 4

      let dBox
      if (forma === 'circulo') dBox = Math.hypot(px - centro, py - centro) - centro
      else if (forma === 'ninguna') dBox = -Infinity
      else dBox = distRoundRect(px, py, centro, centro, centro, centro, s * 0.22)

      const inside = forma === 'ninguna' ? 1 : clamp01(0.5 - dBox)
      if (forma !== 'ninguna') blend(buf, i, BG, inside)

      // Distancia mínima al trazo
      let d = Infinity
      for (let n = 0; n < pts.length - 1; n++) {
        const dd = distSeg(px, py, pts[n][0], pts[n][1], pts[n + 1][0], pts[n + 1][1])
        if (dd < d) d = dd
      }
      // Halo suave, recortado a la silueta
      blend(buf, i, CY, clamp01(1 - d / glow) * 0.22 * inside)
      // Trazo con antialiasing
      blend(buf, i, CY, clamp01(stroke + 0.5 - d) * inside)
    }
  }
  return Buffer.from(Uint8Array.from(buf, (v) => Math.round(Math.min(255, Math.max(0, v)))))
}

/**
 * Lienzo BGRA de w×h: fondo liso y el trazo centrado.
 *
 * Solo recorre los píxeles del recuadro que ocupa el dibujo; el resto se rellena
 * de un tirón. Una pantalla de arranque de 1920×1280 son 2,4 millones de
 * píxeles, y calcular la distancia al trazo en todos ellos tarda de más para
 * nada.
 */
function renderLienzo(w, h, lado) {
  const buf = new Float64Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = BG[2]
    buf[i * 4 + 1] = BG[1]
    buf[i * 4 + 2] = BG[0]
    buf[i * 4 + 3] = 255
  }

  const k = lado / 100
  const cx = w / 2
  const cy = h / 2
  const pts = [
    [22, 70],
    [38, 30],
    [50, 55],
    [62, 30],
    [78, 70],
  ].map(([x, y]) => [(x - 50) * k + cx, (y - 50) * k + cy])
  const stroke = 9 * k * 0.5
  const glow = stroke * 2.6

  const margen = Math.ceil(glow + stroke + 2)
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - margen))
  const x1 = Math.min(w, Math.ceil(Math.max(...pts.map((p) => p[0])) + margen))
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - margen))
  const y1 = Math.min(h, Math.ceil(Math.max(...pts.map((p) => p[1])) + margen))

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const i = (y * w + x) * 4
      let d = Infinity
      for (let n = 0; n < pts.length - 1; n++) {
        const dd = distSeg(px, py, pts[n][0], pts[n][1], pts[n + 1][0], pts[n + 1][1])
        if (dd < d) d = dd
      }
      blend(buf, i, CY, clamp01(1 - d / glow) * 0.22)
      blend(buf, i, CY, clamp01(stroke + 0.5 - d))
    }
  }
  return Buffer.from(Uint8Array.from(buf, (v) => Math.round(Math.min(255, Math.max(0, v)))))
}

/* ---------------- PNG ---------------- */

const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/** Un trozo PNG: longitud, tipo, datos y su CRC. */
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length, 0)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo), 0)
  return Buffer.concat([largo, cuerpo, crc])
}

/** Codifica un lienzo BGRA como PNG de 8 bits con canal alfa. */
function png(bgra, w, h = w) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // color verdadero con alfa
  ihdr[10] = 0 // compresión estándar
  ihdr[11] = 0 // filtrado estándar
  ihdr[12] = 0 // sin entrelazado

  // Cada línea lleva delante su byte de filtro; se usa 0 (sin filtrar).
  const crudo = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) {
    const destino = y * (w * 4 + 1)
    crudo[destino] = 0
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      const d = destino + 1 + x * 4
      crudo[d] = bgra[o + 2] // R
      crudo[d + 1] = bgra[o + 1] // G
      crudo[d + 2] = bgra[o] // B
      crudo[d + 3] = bgra[o + 3] // A
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------- ICO ---------------- */

/** Empaqueta un lienzo BGRA como imagen DIB de icono (cabecera + XOR + máscara AND). */
function dib(bgra, s) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(s, 4)
  header.writeInt32LE(s * 2, 8) // alto doble: XOR + AND
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(s * s * 4, 20)

  // El DIB va de abajo arriba
  const xor = Buffer.alloc(s * s * 4)
  for (let y = 0; y < s; y++) {
    bgra.copy(xor, y * s * 4, (s - 1 - y) * s * 4, (s - y) * s * 4)
  }
  // Máscara AND a cero: la transparencia real la da el canal alfa
  const maskRow = Math.ceil(s / 32) * 4
  return Buffer.concat([header, xor, Buffer.alloc(maskRow * s)])
}

function escribirIco(destino) {
  const images = SIZES.map((s) => ({ s, data: dib(render(s), s) }))
  const dir = Buffer.alloc(6 + images.length * 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2) // tipo icono
  dir.writeUInt16LE(images.length, 4)

  let offset = dir.length
  images.forEach((img, n) => {
    const e = 6 + n * 16
    dir.writeUInt8(img.s >= 256 ? 0 : img.s, e) // 0 significa 256
    dir.writeUInt8(img.s >= 256 ? 0 : img.s, e + 1)
    dir.writeUInt8(0, e + 2)
    dir.writeUInt8(0, e + 3)
    dir.writeUInt16LE(1, e + 4)
    dir.writeUInt16LE(32, e + 6)
    dir.writeUInt32LE(img.data.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += img.data.length
  })

  writeFileSync(destino, Buffer.concat([dir, ...images.map((i) => i.data)]))
  return offset
}

/* ---------------- Salidas ---------------- */

const generados = []
const relativo = (ruta) => ruta.replace(RAIZ + '\\', '').replace(RAIZ + '/', '')
const escribirPng = (ruta, s, opciones) => {
  mkdirSync(dirname(ruta), { recursive: true })
  const datos = png(render(s, opciones), s)
  writeFileSync(ruta, datos)
  generados.push([relativo(ruta), s, datos.length])
}

mkdirSync(OUT, { recursive: true })
const bytesIco = escribirIco(join(OUT, 'gimnasio.ico'))
generados.push(['assets/gimnasio.ico', SIZES.join('/'), bytesIco])

// Origen de todo lo demas y ficha de Play Store.
escribirPng(join(OUT, 'icono-1024.png'), 1024)

// electron-builder arma el paquete .deb a partir de una carpeta de PNG con el
// tamano por nombre.
for (const s of [512, 256, 128, 64]) escribirPng(join(OUT, 'linux', `${s}x${s}.png`), s)

// public/ lo copia Vite tal cual a dist/, asi que es donde tienen que estar los
// iconos a los que apunta el manifiesto web.
const PUBLICO = join(RAIZ, 'public')
for (const s of [512, 192]) escribirPng(join(PUBLICO, `icono-${s}.png`), s)

// Mipmaps del lanzador de Android. Solo si ya existe el proyecto nativo: este
// script tambien se usa antes de crearlo.
const RES = join(RAIZ, 'android', 'app', 'src', 'main', 'res')
if (existsSync(RES)) {
  // Densidades de Android para el icono clasico (48 dp).
  const densidades = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [d, s] of Object.entries(densidades)) {
    escribirPng(join(RES, `mipmap-${d}`, 'ic_launcher.png'), s)
    escribirPng(join(RES, `mipmap-${d}`, 'ic_launcher_round.png'), s, { forma: 'circulo' })
    // La capa frontal del icono adaptativo se dibuja sobre un lienzo 108 dp del
    // que el sistema puede recortar hasta el borde: el trazo va al 55 % para que
    // no lo corte ningun fabricante.
    escribirPng(join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'), Math.round(s * 2.25), {
      forma: 'ninguna',
      escala: 0.55,
    })
  }

  // Pantallas de arranque. Capacitor las deja con su propio logotipo sobre
  // blanco: destella en blanco antes de pintar la app oscura, y muestra la marca
  // de otro. Se regenera cada una con el tamano exacto que ya tenia, leido de su
  // propia cabecera, para no tener que adivinar las medidas de cada densidad.
  const splashes = readdirSync(RES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('drawable'))
    .map((e) => join(RES, e.name, 'splash.png'))
    .filter(existsSync)

  for (const ruta of splashes) {
    const cabecera = readFileSync(ruta)
    const w = cabecera.readUInt32BE(16)
    const h = cabecera.readUInt32BE(20)
    const datos = png(renderLienzo(w, h, Math.min(w, h) * 0.28), w, h)
    writeFileSync(ruta, datos)
    generados.push([relativo(ruta), `${w}x${h}`, datos.length])
  }
} else {
  console.log('  (sin proyecto android/: los mipmaps se generaran cuando exista)')
}

for (const [ruta, tam, bytes] of generados) {
  console.log(`  ${ruta.padEnd(52)} ${String(tam).padStart(9)} px  ${(bytes / 1024).toFixed(1)} kB`)
}
