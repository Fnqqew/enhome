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
