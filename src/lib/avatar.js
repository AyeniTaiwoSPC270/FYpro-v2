// Avatar image helpers: cache-busting + canvas cropping.

/**
 * Append a cache-busting timestamp so a re-uploaded avatar at a stable
 * storage path (same public URL) is not served stale from the CDN/browser.
 * Falsy input is returned unchanged.
 */
export function withCacheBust(url) {
  if (!url) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}t=${Date.now()}`
}

/**
 * Load an image with anonymous CORS so it can be drawn to a canvas without
 * tainting it. Rejects on load error (e.g. blocked CORS).
 */
export function createImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (err) => reject(err))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = src
  })
}

/**
 * Draw the react-easy-crop `croppedAreaPixels` region of `src` into a
 * square `size`x`size` canvas and export it as a JPEG blob.
 * @param {string} src        image URL or object URL
 * @param {{x:number,y:number,width:number,height:number}} areaPixels
 * @param {number} size       output edge length in px (default 512)
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(src, areaPixels, size = 512) {
  const image = await createImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  ctx.drawImage(
    image,
    areaPixels.x, areaPixels.y, areaPixels.width, areaPixels.height,
    0, 0, size, size,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export produced no blob'))),
      'image/jpeg',
      0.9,
    )
  })
}
