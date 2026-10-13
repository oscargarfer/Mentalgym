# Registro de cambios

## 1.2.2 — 2026-10-13

Primera versión con los tres instaladores compilados: la 1.1.0, la 1.2.0 y la
1.2.1 se quedaron sin ellos porque la compilación se paraba antes.

- **Dos guardados a la vez se pisaban.** El automático y otro simultáneo
  escribían el mismo archivo temporal; el segundo fallaba y el orden en disco
  dejaba de ser el orden pedido. Pasaba en la app instalada y en el servidor
  local. Ahora los guardados van en fila.
- El paquete de Ubuntu declara mantenedor, que Debian exige.
- El APK lleva la versión real en el nombre.

## 1.2.1 — 2026-10-13

No llegó a publicarse. Pasaba la prueba de Electron de Linux a Windows, donde
destapó el fallo de los guardados simultáneos que corrige la 1.2.2.

## 1.2.0 — 2026-10-13

La aplicación deja de presentarse como un entrenador de idiomas: entrena cuatro
capacidades —asociar, ordenar, retener y procesar— y el vocabulario es solo uno
de los materiales.

- El Registro abre con las cuatro capacidades, también sin historial, y cada
  una enlaza con los ejercicios que la entrenan.
- Teclas 1–9 en orden de barra lateral; la cifra junto a cada entrada es su
  atajo.
- Diseño nuevo: tinta sobre papel, serif para los títulos y pantalla de
  ejercicio en negro. Marca propia: un cerebro sobre una pesa.
- Vocabulario ordenado por frecuencia real de uso y podado de rarezas, nombres
  propios y muletillas.
- `npm run respaldo`: copia verificada del proyecto fuera de su carpeta.

### Correcciones

- **«Exportar» y «Exportar todo» dejaban fuera las fichas de repaso, los
  palacios y el casillero numérico.** Restaurar la copia en otro ordenador
  devolvía las sesiones y perdía el resto sin avisar. Ahora la copia lleva todo
  lo que «Restaurar copia» sabe leer.

## 1.1.0 — 2026-08-06

Primera versión distribuible: la aplicación deja de depender del navegador y se
instala como programa en Windows, Ubuntu y Android.

### Escritorio

- Ventana propia con Electron, sin barra de direcciones ni pestañas.
- La app se sirve por un esquema `app://` propio en vez de abrir el archivo
  directamente: Chromium bloquea los módulos ES sobre `file://`, y la salida de
  Vite carga los seis diccionarios y el panel de métricas como fragmentos
  aparte. Además da un origen estable, que es lo que hace que el almacenamiento
  del navegador sobreviva de un arranque a otro.
- El progreso pasa a la carpeta de datos del usuario, con las mismas garantías
  que ya daba el servidor local: escritura atómica, respaldo rodante y rechazo
  de escrituras vacías sobre un archivo con contenido. Desinstalar no lo borra.
- Al cerrar, la ventana espera a que se vuelque lo que estuviera pendiente.
- Una sola instancia: abrir el acceso directo dos veces enfoca la que ya hay.
- Instalador que no pide permisos de administrador.

### Móvil

- Proyecto Android con Capacitor y APK instalable.
- **Los seis ejercicios se manejan con el dedo.** Los botones no duplican la
  lógica de cada ejercicio: emiten la misma pulsación de tecla que emitiría el
  teclado, así que el dedo recorre el mismo camino de código y no puede
  comportarse distinto.
- Autocorrector y mayúsculas automáticas desactivados en los campos de
  respuesta: en Android reescribían la respuesta antes de evaluarla y falseaban
  la retención y el VRN.
- El botón atrás aborta el ejercicio en vez de cerrar la aplicación.
- La pantalla no se apaga mientras se entrena.
- Sin zoom por doble toque ni «tirar para recargar» en mitad de un bloque.
- Se guarda al pasar a segundo plano, porque Android puede cerrar la aplicación
  sin previo aviso.

### Común

- `sync.js` decide qué y cuándo se escribe; dónde acaba lo resuelve un
  adaptador que elige entre escritorio, móvil, servidor local o solo
  almacenamiento del navegador.
- Iconos, pantallas de arranque y manifiesto web generados desde el mismo
  dibujo, sin dependencias de imagen.
- Compilación reproducible de los tres instaladores en la nube.
- Licencia propietaria (antes se declaraba MIT sin fichero de licencia).

### Correcciones

- `Kbd` no tenía definido el tono morado: esas teclas se pintaban sin estilo.
- La ruta vacía en el esquema `app://` resolvía al directorio en vez de a
  `index.html`, porque `normalize('')` devuelve `'.'` y no cadena vacía.

## 1.0.0

Versión completa en navegador: nueve vistas, seis módulos de entrenamiento,
repaso espaciado, casillero numérico, palacio de la memoria y 12.849 pares de
vocabulario en seis idiomas.
