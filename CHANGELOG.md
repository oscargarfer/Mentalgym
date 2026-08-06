# Registro de cambios

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
