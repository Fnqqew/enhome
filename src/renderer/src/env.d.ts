// Hojas de estilo importadas por su efecto (las procesa Vite).
declare module '*.css'

// Archivos que Vite entrega como dirección (por ejemplo, el motor wasm del reconocimiento de voz).
declare module '*?url' {
  const url: string
  export default url
}
