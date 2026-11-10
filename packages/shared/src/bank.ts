import { z } from 'zod'
import { MAX_QUESTIONS, questionSchema, questionTypes } from './quiz.js'

/** Questions one host may keep in the question bank. */
export const MAX_BANK_QUESTIONS = 2000
export const MAX_BANK_TAGS = 10
export const BANK_PAGE_SIZE = 50

export const bankTagSchema = z.string().trim().min(1).max(30)

/** Free-form tags, trimmed; the same tag in another case counts once (the first spelling stays). */
export const bankTagsSchema = z
  .array(bankTagSchema)
  .transform((tags) => tags.filter((tag, i) => tags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === i))
  .pipe(z.array(z.string()).max(MAX_BANK_TAGS))

/** Saving questions to the bank; each question is checked like a quiz's on the server. */
export const bankSaveSchema = z.object({
  questions: z.array(z.unknown()).min(1).max(MAX_QUESTIONS),
  tags: bankTagsSchema.default([]),
})

/** Left-out tags or switch stay as they are (the quiz editor sends only the question). */
export const bankUpdateSchema = z.object({ question: z.unknown(), tags: bankTagsSchema.optional(), autoSync: z.boolean().optional() })

export const bankDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(MAX_QUESTIONS) })

export const bankListQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  type: z.enum(questionTypes).optional(),
  tag: bankTagSchema.optional(),
  offset: z.coerce.number().int().min(0).max(MAX_BANK_QUESTIONS).default(0),
})
export type BankListQuery = z.infer<typeof bankListQuerySchema>

export const bankQuestionSchema = z.object({
  id: z.string(),
  question: questionSchema,
  tags: z.array(z.string()),
  /** Saves update the quizzes' unchanged copies at once. */
  autoSync: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type BankQuestion = z.infer<typeof bankQuestionSchema>

export interface BankPage {
  questions: BankQuestion[]
  /** Matching questions in all. */
  total: number
  /** The offset of the next page; null on the last one. */
  next: number | null
}
