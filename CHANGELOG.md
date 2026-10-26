# Novedades

Todas las versiones de Enhome. Los instaladores están en las [versiones publicadas](https://github.com/Fnqqew/enhome/releases) del repositorio.

## 3.1.0 · 2026-10-26

El día con estructura y Claude que vuelve a crear los ejercicios.

### Arreglos

- **Claude no creaba los ejercicios** de los tópicos que todavía no tienen banco (por ejemplo, en portugués) y la práctica no abría. Claude omitía campos o devolvía la lista sin el formato pedido. Ahora cada pedido lleva los campos exactos de cada formato, se acepta la lista sola y cada ejercicio se valida por su cuenta: uno mal armado se descarta en vez de tirar abajo la práctica entera. Lo mismo en los exámenes.

### El día de práctica

- **Calentamiento:** si hay errores del cuaderno para hoy, el día empieza con hasta 5 (se puede saltar).
- **Microlección:** qué se aprende, la regla, ejemplos con un botón para escuchar cada uno, los errores típicos de hispanohablantes y una pregunta para comprobar que se entendió.
- **Cierre:** qué trabajaste, cuánto pasó al cuaderno, cuántos repasos vuelven mañana y un juego rápido para la fluidez.
- Arriba de Práctica se ve en qué parte del día estás.

### Contenido

- Bancos de ejercicios para el primer tópico de portugués: la práctica abre al instante.

## 3.0.0 · 2026-10-26

Más rápida, con voz incluida y ejercicios para escuchar y hablar todos los días.

### Velocidad

- **La práctica abre al instante:** cada subtema trae ejercicios cortos ya escritos y revisados, que se corrigen sin Claude. Los largos se piden cada uno por separado y en paralelo, y aparecen a medida que llegan. Cuando a un subtema le quedan pocos ejercicios sin usar, la app escribe más en segundo plano.
- **La corrección no frena:** respondés y seguís con el siguiente mientras Claude corrige. La corrección aparece sola, y si falla se reintenta sin volver a responder.
- **Claude más rápido:** trabaja en sesiones que quedan abiertas y con una cola que atiende primero lo que estás esperando. Corregir una traducción pasó de unos 30 segundos a unos 5, y a cada pedido se le manda solo lo que necesita.
- **Exámenes:** las respuestas abiertas se corrigen en tanda.
- Más correcciones al instante: los ejercicios traen los errores típicos ya explicados.

### Voz

- **Voces naturales incluidas** para cada idioma y para el español, que se bajan solas la primera vez y funcionan sin internet. La segunda voz del idioma se baja con la primera conversación.
- Las conversaciones se escuchan **a dos voces** y cada frase queda guardada, así la segunda vez suena al instante.
- *Ajustes → Voz*: elegís la voz de cada idioma (con una voz rioplatense para el español) o volvés a las de Windows.
- El reconocimiento de voz usa un modelo chico o uno más preciso según tu compu, y se puede cambiar.

### Ejercicios

- **Seis formatos nuevos:**
  - dictado;
  - escucha de una charla con preguntas;
  - pares mínimos (*ship* o *sheep*);
  - repetí en voz alta, con el reconocimiento de voz;
  - transformar una oración;
  - ordenar las oraciones de un texto.
- **Escuchar y hablar todos los días:** desde 8 ejercicios, la práctica suma siempre algo para escuchar y algo para decir en voz alta.
- **Recordar más que reconocer:** con el nivel hay menos opción múltiple y más ejercicios en los que escribís la respuesta.
- **Segundo intento:** si le errás a un ejercicio corto, te dice por qué no era y probás de nuevo. Si acertás, vale con menos puntaje. Si volvés a errar, va al cuaderno de errores y vuelve al final de la práctica, sin contar en el puntaje.

### Repaso

- Errores, palabras y frases pasan a un solo repaso con **FSRS**, que aprende de lo que recordás y te los muestra justo antes de que se te olviden. Se conservan el progreso y la experiencia.

### Arreglos

- El ícono de los accesos directos ya no queda en blanco después de correr las pruebas.
- Las respuestas de Claude con un formato inesperado se registran para poder revisarlas.

### Por dentro

- Un módulo por tipo de ejercicio, cada idioma como un paquete con sus voces y los canales de la app separados por área.
- `npm run content:check` revisa el temario y los bancos, y `npm run content:banks` los escribe con Claude.
- 442 tests y 9 pruebas de interfaz.

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
