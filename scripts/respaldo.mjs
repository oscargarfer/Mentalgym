/**
 * Respaldo del proyecto.
 *
 * Escrito despues de perder la carpeta entera un 7 de septiembre y recuperarla
 * de la papelera de milagro. El respaldo que habia era del 6 de agosto: treinta
 * y dos dias viejo, sin `.git` y con la mitad del progreso. Habria funcionado
 * -se puede restaurar y arranca- pero habria costado doce commits y veinte
 * fichas de repaso. Un respaldo que se hace a mano se hace una vez.
 *
 * Tres decisiones, y cada una viene de un fallo concreto de aquel archivo:
 *
 * 1. Va FUERA de la carpeta del proyecto, en Documentos. El accidente fue
 *    borrar la carpeta; una copia dentro se habria ido con ella. Y fuera del
 *    Escritorio, que es donde se acumula lo que se borra sin mirar.
 *
 * 2. Incluye `.git`. El archivo de agosto se hizo antes del `git init`, asi que
 *    restaurarlo devolvia los ficheros pero no el historial. Con `.git` dentro,
 *    el tar solo es una recuperacion completa aunque GitHub no exista.
 *
 * 3. Verifica lo que acaba de escribir. Una copia sin restaurar no es una
 *    copia: es un fichero en el que confias sin motivo.
 *
 * No borra respaldos viejos a proposito. Una herramienta de respaldo que
 * ademas borra es una herramienta que puede borrar lo que te quedaba.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(homedir(), 'Documents', 'Respaldos Gimnasio Mental')

/** Lo reproducible no se guarda: se reinstala o se recompila. */
const EXCLUIR = [
  './node_modules', './dist', './release',
  './android/app/build', './android/build', './android/.gradle', './.gradle',
]

/** Sin estas piezas el archivo no sirve de nada, asi que se comprueban una a una. */
const IMPRESCINDIBLES = ['./.git/HEAD', './datos/progreso.json', './package.json', './src', './scripts']

/**
 * En Windows hay dos `tar` y no son intercambiables. El de Git Bash es GNU tar,
 * que interpreta `C:\...` como «servidor C, ruta ...» e intenta resolverlo por
 * red: falla con "Cannot connect to C: resolve failed". El de System32 es
 * bsdtar y entiende las rutas de Windows. Como `npm run` mete Git en el PATH,
 * hay que pedir el de System32 por su ruta completa en lugar de fiarse del
 * nombre y de quien gane en el PATH.
 */
const TAR = (() => {
  if (process.platform !== 'win32') return 'tar'
  const propio = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  return existsSync(propio) ? propio : 'tar'
})()

const hoy = new Date().toISOString().slice(0, 10)
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'

mkdirSync(DESTINO, { recursive: true })

// ---- 1. El archivo ----------------------------------------------------------
const nombre = `Gimnasio Mental - copia ${hoy}.tar.gz`
const final = join(DESTINO, nombre)
// Se escribe a un nombre temporal y se renombra al terminar: si tar falla a
// medias no queda un .tar.gz truncado con pinta de respaldo bueno.
const parcial = final + '.parcial'
if (existsSync(parcial)) rmSync(parcial)

console.log(`\n  Respaldando en ${DESTINO}\n`)
const r = spawnSync(TAR, ['-czf', parcial, ...EXCLUIR.map((e) => `--exclude=${e}`), '-C', RAIZ, '.'], {
  stdio: ['ignore', 'inherit', 'inherit'],
})
if (r.status !== 0) {
  if (existsSync(parcial)) rmSync(parcial)
  console.error('  El archivo no se pudo crear. No se ha tocado nada mas.\n')
  process.exit(1)
}

// ---- 2. Verificarlo ---------------------------------------------------------
const lista = spawnSync(TAR, ['-tzf', parcial], { encoding: 'utf8' })
if (lista.status !== 0) {
  rmSync(parcial)
  console.error('  El archivo se escribio pero no se puede leer. Descartado.\n')
  process.exit(1)
}
// bsdtar termina cada linea con \r\n: sin quitar el \r ningun nombre coincide y
// el archivo bueno se descarta por «faltan piezas». Y las carpetas salen con
// barra final, que tampoco esta en la lista de imprescindibles.
const dentro = new Set(lista.stdout.split(/\r?\n/).map((l) => l.trim().replace(/\/$/, '')))
const faltan = IMPRESCINDIBLES.filter((f) => !dentro.has(f))
if (faltan.length) {
  rmSync(parcial)
  console.error(`  Faltan piezas imprescindibles: ${faltan.join(', ')}. Descartado.\n`)
  process.exit(1)
}
renameSync(parcial, final)
console.log(`  ok   ${nombre}  ${mb(statSync(final).size)}  ·  ${dentro.size} ficheros`)

// ---- 3. El progreso, ademas suelto ------------------------------------------
// Son 100 KB y es lo unico irreemplazable: el codigo se vuelve a escribir, las
// sesiones de entrenamiento no. Suelto se lee sin extraer nada.
const copiaDatos = join(DESTINO, `datos ${hoy}`)
rmSync(copiaDatos, { recursive: true, force: true })
cpSync(join(RAIZ, 'datos'), copiaDatos, { recursive: true })
const p = JSON.parse(readFileSync(join(copiaDatos, 'progreso.json'), 'utf8'))
const d = p.datos || p
console.log(`  ok   datos ${hoy}  ${(d.sessions || []).length} sesiones · ${(d.reviews || []).length} fichas de repaso`)

// ---- 4. Que hay guardado ----------------------------------------------------
const archivos = readdirSync(DESTINO).filter((f) => f.endsWith('.tar.gz')).sort()
const total = archivos.reduce((a, f) => a + statSync(join(DESTINO, f)).size, 0)
console.log(`\n  ${archivos.length} respaldos guardados, ${mb(total)} en total.`)
console.log(`  El mas antiguo: ${archivos[0]}`)

// Lo que este script NO puede proteger, dicho cada vez para que no se olvide.
const git = spawnSync('git', ['rev-list', '--count', 'origin/main..HEAD'], { cwd: RAIZ, encoding: 'utf8' })
const sinSubir = git.status === 0 ? Number(git.stdout.trim()) : null
if (sinSubir) {
  console.log(`\n  AVISO: ${sinSubir} commit(s) sin subir. Esto sigue viviendo en un solo disco.`)
  console.log('         git push origin main')
} else if (sinSubir === 0) {
  console.log('\n  El codigo esta subido a GitHub. Este archivo cubre el progreso.')
}
console.log()
