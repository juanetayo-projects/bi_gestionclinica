import { useMemo } from 'react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import { useValoracionesFiltradas, useCorteActivo } from '@/hooks/useValoraciones'
import { exportTableToExcel, exportTableToPDF, type ExportTable } from '@/utils/exportData'
import { MESES } from '@/types'
import type { Valoracion } from '@/types'
import { FileSpreadsheet, FileText, Loader2, ClipboardList, BedDouble, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'

function labelCorte(corte: string | null): string {
  if (!corte) return 'Sin corte'
  const [anio, mes] = corte.split('-')
  return `${MESES[Number(mes)] ?? mes} ${anio}`
}

const COLS_RESUMEN: { header: string; value: (v: Valoracion) => string | number | null }[] = [
  { header: 'Ingreso',          value: v => v.ingreso },
  { header: 'Identificación',   value: v => v.identificacion_paciente },
  { header: 'Paciente',         value: v => v.nombre_paciente },
  { header: 'Sede',             value: v => v.sede },
  { header: 'Aseguradora',      value: v => v.aseguradora },
  { header: 'F. Ingreso',       value: v => v.fecha_ingreso },
  { header: '1ª Valoración',    value: v => v.fecha_primera_atencion },
  { header: 'Últ. Valoración',  value: v => v.fecha_ultima_valoracion },
  { header: 'Atenciones',       value: v => v.cantidad_atenciones },
  { header: 'Estancia (días)',  value: v => v.estancia_total },
  { header: '>20 días',         value: v => v.estancia_mayor_20_dias },
  { header: 'Tipo intervención', value: v => v.ultimo_tipo_intervencion },
  { header: 'Causas larga estancia', value: v => v.ultimo_causas_larga_estancia },
  { header: 'F. Egreso',        value: v => v.fecha_egreso },
  { header: 'Estado',           value: v => v.estado_paciente },
]

const COLS_ESCALAS: { header: string; value: (v: Valoracion) => string | number | null }[] = [
  { header: 'Ingreso',        value: v => v.ingreso },
  { header: 'Paciente',       value: v => v.nombre_paciente },
  { header: 'CAM',            value: v => v.cam_resultado },
  { header: 'Yesavage',       value: v => v.yesavage_resultado },
  { header: 'Gijón',          value: v => v.gijon_resultado },
  { header: 'MNA',            value: v => v.mna_resultado },
  { header: 'RESVECH',        value: v => v.resvech_resultado },
  { header: 'FOIS',           value: v => v.fois_resultado },
  { header: 'Fragilidad',     value: v => v.fragilidad_resultado },
  { header: 'NECPAL',         value: v => v.necpal_resultado },
  { header: 'PAPSCORE',       value: v => v.papscore_resultado },
  { header: 'IDC-PAL',        value: v => v.idc_estado_situacion },
  { header: 'Barthel previo', value: v => v.barthel_previo_resultado },
  { header: 'Barthel actual', value: v => v.barthel_actual_resultado },
  { header: 'Barthel egreso', value: v => v.barthel_egreso_resultado },
]

interface ReporteDef {
  key: string
  titulo: string
  descripcion: string
  icon: typeof ClipboardList
  cols: typeof COLS_RESUMEN
  filtro?: (v: Valoracion) => boolean
}

const REPORTES: ReporteDef[] = [
  {
    key: 'valoraciones',
    titulo: 'Listado de valoraciones',
    descripcion: 'Pacientes valorados por gestión clínica en el corte: estancia, intervenciones y egreso.',
    icon: ClipboardList,
    cols: COLS_RESUMEN,
  },
  {
    key: 'larga_estancia',
    titulo: 'Larga estancia (>20 días)',
    descripcion: 'Solo pacientes con estancia mayor a 20 días, con causas y tipo de intervención.',
    icon: BedDouble,
    cols: COLS_RESUMEN,
    filtro: v => v.estancia_mayor_20_dias === 'Si',
  },
  {
    key: 'escalas',
    titulo: 'Resultados de escalas',
    descripcion: 'Resultado más reciente de cada escala clínica por paciente.',
    icon: Stethoscope,
    cols: COLS_ESCALAS,
  },
]

export default function ReportsPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte } = useCorteActivo()

  const subtitulo = useMemo(
    () => `Corte: ${labelCorte(corte)} · ${data.length} pacientes · Generado: ${new Date().toLocaleString('es-CO')}`,
    [corte, data.length]
  )

  function buildTable(rep: ReporteDef): ExportTable | null {
    const rows = rep.filtro ? data.filter(rep.filtro) : data
    if (rows.length === 0) {
      toast.error('No hay datos para exportar con los filtros actuales')
      return null
    }
    return {
      titulo: rep.titulo,
      subtitulo,
      head: rep.cols.map(c => c.header),
      body: rows.map(v => rep.cols.map(c => c.value(v))),
      nombreArchivo: `${rep.key}_${corte ?? 'sin_corte'}`,
    }
  }

  function handleExcel(rep: ReporteDef) {
    const table = buildTable(rep)
    if (table) {
      exportTableToExcel(table)
      toast.success('Excel generado')
    }
  }

  async function handlePDF(rep: ReporteDef) {
    const table = buildTable(rep)
    if (table) {
      await exportTableToPDF(table)
      toast.success('PDF generado')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Reportes"
        subtitle={`Exportación de datos del corte ${labelCorte(corte)} con los filtros aplicados`}
      />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {REPORTES.map(rep => {
              const Icon = rep.icon
              const count = rep.filtro ? data.filter(rep.filtro).length : data.length
              return (
                <div key={rep.key} className="card p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-clinic-600" />
                    <h2 className="text-sm font-semibold text-slate-800">{rep.titulo}</h2>
                  </div>
                  <p className="text-xs text-slate-500 flex-1">{rep.descripcion}</p>
                  <p className="text-xs text-slate-400 mt-2">{count} registros con los filtros actuales</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleExcel(rep)}
                      disabled={count === 0}
                      className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      onClick={() => handlePDF(rep)}
                      disabled={count === 0}
                      className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
