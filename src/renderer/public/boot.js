// Corre antes que la interfaz: aplica el estilo y el tema que eligió el usuario (los manda el
// proceso principal en la dirección) para que la pantalla de carga no parpadee con otros colores.
;(function () {
  var params = new URLSearchParams(window.location.hash.slice(1))
  var root = document.documentElement
  var style = params.get('style')
  var theme = params.get('theme')
  if (style) root.dataset.style = style
  if (theme) root.dataset.theme = theme
})()
