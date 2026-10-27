/** One release on the What's new page; its texts are in the dictionaries under `releaseKey(version)`. */
export interface Release {
  version: string
  /** The release day, `YYYY-MM-DD`. */
  date: string
}

export interface ReleaseNotes {
  title: string
  intro: string
  sections: { title: string; items: string[] }[]
}

/** Newest first. The first entry must be the app's version (`releases.test.ts` checks it). */
export const releases: Release[] = [
  { version: '1.6.0', date: '2026-10-27' },
  { version: '1.5.0', date: '2026-10-27' },
  { version: '1.4.0', date: '2026-10-25' },
  { version: '1.3.0', date: '2026-10-25' },
  { version: '1.2.0', date: '2026-10-25' },
  { version: '1.1.0', date: '2026-10-21' },
]

/** i18next reads dots as nesting, so 1.1.0 is stored as `1_1_0`. */
export const releaseKey = (version: string) => `whatsNew.releases.${version.replaceAll('.', '_')}`
