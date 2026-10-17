# Novedades

Todas las versiones de Enhome. Los instaladores están en las [versiones publicadas](https://github.com/Fnqqew/enhome/releases) del repositorio.

## 2.0.0 · 2026-10-16

Cuatro idiomas completos y mucho más para practicar.

### Idiomas

- Portugués de Brasil, italiano y francés, además de inglés. Cada uno va de A1 a C1 (25 tópicos) y tiene su propio progreso, racha y experiencia.
- El idioma se cambia desde la barra lateral. Claude genera y corrige en el idioma de cada curso, y la lectura en voz alta usa la voz que corresponde.
- El examen inicial usa un banco fijo de preguntas para cada idioma. Si nunca estudiaste el idioma, «Empezar desde cero» te lleva directo al primer tópico.
- Cada curso se puede pausar sin perder la racha y reiniciar desde Ajustes.

### Práctica y aprendizaje

- **Repaso:** los errores vuelven a los 1, 3, 7 y 15 días. Las palabras guardadas se repasan con tarjetas, y después de cada examen podés revisarlo.
- **Juegos sin Claude:** contrarreloj, escuchá y elegí, frases desordenadas, memotest, ahorcado, ¿está bien?, dictado y pronunciación con reconocimiento de voz local.
- **Para practicar más:** lecturas graduadas, un diario que corrige Claude y una charla libre en el idioma del curso, con correcciones al costado.
- **Seleccionar texto:** cualquier texto se puede traducir, resaltar o preguntar a Claude, y las palabras se guardan para repasar.
- **Práctica más ágil:**
  - se prepara sola al abrir la app y arranca con los ejercicios cortos mientras llegan los largos;
  - acepta errores de tipeo;
  - la dificultad se adapta por subtema;
  - elegís cuántos ejercicios hacer y qué formatos excluir.
- **Simulacros por subtema** y **certificado en PDF** al terminar un nivel.
- **Temario revisable:** podés revisar y corregir cada tópico desde la app.

### Secciones nuevas e inicio

- Inicio enfocado en «qué hago hoy»: una sola acción principal, la racha, la meta del día y la cuenta regresiva al examen.
- Secciones nuevas: Repaso, Estadísticas, Charla, Juegos, Lecturas, Diario, Biblioteca y Ayuda.
- Recorrido de bienvenida, buscador con Ctrl+K, atajos Ctrl+1 a Ctrl+9, barra lateral plegable y modo enfoque.

### Diseño

- Íconos de línea propios, esqueletos de carga, ejercicio rediseñado y gráficos de progreso.
- Modo lectura cómodo para los resúmenes, con índice y resaltados.
- Tres estilos nuevos (Noche, Papel y Alto contraste) y un editor para armar el tuyo con tus colores.
- La app se adapta a ventanas chicas.
- Celebración sutil al cerrar bien, números animados, sonidos opcionales y una transición de la tarjeta del día a la práctica.

### Ajustes

- Ajustes organizados por pestañas.
- Meta diaria en minutos o en actividades.
- Recordatorio de Windows a la hora que elijas, ícono en la bandeja y arranque con Windows.
- Velocidad o precisión de Claude, y variante del español para las explicaciones.

### Datos y versiones

- Copia de seguridad automática diaria (se guardan las últimas 7).
- Exportar e importar todo el progreso en un archivo `.enhome`, y borrado de datos claro.
- Buscar e instalar actualizaciones desde Acerca de.

### Por dentro

- **Seguridad y robustez:**
  - la interfaz corre aislada (sandbox) y la app instalada no puede arrancar como Node;
  - la ventana recuerda su tamaño y posición;
  - hay registro de errores en un archivo, y los errores de Claude se explican y se pueden cancelar.
- **Base de datos:** índices y mantenimiento automático; cada sección se carga cuando se usa y solo se cargan las tipografías del estilo elegido.
- **Calidad del código:**
  - 327 tests;
  - pruebas de interfaz con Playwright (`npm run e2e`);
  - revisión automática en GitHub Actions, ESLint y Prettier con revisión antes de cada commit;
  - `npm run update-local` actualiza la app instalada con un solo comando.

## 1.5.0 · 2026-10-05

- Pantalla de carga: una casa que se dibuja de un trazo y, adentro, «Hola» que se convierte en «Hello». Toma los colores del estilo desde el primer instante.
- La práctica se genera más rápido cuando algo falla: solo se reintenta la tanda con problemas.
- Animación al pasar el cursor por los botones de la ventana.

## 1.4.1

- Animación al pasar el cursor por los botones de la ventana.

## 1.4.0 · 2026-10-05

- Práctica más larga y exigente: 8 ejercicios por día y tres formatos nuevos (tanda de traducción, conversación y situación real), con devolución parte por parte.
- Botones de la ventana a la derecha, íconos de línea propios, animaciones suaves, y sombras y foco de los campos más cuidados.
- Secciones nuevas: Comentarios y Acerca de.
- Ajustes muestra una miniatura real de cada estilo.
- Correcciones:
  - los accesos directos ya no se reescriben con cada ajuste;
  - el selector de colores respeta el tema al instante;
  - la alternancia entre conversación y situación funciona.

## 1.3.0 · 2026-09-18

- La app pasa a llamarse Enhome.

## 1.2.0 · 2026-09-18

- Ventana propia, y el ícono de la barra de tareas sigue al estilo elegido.

## 1.1.0 · 2026-09-16

- Ícono propio y estilos visuales elegibles: Celeste, Ruta, Cuaderno, Racha y Original.

## 1.0.0 · 2026-09-15

- Primera versión instalable: inglés A1 y A2 con examen inicial, recorrido semanal, práctica diaria generada por Claude, resúmenes, examen semanal, racha, experiencia, comodines y logros.
