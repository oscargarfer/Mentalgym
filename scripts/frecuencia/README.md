# Frecuencia real: de dónde salen los rangos

Este directorio contiene la tubería que ordena el vocabulario por **frecuencia
real medida en un corpus**, no por criterio propio. Es lo que permite afirmar
qué palabras son las más usadas sin que sea una opinión.

## Por qué «palabras de contenido» y no «palabras»

El top 200 de cualquier idioma son palabras gramaticales: `the, you, of, is`,
`的, 我, 了, 在`, `не, что, это`. Un entrenador de asociación no puede trabajar
con ellas —nadie forma una imagen mental de «de»— y además se aprenden por
exposición en las primeras horas, no memorizando.

Por eso `gramaticales.mjs` las aparta, y lo que se ordena son **sustantivos,
verbos, adjetivos y adverbios**: lo que sí se memoriza y lo que de verdad
decide si entiendes una frase.

## Fuentes

Ninguna se redistribuye con la aplicación: se usan aquí para **decidir y
ordenar**, y las traducciones al español son propias.

| Dato | Fuente | Licencia |
|---|---|---|
| Frecuencia en, de, fr, ru, zh | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles) | CC-BY-SA 4.0 |
| Lematización en, de, fr, ru | [michmech/lemmatization-lists](https://github.com/michmech/lemmatization-lists) | ODbL 1.0 |
| Pinyin | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | CC-BY-SA 4.0 |
| Vocabulario japonés | [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary) | MIT |

**El japonés va aparte a propósito.** Su lista de OpenSubtitles está segmentada
por caracteres y no por palabras: empieza por partículas (`い の は て た`) y a
la altura del puesto 500 da fragmentos sin terminación (`消え`, `ござ`, `ひど`).
No sirve para un mazo. En su lugar se usa el vocabulario JLPT, que es el
estándar de «las palabras que hacen falta» y viene con lectura en kana; el
romaji se genera por transliteración mecánica desde el kana, que es exacta.

## Uso

Las descargas van a una carpeta de trabajo fuera del repositorio (son ~53 MB y
licencias que no queremos arrastrar). Con el corpus en su sitio:

```bash
node scripts/frecuencia/ranking.mjs
```

Escribe, por idioma: el top 2000 de contenido con su rango, las palabras del top
que el mazo aún no cubre, y las del mazo que quedan fuera del top.

## Precisión, y sus límites

- La frecuencia se suma **por lema**: `go/goes/going/went/gone` cuentan juntas.
  Sin esto los verbos irregulares —los más frecuentes— salían dispersos y el
  hueco se inflaba varios cientos de palabras por idioma.
- El corpus es de **subtítulos**, así que refleja lengua hablada. Es lo que
  interesa para hablar y entender, pero sobrerrepresenta muletillas
  (`uh`, `um`, `huh`), tacos e interjecciones, que hay que filtrar aparte.
- El chino se limita a lo que CC-CEDICT reconoce como palabra simplificada, lo
  que descarta de golpe el tradicional y el inglés que se cuela en el corpus.
