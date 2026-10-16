// Aviso interno de que pudo haber logros, niveles o comodines nuevos (al terminar una práctica
// o entregar un examen), para mostrarlos al instante en vez de esperar al próximo sondeo.

const EVENT = 'enhome:rewards'

export function announceRewards(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function onRewards(callback: () => void): () => void {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
