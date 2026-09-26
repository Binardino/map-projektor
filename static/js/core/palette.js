// Overlay palettes live in the stylesheet (--<name>-1, --<name>-2, … on
// :root) with every other colour; the JS that paints shapes inline reads
// them once. Deferred module scripts run after the stylesheet has loaded,
// so the values are there at import time.
export function readPalette(name, count) {
  const style = getComputedStyle(document.documentElement);
  return Array.from({ length: count }, (_, i) => style.getPropertyValue(`--${name}-${i + 1}`).trim());
}
