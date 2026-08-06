/**
 * Lleva el progreso de la versión de navegador a la app instalada.
 *
 * Las dos guardan lo mismo pero en sitios distintos: el servidor local escribe
 * en `datos/` junto al proyecto, y la app de escritorio en la carpeta de datos
 * del usuario, que es la única que sigue siendo escribible una vez instalada en
 * `Program Files` y la única que sobrevive a desinstalar.
 *
 *   node scripts/migrar-progreso.mjs           copia proyecto → app instalada
 *   node scripts/migrar-progreso.mjs --volver   copia app instalada → proyecto
 *
 * Nunca pisa un archivo con datos sin dejar antes una copia al lado.
 */
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const PROYECTO = join(dirname(fileURLToPath(import.meta.url)), '..')
// Debe coincidir con `productName` de package.json: es el nombre de carpeta que
// Electron deriva para los datos del usuario.
const NOMBRE = 'Gimnasio Mental'

/** Misma ruta que devuelve `app.getPath('userData')` en cada sistema. */
function carpetaUsuario() {
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), NOMBRE)
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', NOMBRE)
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), NOMBRE)
}

const origenProyecto = join(PROYECTO, 'datos', 'progreso.json')
const origenApp = join(carpetaUsuario(), 'datos', 'progreso.json')

const volver = process.argv.includes('--volver')
const origen = volver ? origenApp : origenProyecto
const destino = volver ? origenProyecto : origenApp

/** Resumen legible de lo que hay dentro, para que se vea qué se está moviendo. */
function describir(sobre) {
  const d = sobre?.datos
  if (!d) return 'sin datos'
  const n = (k) => (Array.isArray(d[k]) ? d[k].length : 0)
  return `${n('sessions')} sesiones · ${n('reviews')} fichas de repaso · ${n('palaces')} palacios · guardado ${sobre.guardado || '?'}`
}

let entrante
try {
  entrante = JSON.parse(await readFile(origen, 'utf8'))
} catch {
  console.error(`\n  No hay nada que copiar en:\n  ${origen}\n`)
  process.exit(1)
}

if (!entrante?.datos || !Object.keys(entrante.datos).length) {
  console.error('\n  El archivo de origen está vacío. No se copia nada.\n')
  process.exit(1)
}

// Si el destino ya tiene progreso, se guarda tal cual antes de pisarlo.
try {
  await stat(destino)
  const previo = JSON.parse(await readFile(destino, 'utf8'))
  const respaldo = `${destino}.antes-de-migrar`
  await copyFile(destino, respaldo)
  console.log(`\n  El destino ya tenía progreso (${describir(previo)}).`)
  console.log(`  Copia guardada en:\n  ${respaldo}`)
} catch {
  /* destino limpio */
}

await mkdir(dirname(destino), { recursive: true })
await writeFile(destino, JSON.stringify(entrante, null, 2), 'utf8')

console.log(`\n  Copiado: ${describir(entrante)}`)
console.log(`  de : ${origen}`)
console.log(`  a  : ${destino}\n`)
