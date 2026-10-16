# Temario base

Contenido fijo y revisado sobre el que la IA genera ejercicios, exámenes y otros tipos de resumen. Hay un temario por idioma: cada uno es un curso independiente, con su propio progreso.

## Estructura

```
content/
  en/                inglés
    roadmap.json     tópicos planificados de los niveles que todavía no tienen contenido
    A1/
      01-to-be/
        topic.json   datos del tópico y sus 5 subtemas (uno por día, de lunes a viernes)
        resumen.md   resumen base: la explicación completa que se muestra al empezar el tópico
    A2/
      ...
  pt/                portugués (de Brasil)
  it/                italiano
  fr/                francés
```

Cada `topic.json` tiene:

| Campo | Qué es |
|---|---|
| `id` | Identificador único dentro del curso (se usa para etiquetar ejercicios y preguntas). **No cambiarlo una vez en uso.** Los cursos nuevos lo empiezan con el código del idioma: `pt-a1-ser-estar`. |
| `level`, `order` | Nivel del marco europeo y posición dentro del nivel (1, 2, 3… sin saltos). |
| `title`, `titleEn` | Título en español y en el idioma del curso (el campo se llama `titleEn` porque el primer curso fue el de inglés). |
| `description`, `objectives` | Lo que ve el usuario. |
| `prerequisites` | Ids de tópicos anteriores del mismo curso que conviene saber. Se usan para decidir a qué volver si hay fallas. |
| `reviewed` | `false` hasta que el contenido se revisa a mano. |
| `subtopics` | Exactamente 5, con `day` del 1 al 5. Cada uno tiene objetivo, habilidades (`grammar`, `reading`, `writing`), puntos clave, ejemplos (`en` es la frase en el idioma del curso y `es` su traducción) y errores comunes. |

`resumen.md` tiene que tener una sección `## Día N` por cada subtema. Las frases en el idioma del curso van en *cursiva*: así la lectura en voz alta sabe qué leer con la voz de ese idioma.

## Cómo revisar un tópico

1. Leé `resumen.md` (en VS Code: clic derecho → *Open Preview*) y `topic.json`.
2. Corregí lo que haga falta directamente en los archivos.
3. Cambiá `"reviewed": false` a `"reviewed": true`.
4. Corré `npm test`: valida que el formato de todos los cursos siga siendo correcto.
