import { useState } from 'react'
import {
  BookOpen, Zap, Layers, Eye, Keyboard, Gauge, TriangleAlert, CalendarClock, Hash, Landmark,
  Play, Target, Brain, Lightbulb, ListChecks, Rocket,
} from 'lucide-react'
import { Panel, SectionTitle, Kbd, Badge, cx } from '../components/ui.jsx'

/* ------------------------------------------------------------------ */
/*  Los cuatro movimientos: el gesto mental que se repite en todo      */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: '01',
    title: 'Palabra puente',
    text: 'Al ver la palabra extranjera, busca de inmediato una palabra en español que SUENE parecido, aunque el significado no tenga nada que ver. No la escribas ni la razones: la primera que aparezca es la buena.',
  },
  {
    n: '02',
    title: 'Imagen mental',
    text: 'Une la palabra puente con el significado real en una sola escena. Debe ser absurda, exagerada, con movimiento y, si puede ser, con sensación física. Lo neutro se olvida; lo ridículo se queda.',
  },
  {
    n: '03',
    title: 'Enganche instantáneo',
    text: 'En cuanto veas la escena con claridad, avanza. No repitas, no revises, no vuelvas atrás. La repetición es el sustituto lento de una imagen bien hecha.',
  },
  {
    n: '04',
    title: 'Evocación a ciegas',
    text: 'En el test, no busques la traducción: busca la escena. La imagen te devuelve la palabra puente y la puente te devuelve el significado. Si no aparece nada, la imagen era débil, no tu memoria.',
  },
]

const RECETA = [
  ['Exagera el tamaño', 'un martillo del tamaño de un coche, no un martillo normal'],
  ['Ponlo en movimiento', 'algo tiene que pasar: choca, revienta, se cae, sale disparado'],
  ['Añade sensación', 'que salpique, que pinche, que huela, que suene'],
  ['Una sola escena', 'si necesitas dos escenas, la imagen es mala; rehazla'],
  ['Ridícula, no lógica', 'lo coherente se confunde con todo lo demás; lo imposible es único'],
]

/* ------------------------------------------------------------------ */
/*  Guía de cada ejercicio                                             */
/* ------------------------------------------------------------------ */

const EJERCICIOS = [
  {
    tecla: '2',
    cap: 'aso',
    nombre: 'Calentamiento de asociación flash',
    icono: Zap,
    color: 'text-vi',
    capacidad: 'ASOCIACIÓN',
    queEs:
      'Fabricar imágenes mentales que unan dos cosas sin relación, y hacerlo rápido. Es el motor de todo lo demás: si aquí eres lento, todo lo que venga después irá lento.',
    porque:
      'Memorizar no es repetir, es enganchar. Un dato aislado se evapora en segundos; un dato metido en una escena absurda resiste años. Este módulo entrena el gesto de fabricar esa escena hasta que salga solo.',
    pasos: [
      'Elige el número de parejas (empieza por 20) y deja el material en «Sustantivos aleatorios».',
      'Pulsa ENTER. Tras la cuenta atrás aparecen dos palabras sin relación entre sí.',
      'Fabrica UNA escena que las una, siguiendo la receta de la imagen (exagerar, mover, sentir).',
      'En cuanto VEAS la escena con claridad, pulsa ESPACIO. No la repases: el cronómetro mide justo eso.',
      'Las rondas encadenan sin pausa. Al terminar, un mini-test te da una de las dos palabras y escribes la otra.',
    ],
    ejemplo: {
      par: 'martillo + sandía',
      imagen:
        'Un martillo gigante cae del cielo y revienta una sandía; el zumo pegajoso te salpica toda la cara y notas las pepitas en la piel.',
    },
    metrica: 'ms por imagen mental · % de evocación real',
    objetivo: 'Bajar de 1500 ms manteniendo la evocación por encima del 80 %.',
    error:
      'Pulsar rápido sin haber creado nada. La app lo detecta sola: la reacción baja y la evocación se hunde. Si tu tiempo mejora pero el mini-test empeora, estás entrenando el dedo, no la memoria.',
  },
  {
    tecla: '3',
    cap: 'aso',
    nombre: 'Memorización masiva',
    icono: Layers,
    color: 'text-cy',
    capacidad: 'CODIFICACIÓN',
    queEs:
      'Meter un lote entero de vocabulario extranjero en la cabeza contra reloj, y comprobar inmediatamente cuánto entró.',
    porque:
      'Es la aplicación práctica de la asociación: aquí el material ya no son palabras al azar, es el idioma que quieres aprender. La app te da la palabra extranjera y su significado real, pero NUNCA la palabra puente ni la imagen: si te las diera, estarías memorizando la asociación de otro y no agarraría.',
    pasos: [
      'Elige tamaño de lote (empieza por 20), formato «Una a una» y dirección de test.',
      'ENTER. Aparece la palabra extranjera arriba y su significado en español debajo.',
      'Busca la PALABRA PUENTE: una palabra española que suene parecido a la extranjera.',
      'Une la puente con el significado real en una imagen. Esa imagen es lo que vas a recordar.',
      'ESPACIO para avanzar. Si te pasas, ← vuelve atrás (el reloj sigue corriendo).',
      'Al acabar el lote se para el cronómetro. ENTER empieza el test: las palabras salen en orden aleatorio y escribes su significado.',
    ],
    ejemplo: {
      par: 'house = casa',
      imagen:
        '«house» suena a HOZ. Una hoz gigante siega el tejado de una casa y las tejas salen volando. Al ver «house» aparece la hoz, y la hoz trae la casa.',
    },
    metrica: 'VRN = palabras correctas ÷ minutos de carga',
    objetivo:
      'Al principio NO persigas el VRN. Persigue la retención a 24 h del módulo de repaso: un VRN alto con retención baja significa que cargas más rápido de lo que fijas.',
    error:
      'Repetir la palabra mentalmente («house-casa, house-casa») en vez de crear una imagen. Cuesta más y funciona peor. Si al llegar al test no aparece ninguna escena, es que no la creaste.',
    nota: 'La dirección ES → idioma es bastante más dura: no basta reconocer, hay que producir. Déjala para cuando la directa te salga cómoda.',
  },
  {
    tecla: '4',
    cap: 'ret',
    nombre: 'Repaso espaciado',
    icono: CalendarClock,
    color: 'text-gr',
    capacidad: 'RETENTIVA',
    queEs:
      'Volver a preguntarte lo que memorizaste, cada vez más tarde, para que pase de la memoria de trabajo a la de largo plazo.',
    porque:
      'Es la diferencia entre saber algo hoy y saberlo dentro de un mes. El test del módulo 3 ocurre segundos después de memorizar: eso mide cuánto ENTRA. Este mide cuánto QUEDA, que es lo único que cuenta para aprender un idioma de verdad.',
    pasos: [
      'Entra aquí LO PRIMERO cada día, antes de memorizar nada nuevo.',
      'Si hay palabras vencidas, ENTER y empieza. Te muestra la palabra extranjera y escribes el significado.',
      'No busques la traducción: busca la escena que fabricaste. Si no aparece, la imagen era floja.',
      'Ya está. No hay que configurar nada: las palabras entran solas cuando terminas un bloque del módulo 3.',
    ],
    calendario: ['24 h', '3 días', '7 días', '21 días', '60 días', '180 días'],
    metrica: 'Retención a 24 h = % de aciertos en el PRIMER repaso de cada palabra',
    objetivo:
      'Por encima del 80 %. Entre 60 y 80, tus imágenes son flojas: exagera más. Por debajo del 60 %, reduce el tamaño del lote antes de tocar nada más.',
    error:
      'Dejarlo para el final del entrenamiento y saltártelo. La deuda se acumula y un día te encuentras con 300 palabras pendientes. El contador ámbar de la barra lateral está para que no pase.',
    nota: 'Un fallo devuelve la palabra al principio del calendario. No es un castigo: es que si la has olvidado, necesita volver a empezar.',
  },
  {
    tecla: '5',
    cap: 'pro',
    nombre: 'Taquistoscopio (RSVP)',
    icono: Eye,
    color: 'text-am',
    capacidad: 'PROCESAMIENTO VISUAL',
    queEs:
      'Ráfagas de palabras que aparecen y desaparecen solas en un punto fijo, para leer sin pronunciar mentalmente.',
    porque:
      'Si tu voz interior pronuncia cada palabra, tu lectura queda anclada al ritmo del habla y nunca pasarás de unas 250 palabras por minuto. Aquí las palabras van más rápido de lo que puedes pronunciar, así que el cerebro no tiene más remedio que captarlas de golpe.',
    pasos: [
      'Empieza en 350 PPM con ráfagas de 25 palabras. No empieces en 900: no sirve de nada.',
      'ENTER y FIJA la vista en el centro de la pantalla. La letra roja marca el punto exacto donde mirar.',
      'No muevas los ojos. Las palabras vienen a ti, tú no vas a ellas.',
      'No pronuncies. Si te oyes por dentro, afloja la mandíbula y deja que la palabra entre como una imagen.',
      'Al acabar la ráfaga hay dos comprobaciones: «¿apareció esta palabra?». Responde S o N.',
    ],
    metrica: 'PPM validado',
    objetivo:
      'Solo subes 25 PPM si aciertas LAS DOS comprobaciones. Si fallas dos ráfagas seguidas al mismo ritmo, baja un escalón: velocidad sin captura no es lectura, es pasar diapositivas.',
    error:
      'Mover los ojos para «leer» la palabra entera. Para eso está la letra roja: es el punto donde el ojo se posa de forma natural, y si te quedas ahí la palabra entra completa por visión periférica.',
    nota: 'Las comprobaciones siempre son una que sí apareció y otra que no. Responder siempre lo mismo no te va a colar.',
  },
  {
    tecla: '6',
    cap: 'aso',
    nombre: 'Números y casillero',
    icono: Hash,
    color: 'text-vi',
    capacidad: 'CONVERSIÓN DE LO ABSTRACTO',
    queEs:
      'Un sistema para convertir cifras en objetos concretos, y ejercicios para automatizarlo y aplicarlo.',
    porque:
      'Un número no se puede visualizar, y lo que no se visualiza no se asocia. La salida es fijar una consonante por dígito y dejar las vocales libres: cada par de cifras se convierte en una palabra concreta, y a partir de ahí un número se memoriza como cualquier otra imagen.',
    pasos: [
      'PRIMERO: ejercicio «Conversión», hasta bajar de 1 segundo por casilla. Puede llevarte una semana y es la parte aburrida, pero sin esto lo demás va a paso de tortuga.',
      'DESPUÉS: «Decimal» con 10 pares. Conviertes cada par en su palabra y encadenas las palabras en una historia (o las colocas en un palacio).',
      'La evocación es EN ORDEN: escribes la serie entera seguida.',
      'Cuando la serie decimal te salga, pasa a «Binario» (tríos de 0 y 1 que dan un dígito) y a «Baraja».',
      'Puedes activar la muleta «Mostrar la palabra» las primeras veces, pero quítala pronto o no automatizarás la tabla.',
    ],
    ejemplo: {
      par: '07 → «saco»',
      imagen:
        '0 es la ese de ceRO, 7 es la ka. S + C = saco. Si la serie empieza por 07 14, tienes «saco» y «toro»: un toro embiste un saco enorme y lo revienta.',
    },
    metrica: 'ms por conversión · secuencia intacta · cifras por minuto',
    objetivo:
      'Conversión por debajo de 1000 ms. En series, lo que cuenta es la SECUENCIA INTACTA: si rompes por el medio, un número de teléfono ya no sirve.',
    error:
      'Saltar a las series antes de tener el casillero automático. Si tienes que pensar qué palabra es el 43, no te queda cabeza para la historia.',
    nota: 'Las 100 palabras son editables en Ajustes (tecla 9). Cámbialas por las que TE evoquen algo: un casillero ajeno funciona mal.',
  },
  {
    tecla: '7',
    cap: 'ord',
    nombre: 'Palacio de la memoria',
    icono: Landmark,
    color: 'text-vi',
    capacidad: 'ALMACENAMIENTO ORDENADO',
    queEs:
      'Un recorrido por un sitio que conoces de memoria, donde vas dejando datos en puntos fijos para recuperarlos después en orden.',
    porque:
      'Todos los demás módulos evocan en desorden. Pero muchas cosas solo valen en secuencia: un número de teléfono, los pasos de un procedimiento, una lista de argumentos. Recuperar en orden es una destreza distinta y más dura, y esta es la única forma de entrenarla.',
    pasos: [
      'CONSTRUIR: pulsa «Nuevo» y escribe un punto por línea, en el orden exacto en que los recorres. Usa un sitio que conozcas de memoria: tu casa, el camino al trabajo.',
      'Los puntos tienen que ser distintos entre sí y estar separados: puerta, perchero, espejo, sofá, televisor… Entre 10 y 20 está bien para empezar.',
      'ENTRENAR: elige qué colocar (objetos, vocabulario, números) y cuántos puntos usar.',
      'Recorres el palacio: en cada punto aparece un objeto. Haz que el objeto INTERACTÚE con el sitio, no que esté ahí puesto.',
      'Evocación: te dan el punto y escribes lo que había. En «Inverso» te lo preguntan del final al principio.',
    ],
    ejemplo: {
      par: 'perchero + cebolla',
      imagen:
        'No vale «hay una cebolla en el perchero». Vale: una cebolla gigante colgada del perchero que gotea y te hace llorar los ojos al pasar. El objeto tiene que hacerle algo al sitio.',
    },
    metrica: 'Secuencia intacta (puntos correctos antes del primer fallo)',
    objetivo:
      'Recorrido directo perfecto primero. Después, el mismo palacio en INVERSO: esa es la prueba de fuego.',
    error:
      'Encadenar cada objeto con el anterior en vez de anclarlo a su sitio. Funciona en directo y se derrumba en inverso: por eso está el recorrido inverso.',
    nota: 'Usa siempre el mismo recorrido y en el mismo sentido. Un palacio que cambia no es un palacio.',
  },
]

const PRIMER_DIA = [
  ['1', 'Ve a Ajustes (tecla 9) y elige tu idioma objetivo.', 'Si vas a aprender inglés, déjalo en inglés. Lo puedes cambiar cuando quieras.'],
  ['2', 'Calentamiento (tecla 2): un bloque de 20 parejas.', 'Sin prisa. Hoy solo quieres pillarle el gesto a fabricar imágenes. Mira tu tiempo medio al final: será tu punto de partida.'],
  ['3', 'Memorización (tecla 3): un lote de 20 palabras.', 'Veinte, no cincuenta. El objetivo de hoy no es el récord, es que mañana te acuerdes.'],
  ['4', 'Taquistoscopio (tecla 5): dos ráfagas a 350 PPM.', 'Si validas las dos, sube a 375 y déjalo ahí para mañana.'],
  ['5', 'Números (tecla 6): «Conversión», 20 casillas.', 'Vas a fallar muchas. Es normal: la tabla se aprende con repetición, y esta es la única parte del método donde repetir es lo correcto.'],
  ['6', 'MAÑANA: entra en Repaso (tecla 4) antes que nada.', 'Ahí verás tu primera cifra de retención a 24 h. Ese número es tu línea base real.'],
]

const CAPACIDADES = [
  ['Asociación', 'Módulo 2', 'Crear la imagen que une dos cosas', 'text-vi'],
  ['Codificación', 'Módulo 3', 'Meter grandes cantidades en poco tiempo', 'text-cy'],
  ['Retentiva', 'Módulo 4', 'Que siga ahí dentro de un mes', 'text-gr'],
  ['Procesamiento visual', 'Módulo 5', 'Captar sin pronunciar por dentro', 'text-am'],
  ['Abstracción', 'Módulo 6', 'Convertir cifras en objetos', 'text-vi'],
  ['Orden', 'Módulo 7', 'Recuperar en secuencia', 'text-vi'],
]

const SHORTCUTS = [
  { keys: ['1'], desc: 'Dashboard de métricas' },
  { keys: ['2'], desc: 'Calentamiento de asociación flash' },
  { keys: ['3'], desc: 'Memorización masiva' },
  { keys: ['4'], desc: 'Repaso espaciado' },
  { keys: ['5'], desc: 'Taquistoscopio / RSVP' },
  { keys: ['6'], desc: 'Números y casillero' },
  { keys: ['7'], desc: 'Palacio de la memoria' },
  { keys: ['8'], desc: 'Esta guía' },
  { keys: ['9'], desc: 'Ajustes: idioma, mazos, casillero, repaso, datos' },
  { keys: ['ENTER'], desc: 'Iniciar bloque / confirmar respuesta' },
  { keys: ['ESPACIO'], desc: 'Enganchar asociación / avanzar tarjeta / anclar celda / avanzar punto' },
  { keys: ['←', '→'], desc: 'Retroceder y avanzar durante la carga' },
  { keys: ['↑', '↓'], desc: 'Navegar rejilla · ajustar PPM en el taquistoscopio' },
  { keys: ['S', 'N'], desc: 'Responder SÍ / NO en la comprobación flash' },
  { keys: ['R'], desc: 'Repetir el bloque tras el resultado' },
  { keys: ['N'], desc: 'Lote nuevo tras un bloque de memorización' },
  { keys: ['+'], desc: 'Subir de nivel PPM tras validar la ráfaga' },
  { keys: ['ESC'], desc: 'Abortar el bloque en curso' },
]

const PROTOCOL = [
  { t: '2 min', m: 'Repaso', d: 'Lo primero, siempre: despacha lo que vence hoy. La deuda de repaso se paga antes de cargar nada nuevo.' },
  { t: '3 min', m: 'Calentamiento', d: '20 parejas hasta bajar de 1500 ms de media. Es el estiramiento antes de levantar peso.' },
  { t: '12 min', m: 'Memorización', d: 'Un lote del idioma objetivo + test completo. Sube de 20 a 50 solo cuando la retención aguante por encima del 80 %.' },
  { t: '4 min', m: 'Taquistoscopio', d: 'Dos ráfagas al PPM actual; si validas ambas, sube 25 PPM.' },
  { t: '4 min', m: 'Números', d: 'Conversión hasta bajar de 1 s, o una serie decimal si ya lo tienes automático.' },
  { t: '5 min', m: 'Palacio', d: 'Un recorrido de 10 puntos. Un día por semana, hazlo en inverso.' },
  { t: '1 min', m: 'Dashboard', d: 'Mira la retención a 24 h. Si baja del 60 %, reduce el lote antes que subir velocidad.' },
]

const PESTANAS = [
  { id: 'inicio', label: 'Empieza aquí', icon: Rocket },
  { id: 'ejercicios', label: 'Las 4 capacidades', icon: ListChecks },
  { id: 'protocolo', label: 'Sesión diaria', icon: BookOpen },
  { id: 'teclas', label: 'Teclas', icon: Keyboard },
]

/* ------------------------------------------------------------------ */

export default function Method() {
  const [tab, setTab] = useState('inicio')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
          Manual de <span className="text-cy">entrenamiento</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
          Todo lo que necesitas para entrenar solo. Si es tu primer día, empieza por la primera
          pestaña y sigue los seis pasos.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-xs font-bold tracking-wide transition-all active:scale-95',
                tab === p.id
                  ? 'border-cy/70 bg-cy/12 text-cy glow-cy'
                  : 'border-line text-mute hover:border-ink-3 hover:text-ink-2',
              )}
            >
              <p.icon size={13} />
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'inicio' && <Inicio />}
          {tab === 'ejercicios' && <Ejercicios />}
          {tab === 'protocolo' && <Protocolo />}
          {tab === 'teclas' && <Teclas />}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Empieza aquí ---------------- */

function Inicio() {
  return (
    <>
      <Panel>
        <SectionTitle icon={Brain}>Qué es esto y qué no</SectionTitle>
        <p className="text-[13px] leading-relaxed text-mute">
          Un gimnasio, no un curso. No te enseña inglés: te entrena la maquinaria con la que se
          aprende cualquier cosa, y usa vocabulario extranjero como peso con el que levantar.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-mute">
          La aplicación <b className="text-ink">nunca</b> te da resuelta la palabra puente ni
          la imagen mental. Solo te muestra la palabra extranjera y su significado real, te
          cronometra y te dice cuántas sobrevivieron. Si te diera las asociaciones hechas estarías
          memorizando las de otro, y esas no agarran. El trabajo mental es tuyo; el de medirlo sin
          piedad es suyo.
        </p>
      </Panel>

      <Panel className="mt-3">
        <SectionTitle icon={Rocket} right={<Badge tone="gr">20 MIN</Badge>}>
          Tu primer día, paso a paso
        </SectionTitle>
        <div className="space-y-2">
          {PRIMER_DIA.map(([n, titulo, detalle]) => (
            <div key={n} className="flex gap-3 rounded-xl border border-line-soft p-3">
              <span className="font-mono text-lg font-bold text-ink-4">{n}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{titulo}</div>
                <p className="mt-1 text-xs leading-relaxed text-mute">{detalle}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <Panel key={s.n}>
            <div className="flex items-start gap-3">
              <span className="font-mono text-2xl font-bold text-ink-4">{s.n}</span>
              <div>
                <div className="font-mono text-sm font-bold tracking-wide text-ink">
                  {s.title}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{s.text}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-3">
        <SectionTitle icon={Lightbulb}>Receta de una imagen que aguanta</SectionTitle>
        <div className="space-y-1.5">
          {RECETA.map(([regla, ejemplo]) => (
            <div key={regla} className="flex flex-wrap items-baseline gap-2 rounded-lg border border-line-soft px-3 py-2">
              <span className="font-mono text-xs font-bold text-cy">{regla}</span>
              <span className="text-xs text-mute">— {ejemplo}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-3">
        <SectionTitle icon={Target}>Qué capacidad entrena cada módulo</SectionTitle>
        <div className="space-y-1.5">
          {CAPACIDADES.map(([cap, mod, desc, color]) => (
            <div key={cap} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft px-3 py-2">
              <span className={cx('w-44 shrink-0 font-mono text-xs font-bold', color)}>{cap}</span>
              <Badge tone="mute">{mod}</Badge>
              <span className="min-w-0 flex-1 text-[13px] text-ink-3">{desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Las seis se sostienen unas a otras. La asociación es el motor; la retentiva es el
          depósito. Un motor potente sin depósito te lleva rápido a ninguna parte.
        </p>
      </Panel>
    </>
  )
}

/* ---------------- Los ejercicios ---------------- */

/**
 * El marco de la aplicación. No se entrenan seis ejercicios sueltos: se
 * entrenan cuatro facultades, y cada una tiene sus caminos.
 *
 * Cada capacidad lleva lo que dice la evidencia, no lo que vendería mejor. La
 * mnemotecnia tiene respaldo serio; la lectura rápida, mucho menos, y eso hay
 * que decirlo en la propia guía y no en la letra pequeña.
 */
const MARCO = [
  {
    id: 'aso',
    n: '01',
    nombre: 'Asociar',
    tinta: 'text-aso',
    fondo: 'bg-aso',
    que: 'Convertir algo abstracto en una imagen que puedas ver.',
    porque:
      'Es la capacidad madre: sin imagen no hay nada que guardar. Un dato suelto se evapora en segundos; metido en una escena absurda resiste años. Todo lo demás se apoya aquí.',
    evidencia:
      'Es la parte con mejor respaldo. Seis semanas de entrenamiento mnemotécnico reorganizan la red funcional del cerebro hacia el patrón de los atletas de memoria, y la mejora se sigue midiendo cuatro meses después.',
  },
  {
    id: 'ord',
    n: '02',
    nombre: 'Ordenar',
    tinta: 'text-ord',
    fondo: 'bg-ord',
    que: 'Evocar en secuencia, no en montón.',
    porque:
      'Recordar veinte cosas sueltas y recordarlas en orden son destrezas distintas. La segunda es más dura y es la que permite discursos, listas y procedimientos enteros sin apuntar nada.',
    evidencia:
      'El palacio de la memoria es justo la técnica que se midió en los estudios de arriba: no es folclore, es el método que usan quienes compiten.',
  },
  {
    id: 'ret',
    n: '03',
    nombre: 'Retener',
    tinta: 'text-ret',
    fondo: 'bg-ret',
    que: 'Que lo memorizado siga ahí dentro de un mes.',
    porque:
      'Acertar treinta segundos después no prueba nada. Sin repaso, todo lo cargado se evapora, y la velocidad de carga se vuelve un número vacío.',
    evidencia:
      'De diez técnicas de estudio evaluadas sobre 242 estudios, solo dos salieron con utilidad alta: recuperar de memoria y espaciar los repasos. Esta capacidad son las dos a la vez.',
  },
  {
    id: 'pro',
    n: '04',
    nombre: 'Procesar',
    tinta: 'text-pro',
    fondo: 'bg-pro',
    que: 'Reconocer antes lo que ya conoces.',
    porque:
      'Cuanto menos tarda tu vista en identificar una palabra, más capacidad te queda libre para lo que importa: entenderla y asociarla.',
    evidencia:
      'Aquí conviene ser honesto: la investigación sobre lectura rápida es tozuda. Existe un intercambio real entre velocidad y comprensión, y presentar palabra a palabra impide volver atrás, que es justo lo que hace falta para entender. Esto entrena el reconocimiento visual y quita el hábito de subvocalizar; no te va a hacer leer el triple entendiendo igual, y quien te diga lo contrario te está vendiendo algo.',
  },
]

function Ejercicios() {
  return (
    <div className="space-y-8">
      {MARCO.map((c) => (
        <section key={c.id}>
          <header className="border-t-2 border-ink pt-3">
            <div className="flex items-baseline gap-2.5">
              <span className="num text-[11px] text-ink-3">CAPACIDAD {c.n}</span>
              <span className={cx('inline-block h-[9px] w-[9px]', c.fondo)} />
            </div>
            <h3 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-[-0.015em] text-ink">
              {c.nombre}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink">{c.que}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{c.porque}</p>
            <p className="mt-2.5 border-l-2 border-rule pl-3 text-[12.5px] leading-relaxed text-ink-3">
              {c.evidencia}
            </p>
          </header>

          <div className="mt-4 space-y-4">
      {EJERCICIOS.filter((e) => e.cap === c.id).map((e) => (
        <Panel key={e.tecla}>
          <div className="mb-4 flex flex-wrap items-baseline gap-2.5">
            <Kbd>{e.tecla}</Kbd>
            <span className="font-serif text-[17px] font-semibold text-ink">{e.nombre}</span>
          </div>

          <p className="text-[13px] leading-relaxed text-ink-2">{e.queEs}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-mute">{e.porque}</p>

          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              Cómo se hace
            </p>
            <ol className="space-y-1.5">
              {e.pasos.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                  <span className="mt-0.5 font-mono text-[11px] font-bold text-cy/60">{i + 1}.</span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ol>
          </div>

          {e.calendario && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                Cada palabra vuelve a
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {e.calendario.map((c, i) => (
                  <span key={c} className="flex items-center gap-1.5">
                    <Badge tone="gr">{c}</Badge>
                    {i < e.calendario.length - 1 && <span className="text-line">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {e.ejemplo && (
            <div className="mt-4 border-l-2 border-aso bg-surface-2 p-3">
              <p className="rotulo mb-1.5 flex items-center gap-1.5">
                <Lightbulb size={11} /> Ejemplo · {e.ejemplo.par}
              </p>
              <p className="text-[13px] leading-relaxed text-ink-2">{e.ejemplo.imagen}</p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border-t border-rule pt-2.5">
              <p className="rotulo mb-1.5 flex items-center gap-1.5">
                <Gauge size={11} /> Qué se mide
              </p>
              <p className="num text-[13px] text-ink">{e.metrica}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{e.objetivo}</p>
            </div>
            <div className="border-t-2 border-pro pt-2.5">
              <p className="rotulo mb-1.5 flex items-center gap-1.5">
                <TriangleAlert size={11} /> Error típico
              </p>
              <p className="text-[12.5px] leading-relaxed text-ink-2">{e.error}</p>
            </div>
          </div>

          {e.nota && (
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
              <Play size={11} className="mt-0.5 shrink-0" />
              {e.nota}
            </p>
          )}
        </Panel>
      ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/* ---------------- Sesión diaria ---------------- */

function Protocolo() {
  return (
    <>
      <Panel>
        <SectionTitle icon={BookOpen} right={<Badge tone="gr">31 MIN</Badge>}>
          Orden de la sesión
        </SectionTitle>
        <div className="space-y-1.5">
          {PROTOCOL.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft px-3 py-2.5">
              <span className="w-14 shrink-0 font-mono text-xs font-bold text-cy">{p.t}</span>
              <Badge tone="mute">{p.m}</Badge>
              <span className="min-w-0 flex-1 text-[13px] text-ink-2">{p.d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Media hora es la sesión completa. Si solo tienes diez minutos, haz el repaso y un lote
          corto de memorización: esos dos son los que construyen. Lo demás es afilar.
        </p>
      </Panel>

      <Panel className="mt-3">
        <SectionTitle icon={TriangleAlert}>Reglas que no conviene saltarse</SectionTitle>
        <div className="space-y-2 text-[13px] leading-relaxed text-mute">
          <p>
            <b className="text-ink">Diez minutos diarios baten a dos horas un domingo.</b> La
            consolidación ocurre mientras duermes, no mientras entrenas. Por eso el repaso va por
            días y no por sesiones.
          </p>
          <p>
            <b className="text-ink">El repaso va primero.</b> Si acumulas deuda, cargar más
            solo empeora el problema.
          </p>
          <p>
            <b className="text-ink">Sube una cosa cada vez.</b> O el tamaño del lote, o los
            PPM, o la longitud del palacio. Nunca las tres a la vez, o no sabrás qué te ha roto.
          </p>
          <p>
            <b className="text-ink">La retención manda sobre la velocidad.</b> Si cae por
            debajo del 60 % dos sesiones seguidas, no subas carga: estás acumulando fatiga, no
            capacidad.
          </p>
          <p>
            <b className="text-ink">Cansado no se memoriza.</b> Una sesión con la cabeza
            fundida ensucia el histórico y no fija nada. Ese día haz solo el repaso.
          </p>
        </div>
      </Panel>

      <Panel className="mt-3">
        <SectionTitle icon={Target}>Cómo saber que estás progresando</SectionTitle>
        <div className="space-y-1.5">
          {[
            ['Semana 1', 'El calentamiento baja de 2000 ms. La tabla del casillero empieza a salir sin pensar.'],
            ['Semana 2-3', 'Retención a 24 h por encima del 70 %. Ya puedes subir el lote de 20 a 35.'],
            ['Mes 1', 'Retención estable sobre 80 %, lotes de 50, taquistoscopio validando 450-500 PPM.'],
            ['Mes 2-3', 'Casillero automático por debajo de 1 s. Palacio de 20 puntos en inverso sin romper la secuencia.'],
          ].map(([cuando, que]) => (
            <div key={cuando} className="flex flex-wrap items-baseline gap-3 rounded-lg border border-line-soft px-3 py-2">
              <span className="w-20 shrink-0 font-mono text-xs font-bold text-gr">{cuando}</span>
              <span className="min-w-0 flex-1 text-[13px] text-ink-2">{que}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Son referencias, no una carrera. Lo único que importa de verdad es que tus propias curvas
          del dashboard suban con el tiempo.
        </p>
      </Panel>
    </>
  )
}

/* ---------------- Teclas ---------------- */

function Teclas() {
  return (
    <Panel>
      <SectionTitle icon={Keyboard} right={<Badge tone="cy">100 % TECLADO</Badge>}>
        Mapa de teclas
      </SectionTitle>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {SHORTCUTS.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line-soft px-3 py-2">
            <span className="flex w-24 shrink-0 gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
            <span className="min-w-0 flex-1 text-[12px] text-ink-3">{s.desc}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-mute">
        Mientras un bloque está en marcha, las teclas de navegación quedan bloqueadas para no
        romper la medición. <Kbd>ESC</Kbd> aborta y te devuelve la navegación.
      </p>
    </Panel>
  )
}
