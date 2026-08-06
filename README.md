# GIMNASIO MENTAL · Alto Rendimiento Cognitivo

Web app de entrenamiento cerebral basada en el método de **velocidad, asociación y lectura** de
Ramón Campayo, orientada al aprendizaje de idiomas y a la fuerza mental bruta.

100 % operativa vía teclado. Tema oscuro.

## Dónde vive tu progreso

En `datos/progreso.json`, junto al proyecto. Se guarda **solo**, en cada cambio y al cerrar la
pestaña; al abrir, la app lo recupera de ahí. `localStorage` es únicamente una caché: puedes
limpiar los datos del navegador o cambiar de navegador y tu histórico sigue intacto.

El servidor **rechaza cualquier escritura vacía** sobre un archivo que ya tiene contenido, y
guarda la versión anterior en `datos/progreso.anterior.json` antes de cada sobrescritura. Si el
navegador falla, el disco no se lleva el fallo por delante. Borrar de verdad exige el botón de
borrar historial.

## Entrenar

Doble clic en **Gimnasio Mental** en el escritorio. Eso es todo: se abre en el navegador y a
entrenar.

Por dentro el acceso directo llama a `scripts/entrenar.vbs`, que arranca `scripts/launch.mjs`
sin dejar ventana de consola. Ese script:

1. Compara las fechas de `src/` con las de `dist/` y **recompila solo si has tocado algo**
   (código o vocabulario). El arranque normal es instantáneo.
2. Levanta un servidor local sin dependencias en `http://127.0.0.1:4123` y abre el navegador.
3. Si ya estaba en marcha, **reabre la pestaña en vez de levantar un segundo servidor**.

Hace falta servirlo por HTTP —abrir `dist/index.html` con doble clic no funciona— porque el
navegador bloquea los módulos ES sobre `file://`. El servidor solo escucha en `127.0.0.1`, así que
no queda expuesto en la red.

Para detenerlo: `taskkill /IM node.exe /F`, o simplemente reinicia; no consume nada mientras espera.

Si el acceso directo se pierde, se recrea con:

```powershell
$raiz = "C:\Users\OscarGarcia\Desktop\Entrenamiento mental"
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Gimnasio Mental.lnk")
$s.TargetPath = "$env:SystemRoot\System32\wscript.exe"; $s.Arguments = """$raiz\scripts\entrenar.vbs"""
$s.WorkingDirectory = $raiz; $s.IconLocation = "$raiz\assets\gimnasio.ico,0"; $s.Save()
```

### Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo con recarga en caliente
npm run build      # compila a dist/
npm run entrenar   # lo mismo que el acceso directo, desde la terminal
npm run vocab      # recuenta y audita los mazos de vocabulario
npm run icono      # regenera assets/gimnasio.ico
```

---

## Principio de diseño

La app **nunca** te da resuelta la palabra puente ni la imagen mental. Solo te muestra
`palabra extranjera → significado real en español`, te cronometra con precisión y mide cuántas
asociaciones sobrevivieron. El trabajo mental es tuyo; el trabajo de medirlo sin piedad es suyo.

---

## Reparto del material

Los tres módulos reparten **sin reemplazo**, con una bolsa persistente (`src/lib/bag.js`): dentro
de un bloque nunca se repite una palabra, y una palabra no vuelve a salir hasta que hayan salido
todas las demás del banco o del mazo. Así el recorrido es completo en vez de aleatorio con huecos.

Sortear cada palabra por separado parecía aleatorio pero arruinaba el entrenamiento: en bloques de
20 parejas salían de media 4,6 palabras repetidas, y una misma palabra en dos parejas distintas
hace que la segunda imagen mental pise a la primera.

La bolsa se guarda entre sesiones, así que al volver otro día continúas la vuelta donde la dejaste.

## Módulos

### 1 · Calentamiento de Asociación Flash (`2`)

El banco de sustantivos tiene 547 palabras, así que el tope por bloque son 273 parejas.

Bloques de 10 / 20 / 30 / 50 parejas (o el número que quieras). Aparece una pareja, fabricas la
imagen mental que las une y pulsas `ESPACIO` en cuanto la ves. Las rondas encadenan sin
interrupciones para lograr flujo. Al terminar, un **mini-test de evocación aleatorio** sobre el 25 %
del bloque comprueba que las asociaciones eran reales y no un reflejo del dedo.

- Métrica: **ms por imagen mental** (media, mejor, peor) + **% de evocación real**.
- Material: sustantivos concretos aleatorios, o vocabulario del idioma activo.

### 2 · Bloque Principal de Memorización Masiva (`3`)
Fase de **carga** con cronómetro de alta precisión (`performance.now()`), en dos formatos:

- **Una a una**: tarjeta a pantalla completa, `ESPACIO` / `→` avanza, `←` retrocede.
- **Rejilla navegable**: todas las palabras en pantalla, flechas para moverte, `ESPACIO` ancla la
  celda y salta a la siguiente sin anclar. La carga acaba al anclar todas.

Fase de **evocación a contrarreloj**: las palabras aparecen en orden aleatorio y escribes el
significado (o la palabra extranjera, si eliges dirección inversa).

- Métrica clave: **VRN (Velocidad de Retención Net)** = `palabras correctas / minutos de carga`.
- También: precisión, tiempo de carga, tiempo de test, s/palabra y lista de fallos a re-anclar.

La corrección tolera acentos, mayúsculas, artículos iniciales, paréntesis y acepta cualquiera de
las alternativas separadas por coma o barra (`suelo, tierra` → valen las dos).

### 4 · Repaso espaciado (`4`)

Todo lo que memorizas en el módulo 2 entra aquí automáticamente y vuelve **a las 24 h**, y después
a los 3, 7, 21, 60 y 180 días mientras lo aciertes. Un fallo devuelve la palabra al primer
intervalo. Los intervalos y el tope por sesión se ajustan en Ajustes.

Métrica clave: **retención a 24 h**, el porcentaje de aciertos en el *primer* repaso de cada
palabra. El VRN mide cuánto entra; esta cifra mide cuánto queda, y es la que encabeza el dashboard.

Avisa sin bloquear: contador en la barra lateral y tarjeta en el dashboard. Nunca cierra el paso a
los demás módulos.

### 3 · Taquistoscopio / RSVP (`5`)
Ráfagas de 300 a 900 PPM en un punto fijo, con la letra del **punto óptimo de reconocimiento (ORP)**
resaltada y corrección de deriva temporal en el temporizador.

Verificación: al acabar la ráfaga, **2 comprobaciones flash** del tipo *"¿apareció la palabra X?"*
(`S` / `N`). Solo si aciertas ambas se valida el nivel y se desbloquea la subida de +25 PPM.

- Material: vocabulario del idioma activo, textos en español incluidos, o texto propio pegado.

### 6 · Números y casillero (`6`)

Un número no se visualiza, y lo que no se visualiza no se asocia. El **casillero fonético**
convierte cada par de cifras en una palabra concreta (tabla dígito↔consonante, vocales libres).
Cuatro ejercicios:

- **Conversión** — casilla → palabra, cronometrado. El drill que automatiza la tabla.
- **Decimal** — serie de cifras, carga cronometrada, evocación **en orden**.
- **Binario** — tríos de 0/1 (000→0 … 111→7) que pasan por el casillero.
- **Baraja** — cartas en orden; se responden como valor + palo (`as`, `10c`, `kd`, `7t`).

Las 100 palabras del casillero son **editables** en Ajustes: una casilla ajena funciona mal. El
editor marca en ámbar las palabras que dejen de codificar sus dos cifras.

### 7 · Palacio de la memoria (`7`)

Almacenamiento **ordenado**, lo único que entrena la recuperación secuencial: los demás módulos
evocan en desorden. Defines tus propios itinerarios (mínimo 3 puntos, ideal 10-20), colocas un
objeto en cada punto y reconstruyes la secuencia. El **recorrido inverso** distingue las imágenes
ancladas al sitio de las simplemente encadenadas.

Material a colocar: sustantivos concretos, vocabulario del idioma activo, números vía casillero, o
tu propia lista.

Métrica: **secuencia intacta** (puntos correctos antes del primer fallo), que es lo que cuenta en
datos ordenados.

---

## Dashboard (`1`)

Gráficas de evolución (`recharts`):

- Curva de **retención a 24 h** — la métrica principal, con la referencia del 80 %.
- Curva de **VRN**, **segmentada por tamaño de lote**. Un lote de 5 y uno de 100 no son
  comparables: los pequeños puntúan siempre más alto, así que la curva no los mezcla y el KPI dice
  a qué tamaño corresponde.
- Curva de **tiempo de enganche** (ms), con la referencia de 1500 ms.
- Curva de **PPM**, con los puntos validados en verde y los no consolidados en rojo.
- Tarjeta de **repasos pendientes** con la fecha del próximo.
- KPIs: retención a 24 h, VRN récord del lote activo, reacción mínima, racha, PPM máx. validado,
  palabras consolidadas, fichas en seguimiento y precisión media.
- Historial de sesiones + exportar / restaurar copia de seguridad en JSON.

---

## Idiomas

Incluidos: **Inglés, Alemán, Francés, Ruso** (cirílico + transliteración), **Chino mandarín**
(hanzi + pinyin) y **Japonés Romaji** (romaji + kana/kanji).

Cada idioma vive en su propio `src/data/vocab/<id>.json` y **se importa solo al activarlo**, así
que el mazo puede crecer a miles de palabras sin tocar el bundle inicial. Formato por fila:
`["palabra", "significado"]` o `["palabra", "significado", "lectura"]`.

Los mazos se construyeron por tramos de frecuencia hasta superar las 2000 palabras. **Completo**:

| Idioma | Palabras |
|---|---:|
| Inglés | 2392 |
| Alemán | 2139 |
| Francés | 2125 |
| Chino | 2102 |
| Ruso | 2086 |
| Japonés | 2005 |
| **Total** | **12 849** |

El tramo 1 cubre el núcleo funcional: verbos, adjetivos, conectores, marcadores de tiempo y los
campos semánticos de mayor uso (cuerpo, familia, comida, ciudad, naturaleza, oficios, materia).
El tramo 2 añade vocabulario de dominio: trabajo, estudio, sociedad, derecho, salud, tecnología,
viajes, emociones matizadas y ~200 verbos más por idioma. El tramo 3 cierra con la cola de menor
frecuencia pero aún útil: verbos abstractos, adjetivos de matiz y sustantivos concretos de
naturaleza, oficios, cuerpo, materiales y objetos.

En el test inverso (ES → idioma) se acepta tanto la grafía original como su lectura: vale `房子` o
`fangzi`, `дом` o `dom`, `かがみ` o `kagami`.

### Ampliar un mazo

Los mazos crecen por tramos de frecuencia. Un lote nuevo se deja en `scripts/batches/` y se fusiona:

```bash
node scripts/merge-vocab.mjs de scripts/batches/de-t2.json
```

`merge-vocab` añade solo lo que no existe ya. Su clave de deduplicación es deliberadamente
conservadora: **no** ignora mayúsculas, diacríticos, artículos ni el `to` inglés. En alemán
`zahlen` (pagar) no es `zählen` (contar) y `der Arm` (brazo) no es `arm` (pobre); en francés
`la tour` (torre) no es `le tour` (turno) ni `le personnel` (plantilla) el adjetivo `personnel`;
en inglés `to answer` (responder) no es `answer` (respuesta). Un duplicado se detecta a simple
vista; una palabra fundida por error, no. Como contrapartida, `npm run vocab` lista aparte las
entradas que solo difieren en el artículo para revisarlas a ojo.

**Homófonos en japonés**: como la clave del mazo es el romaji, palabras distintas con la misma
lectura (`kami` = 髪 cabello y 紙 papel) no pueden convivir como entradas separadas o el test sería
ambiguo. Se fusionan en una sola entrada con los dos sentidos —`["kami", "cabello, papel", "かみ /
髪・紙"]`— y el corrector acepta cualquiera de ellos.

**Glosas compartidas**: si dos palabras distintas tienen la misma glosa española, el test inverso
sería imposible de adivinar. `npm run vocab` las lista como aviso y la app las acepta todas como
válidas (ver `buildMeaningIndex` en `src/lib/utils.js`). Cuando no son sinónimos sino conceptos o
categorías distintas se matiza entre paréntesis —`seguro (póliza)`, `mañana (día siguiente)`—: el
corrector ignora los paréntesis, así que sirven de pista sin obligar a escribirlos.

**Nunca inventar palabras para esquivar una colisión.** Si una entrada nueva choca con una
existente, o es un sentido más de la misma palabra (se amplía la glosa) o es una palabra distinta
que ya existe en el idioma. Un compuesto forzado tipo `hill top` o `die Fähigkeit zu fassen` es
basura en el mazo y se entrena mal.

Después:

```bash
npm run vocab
```

Recuenta, regenera `src/data/vocabCounts.json` (lo que muestra la UI sin cargar los mazos) y avisa
de duplicados y filas mal formadas.

**Idioma personalizado**: en `Ajustes` (`6`) puedes pegar o subir un archivo.

```json
[
  { "w": "hund", "m": "perro" },
  { "w": "katze", "m": "gato", "r": "lectura opcional" }
]
```

```csv
palabra,significado
hund,perro
katze,gato
```

Acepta JSON (objetos o arrays), CSV, TSV y `;` como separador, con cabecera opcional.

---

## Mapa de teclas

| Tecla | Acción |
|---|---|
| `1` … `9` | Dashboard · Calentamiento · Memorización · Repaso · Taquistoscopio · Números · Palacio · Método · Ajustes |
| `ENTER` | Iniciar bloque · confirmar respuesta |
| `ESPACIO` | Enganchar asociación · avanzar tarjeta · anclar celda · avanzar punto del palacio |
| `←` `→` | Retroceder / avanzar en la carga |
| `↑` `↓` | Navegar rejilla · ajustar PPM |
| `S` / `N` | Responder SÍ / NO en la comprobación flash |
| `R` | Repetir bloque |
| `N` | Lote nuevo (módulo 2) |
| `+` | Subir nivel de PPM tras validar |
| `ESC` | Abortar el bloque en curso |

Mientras un bloque está en marcha, la navegación global queda bloqueada para no romper la medición.

---

## Arquitectura

```
assets/
└── gimnasio.ico   icono del acceso directo
scripts/
├── entrenar.vbs   lanzador sin consola (destino del acceso directo)
├── launch.mjs     recompila si hace falta y arranca el servidor
├── serve.mjs      servidor estático local, sin dependencias
├── sync-vocab.mjs recuento y auditoría de los mazos
├── merge-vocab.mjs fusiona un lote nuevo sin duplicar
├── vocab-key.mjs  clave de deduplicación compartida
├── make-icon.mjs  genera el .ico
└── batches/       lotes de vocabulario por tramo
src/
├── data/
│   ├── vocab/*.json  un idioma por archivo, carga diferida
│   ├── pegs.js       tabla fonética, casillero 00-99 y baraja
│   ├── languages.js  metadatos + cargador perezoso
│   └── ...           banco de sustantivos, textos RSVP
├── lib/           utilidades, corrección de respuestas, storage, sync a disco,
│                  bag.js (reparto sin repetición) y srs.js (repaso espaciado)
├── state/         AppContext (ajustes, mazos, sesiones, bloqueo de navegación)
├── components/    Shell (nav) y sistema de UI
├── modules/       Warmup · Massive · Review · Tachistoscope · Numbers · Palace
└── views/         Dashboard · Method · Settings
```

Stack: **React 19 + Vite 8 + Tailwind CSS 4 + recharts 3 + lucide-react**.
