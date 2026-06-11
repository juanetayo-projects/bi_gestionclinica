import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportTableToExcel, exportTableToPDF, type ExportTable } from '@/utils/exportData'

interface ExportButtonsProps {
  /** Construye la tabla a exportar con los datos filtrados actuales; null si no hay datos */
  build: () => ExportTable | null
}

/**
 * Botones Excel/PDF para cada módulo. Exportan la información según los
 * filtros seleccionados, con título, logo y colores institucionales.
 */
export default function ExportButtons({ build }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false)

  function handleExcel() {
    const table = build()
    if (!table) { toast.error('No hay datos para exportar con los filtros actuales'); return }
    exportTableToExcel(table)
    toast.success('Excel generado')
  }

  async function handlePDF() {
    const table = build()
    if (!table) { toast.error('No hay datos para exportar con los filtros actuales'); return }
    setBusy(true)
    try {
      await exportTableToPDF(table)
      toast.success('PDF generado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
      <button onClick={handleExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </button>
      <button onClick={handlePDF} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
      </button>
    </div>
  )
}
