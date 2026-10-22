/**
 * Three soft colour blobs in the theme's hues drifting slowly behind every page. Each is one
 * composited layer moved with transforms only, so phones spend nothing on it per frame; the
 * reduced-motion rule freezes them.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span className="absolute -top-[18vmax] -left-[12vmax] size-[62vmax] animate-drift rounded-full bg-[radial-gradient(circle,var(--blob-1)_0%,transparent_64%)] will-change-transform" />
      <span
        className="absolute top-[30vmax] -right-[22vmax] size-[58vmax] animate-drift rounded-full bg-[radial-gradient(circle,var(--blob-2)_0%,transparent_64%)] will-change-transform"
        style={{ animationDuration: '36s', animationDelay: '-12s' }}
      />
      <span
        className="absolute -bottom-[26vmax] left-[16vmax] size-[54vmax] animate-drift rounded-full bg-[radial-gradient(circle,var(--blob-3)_0%,transparent_64%)] will-change-transform"
        style={{ animationDuration: '44s', animationDelay: '-25s' }}
      />
    </div>
  )
}
