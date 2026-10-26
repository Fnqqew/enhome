// El encabezado de la práctica: qué día del tópico es o si es una recuperación.

export default function Heading({
  purpose,
  unitIndex,
  topicTitle
}: {
  purpose: string
  unitIndex: number | null
  topicTitle: string
}): React.JSX.Element {
  return (
    <span className="level">
      {purpose === 'recovery' ? 'RECUPERACIÓN DEL DOMINGO' : `DÍA ${unitIndex}`} · {topicTitle.toUpperCase()}
    </span>
  )
}
