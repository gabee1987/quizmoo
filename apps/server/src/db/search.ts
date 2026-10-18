import { sql, type SQL } from 'drizzle-orm'

/**
 * Accented letters and their plain forms for `translate()` in Postgres (no `unaccent` extension
 * needed): Hungarian and the common Western and Central European ones. Same length, letter by letter.
 */
export const ACCENTED = 'áàâäãåāăąçćčďéèêëēęěíìîïłńňñóòôöõøōőřśšşťúùûüūůűýÿźżž'
export const PLAIN = 'aaaaaaaaacccdeeeeeeeiiiilnnnoooooooorssstuuuuuuuyyzzz'

/** Lower case without accents, in SQL: how titles are stored for search and how the search text is compared. */
export const foldSql = (value: SQL): SQL => sql`translate(lower(${value}), ${sql.raw(`'${ACCENTED}'`)}, ${sql.raw(`'${PLAIN}'`)})`

/** `%` and `_` in a search typed by the host are letters, not wildcards. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)
