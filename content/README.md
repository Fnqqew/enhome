# Temario base

Contenido fijo y revisado sobre el que la IA genera ejercicios, exámenes y otros tipos de resumen.

## Estructura

```
content/
  A1/
    01-to-be/
      topic.json   datos del tópico y sus 5 subtemas (uno por día, de lunes a viernes)
      resumen.md   resumen base: la explicación completa que se muestra al empezar el tópico
  A2/
    ...
```

Cada `topic.json` tiene:

| Campo | Qué es |
|---|---|
| `id` | Identificador único (se usa para etiquetar ejercicios y preguntas). **No cambiarlo una vez en uso.** |
| `level`, `order` | Nivel del marco europeo y posición dentro del nivel (1, 2, 3… sin saltos). |
| `title`, `titleEn`, `description`, `objectives` | Lo que ve el usuario. |
| `prerequisites` | Ids de tópicos anteriores que conviene saber. Se usan para decidir a qué volver si hay fallas. |
| `reviewed` | `false` hasta que el contenido se revisa a mano. |
| `subtopics` | Exactamente 5, con `day` del 1 al 5. Cada uno tiene objetivo, habilidades (`grammar`, `reading`, `writing`), puntos clave, ejemplos y errores comunes. |

`resumen.md` tiene que tener una sección `## Día N` por cada subtema.

## Cómo revisar un tópico

1. Leé `resumen.md` (en VS Code: clic derecho → *Open Preview*) y `topic.json`.
2. Corregí lo que haga falta directamente en los archivos.
3. Cambiá `"reviewed": false` a `"reviewed": true`.
4. Corré `npm test`: valida que el formato siga siendo correcto.
