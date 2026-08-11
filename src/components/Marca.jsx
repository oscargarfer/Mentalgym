/**
 * La marca: un cerebro sobre una pesa.
 *
 * Monolínea y de una sola tinta, porque tiene que funcionar igual en la
 * cabecera (27 px), en la barra plegada (26 px) y sobre negro en la pantalla de
 * ejercicio. Usa `currentColor`: hereda la tinta del sitio donde se ponga y no
 * hay que mantener una versión clara y otra oscura.
 *
 * El contorno se dibuja una vez y se refleja con una matriz en lugar de escribir
 * la mitad izquierda a mano. Así la simetría es exacta por construcción: no
 * depende de que yo copie bien doce números con el signo cambiado.
 *
 * **Un solo pliegue por hemisferio, y es una decisión medida, no un descuido.**
 * Probé tres densidades rasterizando el SVG a 26 px y leyendo los píxeles: con
 * dos pliegues, o con uno más una coma arriba, los trazos interiores quedan a
 * menos de dos unidades del contorno y a ese tamaño se funden con él en una
 * mancha. Un pliegue amplio y separado es lo único que sigue leyéndose como
 * circunvolución cuando el dibujo mide 26 píxeles.
 *
 * Los discos de la pesa van macizos y el resto en trazo. Es lo que hace que se
 * lea «pesa» y no «tres rayas»: la masa identifica el objeto, y un contorno de
 * 1,6 px a ese tamaño se cierra en gris.
 */

/** Mitad derecha del cerebro: contorno y pliegue. Se refleja para la izquierda. */
function Mitad() {
  return (
    <>
      <path d="M16 3C18.8 1.4 22.3 2.3 23.2 4.9C25.9 5.2 27.5 7.5 26.6 9.9C28.4 11.4 28.2 14.3 26.1 15.5C26 18.1 23.5 19.7 21.1 19C19.9 20.7 17.6 20.9 16 19.6" />
      <path d="M25.4 9C22.2 8.8 20.2 11 21.1 13.4C21.6 14.9 23.3 15.6 24.6 14.9" />
    </>
  )
}

export default function Marca({ size = 27, className, titulo = 'Gimnasio Mental' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={titulo}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Mitad />
      {/* x' = 32 − x: el reflejo deja el eje en 16, el centro exacto del lienzo */}
      <g transform="translate(32,0) scale(-1,1)">
        <Mitad />
      </g>
      {/* Surco interhemisférico. No es recto: una recta lo convierte en un sello. */}
      <path d="M16 3C15.1 5.9 16.9 8 16 10.8C15.1 13.6 16.9 16.1 16 19.6" />

      {/* La pesa */}
      <path d="M11.4 25.6H20.6" strokeWidth="2.2" />
      <rect x="7.6" y="22.4" width="3.6" height="6.4" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="20.8" y="22.4" width="3.6" height="6.4" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
