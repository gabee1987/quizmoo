import type { Avatar, NicknameLanguage } from '@quizmoo/shared'
import { simplify } from './names.js'

/**
 * Built-in "Surprise me" names with the avatar that fits each, used until an admin saves a list
 * for the language. Written per language, not translated: the Hungarian ones play with Hungarian
 * words, alliteration and childhood cartoons. Puns on fictional or historical figures only, never
 * on living people. Each passes the name filter.
 */
const builtIn: Record<NicknameLanguage, readonly (readonly [string, Avatar])[]> = {
  hu: [
    ['Frakk Unokaöccse', '🐶'], ['Blöki Béla', '🐶'], ['Csaholó Csongor', '🐶'],
    ['Dorombolós Döme', '🐱'], ['Cicamica Cili', '🐱'], ['Kandúr Kornél', '🐱'],
    ['Vuk Unokája', '🦊'], ['Rókalyuk Rudi', '🦊'],
    ['Gumimaci Gábor', '🐻'], ['Mézmániás Mackó', '🐻'], ['Brummogó Bertalan', '🐻'],
    ['Bambusz Béla', '🐼'], ['Panda Pannika', '🐼'],
    ['Koala Kálmán', '🐨'], ['Eukaliptusz Ede', '🐨'],
    ['Tigris Tihamér', '🐯'], ['Csíkos Csabi', '🐯'],
    ['Oroszlánszívű Ottó', '🦁'], ['Sörényes Sanyi', '🦁'],
    ['Bőgő Boci', '🐮'], ['Kérődző Kristóf', '🐮'], ['Bociszemű Bori', '🐮'], ['Tejfölös Tercsi', '🐮'],
    ['Röfi Rozi', '🐷'], ['Hurka Huba', '🐷'], ['Malacpersely Matyi', '🐷'],
    ['Brekegő Brúnó', '🐸'], ['Békakirály Barnabás', '🐸'],
    ['Majomkodó Marci', '🐵'], ['Majomparádé Miki', '🐵'],
    ['Táncoló Tojás', '🐔'], ['Kotkodácsoló Kati', '🐔'], ['Tyúkeszű Tódor', '🐔'], ['Kukori Kristóf', '🐔'],
    ['Pattogó Pingvin', '🐧'], ['Frakkos Ferkó', '🐧'], ['Jégtáncos Jeromos', '🐧'],
    ['Bajszos Bagoly', '🦉'], ['Bagoly Mondja', '🦉'], ['Okostojás Oszkár', '🦉'], ['Tudálékos Tivadar', '🦉'],
    ['Csillámpóni', '🦄'], ['Unikornis Ubul', '🦄'],
    ['Zümmögő Zsolti', '🐝'], ['Dolgos Dongó', '🐝'], ['Méhkirálynő Margit', '🐝'],
    ['Turbó Teknős', '🐢'], ['Páncélos Pál', '🐢'],
    ['Polip Pista', '🐙'], ['Nyolckarú Nándi', '🐙'], ['Tintahal Tivadar', '🐙'],
    ['Oldalazó Ottokár', '🦀'], ['Ollós Olivér', '🦀'],
    ['Delfin Dénes', '🐬'], ['Fröcskölő Flóra', '🐬'],
    ['Nyakigláb Nándor', '🦒'], ['Zsiráf Zsófi', '🦒'],
    ['Sün Balázs', '🦔'], ['Tüskés Teodóra', '🦔'],
    ['Álmos Lajhár', '🦥'], ['Lusta Lajhár Laci', '🦥'],
    ['Pizzás Pisti', '🍕'], ['Négysajtos Nóri', '🍕'],
    ['Hambi Hugó', '🍔'], ['Dupla Sajtos Dezső', '🍔'],
    ['Taco Tamás', '🌮'], ['Csípős Cecília', '🌮'],
    ['Fürge Fánk', '🍩'], ['Fánkfaló Feri', '🍩'], ['Farsangi Fanni', '🍩'],
    ['Fagyi Frigyes', '🍦'], ['Tölcséres Tódor', '🍦'],
    ['Dinnye Dömötör', '🍉'], ['Görögdinnye Gizi', '🍉'],
    ['Eper Endre', '🍓'], ['Epres Elemér', '🍓'],
    ['Avokádó Aladár', '🥑'],
    ['Kapitány Banán', '🍌'], ['Banánhéj Bandi', '🍌'],
    ['Sajtos Pogácsa', '🥨'], ['Kalandor Kifli', '🥨'], ['Perec Peti', '🥨'],
    ['Kuglóf Király', '🧁'], ['Muffin Manci', '🧁'], ['Habos Hajni', '🧁'],
    ['Pukkanó Popcorn', '🍿'], ['Pattogatott Pali', '🍿'],
    ['Űrlény Ödön', '👽'], ['Marslakó Misi', '👽'],
    ['Robotporszívó Rudi', '🤖'], ['Robot Robi', '🤖'],
    ['Szellemes Szilvi', '👻'], ['Kísértet Kázmér', '👻'],
    ['Tökfej Tamás', '🎃'], ['Tökmag Tibi', '🎃'],
    ['Hókuszpók', '🧙'], ['Varázsló Vazul', '🧙'], ['Bűbájos Benedek', '🧙'],
    ['Drakula Dani', '🧛'], ['Fokhagymakerülő Ferenc', '🧛'],
    ['Hős Hörcsög', '🦸'], ['Szuper Szilva', '🦸'], ['Szuperhős Szilárd', '🦸'],
    ['Balatoni Hableány', '🧜'], ['Sellő Sári', '🧜'],
    ['Hétfejű Sárkány', '🐉'], ['Süsü Unokája', '🐉'],
    ['Dzsinn Dzsoni', '🧞'], ['Lámpás Lajos', '🧞'],
    ['Bohóc Bence', '🤡'], ['Lufi Lajos', '🤡'], ['Mókamester Miki', '🤡'],
    ['Disco Krumpli', '😎'], ['Menő Manó', '😎'], ['Laza Lali', '😎'], ['Puskázó Pongrác', '😎'],
    ['Rakéta Réka', '🚀'], ['Turbó Csiga', '🚀'], ['Repülő Rántotta', '🚀'],
    ['Kapufa Karcsi', '⚽'], ['Lesen Lévő Levente', '⚽'],
    ['Zsákoló Zsiga', '🏀'], ['Kosaras Kornél', '🏀'],
    ['Léggitáros Lőrinc', '🎸'], ['Rocker Róbert', '🎸'],
    ['Pixel Pityu', '🎮'], ['Joystick Jenő', '🎮'],
    ['Vaktában Vilma', '🎲'], ['Szerencsés Szende', '🎲'], ['Kockázó Kinga', '🎲'],
    ['Szivárvány Szabina', '🌈'],
    ['Csillag Csenge', '⭐'], ['Sztár Szonja', '⭐'],
    ['Telitalálat Tóni', '🎯'], ['Kapásból Kata', '🎯'],
    ['Gyémánt Gyuri', '💎'], ['Csillogó Csilla', '💎'],
    ['Cilinderes Cecil', '🎩'], ['Monoklis Márton', '🎩'],
    ['Bolygó Hollandi', '🪐'], ['Galaktikus Galuska', '🪐'], ['Szaturnusz Szaniszló', '🪐'],
    // Films, cartoons, history and memes everyone here grew up with.
    ['Üvegtigris Lali', '🐯'], ['Büfés Gaben', '🍔'], ['Dr. Bubó Unokája', '🦉'], ['Mézga Aladár', '🪐'],
    ['Hyppolit a Lakáj', '🎩'], ['Paprika Jancsi', '🤡'], ['Lúdas Matyi', '🐔'], ['Mazsola', '🐷'],
    ['Szerénke Cica', '🐱'], ['Törpapa', '🧙'], ['Okoska Törp', '🦉'], ['Törpilla', '🌈'],
    ['Nick Grabowski', '😎'], ['Csinibaba Zenekar', '🎸'], ['Kincskereső Kisködmön', '💎'], ['Gittegylet Elnöke', '⭐'],
    ['Mátyás Király Álruhában', '🎩'], ['Pajkaszegi Polgármester', '🎩'], ['Reszkessetek Betörők', '😎'],
    ['Csak Semmi Pánik Pali', '🚀'], ['Talpra Magyar Tamás', '🦸'], ['Egri Csillag', '⭐'], ['Hungarikum Huba', '⭐'],
    ['Aranycsapat Kapusa', '⚽'], ['Puskás Öccse', '⚽'], ['Rubik Kocka Rudi', '🎲'], ['Kakukktojás Kata', '🐔'],
    ['Kossuth Kifli', '🥨'], ['Kürtőskalács Kristóf', '🥨'], ['Fokhagymás Lángos', '🍕'], ['Paprikás Csirke Csaba', '🐔'],
    ['Zserbó Zsuzsi', '🧁'], ['Dobos Torta Dénes', '🧁'], ['Duna-parti Delfin', '🐬'],
    ['Sírva Vigadó Vince', '🤡'], ['Ejnye-Bejnye Béla', '🤡'],
    ['Doge Dezső', '🐶'], ['Minden Rendben Kutya', '🐶'], ['Nyan Macska', '🌈'], ['Stonks Sanyi', '💎'],
    ['Galaxisagyú Géza', '🪐'], ['Trololo Tóni', '🎸'],
  ],
  en: [
    ['Sherlock Bones', '🐶'], ['Bark Twain', '🐶'], ['Droolius Caesar', '🐶'],
    ['Purrlock Holmes', '🐱'], ['Catrick Swayze', '🐱'], ['Purrfect Stranger', '🐱'],
    ['Foxy Moron', '🦊'], ['Fox in Socks', '🦊'],
    ['Teddy Mercury', '🐻'], ['Unbearable Larry', '🐻'], ['Gummy Bear Bob', '🐻'],
    ['Pandamonium', '🐼'], ['Pandalorian', '🐼'],
    ['Koala Tea', '🐨'], ['Koalafied Expert', '🐨'],
    ['Tigger Happy', '🐯'], ['Ferocious Fluffball', '🐯'],
    ['Dandy Lion', '🦁'], ['The Mane Event', '🦁'],
    ['Udderly Brilliant', '🐮'], ['Moozart', '🐮'], ['Holy Cow', '🐮'], ['Dairy Potter', '🐮'],
    ['Hamlet', '🐷'], ['Sir Oinksalot', '🐷'], ['Piggy Smalls', '🐷'],
    ['Kermit Mistakes', '🐸'], ['Hoppy Potter', '🐸'], ['Frog Almighty', '🐸'],
    ['Cheeky Monkey', '🐵'], ['Monkey Business', '🐵'],
    ['Hen Solo', '🐔'], ['Cluck Rogers', '🐔'], ['Eggcellent Eddie', '🐔'],
    ['Bouncy Penguin', '🐧'], ['Tuxedo Ted', '🐧'], ['Penguin of Doom', '🐧'],
    ['Owl Capone', '🦉'], ['Owlbert Einstein', '🦉'], ['Hoo Knows', '🦉'],
    ['Unicorn Dust', '🦄'], ['Uni Corny', '🦄'],
    ['Obi-Wan Kenobee', '🐝'], ['Mind Your Own Beeswax', '🐝'], ['Bumble Bob', '🐝'],
    ['Turtle Recall', '🐢'], ['Shell Shocked', '🐢'], ['Turbo Turtle', '🐢'],
    ['Inkredible Hulk', '🐙'], ['Doctor Octopants', '🐙'],
    ['Crabby Patty', '🦀'], ['Pinchy McPinchface', '🦀'], ['Rock Lobster', '🦀'],
    ['Flipper Fiasco', '🐬'], ['Dolphinitely Right', '🐬'],
    ['Longneck Larry', '🦒'], ['Giraffe Me Crazy', '🦒'],
    ['Hedge Fund Harry', '🦔'], ['Spiky McSpikeface', '🦔'],
    ['Sleepy Sloth', '🦥'], ['Slow and Furious', '🦥'], ['Sloth Vader', '🦥'],
    ['Pizza the Hutt', '🍕'], ['Pepperoni Tony', '🍕'],
    ['Burger Meister', '🍔'], ['Big Cheese Burger', '🍔'],
    ['Taco Tornado', '🌮'], ['Nacho Average Joe', '🌮'], ['Taco Belle', '🌮'],
    ['Donut Disturb', '🍩'], ['Glazed and Confused', '🍩'], ['Speedy Donut', '🍩'],
    ['Brain Freeze Bob', '🍦'], ['Sundae Funday', '🍦'],
    ['One in a Melon', '🍉'], ['Melon Collie', '🍉'],
    ['Berry Important Person', '🍓'], ['Strawberry Shortcut', '🍓'],
    ['Holy Guacamole', '🥑'], ['Avocadabra', '🥑'], ['Avocado Toastmaster', '🥑'],
    ['Captain Banana', '🍌'], ['Bananarchy', '🍌'],
    ['Cheesy Pretzel', '🥨'], ['Pretzel Logic', '🥨'],
    ['Professor Muffin', '🧁'], ['Cupcake Commando', '🧁'],
    ['Kernel Sanders', '🍿'], ['Popcorn Panic', '🍿'],
    ['Area 51 Intern', '👽'], ['Little Green Steve', '👽'],
    ['Sir Beeps-a-Lot', '🤖'], ['Error 404 Brain', '🤖'], ['Toaster Supreme', '🤖'],
    ['Ghost of Monday', '👻'], ['Boo Lightyear', '👻'],
    ['Jack O Latte', '🎃'], ['Pumpkin Spice Guy', '🎃'],
    ['Gandalf the Beige', '🧙'], ['Pizza Wizard', '🧙'], ['Wizard of Ahhs', '🧙'],
    ['Count Snackula', '🧛'], ['Vlad the Inhaler', '🧛'],
    ['Captain Obvious', '🦸'], ['Captain Overthink', '🦸'], ['Super Mediocre', '🦸'],
    ['Mermaid Mayhem', '🧜'],
    ['Dragon My Feet', '🐉'], ['Snapdragon', '🐉'],
    ['Genie in a Bottle', '🧞'], ['Three Wishes Willy', '🧞'],
    ['Bozo the Brain', '🤡'], ['Clowning Glory', '🤡'],
    ['Too Cool for Quiz', '😎'], ['Smarty Pants', '😎'], ['Disco Potato', '😎'],
    ['Rocket Surgeon', '🚀'], ['Rocket Pickle', '🚀'], ['Turbo Snail', '🚀'],
    ['Goal Digger', '⚽'], ['Offside Ollie', '⚽'],
    ['Hoop There It Is', '🏀'], ['Hoop Dreams', '🏀'],
    ['Guitar Zero', '🎸'], ['Air Guitar Hero', '🎸'],
    ['Rage Quitter', '🎮'], ['Respawn Ron', '🎮'], ['Player One', '🎮'],
    ['Dice Dice Baby', '🎲'], ['Lucky Guess', '🎲'], ['Wild Guess Gus', '🎲'],
    ['Double Rainbow', '🌈'], ['Taste the Rainbow', '🌈'],
    ['Twinkle Toes', '⭐'], ['Star of the Show', '⭐'],
    ['Nailed It Nigel', '🎯'], ['Bullseye Betty', '🎯'],
    ['Shine Bright', '💎'], ['Diamond in the Rough', '💎'],
    ['Sir Waffles', '🎩'], ['Duke of Pudding', '🎩'], ['Lord Fancypants', '🎩'],
    ['Cosmic Pancake', '🪐'], ['Galactic Dumpling', '🪐'], ['Spaced Out', '🪐'],
    // History, films, books and memes people recognise.
    ['Attila the Fun', '🦁'], ['Napoleon Bonapizza', '🍕'], ['Julius Sneezer', '🤡'], ['Cleocatra', '🐱'],
    ['Isaac Mewton', '🐱'], ['Albert Einswine', '🐷'], ['Sock-rates', '🦉'], ['Elvis Parsley', '🎸'],
    ['Vincent van Dough', '🥨'], ['Mona Pizza', '🍕'], ['King Tut Tut', '🎩'], ['Cluckingham Palace', '🐔'],
    ['Loch Mess Monster', '🐉'], ['Indiana Bones', '🐶'], ['Bond, Jam Bond', '🍓'], ['Darth Waiter', '🤖'],
    ['One Does Not Simply', '🧙'], ['Wingardium Leviosa', '🧙'], ['Winter Is Coming', '🐉'],
    ['May the Quiz Be With You', '⭐'], ['Houston We Have a Quiz', '🚀'], ['Ctrl Alt Defeat', '🤖'],
    ['Leeroy Jenkins', '🎮'], ['Press F to Pay Respects', '🎮'], ['This Is Fine Dog', '🐶'],
    ['Such Doge Very Quiz', '🐶'], ['Grumpy Kitty', '🐱'], ['Nyan Cat', '🌈'], ['Keyboard Cat', '🎸'],
    ['Galaxy Brain', '🪐'], ['Stonks', '💎'], ['Never Gonna Give Up', '🎸'], ['Distracted Boyfriend', '😎'],
  ],
}

/** "Surprise me" names used until an admin saves a list for the language. */
export const defaultNicknames: Record<NicknameLanguage, string[]> = {
  hu: builtIn.hu.map(([name]) => name),
  en: builtIn.en.map(([name]) => name),
}

const builtInAvatars = new Map(
  Object.values(builtIn)
    .flat()
    .map(([name, avatar]) => [name.toLocaleLowerCase(), avatar] as const),
)

/**
 * Words that give an admin's own name its avatar, in both languages, in the name filter's
 * simplified form (lower case, no accents). `*` marks a word start (Hungarian adds endings,
 * English plurals); the others match whole words only ("rák", not "rakéta").
 */
const keywords: Partial<Record<Avatar, string[]>> = {
  '🐶': ['kutya*', 'kutyus*', 'bloki*', 'dog*', 'puppy', 'doggo*'],
  '🐱': ['macska*', 'macsek*', 'cica*', 'cicus*', 'cicamica*', 'kandur*', 'cat', 'cats', 'kitty', 'kitten*'],
  '🦊': ['roka*', 'vuk', 'fox', 'foxy'],
  '🐻': ['medve*', 'macko*', 'maci', 'gumimaci*', 'bear', 'bears', 'teddy'],
  '🐼': ['panda*'],
  '🐨': ['koala*'],
  '🐯': ['tigris*', 'tiger*'],
  '🦁': ['oroszlan*', 'lion', 'lions'],
  '🐮': ['tehen*', 'boci*', 'borju*', 'bika*', 'cow', 'cows', 'udder*'],
  '🐷': ['malac*', 'diszno*', 'rofi*', 'pig', 'pigs', 'piggy', 'oink*'],
  '🐸': ['beka*', 'frog*', 'toad*'],
  '🐵': ['majom*', 'majm*', 'monkey*', 'chimp*'],
  '🐔': ['csirke*', 'tyuk*', 'kakas*', 'chicken*', 'chick', 'rooster*'],
  '🐧': ['pingvin*', 'penguin*'],
  '🦉': ['bagoly*', 'bagly*', 'owl', 'owls'],
  '🦄': ['unikornis*', 'egyszarvu*', 'unicorn*', 'csillamponi*', 'poni*', 'pony'],
  '🐝': ['meheck*', 'dongo*', 'bee', 'bees', 'bumble*'],
  '🐢': ['teknos*', 'teknoc*', 'turtle*', 'tortoise*'],
  '🐙': ['polip*', 'octopus*', 'kraken'],
  '🦀': ['rak', 'rakocska*', 'crab*'],
  '🐬': ['delfin*', 'dolphin*'],
  '🦒': ['zsiraf*', 'giraffe*'],
  '🦔': ['sun', 'sundiszno*', 'hedgehog*'],
  '🦥': ['lajhar*', 'sloth*'],
  '🍕': ['pizza*'],
  '🍔': ['hamburger*', 'burger*', 'hambi*'],
  '🌮': ['taco*', 'nacho*'],
  '🍩': ['fank*', 'donut*', 'doughnut*'],
  '🍦': ['fagyi*', 'fagylalt*', 'jegkrem*', 'icecream', 'sundae'],
  '🍉': ['dinnye*', 'gorogdinnye*', 'melon*', 'watermelon*'],
  '🍓': ['eper', 'epres*', 'strawberr*'],
  '🥑': ['avokado*', 'avocado*', 'guacamole'],
  '🍌': ['banan*'],
  '🥨': ['perec*', 'pretzel*', 'pogacsa*', 'kifli*'],
  '🧁': ['muffin*', 'cupcake*', 'kuglof*', 'torta*', 'suti*', 'cake', 'cakes'],
  '🍿': ['popcorn*', 'pattogatott*'],
  '👽': ['ufo*', 'alien*', 'urleny*', 'marslako*'],
  '🤖': ['robot*', 'droid*', 'android*'],
  '👻': ['szellem*', 'kisertet*', 'ghost*', 'spook*'],
  '🎃': ['tok', 'tokfej*', 'tokmag*', 'pumpkin*'],
  '🧙': ['varazslo*', 'boszorkany*', 'wizard*', 'witch*', 'hokuszpok*'],
  '🧛': ['vampir*', 'drakula*', 'dracula*'],
  '🦸': ['szuperhos*', 'hos', 'hero', 'heroes', 'superhero*'],
  '🧜': ['hableany*', 'sello*', 'mermaid*', 'merman'],
  '🐉': ['sarkany*', 'dragon*', 'susu'],
  '🧞': ['dzsinn*', 'genie*'],
  '🤡': ['bohoc*', 'clown*', 'pojaca*'],
  '😎': ['meno', 'laza', 'cool'],
  '🚀': ['raket*', 'rocket*', 'turbo*'],
  '⚽': ['foci*', 'focis*', 'football*', 'soccer*'],
  '🏀': ['kosar*', 'basketball*'],
  '🎸': ['gitar*', 'guitar*', 'rocker*'],
  '🎮': ['gamer*', 'joystick*', 'pixel*', 'konzol*'],
  '🎲': ['dobokocka*', 'dice', 'szerencse*', 'lucky'],
  '🌈': ['szivarvany*', 'rainbow*'],
  '⭐': ['csillag*', 'sztar*', 'star', 'stars', 'superstar*'],
  '🎯': ['celpont*', 'telitalalat*', 'target*', 'bullseye*'],
  '💎': ['gyemant*', 'diamond*', 'gem', 'gems', 'bling*'],
  '🎩': ['cilinder*', 'kalap*', 'grof*', 'hat', 'sir', 'lord', 'duke'],
  '🪐': ['bolygo*', 'szaturnusz*', 'galaktikus*', 'kozmikus*', 'planet*', 'saturn*', 'galactic*', 'cosmic*'],
}

const keywordRules = Object.entries(keywords).flatMap(([avatar, words]) =>
  words.map((word) => ({ avatar: avatar as Avatar, root: word.replace(/\*$/, ''), prefix: word.endsWith('*') })),
)

/**
 * The avatar "Surprise me" gives with a name: a built-in name's own avatar, else the first
 * keyword found from the end of the name (the noun comes last: "Pattogó Pingvin", "Pizza Wizard"),
 * else null (the phone picks a random one).
 */
export function avatarForNickname(name: string): Avatar | null {
  const own = builtInAvatars.get(name.trim().toLocaleLowerCase())
  if (own) return own
  const words = simplify(name).split(/[^\p{L}]+/u).filter(Boolean).reverse()
  for (const word of words) {
    const rule = keywordRules.find(({ root, prefix }) => (prefix ? word.startsWith(root) : word === root))
    if (rule) return rule.avatar
  }
  return null
}

/**
 * A random name from `names` that nobody in the game has yet (compared case-insensitively),
 * or any of them once all are taken (the join then reports the clash). Null for an empty list.
 */
export function pickNickname(names: readonly string[], taken: readonly string[], random: () => number = Math.random): string | null {
  const used = new Set(taken.map((name) => name.toLocaleLowerCase()))
  const free = names.filter((name) => !used.has(name.toLocaleLowerCase()))
  const pool = free.length > 0 ? free : names
  return pool[Math.floor(random() * pool.length)] ?? null
}
