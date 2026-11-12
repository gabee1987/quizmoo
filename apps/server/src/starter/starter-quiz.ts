import { quizInputSchema, type QuizInput } from '@quizmoo/shared'
import { nanoid } from 'nanoid'
import type { StarterDrawing } from './drawings.js'

/**
 * The quiz every new host account starts with: 20 questions that show every question type and
 * most of what a quiz can do (rounds with intros and their own rules, pictures in questions and
 * answers, 2 to 6 options, a poll worth nothing, double points, tolerance, several accepted
 * answers, a typed answer the host marks). Pictures are named by drawing and swapped for real
 * image ids when the quiz is stored (`addStarterQuiz`).
 */

export const starterLanguages = ['hu', 'en'] as const
export type StarterLanguage = (typeof starterLanguages)[number]

type Texts = typeof en

const en = {
  title: 'Quizmoo starter quiz',
  description:
    'A short tour of everything a quiz can do: every question type, pictures, rounds with their own rules. Play it with a friend or two, then change anything or delete it. You can add a fresh copy from your quiz list any time.',
  mood: { text: 'Warm-up: how are you feeling right now?', options: ['Ready to win', 'Here for the snacks', 'Who invited me?', 'Moo'] },
  banana: 'A banana is a berry.',
  cows: { text: 'How many cows are in the picture? Look closely!', options: ['5', '6', '7', '8'] },
  round1: { title: 'Weird but true', info: 'Easy questions? Think twice: every one hides a little trap.' },
  feathers: { text: 'Which is heavier: a kilo of feathers or a kilo of iron?', options: ['The iron', 'The feathers', 'They weigh the same'] },
  mammals: { text: 'Which of these are mammals?', options: ['Dolphin', 'Bat', 'Penguin', 'Platypus', 'Shark', 'Human'] },
  octopus: 'How many hearts does an octopus have?',
  eiffel: 'How tall is the Eiffel Tower, in metres? Within 30 metres counts.',
  goldfish: 'A goldfish only remembers the last three seconds.',
  canberra: { text: 'What is the capital of Australia?', answers: ['Canberra'] },
  round2: { title: 'Quick fingers', info: '10 seconds a question, and no changing your mind. The faster, the more points!' },
  flag: { text: 'Which one is the flag of Bulgaria?', options: ['1', '2', '3', '4'] },
  planets: { text: 'Put the planets in order of size, smallest first.', options: ['Mercury', 'Mars', 'Earth', 'Neptune', 'Jupiter'] },
  egg: { text: 'Which came first?', options: ['The egg', 'The chicken'] },
  inventions: { text: 'Put these in order of invention, oldest first.', options: ['Printing press', 'Telescope', 'Steam engine', 'Telephone'] },
  round3: { title: 'Over to you', info: 'No right or wrong here, almost. Speed does not matter in this round.' },
  oneWord: 'Describe this quiz in one word. The host decides what counts!',
  pizza: { text: 'Pineapple on pizza?', options: ['Yes, please', 'Never'] },
  palindromes: { text: 'Which of these words read the same backwards?', options: ['level', 'lemon', 'noon', 'radio'] },
  minutes: 'How many minutes are in a day?',
  timeZones: { text: 'Double points! Which country has the most time zones?', options: ['Russia', 'USA', 'France', 'China'] },
  rainbow: {
    text: 'Name one colour of the rainbow.',
    answers: ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'purple'],
  },
  last: 'This was the last question.',
}

const hu: Texts = {
  title: 'Quizmoo próbakvíz',
  description:
    'Rövid körút mindenen, amit egy kvíz tud: minden kérdéstípus, képek, saját szabályú körök. Játszd végig egy-két baráttal, aztán írd át vagy töröld nyugodtan. A kvízeid listájáról bármikor kérhetsz új példányt.',
  mood: { text: 'Bemelegítés: hogy érzed magad most?', options: ['Nyerni jöttem', 'A rágcsa miatt vagyok itt', 'Ki hívott meg?', 'Múúú'] },
  banana: 'A banán bogyótermés.',
  cows: { text: 'Hány tehén van a képen? Nézd meg jól!', options: ['5', '6', '7', '8'] },
  round1: { title: 'Furcsa, de igaz', info: 'Könnyű kérdések? Gondold át kétszer: mindegyikben van egy kis csapda.' },
  feathers: { text: 'Mi a nehezebb: egy kiló toll vagy egy kiló vas?', options: ['A vas', 'A toll', 'Ugyanannyi'] },
  mammals: { text: 'Melyik emlős ezek közül?', options: ['Delfin', 'Denevér', 'Pingvin', 'Kacsacsőrű emlős', 'Cápa', 'Ember'] },
  octopus: 'Hány szíve van egy polipnak?',
  eiffel: 'Hány méter magas az Eiffel-torony? 30 méteren belül jónak számít.',
  goldfish: 'Az aranyhal csak az utolsó három másodpercre emlékszik.',
  canberra: { text: 'Mi Ausztrália fővárosa?', answers: ['Canberra'] },
  round2: { title: 'Villámkör', info: '10 másodperc kérdésenként, és nincs meggondolás. Minél gyorsabb vagy, annál több a pont!' },
  flag: { text: 'Melyik Bulgária zászlaja?', options: ['1', '2', '3', '4'] },
  planets: { text: 'Rakd sorba a bolygókat méret szerint, a legkisebbel kezdd.', options: ['Merkúr', 'Mars', 'Föld', 'Neptunusz', 'Jupiter'] },
  egg: { text: 'Mi volt előbb?', options: ['A tojás', 'A tyúk'] },
  inventions: { text: 'Rakd sorba a találmányokat, a legrégebbivel kezdd.', options: ['Könyvnyomtatás', 'Távcső', 'Gőzgép', 'Telefon'] },
  round3: { title: 'Te jössz!', info: 'Itt (majdnem) nincs rossz válasz. Ebben a körben nem számít a gyorsaság.' },
  oneWord: 'Írd le egy szóval ezt a kvízt! Hogy mi számít jónak, azt a játékvezető dönti el.',
  pizza: { text: 'Ananász a pizzán?', options: ['Naná', 'Soha'] },
  palindromes: { text: 'Melyik szó olvasható visszafelé is ugyanúgy?', options: ['kerek', 'kosár', 'görög', 'alma'] },
  minutes: 'Hány perc van egy napban?',
  timeZones: { text: 'Dupla pont! Melyik országnak van a legtöbb időzónája?', options: ['Oroszország', 'USA', 'Franciaország', 'Kína'] },
  rainbow: {
    text: 'Mondd a szivárvány egyik színét!',
    answers: ['piros', 'vörös', 'narancs', 'narancssárga', 'sárga', 'zöld', 'kék', 'indigó', 'ibolya', 'lila'],
  },
  last: 'Ez volt az utolsó kérdés.',
}

const texts: Record<StarterLanguage, Texts> = { hu, en }

const opts = (labels: string[], images?: StarterDrawing[]) =>
  labels.map((text, i) => ({ id: nanoid(8), text, ...(images?.[i] && { imageId: images[i] }) }))

/** A fresh quiz (new ids every call) in the given language; pictures still carry drawing names. */
export function starterQuiz(language: StarterLanguage): QuizInput {
  const t = texts[language]
  const round1 = nanoid(8)
  const round2 = nanoid(8)
  const round3 = nanoid(8)
  const q = () => nanoid(8)

  const mood = opts(t.mood.options)
  const cows = opts(t.cows.options)
  const feathers = opts(t.feathers.options)
  const mammals = opts(t.mammals.options)
  const flag = opts(t.flag.options, ['hungary', 'bulgaria', 'italy', 'ireland'])
  const egg = opts(t.egg.options)
  const palindromes = opts(t.palindromes.options)
  const timeZones = opts(t.timeZones.options)

  return quizInputSchema.parse({
    title: t.title,
    description: t.description,
    settings: { streakBonus: true, answerChanges: true, answerLockSec: 3, countdownSec: 3 },
    groups: [
      { id: round1, title: t.round1.title, info: t.round1.info, imageId: 'roundBrain', color: 'purple' },
      {
        id: round2,
        title: t.round2.title,
        info: t.round2.info,
        imageId: 'roundFast',
        color: 'yellow',
        timeLimitSec: 10,
        settings: { answerChanges: false },
      },
      { id: round3, title: t.round3.title, info: t.round3.info, imageId: 'roundYou', color: 'blue', settings: { speedBonus: false } },
    ],
    questions: [
      // Warm-up, before the rounds.
      { id: q(), type: 'poll', text: t.mood.text, options: mood, timeLimitSec: 15, points: 0 },
      { id: q(), type: 'truefalse', text: t.banana, correct: true, timeLimitSec: 15 },
      { id: q(), type: 'single', text: t.cows.text, imageId: 'cows', options: cows, correctOptionId: cows[2]!.id, timeLimitSec: 25 },

      { id: q(), groupId: round1, type: 'single', text: t.feathers.text, options: feathers, correctOptionId: feathers[2]!.id },
      {
        id: q(),
        groupId: round1,
        type: 'multiple',
        text: t.mammals.text,
        options: mammals,
        correctOptionIds: [mammals[0]!.id, mammals[1]!.id, mammals[3]!.id, mammals[5]!.id],
        scoring: 'partial',
        timeLimitSec: 30,
      },
      { id: q(), groupId: round1, type: 'number', text: t.octopus, correct: 3, tolerance: 0 },
      { id: q(), groupId: round1, type: 'number', text: t.eiffel, correct: 330, tolerance: 30, timeLimitSec: 25 },
      { id: q(), groupId: round1, type: 'truefalse', text: t.goldfish, imageId: 'goldfish', correct: false },
      { id: q(), groupId: round1, type: 'text', text: t.canberra.text, acceptedAnswers: t.canberra.answers, timeLimitSec: 30, color: 'green' },

      { id: q(), groupId: round2, type: 'single', text: t.flag.text, options: flag, correctOptionId: flag[1]!.id, timeLimitSec: 10 },
      { id: q(), groupId: round2, type: 'order', text: t.planets.text, options: opts(t.planets.options), timeLimitSec: 20 },
      { id: q(), groupId: round2, type: 'single', text: t.egg.text, options: egg, correctOptionId: egg[0]!.id, timeLimitSec: 10 },
      { id: q(), groupId: round2, type: 'order', text: t.inventions.text, options: opts(t.inventions.options), timeLimitSec: 20 },

      { id: q(), groupId: round3, type: 'text', text: t.oneWord, acceptedAnswers: [], timeLimitSec: 30, points: 500 },
      { id: q(), groupId: round3, type: 'poll', text: t.pizza.text, options: opts(t.pizza.options), timeLimitSec: 15, points: 0 },
      {
        id: q(),
        groupId: round3,
        type: 'multiple',
        text: t.palindromes.text,
        options: palindromes,
        correctOptionIds: [palindromes[0]!.id, palindromes[2]!.id],
        scoring: 'partial',
      },

      // The finale, after the rounds.
      { id: q(), type: 'number', text: t.minutes, correct: 1440, tolerance: 0, timeLimitSec: 30 },
      {
        id: q(),
        type: 'single',
        text: t.timeZones.text,
        options: timeZones,
        correctOptionId: timeZones[2]!.id,
        timeLimitSec: 20,
        points: 2000,
        color: 'red',
      },
      { id: q(), type: 'text', text: t.rainbow.text, acceptedAnswers: t.rainbow.answers },
      { id: q(), type: 'truefalse', text: t.last, correct: true, timeLimitSec: 10, points: 500 },
    ],
  })
}
