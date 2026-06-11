import { Info } from 'lucide-react'

/**
 * Icono de información con tooltip al pasar el mouse.
 * Se usa junto a los títulos de gráficos para explicar el cálculo empleado.
 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle ml-1.5">
      <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-clinic-600 cursor-help transition-colors" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block z-40 w-72 rounded-lg bg-slate-800 text-white text-[11px] font-normal normal-case leading-snug p-2.5 shadow-xl">
        {text}
      </span>
    </span>
  )
}
