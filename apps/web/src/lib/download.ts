/** Saves a blob as a file through a temporary link (phones offer to open or share it). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}
