import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, BedDouble } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import InfoTip from '@/components/ui/InfoTip'
import ExportButtons from '@/components/ui/ExportButtons'
import { useValoracionesFiltradas, useCorteActivo, countBy } from '@/hooks/useValoraciones'
import { subtituloExport } from '@/utils/format'
import { MESES } from '@/types'

export default function LargaEstanciaPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte } = useCorteActivo()

  const largaEstancia = useMemo(() => data.filter(v => v.estancia_mayor_20_dias === 'Si'), [data])

  const buildExport = () => {
    if (!largaEstancia.length) return null
    return {
      titulo: 'Larga Estancia (>20 días) — Gestión Clínica',
      subtitulo: subtituloExport(corte, largaEstancia.length),
      head: ['Ingreso', 'Paciente', 'Identificación', 'Aseguradora', 'F. Ingreso', 'Estancia (d)', 'Causas larga estancia', 'Tipo intervención', 'Últ. Valoración', 'Estado'],
      body: largaEstancia.map(v => [
        v.ingreso, v.nombre_paciente, v.identificacion_paciente, v.aseguradora,
        v.fecha_ingreso, v.estancia_total,
        v.ultimo_causas_larga_estancia || v.primer_causas_larga_estancia,
        v.ultimo_tipo_intervencion || v.primer_tipo_intervencion,
        v.fecha_ultima_valoracion, v.estado_paciente,
      ]),
      nombreArchivo: `larga_estancia_${corte ?? 'actual'}`,
    }
  }

  const causas = useMemo(() => {
    // El campo puede traer varias causas separadas por coma
    const map = new Map<string, number>()
    for (const v of largaEstancia) {
      const raw = v.ultimo_causas_larga_estancia || v.primer_causas_larga_estancia
      if (!raw) { map.set('Sin registro', (map.get('Sin registro') ?? 0) + 1); continue }
      for (const c of raw.split(',').map(s => s.trim()).filter(Boolean)) {
        map.set(c, (map.get(c) ?? 0) + 1)
      }
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [largaEstancia])

  const intervenciones = useMemo(
    () => countBy(largaEstancia, v => v.ultimo_tipo_intervencion || v.primer_tipo_intervencion),
    [largaEstancia]
  )

  const evolucionMensual = useMemo(() => {
    const map = new Map<string, { total: number; larga: number }>()
    for (const v of data) {
      if (!v.anio_ingreso || !v.mes_ingreso) continue
      const k = `${v.anio_ingreso}-${String(v.mes_ingreso).padStart(2, '0')}`
      if (!map.has(k)) map.set(k, { total: 0, larga: 0 })
      const e = map.get(k)!
      e.total++
      if (v.estancia_mayor_20_dias === 'Si') e.larga++
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, e]) => {
        const [anio, mes] = k.split('-')
        return {
          name: `${MESES[Number(mes)].substring(0, 3)} ${anio.substring(2)}`,
          'Larga estancia': e.larga,
          'Total ingresos': e.total,
        }
      })
  }, [data])

  const promedioEstancia = useMemo(() => {
    const vals = largaEstancia.map(v => v.estancia_total).filter((n): n is number => n != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }, [largaEstancia])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Larga Estancia" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Larga Estancia" subtitle="Pacientes con estancia mayor a 20 días" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        <div className="flex items-center">
          <ExportButtons build={buildExport} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
              <BedDouble className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-clinic-600">{largaEstancia.length.toLocaleString('es-CO')}</p>
              <p className="text-xs text-slate-500">Pacientes &gt;20 días</p>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">
              {data.length ? ((largaEstancia.length / data.length) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-slate-500">% del total valorado</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">{promedioEstancia}</p>
            <p className="text-xs text-slate-500">Estancia promedio (días)</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">
              {largaEstancia.filter(v => v.estado_paciente === 'Activo').length}
            </p>
            <p className="text-xs text-slate-500">Aún hospitalizados</p>
          </div>
        </div>

        {/* Evolución mensual */}
        <div className="card-chart p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">
            Evolución mensual
            <InfoTip text="Pacientes agrupados por mes de ingreso hospitalario (dentro del corte y filtros seleccionados). Larga estancia = más de 20 días desde el ingreso real hasta el corte del mes o el egreso." />
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={evolucionMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Total ingresos" fill="#a8bce6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Larga estancia" fill="#0D2D6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Causas */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Causas de larga estancia
              <InfoTip text="Causas registradas en la valoración de gestión clínica más reciente (o la primera si no hay posterior). Un paciente puede tener varias causas, por lo que la suma puede superar el total de pacientes." />
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, causas.length * 36)}>
              <BarChart data={causas} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Pacientes" fill="#16468E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tipo de intervención */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Tipo de intervención
              <InfoTip text="Tipo de intervención (Geriatría, Cuidado Paliativo, Larga Estancia, Intervención Familiar, Comité) registrado en la valoración más reciente del paciente con estancia >20 días." />
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, intervenciones.length * 36)}>
              <BarChart data={intervenciones} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Pacientes" fill="#4169b8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
