import { MESES } from '@/types'

/** '2026-05-31' → 'Mayo 2026' */
export function labelCorte(corte: string | null): string {
  if (!corte) return 'Sin corte'
  const [anio, mes] = corte.split('-')
  return `${MESES[Number(mes)] ?? mes} ${anio}`
}

/** Subtítulo estándar de exportes: corte + cantidad + fecha de generación */
export function subtituloExport(corte: string | null, n: number): string {
  return `Corte: ${labelCorte(corte)} · ${n} registros · Generado: ${new Date().toLocaleString('es-CO')}`
}
