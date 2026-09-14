export default function Placeholder({ title, phase }: { title: string; phase: number }): React.JSX.Element {
  return (
    <>
      <h1>{title}</h1>
      <section className="card">
        <p className="muted">Esta sección se construye en la fase {phase}.</p>
      </section>
    </>
  )
}
