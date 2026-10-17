import { useShell } from '../shell'
import Icon from './Icon'

// Modo enfoque: esconde la barra lateral y deja solo el ejercicio. Esc vuelve.
export default function FocusToggle(): React.JSX.Element {
  const { focus, setFocus } = useShell()
  return (
    <button
      type="button"
      className="chip focus-toggle"
      aria-pressed={focus}
      title={focus ? 'Salir del modo enfoque (Esc)' : 'Esconder todo menos el ejercicio'}
      onClick={() => setFocus(!focus)}
    >
      <Icon name="focus" className="glyph" /> {focus ? 'Salir del enfoque' : 'Modo enfoque'}
    </button>
  )
}
