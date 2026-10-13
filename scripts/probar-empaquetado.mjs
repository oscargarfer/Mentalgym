/**
 * Comprobaciones de las dos piezas del empaquetado que, si fallan, fallan en
 * silencio: la resolución de rutas del esquema `app://` y el guardado del
 * progreso en la app instalada.
 *
 *   node scripts/probar-empaquetado.mjs
 *
 * No necesitan Electron a propósito. La ventana se ve a simple vista; que no se
 * pueda pedir un archivo de fuera de `dist/`, y que una foto en blanco no se
 * lleve por delante el progreso de meses, no.
 */
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolverRuta, tipoMime } from '../electron/rutas.js'
import { leerProgreso, guardarProgreso, rutaProgreso, rutaRespaldo } from '../electron/persistencia.js'

let fallos = 0
const comprobar = (nombre, cierto, detalle = '') => {
  if (cierto) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLA ${nombre}${detalle ? `  → ${detalle}` : ''}`)
  }
}

/* ---------- Rutas del esquema app:// ---------- */

console.log('\nResolución de rutas (esquema app://)\n')

const RAIZ = process.platform === 'win32' ? 'C:\\app\\dist' : '/app/dist'
const dentro = (p) => resolverRuta(RAIZ, p)

comprobar('la raíz sirve index.html', dentro('/')?.endsWith('index.html'))
comprobar('la ruta vacía sirve index.html', dentro('')?.endsWith('index.html'))
comprobar('un directorio sirve index.html', dentro('/assets/')?.endsWith('index.html'))
comprobar('un archivo normal se resuelve', dentro('/assets/index-abc.js')?.endsWith('index-abc.js'))

// El caso que importa: salir de dist/. El navegador normaliza los `..` antes de
// llegar aquí, pero no los que vienen codificados en porcentaje.
const fugas = [
  '/../package.json',
  '/%2e%2e/package.json',
  '/assets/../../package.json',
  '/..%2f..%2fpackage.json',
  '/%2e%2e%2f%2e%2e%2fdatos/progreso.json',
  '/....//package.json',
]
for (const f of fugas) {
  const r = dentro(f)
  comprobar(`bloquea  ${f}`, r === null || r.startsWith(RAIZ), r || 'null')
}

comprobar('un porcentaje mal formado no revienta', dentro('/%ZZ') === null)

comprobar('mime de .js', tipoMime('a/b.js') === 'text/javascript; charset=utf-8')
comprobar('mime de .json', tipoMime('a/b.json') === 'application/json; charset=utf-8')
comprobar('mime desconocido cae en octet-stream', tipoMime('a/b.raro') === 'application/octet-stream')

/* ---------- Progreso en la app instalada ---------- */

console.log('\nGuardado del progreso (app instalada)\n')

const carpeta = await mkdtemp(join(tmpdir(), 'gimnasio-prueba-'))
const sobre = (datos) => ({ version: 1, guardado: new Date().toISOString(), datos })

const vacioAlPrincipio = await leerProgreso(carpeta)
comprobar('sin archivo devuelve datos nulos', vacioAlPrincipio?.datos === null)

const real = sobre({ sessions: [{ id: 'a' }], pegs: ['seso'], settings: { langId: 'en' } })
comprobar('escribe un progreso real', (await guardarProgreso(carpeta, real)).ok === true)

const leido = await leerProgreso(carpeta)
comprobar('lo escrito se recupera igual', JSON.stringify(leido) === JSON.stringify(real))

// Lo que de verdad se está protegiendo: el navegador pierde su almacenamiento,
// manda una foto en blanco, y el disco no puede hacerle caso.
const rechazo = await guardarProgreso(carpeta, sobre({}))
comprobar('rechaza una foto vacía sobre progreso real', rechazo.ok === false)
const trasRechazo = await leerProgreso(carpeta)
comprobar('el progreso sigue intacto tras el rechazo', trasRechazo.datos?.sessions?.length === 1)

const nulo = await guardarProgreso(carpeta, sobre(null))
comprobar('rechaza también datos nulos', nulo.ok === false)

// Un borrado deliberado sí debe pasar.
const forzado = { ...sobre({}), forzar: true }
comprobar('una foto vacía con `forzar` sí se escribe', (await guardarProgreso(carpeta, forzado)).ok === true)
comprobar('y deja el archivo vacío', Object.keys((await leerProgreso(carpeta)).datos).length === 0)

// El respaldo rodante debe conservar la versión de antes del borrado.
const respaldo = JSON.parse(await readFile(rutaRespaldo(carpeta), 'utf8'))
comprobar('el respaldo guarda la versión anterior', respaldo.datos?.sessions?.length === 1)

// Sobre una carpeta que aún no existe.
const nueva = join(carpeta, 'no', 'existe', 'todavia')
comprobar('crea la carpeta si hace falta', (await guardarProgreso(nueva, real)).ok === true)
comprobar('y se puede leer de ella', (await leerProgreso(nueva)).datos?.pegs?.length === 1)

// Un archivo corrupto no debe impedir arrancar ni bloquear la siguiente escritura.
await mkdir(join(carpeta, 'roto'), { recursive: true })
await writeFile(rutaProgreso(join(carpeta, 'roto')), '{ esto no es json', 'utf8')
comprobar('un archivo corrupto se lee como vacío', (await leerProgreso(join(carpeta, 'roto'))).datos === null)
comprobar('y se puede escribir encima', (await guardarProgreso(join(carpeta, 'roto'), real)).ok === true)

// Veinte guardados a la vez, como el automático y el de cerrar coincidiendo.
// Antes compartían el .tmp: alguno fallaba con ENOENT, y en la integración
// continua de Windows pasaba siempre.
const simultanea = join(carpeta, 'simultanea')
const lote = await Promise.all(
  Array.from({ length: 20 }, (_, i) => guardarProgreso(simultanea, sobre({ orden: i }))),
)
comprobar('veinte guardados simultáneos salen todos bien', lote.every((r) => r.ok === true),
  lote.filter((r) => !r.ok).map((r) => r.error).join(' | '))
comprobar('y gana el último pedido, no el último en llegar',
  (await leerProgreso(simultanea)).datos?.orden === 19)

console.log(`\n${fallos === 0 ? 'Todo correcto' : `${fallos} comprobaciones han fallado`}\n`)
process.exit(fallos === 0 ? 0 : 1)
