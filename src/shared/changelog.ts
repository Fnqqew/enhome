// Novedades de cada versión: se muestran una vez al abrir una versión nueva y quedan en Ayuda.

export interface Release {
  version: string
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '3.1.0',
    date: '2026-10-26',
    title: 'El día con estructura y Claude que vuelve a crear los ejercicios',
    items: [
      'Arreglado: Claude no creaba los ejercicios de los tópicos sin banco (como los de portugués) y la práctica no abría.',
      'El día empieza con un calentamiento: hasta 5 errores del cuaderno que tocan hoy.',
      'Microlección antes de practicar: la regla, ejemplos para escuchar, los errores típicos de hispanohablantes y una pregunta para comprobar que se entendió.',
      'Cada práctica mezcla hasta 2 ejercicios de tópicos anteriores, de lo que más te cuesta según el cuaderno de errores.',
      'Al terminar, el cierre te dice qué trabajaste, qué pasó al cuaderno y cuántos repasos vuelven mañana.',
      'El primer tópico de portugués trae sus ejercicios listos: la práctica abre al instante.'
    ]
  },
  {
    version: '3.0.0',
    date: '2026-10-26',
    title: 'Más rápida, con voz incluida y ejercicios para escuchar y hablar',
    items: [
      'La práctica abre al instante con ejercicios ya escritos y revisados, y los largos aparecen a medida que llegan.',
      'Lo que corrige Claude no frena: seguís con el siguiente y la corrección aparece sola, en unos segundos.',
      'Voces naturales para cada idioma y para el español, que se bajan solas y funcionan sin internet. Las conversaciones se escuchan a dos voces.',
      'Seis ejercicios nuevos: dictado, escucha de una charla, pares mínimos, repetí en voz alta, transformar una oración y ordenar un texto.',
      'Todos los días hay algo para escuchar y algo para decir en voz alta (en las prácticas de 8 ejercicios o más).',
      'Si le errás a un ejercicio corto, te dice por qué no era y probás de nuevo. Lo que fallás dos veces vuelve al final de la práctica.',
      'Con el nivel hay menos opción múltiple y más ejercicios en los que escribís la respuesta.',
      'Errores, palabras y frases se repasan con FSRS, justo antes de que se te olviden.',
      'Ajustes → Voz: elegí la voz de cada idioma, una voz rioplatense para el español o las voces de Windows.'
    ]
  },
  {
    version: '2.0.0',
    date: '2026-10-16',
    title: 'Cuatro idiomas completos y mucho más para practicar',
    items: [
      'Portugués de Brasil, italiano y francés, además de inglés: cada uno de A1 a C1, con su propio progreso. Se cambia desde la barra lateral.',
      'Inicio con «qué hago hoy»: una sola acción principal, la racha y la cuenta regresiva al examen.',
      'Repaso: el cuaderno de errores vuelve a los 1, 3, 7 y 15 días, y las palabras que guardás se repasan con tarjetas.',
      'Juegos para practicar al instante: contrarreloj, memotest, ahorcado, dictado, pronunciación con reconocimiento de voz y más.',
      'Lecturas graduadas, diario corregido por Claude y charla libre en el idioma del curso.',
      'Seleccioná una palabra en cualquier texto para traducirla y guardarla.',
      'La práctica empieza apenas llegan los ejercicios cortos, se prepara sola al abrir la app y se adapta a cómo te viene yendo.',
      'Buscador con Ctrl+K, atajos de teclado, barra lateral plegable y modo enfoque.',
      'Certificado en PDF al completar un nivel, estadísticas y biblioteca de todo lo generado.',
      'Meta diaria en minutos o actividades, recordatorio de Windows a la hora que elijas e ícono en la bandeja.',
      'Modo lectura con resaltados para los resúmenes, cuatro estilos nuevos y un estilo propio con tus colores.',
      'Copias de seguridad automáticas, exportar e importar el progreso, y buscar actualizaciones desde Acerca de.'
    ]
  },
  {
    version: '1.5.0',
    date: '2026-10-05',
    title: 'Pantalla de carga y botones de ventana animados',
    items: [
      'Una pantalla de carga con la casa que se dibuja y el saludo en el idioma del curso.',
      'Animación al pasar por los botones de la ventana.'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-10-05',
    title: 'Práctica larga e inmersiva',
    items: [
      'Conversaciones, situaciones para resolver y tandas de traducción.',
      'Secciones Comentarios y Acerca de, y estilos visuales intercambiables.'
    ]
  }
]
