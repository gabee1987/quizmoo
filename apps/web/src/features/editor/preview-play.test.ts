import { gameSettingsSchema, type Question, type QuestionGroup } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { nextQuestion, restartQuestion, reveal, revealSnapshot, scoreOf, startPlay, type PreviewQuiz } from './preview-play'

const single = (id: string, extra: Partial<Question> = {}): Question =>
  ({
    id,
    type: 'single',
    text: id,
    timeLimitSec: 20,
    points: 1000,
    options: [
      { id: `${id}-a`, text: 'Cow' },
      { id: `${id}-b`, text: 'Shark' },
    ],
    correctOptionId: `${id}-a`,
    ...extra,
  }) as Question

const right = (id: string) => ({ type: 'single' as const, optionId: `${id}-a` })
const wrong = (id: string) => ({ type: 'single' as const, optionId: `${id}-b` })

const group: QuestionGroup = { id: 'g1', title: 'Round 1', info: '', settings: { speedBonus: false } } as QuestionGroup

function quiz(questions: Question[], settings: Partial<PreviewQuiz['settings']> = {}): PreviewQuiz {
  return { title: 'TEST_QUIZ', questions, groups: [group], settings: gameSettingsSchema.parse({ streakBonus: false, ...settings }) }
}

describe('preview play-through', () => {
  it('starts at the selected question, or the first played one after a switched-off one', () => {
    const q = quiz([single('a'), single('b', { off: true }), single('c')])
    expect(startPlay(q, 0, 0)?.index).toBe(0)
    // b is off: the game plays a, c, so c is index 1.
    expect(startPlay(q, 1, 0)?.index).toBe(1)
    expect(startPlay(q, 3, 0)).toBeNull()
  })

  it('scores a right answer with the speed bonus, a wrong one with nothing', () => {
    const q = quiz([single('a'), single('b')])
    const play = reveal(q, startPlay(q, 0, 0)!, right('a'), 10_000)
    expect(play).toMatchObject({ revealed: true, correct: true, points: 750, timeMs: 10_000 })
    const second = reveal(q, nextQuestion(q, play, 20_000)!, wrong('b'), 21_000)
    expect(second).toMatchObject({ correct: false, points: 0, scoreBefore: 750 })
    expect(scoreOf(second)).toBe(750)
  })

  it('counts a late answer as given at the end of the time, as the timer never closes the question', () => {
    const q = quiz([single('a')])
    expect(reveal(q, startPlay(q, 0, 0)!, right('a'), 60_000)).toMatchObject({ timeMs: 20_000, points: 500 })
  })

  it("uses the group's own rules", () => {
    const q = quiz([single('a', { groupId: 'g1' })])
    expect(reveal(q, startPlay(q, 0, 0)!, right('a'), 10_000).points).toBe(1000)
  })

  it('adds the streak bonus from the second right answer in a row', () => {
    const q = quiz([single('a'), single('b')], { streakBonus: true, speedBonus: false })
    const first = reveal(q, startPlay(q, 0, 0)!, right('a'), 0)
    expect(first.points).toBe(1000)
    const second = reveal(q, nextQuestion(q, first, 0)!, right('b'), 0)
    expect(second).toMatchObject({ bonus: 100, points: 1100 })
    expect(revealSnapshot(q, second, 0)?.me.streak).toBe(2)
  })

  it('scores a partly right partial-credit answer as a game would, keeping the streak', () => {
    const multi: Question = {
      id: 'm',
      type: 'multiple',
      text: 'm',
      timeLimitSec: 20,
      points: 1000,
      scoring: 'partial',
      options: ['a', 'b', 'c'].map((id) => ({ id, text: id })),
      correctOptionIds: ['a', 'b'],
    }
    const q = quiz([single('s'), multi], { streakBonus: true, speedBonus: false })
    const first = reveal(q, startPlay(q, 0, 0)!, right('s'), 0)
    const second = reveal(q, nextQuestion(q, first, 0)!, { type: 'multiple', optionIds: ['a'] }, 0)
    expect(second).toMatchObject({ correct: 'partial', points: 500, bonus: 0 })
    const snapshot = revealSnapshot(q, second, 0)
    expect([snapshot?.lastCorrect, snapshot?.me.streak, snapshot?.reveal?.partialCount]).toEqual(['partial', 1, 1])
  })

  it('leaves polls and text without accepted answers ungraded', () => {
    const poll = { id: 'p', type: 'poll', text: 'p', timeLimitSec: 20, points: 1000, options: [{ id: 'o', text: 'x' }, { id: 'o2', text: 'y' }] } as Question
    const text = { id: 't', type: 'text', text: 't', timeLimitSec: 20, points: 1000, acceptedAnswers: [] } as unknown as Question
    const q = quiz([poll, text])
    const voted = reveal(q, startPlay(q, 0, 0)!, { type: 'poll', optionId: 'o' }, 0)
    expect(voted).toMatchObject({ correct: null, points: 0 })
    const typed = reveal(q, nextQuestion(q, voted, 0)!, { type: 'text', value: 'anything' }, 0)
    expect(typed).toMatchObject({ correct: null, points: 0 })
  })

  it('accepts a small typo as a near miss when the quiz allows typos', () => {
    const text = { id: 't', type: 'text', text: 't', timeLimitSec: 20, points: 1000, acceptedAnswers: ['Budapest'] } as unknown as Question
    const q = quiz([text], { speedBonus: false })
    expect(reveal(q, startPlay(q, 0, 0)!, { type: 'text', value: 'Budpest' }, 0)).toMatchObject({ correct: true, nearMiss: true, points: 1000 })
  })

  it('takes the points back when an edited question is played again', () => {
    const q = quiz([single('a'), single('b')], { speedBonus: false })
    const second = reveal(q, nextQuestion(q, reveal(q, startPlay(q, 0, 0)!, right('a'), 0), 0)!, right('b'), 0)
    expect(scoreOf(second)).toBe(2000)
    const again = restartQuestion(q, second, 5)!
    expect(again).toMatchObject({ index: 1, revealed: false, answer: null, startedAt: 5 })
    expect(scoreOf(again)).toBe(1000)
  })

  it('ends after the last played question', () => {
    const q = quiz([single('a'), single('b', { off: true })])
    expect(nextQuestion(q, reveal(q, startPlay(q, 0, 0)!, null, 0), 0)).toBeNull()
  })

  it('builds the reveal a phone would get, with results shown', () => {
    const q = quiz([single('a', { groupId: 'g1' }), single('b')], { revealAnswers: 'atEnd' })
    const snapshot = revealSnapshot(q, reveal(q, startPlay(q, 0, 0)!, right('a'), 0), 0)!
    expect(snapshot).toMatchObject({
      phase: 'reveal',
      questionIndex: 0,
      questionCount: 2,
      answersHidden: false,
      lastCorrect: true,
      lastPoints: 1000,
      myAnswer: right('a'),
      nextQuestion: { index: 1, type: 'single', groupTitle: null },
      group: { id: 'g1', firstIndex: 0, questionCount: 1, count: 1 },
    })
    expect(snapshot.reveal?.question.id).toBe('a')
  })
})
