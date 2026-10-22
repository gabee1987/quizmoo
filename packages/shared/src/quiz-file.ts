import { z } from 'zod'
import type { QuizInput } from './quiz.js'

/**
 * The Quizmoo quiz file (`.quizmoo.json`): a full copy of a quiz, with every setting and its
 * images embedded as base64, for moving a quiz between installs and people. Other keys (the
 * `guide` written by the export) are ignored on import.
 */
export const QUIZ_FILE_FORMAT = 'quizmoo-quiz'
export const QUIZ_FILE_VERSION = 1
/** The import route's body limit; each image is still held to the 5 MB upload limit. */
export const MAX_QUIZ_FILE_BYTES = 25 * 1024 * 1024

export const quizFileSchema = z.object({
  format: z.literal(QUIZ_FILE_FORMAT),
  version: z.literal(QUIZ_FILE_VERSION),
  /** Validated by the server with the quiz schema, so problems name the quiz's own paths. */
  quiz: z.unknown(),
  /** Image id -> base64 bytes, for the ids the quiz refers to. */
  images: z.record(z.string().regex(/^[\w-]{1,32}$/), z.string().max(8 * 1024 * 1024)).default({}),
})
export type QuizFile = z.infer<typeof quizFileSchema>

/** Every image a quiz refers to: question, option and group images and the logo, each once. */
export function quizImageIds(quiz: QuizInput): string[] {
  const ids = quiz.questions.flatMap((q) => [q.imageId, ...('options' in q ? q.options.map((o) => o.imageId) : [])])
  const groupIds = quiz.groups.map((g) => g.imageId)
  return [...new Set([...ids, ...groupIds, quiz.branding.logoImageId].filter((id): id is string => !!id))]
}

/** The quiz with its image ids swapped through `map` (ids missing from it are left as they are). */
export function mapQuizImages(quiz: QuizInput, map: ReadonlyMap<string, string>): QuizInput {
  const swap = <T extends { imageId?: string | undefined }>(item: T): T =>
    item.imageId ? { ...item, imageId: map.get(item.imageId) ?? item.imageId } : item
  const logo = quiz.branding.logoImageId
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ('options' in q ? { ...swap(q), options: q.options.map(swap) } : swap(q))),
    groups: quiz.groups.map(swap),
    branding: { ...quiz.branding, logoImageId: logo ? (map.get(logo) ?? logo) : null },
  }
}
