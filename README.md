# Proyecto Inglés

App de escritorio personal para aprender inglés (gramática, comprensión lectora y escritura), impulsada por Claude Code con la suscripción del usuario.

## Requisitos
- Node.js 22 o superior.
- [Claude Code](https://claude.com/claude-code) instalado y con sesión iniciada con una suscripción de claude.ai (Pro o superior). Sin eso, la app muestra una pantalla de bloqueo. Si Claude Code está en otra ruta, se puede indicar con la variable `CLAUDE_PATH`.

## Uso
```
npm install
npm run dev        # abre la app en modo desarrollo
npm run build      # compila
npm run typecheck  # revisa tipos
npm test           # tests
```

Si la app no abre y aparece `Cannot read properties of undefined (reading 'isPackaged')`, la terminal tiene definida la variable `ELECTRON_RUN_AS_NODE` (pasa al lanzarla desde herramientas integradas en VS Code). Quitala antes de ejecutar `npm run dev`.

## Documentación
El diseño completo del producto y el plan por fases están en [docs/documento-base.md](docs/documento-base.md).
