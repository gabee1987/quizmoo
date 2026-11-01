import { z } from 'zod'

/** The seasons with their own look (phase 50), in calendar order; on a tie between overlapping windows the earlier one wins. */
export const seasons = [
  'newYear',
  'carnival',
  'valentine',
  'womensDay',
  'aprilFools',
  'easter',
  'halloween',
  'stNicholas',
  'christmas',
] as const
export const seasonSchema = z.enum(seasons)
export type Season = z.infer<typeof seasonSchema>

/** Longest stretch a season may start before or end after its main day. */
export const MAX_SEASON_DAYS = 31

/** An admin's change to a season's dates: days before and after its main day, or the season left out. */
export const seasonWindowSchema = z.object({
  before: z.number().int().min(0).max(MAX_SEASON_DAYS),
  after: z.number().int().min(0).max(MAX_SEASON_DAYS),
  off: z.boolean(),
})
export type SeasonWindow = z.infer<typeof seasonWindowSchema>

/** The changed seasons; a season missing here keeps its built-in dates. */
export const seasonWindowsSchema = z.partialRecord(seasonSchema, seasonWindowSchema)
export type SeasonWindows = z.infer<typeof seasonWindowsSchema>
