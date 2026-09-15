# Proyecto Inglés: documento base y plan de implementación

## Contexto
App de escritorio personal para aprender inglés. Nace de un mapa conceptual con tres secciones (Práctica, Resúmenes, Pruebas), la lógica de Progresión y el diseño. Después de dos rondas de discusión se cerraron todas las contradicciones y los huecos. Hay tres condiciones de partida: **un solo usuario (el dueño)**, **sin presupuesto** y la IA funciona con **su suscripción de Claude** a través de Claude Code instalado en su compu. La carpeta del proyecto está vacía.

---

## 1. Reglas del producto (definitivas)

### Temario y ciclo semanal
- Se sigue el **marco europeo**. La primera versión trae **A1 y A2**, con 8 a 10 tópicos. Los niveles siguientes llegan en actualizaciones.
- **1 tópico por semana.** De lunes a viernes, cada día trata un subtema del tópico. El sábado se rinde el examen (fecha sugerida). El domingo es libre: repaso, simulacros o recuperar una falta.
- Al empezar cada tópico se muestra un resumen inicial.
- El contenido se ve en tres áreas: **gramática, comprensión lectora y escritura**. El vocabulario aparece solo dentro de los textos. Escucha y vocabulario propio quedan para una actualización.

### Examen inicial
- Examen corto que sube o baja la dificultad según las respuestas y determina el nivel y los puntos débiles.
- Los tópicos por debajo del nivel quedan aprobados, pero pueden reabrirse si después aparecen fallas en ellos.
- Si se hace entre miércoles y domingo, la primera semana de tópico arranca el lunes siguiente. Mientras tanto hay práctica libre y simulacros.

### Faltas y bloqueo
- Una **falta** es un día de lunes a viernes que termina sin completar la práctica.
- Los días pendientes se acumulan: la práctica no se pierde.
- El domingo se puede **recuperar 1 falta**.
- Con **3 faltas o más**, el examen del sábado se bloquea. La semana siguiente sigue el mismo tópico, primero los días pendientes, y se rinde ese sábado.
- El examen se habilita solo con la práctica de la semana completa.

### Exámenes
- Unas 20 preguntas, nota de 0 a 10, **se aprueba con 8**. La dificultad depende del nivel y de los errores anteriores.
- Se puede volver a preguntas anteriores. **No se puede salir del examen** hasta entregarlo y ver la corrección.
- **Seguro:** cada respuesta se guarda automáticamente. Si se cierra la app, el examen queda en pausa **hasta 30 minutos**, **1 vez por examen**. Si se pasa el tiempo, se anula **sin contar como reprobado** y se genera uno nuevo con otras preguntas.
- **Si reprueba:** la semana siguiente se enfoca en lo fallado y el examen tiene preguntas nuevas. **Con 2 reprobados**, se activa el repaso de tópicos anteriores.
- **Simulacros:** a elección, más fáciles, del tópico o de inglés en general. No cuentan para aprobar, pero sí alimentan la detección de puntos débiles.

### Detección de puntos débiles
- Cada pregunta y cada ejercicio llevan la etiqueta del tópico y del subtema que evalúan.
- Con **más del 40% de errores** en un tópico anterior (en exámenes o simulacros), la app recomienda un repaso de 1–2 días.

### Práctica
- Ejercicios variados y ordenados. El usuario puede cambiar de ejercicio, seguir y calificar si le gusta o le sirve.
- Recibe una devolución breve. En escritura, la IA corrige con criterios definidos.
- Los tipos mejor calificados aparecen más seguido, sin dejar de lado los demás.

### Resúmenes
- Tipos de resumen:
  - explicación completa
  - esquema
  - tabla comparativa
  - ejemplos en contexto
  - errores comunes de hispanohablantes
  - comparación con el español
  - paso a paso
  - mini historia
  - tarjetas de repaso
  - "explicámelo simple"
- El usuario elige sus preferidos y los califica.
- Explicación en español, ejemplos en inglés.

### Progreso con juego y recompensas
- **Racha** de días seguidos cumpliendo la práctica. El domingo no la corta.
- **Experiencia y nivel de jugador.** La constancia multiplica lo que se gana.
- **Logros.** Por ejemplo: 7 días seguidos, aprobar con 10, recuperar un tópico.
- **Comodines**, que se ganan con rachas:
  - *Segunda oportunidad:* rehacer 1 pregunta fallida de un examen. Se gana a los 7 días de racha.
  - *Pista:* en práctica.
  - *Protector de racha:* te salva un día de falta.
- **Límite:** máximo 1 comodín por examen.
- **Mapa visual** A1 → C1 con los tópicos aprobados, en curso y bloqueados. También muestra las notas, los puntos débiles y el historial.

### Diseño
- Una sola base visual para toda la app: **minimalista, sobria y amigable**.
- Personalización: modo claro u oscuro, 6–8 paletas de color, tamaño de letra, 2–3 tipografías y espaciado compacto o amplio. Todo dentro de la misma base visual.
- **Modo lectura en toda la app:** vista sin distracciones, lectura en voz alta con las voces del sistema (gratis) y la opción de seleccionar un texto para preguntarle a Claude.
- La interfaz está en español.

---

## 2. Arquitectura

- **Electron + React + TypeScript**, armado con `electron-vite`.
- **Proceso principal:**
  - SQLite local con `node:sqlite`, que ya viene incluido en Electron, con la base en la carpeta de datos del usuario. Se descartó `better-sqlite3` porque en Windows necesita Visual Studio para compilarse.
  - **Puente con Claude:** lanza `claude -p --output-format json` y le pasa el pedido por la entrada estándar.
  - Valida con `zod` que la IA devuelva el formato esperado y reintenta si no.
  - Comunicación con la interfaz por IPC tipado.
- **Sesión única:** al abrirse, la app verifica que Claude Code esté instalado y con sesión iniciada. Si no, muestra una pantalla de bloqueo con instrucciones. No hay cuentas propias.
- **Menos llamadas a la IA:** los ejercicios de la semana se generan por adelantado (al empezar el tópico) y quedan guardados. En tiempo real solo se usa para corregir escritura, dar devoluciones, generar exámenes nuevos y responder dudas.
- **Contenido base dentro del repo:** `content/<nivel>/<tópico>/` con `topic.json` (subtemas, objetivos, etiquetas) y resúmenes base en Markdown. Lo genera Claude y lo revisa el usuario.
- **Temas visuales:** variables CSS; cada paleta es un archivo de valores.
- **Tests:** `vitest` para el motor de progresión y las reglas.

### Estructura prevista
```
electron/        main.ts, preload.ts, claude/ (puente), db/ (esquema y migraciones), engine/ (progresión, faltas, exámenes, juego)
src/             app React: pages/ (Inicio, Práctica, Resúmenes, Pruebas, Progreso, Ajustes), components/, theme/
content/A1, A2   temario base revisado
tests/           tests del motor
```

### Datos (SQLite, tablas principales)
- `settings`: tema, paleta, tipografía, preferencias de resumen.
- `topic_progress`: estado de cada tópico, intentos, fechas.
- `day_progress`: práctica de cada día, completa o no, falta, recuperada.
- `exercises` y `exercise_attempts`: ejercicios generados, respuestas, etiquetas, calificación del usuario.
- `exams`, `exam_answers` y `exam_sessions`: exámenes, respuestas, pausa y anulación.
- `summaries` y `summary_ratings`.
- `player`: experiencia, nivel, racha. También `achievements` e `inventory` (comodines).

---

## 3. Fases de implementación

0. **Base:** `git init`, repo privado en GitHub, proyecto `electron-vite`, **verificar que `claude -p` funciona con la suscripción** y la pantalla de bloqueo.
1. **Núcleo:** esquema de base de datos, puente con Claude validado, base visual con temas, navegación principal.
2. **Contenido A1–A2:** temario y resúmenes base generados y revisados.
3. **Motor de progresión:** examen inicial, calendario semanal, faltas, bloqueo, repaso de tópicos anteriores. Con tests.
4. **Práctica:** tipos de ejercicio, cambiar o seguir, calificaciones, devolución, corrección de escritura.
5. **Resúmenes:** tipos, preferencias, modo lectura con voz.
6. **Pruebas:** examen del sábado, pausa de 30 minutos, simulacros, uso de comodines.
7. **Progreso:** racha, experiencia, logros, comodines, mapa visual.
8. **Ajustes:** personalización completa y pulido final.

## Reglas detalladas del motor (definidas en la fase 3)

Todas las constantes están en `src/main/engine/rules.ts`.

**Examen inicial**
- Va tópico por tópico, con 3 preguntas de opción múltiple generadas por Claude, cada una de un subtema distinto. Se puede responder «No lo sé», que cuenta como error.
- Con 2 de 3 correctas se pasa al tópico siguiente. El primer tópico que no se supera es donde empieza el recorrido, y el examen termina ahí.
- Los tópicos anteriores quedan aprobados. Si se hace lunes o martes, la semana arranca ese mismo día sin contar faltas de los días previos. Si se hace de miércoles en adelante, arranca el lunes siguiente.
- Si se cierra la app, el examen se retoma donde quedó.

**Semana**
- Cada semana tiene 5 prácticas en orden. La práctica N se habilita el día N: no se puede adelantar, pero sí ponerse al día con las atrasadas, varias el mismo día.
- Una falta es un día de lunes a viernes que termina sin ninguna práctica hecha.
- Practicar un domingo con faltas recupera 1, una sola vez por semana. Si ya no quedan prácticas pendientes, se registra un repaso de recuperación.
- El examen se habilita con las 5 prácticas hechas y menos de 3 faltas efectivas, desde el viernes y hasta el domingo.

**Fin de semana sin resultado**
- Si se pasa el domingo sin rendir, sea por prácticas incompletas, bloqueo o porque no se rindió, el lunes arranca una semana de continuación del mismo tópico.
- Esa semana empieza por las prácticas pendientes y completa los días libres con repaso del tópico.
- Si pasó más de una semana sin abrir la app, las faltas se cuentan desde el día en que se vuelve.

**Resultado del examen semanal**
- Con 8 o más, el tópico se aprueba y el siguiente arranca el lunes.
- Si reprueba, la semana siguiente es de reintento: los 5 días refuerzan los subtemas con más errores.
- Desde el segundo reprobado, los 2 primeros días repasan los prerrequisitos con más errores y los otros 3 refuerzan.
- En cualquier examen, un tópico anterior con más del 40 % de errores (y al menos 2 preguntas) queda marcado como «repaso recomendado». La marca se quita al hacer una práctica de repaso de ese tópico.

## Reglas de la práctica (definidas en la fase 4)

Las constantes están en `src/main/practice/composition.ts` y `src/main/practice/ai-grading.ts`.

**Tipos de ejercicio**
- Opción múltiple, completar, ordenar la oración y corregir el error. Trabajan gramática y se corrigen al instante.
- Traducir al inglés, que trabaja escritura. Si la respuesta coincide con una de referencia se corrige al instante; si no, la corrige Claude, que acepta traducciones válidas distintas.
- Comprensión lectora: un texto con 2 o 3 preguntas, con puntaje parcial.
- Escritura, que corrige Claude con criterios ponderados: lo que practica el subtema 40 %, gramática y ortografía 25 %, cumplir la consigna 25 %, vocabulario y claridad 10 %. Se considera correcta con 6/10 o más.
- En la corrección automática no cuentan las mayúsculas, la puntuación final ni las contracciones (*isn't* = *is not*).

**Armado de cada práctica**
- Claude genera de una vez 9 a 11 ejercicios del subtema, y la sesión usa 6. El resto queda como alternativa para «Cambiar ejercicio».
- Los días que trabajan lectura o escritura siempre incluyen al menos un ejercicio de ese tipo. La escritura va al final.
- El resto se elige priorizando variedad de tipos y los tipos mejor calificados. Se ordena de lo más guiado a lo más abierto.
- El alumno califica cada ejercicio con «No me sirvió», «Estuvo bien» o «Me encantó». Los tipos con promedio de 4 o más se generan más; los de 2 o menos, menos, salvo que sean obligatorios ese día.
- Se le pide a Claude que no repita las oraciones de los últimos 20 ejercicios del mismo subtema.
- Las prácticas de refuerzo (después de reprobar) y las de repaso usan una consigna distinta para Claude.

**Cuándo se genera**
- Al abrir la práctica, los ejercicios se preparan en segundo plano mientras se lee la introducción: puntos clave y ejemplos.
- Al terminar una práctica se prepara la siguiente, de a una generación por vez.

**Recuperación del domingo**
- Si ya no quedan prácticas pendientes, es una sesión de repaso del subtema del día que se faltó. Al terminarla se recupera la falta.

## Resúmenes (fase 5)

**Acceso**
- Solo se ven los tópicos desbloqueados: el que está en curso (aunque su semana todavía no haya empezado), los aprobados y los marcados para repasar.
- Antes del examen inicial no hay resúmenes disponibles.

**Tipos**
- **Explicación completa:** es el resumen base del temario y siempre aparece primero.
- **Generados por Claude:** esquema, tablas comparativas, ejemplos en contexto, errores comunes, comparación con el español, paso a paso, mini historia, diálogo, «explicámelo simple», preguntas frecuentes, trucos para recordar y tarjetas de repaso.
- **Generación:** cada tipo se genera la primera vez que se pide, pasa por el revisor (esfuerzo medio) y queda guardado. «Regenerar» lo reemplaza y borra su calificación.

**Preferencias**
- Cada tipo se puede marcar como favorito y cada resumen se califica igual que los ejercicios.
- Orden de los tipos: explicación completa, después favoritos, después los mejor calificados. Los de promedio 4 o más llevan la marca «Recomendado».

**Lectura**
- **Modo lectura:** vista sin distracciones a pantalla completa.
- **Escuchar:** usa las voces instaladas en Windows y detecta qué partes están en español y cuáles en inglés, para leer cada una con su voz. Se puede pausar y elegir la velocidad (0,8×, 1× o 1,2×).
- **Preguntar a Claude:** al seleccionar texto aparece «Preguntar a Claude». Responde en el momento, en no más de 200 palabras y con el contexto del tópico; estas respuestas no pasan por el revisor, para no hacer esperar.

## Pruebas (fase 6)

Constantes en `src/main/exams/rules.ts`.

**Examen semanal**
- **20 preguntas**, que genera Claude y controla el revisor:
  - 2 cerradas por subtema, más 3 extra en los subtemas con más errores en la práctica.
  - 4 de repaso de los prerrequisitos; si no hay, del tópico anterior.
  - Al final, una traducción, una lectura y una escritura, si el tópico trabaja lectura y escritura.
  - Se descartan hasta 2 preguntas que no pasen los controles automáticos.
- **Preparación:** las preguntas se preparan en segundo plano apenas el examen queda disponible y se usan una sola vez.
- **Nota:** promedio de las preguntas, de 0 a 10. Lo que no se responde cuenta como incorrecto; la lectura da puntaje parcial; la traducción y la escritura las corrige Claude.
- **Durante el examen:**
  - No se puede salir de Pruebas: el menú queda bloqueado.
  - Se puede navegar entre las preguntas.
  - Las respuestas se guardan solas.
  - La interfaz avisa cada 20 s que el examen sigue abierto.
- **Interrupción:** si pasa más de 1 minuto sin esa señal (la app se cerró o la computadora se suspendió), el examen queda **en pausa**.
  - Se puede retomar **una sola vez**, dentro de los **30 minutos**.
  - Si la pausa vence, el examen se **anula sin contar como reprobado** y el próximo tiene preguntas nuevas.
  - Una **segunda interrupción** entrega el examen con lo respondido.
- **Medianoche:** mientras hay un examen abierto, la semana no se cierra. Un examen empezado el domingo y entregado después de las 00:00 se evalúa con la fecha en que empezó.

**Simulacros**
- 10 preguntas cerradas, un poco más fáciles: del tópico actual, o de todo lo desbloqueado repartido entre tópicos.
- No bloquean la navegación, no cuentan para aprobar y se pueden descartar.
- Un tópico anterior con más del 40 % de errores queda marcado para repasar.

**Historial:** todas las pruebas con fecha, nota y motivo si se anularon o se entregaron solas. Cada una se puede abrir para ver la corrección completa.

## Progreso y recompensas (fase 7)

Constantes en `src/main/rewards/rules.ts`. Todo se recalcula a partir de lo que el alumno hizo y cada recompensa se da una sola vez.

**Racha**
- Cuenta los días hábiles seguidos con al menos una práctica terminada ese día.
- El fin de semana no cuenta ni corta.
- El día de hoy no corta hasta que termine.
- Un día hábil sin práctica corta la racha, salvo que haya un protector de racha: se usa solo y avisa.

**Experiencia**

| Actividad | Experiencia |
|---|---|
| Práctica | 20, + 3 por ejercicio correcto |
| Recuperación del domingo | 15 |
| Examen inicial | 50 |
| Examen semanal aprobado | 120, + 15 por punto sobre el 8 |
| Examen semanal reprobado | 30 |
| Simulacro | 25 |
| Logro | 30 |

- **Multiplicador por constancia:** × (1 + 5 % por día de racha), hasta × 1,5. Se aplica a prácticas, recuperaciones, exámenes semanales y simulacros.
- **Niveles:** el nivel *n* empieza en 50·*n*·(*n*−1) XP (0, 100, 300, 600, 1000…), con títulos de «Recién llegado» a «Leyenda».

**Comodines** (con máximo acumulable)
- 💡 **Pista** (máx. 5): se gana cada 3 días de racha. En la práctica da una ayuda sin revelar la respuesta; hasta 2 por práctica.
- 🔁 **Segunda oportunidad** (máx. 3): se gana cada 7 días de racha. En el examen semanal dice si una respuesta cerrada está bien antes de entregar; 1 por examen, no aplica a traducción ni escritura.
- 🛡️ **Protector de racha** (máx. 2): se gana por cada semana perfecta (5 prácticas desde el lunes, sin faltas). Se usa solo cuando se falta un día y había racha.

**Logros:** 20, entre ellos examen inicial, primera práctica, rachas de 3, 7, 15 y 30 días, semana perfecta, aprobar, sacar 10, remontada, recuperar una falta, 25 y 100 prácticas, 200 ejercicios, simulacro, 5 resúmenes, 20 calificaciones, A1 y A2 completos y nivel 5.

**Avisos:** carteles emergentes al desbloquear logros, subir de nivel, ganar o usar comodines, y cuando se corta una racha de 3 días o más.

**Pantalla de Progreso:** nivel y experiencia, racha y multiplicador, calendario de las últimas 5 semanas, comodines, logros con su avance, mapa del recorrido A1 → B2, estadísticas y últimas experiencias ganadas.

## Temario interactivo y niveles futuros

- **Sección «Temario»:** desplegable por nivel → tópico → subtema.
  - Cada **tópico** muestra objetivos, prerrequisitos, mejor nota y estado: sin empezar, en curso, aprobado, para repasar o bloqueado.
  - Cada **subtema** muestra habilidades, objetivo, puntos clave, ejemplos y errores comunes.
  - Tiene un buscador sin tildes y los botones «Expandir todo» y «Contraer todo».
- **Recorrido del marco europeo:** A1 → A2 → B1 → B2 → C1.
  - Hoy tienen contenido A1 y A2.
  - B1 y B2 figuran como tópicos planificados, en `content/roadmap.json`.
  - El pasado continuo y los verbos con -ing o to, que quedaron afuera de A2, están en el plan de B1.

## Revisión de calidad de lo que genera la IA

Todo lo que genera Claude pasa por tres filtros antes de llegar al alumno:

1. **Autocontrol al generar:** el prompt le pide verificar respuestas, ambigüedades y errores de inglés y español antes de responder.
2. **Revisión en una segunda llamada:** un «revisor» recibe lo generado y controla, con máximo rigor, que:
   - la respuesta marcada sea la única correcta;
   - el inglés y el español no tengan errores;
   - las explicaciones sean coherentes;
   - la consigna no sea ambigua;
   - el contenido corresponda al subtema y al nivel;
   - se cumplan los controles propios de cada tipo de ejercicio.

   Devuelve solo las correcciones. Si la revisión falla, se vuelve a generar y revisar: **nunca se entrega contenido sin revisar**. Se aplica a ejercicios de práctica y preguntas del examen inicial.

   La revisión usa esfuerzo «medio». En la medición tardó 35 s, contra 76 s del esfuerzo por defecto, y encontró errores reales que el otro dejó pasar. Una práctica queda lista en unos 70 s, en segundo plano.
3. **Controles automáticos:**
   - opciones no repetidas;
   - la opción correcta dentro de rango;
   - completar con exactamente un hueco;
   - la oración a corregir tiene que tener un error de verdad;
   - extensión mínima menor que la máxima.

   El ejercicio que no pasa estos controles se descarta.

En la corrección de traducciones y textos, Claude verifica su propia corrección dentro de la misma llamada, para no hacer esperar al alumno.

## 4. Verificación
- **Tests del motor con fechas simuladas:**
  - Examen inicial a mitad de semana.
  - Semana completa → examen → aprobar, reprobar o reprobar 2 veces.
  - 3 faltas → bloqueo.
  - Recuperar una falta el domingo.
  - Más del 40% de errores → repaso de tópicos anteriores.
- **Examen:** cerrar la app y volver antes de 30 minutos (retoma), después de 30 minutos (se anula sin contar) y una segunda pausa (no se permite).
- **Puente con Claude:** cerrar la sesión de Claude Code → pantalla de bloqueo. Respuesta con formato roto → se reintenta.
- **Prueba manual:** abrir la app con `npm run dev` y recorrer una semana entera de A1.
