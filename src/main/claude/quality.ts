// Pautas de calidad compartidas: autocontrol al generar y revisión en una segunda llamada.

export const SELF_CHECK =
  'Antes de responder, verificá cada dato: que las respuestas marcadas como correctas lo sean, que no haya ambigüedades y que el inglés y el español no tengan errores.'

// Medido en la fase 4: con esfuerzo por defecto la revisión tardaba 76 s; con medio, 35 s,
// y encontró errores reales que el esfuerzo por defecto dejó pasar.
export const REVIEW_EFFORT = 'medium'

export const REVIEW_SYSTEM_PROMPT =
  'Sos un revisor de calidad de materiales de inglés para hispanohablantes de Argentina. Tu trabajo es encontrar y corregir cualquier error antes de que llegue al alumno, con máximo rigor. Respondé solo con el JSON pedido.'

// El revisor devuelve solo lo que corrige (mucho más rápido que reescribir todo).
// Se ignoran correcciones fuera de rango o que cambian el tipo de elemento.
export function applyCorrections<T>(
  items: T[],
  corrections: { index: number; replacement: T }[],
  sameKind: (original: T, replacement: T) => boolean = () => true
): T[] {
  const result = [...items]
  for (const { index, replacement } of corrections) {
    if (index >= 0 && index < result.length && sameKind(result[index], replacement)) result[index] = replacement
  }
  return result
}

export function numbered(items: unknown[]): string {
  return items.map((item, i) => `#${i}: ${JSON.stringify(item)}`).join('\n')
}

export const CORRECTIONS_GUIDE = `Devolvé solo lo que haya que corregir o reemplazar: en corrections, index es el número (#) del elemento y replacement es su versión corregida completa, del mismo tipo. Si todo está bien, corrections va vacío.
En issues anotá, en una frase cada uno, los problemas que encontraste (vacío si no hubo).`

export const QUALITY_CHECKLIST = `Verificá en cada uno:
- La respuesta marcada como correcta es correcta y es la única correcta: ninguna otra opción puede ser válida en un contexto razonable.
- El inglés es correcto y natural; el español es correcto y rioplatense.
- La explicación es correcta y coincide con la respuesta.
- La consigna se entiende sin ambigüedad.
- Corresponde al subtema y al nivel indicados.`
