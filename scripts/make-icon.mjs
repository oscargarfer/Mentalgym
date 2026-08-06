/**
 * Genera assets/gimnasio.ico para el acceso directo del escritorio.
 *
 * Dibuja el mismo trazo que el favicon (zigzag cian sobre cuadrado oscuro) a
 * varios tamaños y los empaqueta en un .ico clásico (DIB de 32 bits con canal
 * alfa). Sin librerías: solo aritmética de píxeles y Buffer.
 *
 *   node scripts/make-icon.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
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

/** Lienzo BGRA de s×s con el logotipo. */
function render(s) {
  const buf = new Float64Array(s * s * 4) // transparente de partida
  const k = s / 100 // el trazo está definido en un lienzo de 100×100
  // Zigzag del favicon: M22,70 L38,30 L50,55 L62,30 L78,70
  const pts = [
    [22, 70],
    [38, 30],
    [50, 55],
    [62, 30],
    [78, 70],
  ].map(([x, y]) => [x * k, y * k])
  const stroke = 9 * k * 0.5 // radio del trazo
  const glow = stroke * 2.6

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const i = (y * s + x) * 4

      // Fondo redondeado
      const dBox = distRoundRect(px, py, s / 2, s / 2, s / 2, s / 2, s * 0.22)
      blend(buf, i, BG, clamp01(0.5 - dBox))

      // Distancia mínima al trazo
      let d = Infinity
      for (let n = 0; n < pts.length - 1; n++) {
        const dd = distSeg(px, py, pts[n][0], pts[n][1], pts[n + 1][0], pts[n + 1][1])
        if (dd < d) d = dd
      }
      // Halo suave, recortado al cuadrado
      const inside = clamp01(0.5 - dBox)
      blend(buf, i, CY, clamp01(1 - d / glow) * 0.22 * inside)
      // Trazo con antialiasing
      blend(buf, i, CY, clamp01(stroke + 0.5 - d) * inside)
    }
  }
  return Buffer.from(Uint8Array.from(buf, (v) => Math.round(Math.min(255, Math.max(0, v)))))
}

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

mkdirSync(OUT, { recursive: true })
const file = join(OUT, 'gimnasio.ico')
writeFileSync(file, Buffer.concat([dir, ...images.map((i) => i.data)]))
console.log(`${file}  ·  ${SIZES.join(', ')} px  ·  ${(offset / 1024).toFixed(1)} kB`)
