// Applies the saved colour mode before first paint (no light flash in dark mode).
// A same-origin file rather than an inline script: the CSP allows scripts from 'self' only.
// Mirrors resolveMode() in src/lib/mode.ts.
;(function () {
  var mode = 'system'
  try {
    mode = localStorage.getItem('quizmoo.mode') || 'system'
  } catch (e) {}
  var dark = mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.mode = dark ? 'dark' : 'light'
})()
