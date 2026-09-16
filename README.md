# Proyecto Inglés

App de escritorio personal para aprender inglés (gramática, comprensión lectora y escritura) del marco europeo A1 al A2, impulsada por Claude Code con la suscripción del usuario.

## Qué hace

- **Examen inicial:** ubica al alumno en el temario.
- **Recorrido semanal:** un tópico por semana, con un subtema por día y examen desde el viernes. Hay faltas, bloqueo, recuperación del domingo y semanas de refuerzo.
- **Práctica diaria:** 7 tipos de ejercicio generados por Claude y controlados por un revisor, con corrección automática o de Claude, pistas y calificación.
- **Resúmenes:** 13 tipos, modo lectura, lectura en voz alta en español e inglés y preguntas a Claude sobre el texto seleccionado.
- **Pruebas:** examen semanal con pausa única de 30 minutos, simulacros e historial.
- **Progreso:** racha, experiencia y niveles, comodines, logros y mapa del recorrido.
- **Temario interactivo** con buscador y el plan de B1 y B2.
- **Personalización:** 5 estilos visuales (Celeste, Ruta, Cuaderno, Racha y Original), tema, color, tipografía, tamaño, espaciado, animaciones y voces.

El diseño completo y todas las reglas están en [docs/documento-base.md](docs/documento-base.md).

## Requisitos

- Windows 10 u 11.
- [Claude Code](https://claude.com/claude-code) instalado y con sesión iniciada con una suscripción de claude.ai (Pro o superior). Sin eso, la app muestra una pantalla de bloqueo. Si Claude Code está en otra ruta, se puede indicar con la variable `CLAUDE_PATH`.
- Para la lectura en voz alta: voces de Windows en español y en inglés (Configuración → Hora e idioma → Voz → Agregar voces).
- Para desarrollar: Node.js 22 o superior.

## Instalar la app

```
npm install
npm run dist
```

Genera `dist/proyecto-ingles-<versión>-setup.exe`. La app instalada guarda el progreso en `%APPDATA%\proyecto-ingles`, la misma carpeta que la versión de desarrollo, así que el progreso se comparte. Solo puede haber una ventana abierta a la vez.

## Desarrollo

```
npm run dev        # abre la app en modo desarrollo (con herramientas de prueba en Inicio)
npm run typecheck  # revisa tipos
npm test           # tests
npm run build      # compila sin generar el instalador
npm run icon       # regenera el ícono (build/icon.ico y resources/icon.png) desde el logo Celeste
```

Pruebas contra Claude de verdad (gastan uso de la suscripción):

```
$env:LIVE_CLAUDE = '1'; npx vitest run tests/live
```

Si la app no abre y aparece `Cannot read properties of undefined (reading 'isPackaged')`, la terminal tiene definida la variable `ELECTRON_RUN_AS_NODE`: pasa al lanzarla desde herramientas integradas en VS Code. Quitala antes de ejecutar `npm run dev`.

## Estructura

```
content/            temario base (A1 y A2) y plan de niveles futuros
docs/               documento base con todas las reglas
src/main/           proceso principal: base de datos, motor, Claude, práctica, resúmenes, pruebas y recompensas
src/preload/        puente seguro entre la interfaz y el proceso principal
src/renderer/       interfaz en React
src/shared/         tipos y utilidades compartidas
tests/              tests (tests/live: contra Claude real)
```
