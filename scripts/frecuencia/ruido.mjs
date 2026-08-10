/**
 * Lo que un corpus de subtítulos cuela y no es vocabulario.
 *
 * Tres familias, y conviene distinguirlas porque se descartan por motivos
 * distintos:
 *
 *   nombres        Personas, ciudades y marcas. Son frecuentísimos en ficción
 *                  (john, sarah, paris) y no enseñan idioma.
 *   ruido          Muletillas y efectos de sonido que el subtitulador escribe
 *                  entre paréntesis: uh, hmm, gasp, groan, chuckle. No se
 *                  pronuncian como palabras y no se memorizan.
 *   malsonante     Frecuentísimas en subtítulos, pero no es lo que se quiere
 *                  poner delante de alguien que empieza un idioma. Fuera del
 *                  mazo por criterio de producto, no de frecuencia.
 *
 * Y `extraGramaticales` recoge lo que se escapó de la primera pasada:
 * indefinidos, cuantificadores y adverbios de grado, que son gramática aunque
 * no lo parezcan.
 */

export const NOMBRES = {
  en: `john jack sam michael george joe david charlie mike tom peter paul mary ben max james henry
nick bob harry danny alex jim jimmy tony adam steve sarah richard lee billy jane eddie jake martin
robert chris amy roger bobby johnny tommy dick tommy frank kate emily arthur wood emma anna lucy
york paris london america american english french german russian chinese christmas jesus christ
lord god majesty`,
  de: `hans peter michael thomas andreas klaus max anna maria john jack sam charlie mike tom
deutschland berlin amerika england frankreich gott jesus christus`,
  fr: `jean pierre michel jacques paul marie anne claire john jack sam charlie mike tom
paris france amérique angleterre dieu jésus christ`,
  ru: `иван пётр петр михаил александр сергей андрей николай анна мария елена ольга джон джек сэм
москва россия америка англия бог иисус христос`,
  zh: `约翰 杰克 迈克 汤姆 玛丽 中国 美国 英国 法国 上帝 耶稣`,
}

export const RUIDO = {
  en: `uh um huh hmm mm mmm ha haha ooh aah ow aw ugh er yo shh wow whoa beep gasp groan grunt
chuckle cheer chatter click bang whoo pant sigh sob laugh gulp cough hiss buzz thud crash whistle
yay oops ahem hey hi yeah yep nope nah okay ok alright em ma la de lt tv`,
  de: `äh ähm hm hmm ach oh ah eh na ja nein ok okay hey hallo tja pff mhm`,
  fr: `euh heu hein hum ah oh eh ben bah pff hé ok okay salut ouais`,
  ru: `эм ага угу ой ах ох эх ну эй окей ок хм`,
  zh: `啊 哦 呃 嗯 唔 哼 咦 嘿 喂 哇 呀 嘛 咯 喔 嗨`,
}

export const MALSONANTE = {
  en: `fuck fucking fuckin shit bullshit damn goddamn bitch ass asshole bastard crap piss dick
cock pussy whore slut rape bloody hell`,
  de: `scheiße scheisse verdammt arsch fotze hure schwanz ficken`,
  fr: `merde putain con connard salope bite cul enculé`,
  ru: `блядь блять хуй пизда ебать сука говно жопа`,
  zh: `操 妈的 混蛋 婊子 屁股`,
}

/** Gramática que se coló en la primera pasada. */
export const EXTRA_GRAMATICALES = {
  en: `something anything everything nothing someone somebody anyone anybody everyone everybody
sure into another course far ago less along ahead across except upon twice onto towards toward
beyond plus till anymore anywhere everywhere nowhere somehow apparently simply totally definitely
seriously truly honestly perfectly quickly possibly probably certainly exactly finally suddenly
usually really pretty cannot hasn hadn haven ain isn aren wasn weren doesn didn don won wouldn
couldn shouldn mustn needn shan mightn`,
  de: `etwas irgendwas nichts jemand irgendjemand niemand jeder alles ziemlich ganz sehr eher
ungefähr wirklich eigentlich vielleicht wahrscheinlich natürlich endlich plötzlich gewöhnlich
genau schließlich zurück weiter selbst klar los`,
  fr: `quelque chose quelqu rien personne assez plutôt vraiment vraiement franchement exactement
enfin soudain probablement certainement peut-être naturellement toujours jamais encore déjà`,
  ru: `что-то кое-что ничто некто никто всё довольно весьма очень скорее примерно действительно
вообще возможно наверное конечно наконец вдруг обычно точно назад дальше сам ясно`,
  zh: `什么 任何 一切 没什么 有人 没人 大家 相当 非常 真的 其实 也许 大概 当然 终于 突然 通常 正好 回来 清楚`,
}

const conjunto = (texto) => new Set(texto.split(/\s+/).filter(Boolean))

/** Todo lo que hay que descartar en un idioma. */
export function descartes(lang) {
  return new Set([
    ...conjunto(NOMBRES[lang] || ''),
    ...conjunto(RUIDO[lang] || ''),
    ...conjunto(MALSONANTE[lang] || ''),
    ...conjunto(EXTRA_GRAMATICALES[lang] || ''),
  ])
}
