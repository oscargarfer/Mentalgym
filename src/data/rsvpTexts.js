// Corpus de texto en espanol para el Taquistoscopio / RSVP.
// El objetivo no es entender la trama, sino forzar la captura visual sin subvocalizar.
export const RSVP_TEXTS = [
  {
    id: 'foco',
    title: 'Foco y umbral',
    body: `El ojo no lee letra a letra cuando entrena de verdad. Salta. Cada salto captura un bloque entero y el cerebro rellena el resto con contexto. Si la voz interior sigue pronunciando cada palabra, la velocidad queda anclada al ritmo del habla y nunca supera las doscientas cincuenta palabras por minuto. Romper ese techo exige incomodidad deliberada: empujar el ritmo hasta que la comprensión tiemble, sostenerlo un minuto y volver a bajar. El umbral se desplaza. Mañana la velocidad de hoy será cómoda y el listón habrá subido solo. Nadie mejora dentro de su zona de confort porque el cerebro únicamente reasigna recursos cuando percibe una demanda que no puede satisfacer con lo que ya tiene.`,
  },
  {
    id: 'memoria',
    title: 'Arquitectura de la memoria',
    body: `La memoria no es un almacén sino una red de enganches. Un dato aislado se evapora en segundos; un dato anclado a una imagen absurda, en movimiento y con carga emocional, resiste años. Por eso el atleta mental no repite: asocia. Convierte lo abstracto en concreto, lo concreto en escena y la escena en algo imposible de olvidar porque es ridículo. El esfuerzo se traslada del repaso a la creación. Crear la imagen cuesta un segundo y medio; repetir la palabra veinte veces cuesta un minuto y funciona peor. La retención masiva no viene de la fuerza de voluntad sino del formato en que se guarda la información.`,
  },
  {
    id: 'velocidad',
    title: 'Fuerza bruta cognitiva',
    body: `Medir cambia el juego. Sin cronómetro el entrenamiento es un paseo; con cronómetro es una serie. Cada bloque de palabras memorizadas tiene un tiempo de carga y un número de aciertos, y del cociente sale un índice que no admite excusas. Ese índice sube cuando el sistema se somete a carga progresiva, igual que un músculo. Sube más rápido cuando el descanso es real y el sueño suficiente, porque la consolidación ocurre fuera de la sesión. Entrenar todos los días diez minutos vence a entrenar dos horas un domingo. La constancia gana a la intensidad aislada, y la intensidad sobre una base constante gana a todo lo demás.`,
  },
]

export const wordsFromText = (text) =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.replace(/^[¿¡("']+|[.,;:!?)"']+$/g, ''))
    .filter((w) => w.length > 1)
