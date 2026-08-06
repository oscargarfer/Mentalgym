/**
 * Punto de entrada del acceso directo del escritorio.
 *
 * 1. Comprueba si dist/ está al día comparando fechas con src/ e index.html.
 * 2. Reconstruye solo si hace falta (la primera vez, o tras editar vocabulario).
 * 3. Levanta el servidor local y abre el navegador.
 *
 * Así el arranque normal es instantáneo y no hay que acordarse de compilar nada.
 */
import { readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/** Fecha de modificación más reciente de un árbol de ficheros. */
async function newest(path) {
  let max = 0
  const walk = async (p) => {
    let info
    try {
      info = await stat(p)
    } catch {
      return
    }
    if (info.isDirectory()) {
      for (const name of await readdir(p)) await walk(join(p, name))
    } else if (info.mtimeMs > max) {
      max = info.mtimeMs
    }
  }
  await walk(path)
  return max
}

async function mtime(p) {
  try {
    return (await stat(p)).mtimeMs
  } catch {
    return 0
  }
}

const built = await mtime(join(ROOT, 'dist', 'index.html'))
const source = Math.max(
  await newest(join(ROOT, 'src')),
  await mtime(join(ROOT, 'index.html')),
  await mtime(join(ROOT, 'vite.config.js')),
)

if (built === 0 || source > built) {
  console.log(built === 0 ? '  Primera compilación...\n' : '  Hay cambios: recompilando...\n')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const r = spawnSync(npm, ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error('\n  La compilación ha fallado. Revisa el error de arriba.')
    process.exit(r.status || 1)
  }
}

// Se importa en vez de lanzarse aparte: así queda un único proceso de Node vivo
// (el servidor) en lugar de un padre esperando eternamente a su hijo.
await import('./serve.mjs')
