// Biblioteca: lo generado del curso para buscar y releer.

export type LibraryKind = 'resumen' | 'lectura' | 'palabra' | 'diario'

export const LIBRARY_KINDS: Record<LibraryKind, string> = {
  resumen: 'Resúmenes',
  lectura: 'Lecturas',
  palabra: 'Vocabulario',
  diario: 'Diario'
}

export interface LibraryItem {
  kind: LibraryKind
  id: string
  title: string
  date: string
  text: string
  // Si el texto es Markdown (los resúmenes).
  markdown: boolean
}

export interface LibraryResult extends LibraryItem {
  snippet: string
}
