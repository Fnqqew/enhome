// Novedades de cada versión: se muestran una vez al abrir una versión nueva y quedan en Ayuda.

export interface Release {
  version: string
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: Release[] = [
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
