/**
 * Palabras gramaticales de cada idioma.
 *
 * No entran en el mazo de asociación: nadie forma una imagen mental de "de" o
 * de "el", y son las primeras que se aprenden por exposición. Pero son el
 * grueso del top 200 de cualquier lista de frecuencia, así que hay que
 * apartarlas antes de poder hablar de "las 2000 palabras de contenido más
 * usadas".
 */
export const GRAMATICALES = {
  en: new Set(`a an the this that these those i me my mine myself you your yours yourself he him his himself
she her hers herself it its itself we us our ours ourselves they them their theirs themselves
am is are was were be been being do does did doing done have has had having
will would shall should can could may might must ought
not no nor never nothing none nobody nowhere neither either
and but or so yet for nor because if unless although though while whereas since as than
of in on at to from by with without about above below under over between among through during before after
up down out off away back here there where when why how what which who whom whose
all any both each every few many much more most other some such only own same very just too also
one two three four five six seven eight nine ten first second next last
yes yeah yep okay ok oh ah eh hey hi hello well like really actually maybe perhaps please thanks thank sorry
gonna wanna gotta let s t d ll re ve m don didn doesn isn aren wasn weren won wouldn couldn shouldn can t
mr mrs ms dr sir madam
if then else while until once again ever still already almost even indeed rather quite
whatever whenever wherever whoever however therefore moreover thus hence
i'm you're he's she's it's we're they're`.split(/\s+/).filter(Boolean)),

  de: new Set(`der die das den dem des ein eine einen einem eines einer
ich mich mir du dich dir er ihn ihm sie ihr ihnen es wir uns ihr euch
mein meine meinen meinem meiner dein deine sein seine ihre unser euer
bin bist ist sind war waren sein gewesen habe hast hat haben hatte hatten gehabt
werde wirst wird werden wurde wurden worden
kann kannst könnt können konnte konnten muss musst müssen musste mussten
will willst wollen wollte wollten soll sollst sollen sollte sollten darf dürfen mag mögen möchte
nicht kein keine keinen keinem keiner nichts nie niemals niemand nirgends
und aber oder denn sondern doch also so wenn falls ob weil da dass damit obwohl während bis seit
von zu bei mit nach aus vor für über unter zwischen durch gegen ohne um an auf in im am zum zur ins
hier da dort wo wohin woher wann warum wieso weshalb wie was wer wen wem wessen welche welcher welches
alle alles jeder jede jedes viele viel mehr meist andere manche einige nur eigen selbe sehr auch schon noch
eins zwei drei vier fünf sechs sieben acht neun zehn erste zweite
ja nein doch okay oh ach he hallo na also mal eben halt wohl denn etwa
herr frau dr
dann sonst bis nochmal immer nie fast sogar bereits ziemlich eher
was's ich's`.split(/\s+/).filter(Boolean)),

  fr: new Set(`le la les un une des du de d au aux
je me moi tu te toi il lui elle on nous vous ils elles eux se soi
mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs
suis es est sommes êtes sont étais était étions étaient été être
ai as a avons avez ont avais avait avions avaient eu avoir
serai sera serons seront aurai aura aurons auront
peux peut pouvons pouvez peuvent pu pouvoir dois doit devons devez doivent dû devoir
veux veut voulons voulez veulent voulu vouloir vais vas va allons allez vont
ne pas plus jamais rien personne aucun aucune ni non
et mais ou or donc car si comme que qui quoi dont où quand pourquoi comment combien quel quelle quels quelles
en dans sur sous vers chez par pour avec sans entre depuis pendant avant après contre jusqu
ici là bas ailleurs partout
tout toute tous toutes chaque plusieurs beaucoup peu très trop aussi encore déjà toujours souvent
un deux trois quatre cinq six sept huit neuf dix premier première
oui ouais non ok d'accord ah oh eh salut bonjour bien alors ben quoi
monsieur madame mademoiselle
c est qu ç j l m n s t y
même autre autres tel telle quelque quelques
c'est j'ai il's`.split(/\s+/).filter(Boolean)),

  ru: new Set(`я меня мне мной мною ты тебя тебе тобой он его ему им она её ей оно
мы нас нам нами вы вас вам вами они их им ими себя себе собой
мой моя моё мои твой твоя твоё твои его её их наш наша наше наши ваш ваша ваше ваши свой своя своё свои
этот эта это эти тот та то те такой такая такое такие
быть был была было были буду будешь будет будем будете будут есть
не нет ни никогда ничего никто нигде никак нельзя
и а но или да же ведь вот бы ли если чтобы что как когда где куда откуда почему зачем кто чей
в во на за под над при про для от до из у с со к ко об о по без через между перед около
здесь там тут туда сюда оттуда везде
весь вся всё все каждый много мало больше меньше очень тоже также ещё уже только даже почти лишь
один два три четыре пять шесть семь восемь девять десять первый второй
да нет ладно хорошо ну ой ах эй привет
может можно нужно надо должен должна должны хочу хочешь хочет
господин госпожа
самый сам сама само сами другой другая другое другие
потом затем потому поэтому итак значит впрочем однако`.split(/\s+/).filter(Boolean)),

  zh: new Set(`的 了 是 在 我 你 他 她 它 我们 你们 他们 她们 它们 这 那 这个 那个 这些 那些 这样 那样 这么 那么
不 没 没有 别 不是 不会 不能 不要 不用 无
吗 呢 吧 啊 呀 哦 嗯 哎 唉 喂 嘿 哇 哼 咦 嘛 啦 咯 喔
和 跟 与 及 或 还是 但 但是 可是 不过 而 而且 因为 所以 如果 要是 虽然 然后 于是 就是 就
把 被 让 给 对 从 向 往 到 由 为 为了 关于 按照 根据
上 下 里 外 中 前 后 左 右 内 间
个 们 得 地 着 过 都 也 又 再 还 就 才 只 很 太 最 更 挺 比较 非常
什么 谁 哪 哪儿 哪里 怎么 怎样 为什么 多少 几 何时
一 二 三 四 五 六 七 八 九 十 百 千 万 第一 第二
是的 好 好的 对 行 可以 能 会 要 想 应该 必须 可能 也许 大概
自己 别人 大家 每 各 所有 一些 有些 很多 许多 一点 一下 一样 一直 一起 已经 正在 刚 刚才
先生 女士 小姐 老师
的话 之 其 此 该 等`.split(/\s+/).filter(Boolean)),
}
