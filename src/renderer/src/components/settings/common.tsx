// Piezas comunes de las pestañas de Ajustes.

export function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="setting-row">
      <span>{label}</span>
      {children}
    </div>
  )
}
