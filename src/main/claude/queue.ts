// Turnos para pedirle cosas a Claude. Lo que el alumno está esperando va primero; lo de fondo
// (la práctica de mañana, resúmenes, audios) usa los huecos y nunca ocupa más de un lugar.

export type Priority = 'now' | 'background'

// Un pedido de fondo puede pasar a ser urgente (por ejemplo, la práctica que se preparaba
// en segundo plano y que el alumno acaba de abrir): se cambia la prioridad del ticket.
export interface Ticket {
  priority: Priority
}

interface Waiting {
  ticket: Ticket
  seq: number
  start: (lane: Priority) => void
  reject: (error: Error) => void
}

export class JobQueue {
  private running: Record<Priority, number> = { now: 0, background: 0 }
  private waiting: Waiting[] = []
  private seq = 0

  constructor(
    private readonly limit = 3,
    private readonly backgroundLimit = 1
  ) {}

  async run<T>(ticket: Ticket, task: () => Promise<T>): Promise<T> {
    const lane = await new Promise<Priority>((start, reject) => {
      this.waiting.push({ ticket, seq: this.seq++, start, reject })
      this.pump()
    })
    try {
      return await task()
    } finally {
      this.running[lane]--
      this.pump()
    }
  }

  // Volver a ordenar después de cambiar la prioridad de un ticket.
  reschedule(): void {
    this.pump()
  }

  // Rechaza todo lo que espera turno (lo que ya corre se corta por otro lado).
  rejectWaiting(error: Error): void {
    const all = this.waiting
    this.waiting = []
    for (const w of all) w.reject(error)
  }

  get pending(): number {
    return this.waiting.length
  }

  get active(): number {
    return this.running.now + this.running.background
  }

  private pump(): void {
    while (this.active < this.limit) {
      const next = this.pickNext()
      if (!next) return
      this.waiting.splice(this.waiting.indexOf(next), 1)
      const lane = next.ticket.priority
      this.running[lane]++
      next.start(lane)
    }
  }

  private pickNext(): Waiting | undefined {
    const byOrder = (a: Waiting, b: Waiting): number => a.seq - b.seq
    const urgent = this.waiting.filter((w) => w.ticket.priority === 'now').sort(byOrder)[0]
    if (urgent) return urgent
    if (this.running.background >= this.backgroundLimit) return undefined
    return this.waiting.filter((w) => w.ticket.priority === 'background').sort(byOrder)[0]
  }
}
