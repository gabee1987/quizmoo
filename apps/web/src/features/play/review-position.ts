/** " (2/4)" while the host steps through several shown questions ("Show answers"), else nothing. */
export function reviewPosition(snapshot: { reviewQueue: number[] | null; questionIndex: number }): string {
  const queue = snapshot.reviewQueue
  if (!queue || queue.length < 2) return ''
  return ` (${queue.indexOf(snapshot.questionIndex) + 1}/${queue.length})`
}
