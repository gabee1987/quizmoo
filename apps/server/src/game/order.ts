/**
 * The order players see an ordering question's items in. Shuffled with a seed taken from the
 * question id, so every phone, the projector and every reconnect get the same order without
 * storing it, and never the correct order itself (that would give the answer away).
 */
export function displayOrder<T extends { id: string }>(questionId: string, options: readonly T[]): T[] {
  const shuffled = [...options]
  const random = seeded(questionId)
  // Fisher-Yates.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  // A shuffle can land on the original order; move the first item to the end then.
  if (shuffled.length > 1 && shuffled.every((option, i) => option.id === options[i]!.id)) shuffled.push(shuffled.shift()!)
  return shuffled
}

/** mulberry32 seeded with a hash of `text`: small, fast and good enough for shuffling. */
function seeded(text: string): () => number {
  let seed = 0
  for (const char of text) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
