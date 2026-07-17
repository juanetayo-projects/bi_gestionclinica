import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Users, BedDouble, LogOut as LogOutIcon, HeartPulse, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import InfoTip from '@/components/ui/InfoTip'
import ExportButtons from '@/components/ui/ExportButtons'
import { useValoracionesFiltradas, useEvolucion, useCorteActivo, countBy } from '@/hooks/useValoraciones'
import { subtituloExport } from '@/utils/format'
import { MESES } from '@/types'

const COLORS = ['#0D2D6B', '#16468E', '#4169b8', '#7494d4', '#a8bce6', '#d3ddf2', '#94a3b8', '#cbd5e1']

export default function DashboardPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte } = useCorteActivo()

  const buildExport = () => {
    if (!data.length) return null
    return {
      titulo: 'Resumen General — Gestión Clínica',
      subtitulo: subtituloExport(corte, data.length),
      head: ['Ingreso', 'Paciente', 'Identificación', 'Sede', 'Aseguradora', 'F. Ingreso', '1ª Valoración', 'Últ. Valoración', 'Atenciones', 'Estancia (d)', '>20 días', 'Estado'],
      body: data.map(v => [
        v.ingreso, v.nombre_paciente, v.identificacion_paciente, v.sede, v.aseguradora,
        v.fecha_ingreso, v.fecha_primera_atencion, v.fecha_ultima_valoracion,
        v.cantidad_atenciones, v.estancia_total, v.estancia_mayor_20_dias, v.estado_paciente,
      ]),
      nombreArchivo: `resumen_general_${corte ?? 'actual'}`,
    }
  }

  const kpis = useMemo(() => {
    const total = data.length
    const activos = data.filter(v => v.estado_paciente === 'Activo').length
    const egresados = data.filter(v => v.estado_paciente === 'Egresado').length
    const fallecidos = data.filter(v => v.estado_paciente === 'Fallecido').length
    const largaEstancia = data.filter(v => v.estancia_mayor_20_dias === 'Si').length
    return { total, activos, egresados, fallecidos, largaEstancia }
  }, [data])

  const porAseguradora = useMemo(() => countBy(data, v => v.aseguradora).slice(0, 10), [data])
  const porSede = useMemo(() => countBy(data, v => v.sede), [data])
  const porEstado = useMemo(() => countBy(data, v => v.estado_paciente), [data])
  const porEspecialidad = useMemo(() => countBy(data, v => v.especialidad_ultima).slice(0, 8), [data])

  // Evolución mes a mes: cruza TODOS los cortes mensuales (no depende del corte seleccionado)
  const { data: evolucion = [] } = useEvolucion()
  const historicoMensual = useMemo(() => {
    return evolucion.map(e => {
      const [anio, mes] = e.fecha_corte.split('-')
      return {
        name: `${MESES[Number(mes)].substring(0, 3)} ${anio.substring(2)}`,
        value: e.total,
        largaEstancia: e.larga_estancia,
      }
    })
  }, [evolucion])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Resumen General" subtitle="Programa de Gestión Clínica" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Resumen General" subtitle="Programa de Gestión Clínica · Cuidado Paliativo · Geriatría" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        <div className="flex items-center">
          <ExportButtons build={buildExport} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Pacientes valorados', value: kpis.total, icon: Users, color: 'bg-clinic-600' },
            { label: 'Activos', value: kpis.activos, icon: HeartPulse, color: 'bg-emerald-600' },
            { label: 'Egresados', value: kpis.egresados, icon: LogOutIcon, color: 'bg-sky-600' },
            { label: 'Fallecidos', value: kpis.fallecidos, icon: Users, color: 'bg-slate-500' },
            { label: 'Larga estancia (>20d)', value: kpis.largaEstancia, icon: BedDouble, color: 'bg-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-clinic-600 leading-tight">{value.toLocaleString('es-CO')}</p>
                <p className="text-xs text-slate-500 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Histórico mensual */}
        <div className="card-chart p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">
            Evolución mensual de pacientes valorados (todos los cortes)
            <InfoTip text="Cuenta los pacientes únicos (ingresos) de cada snapshot mensual, sin importar el corte seleccionado arriba. Larga estancia = pacientes con más de 20 días calculados desde el ingreso real hasta el último día del mes (o el egreso si fue antes)." />
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={historicoMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Valorados" fill="#0D2D6B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="largaEstancia" name="Larga estancia (>20d)" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Por aseguradora */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Pacientes por aseguradora
              <InfoTip text="Número de pacientes del corte y filtros seleccionados, agrupados por la aseguradora del contrato principal del ingreso. Se muestran las 10 con más pacientes." />
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, porAseguradora.length * 32)}>
              <BarChart data={porAseguradora} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Pacientes" fill="#16468E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Estado del paciente */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Estado del paciente
              <InfoTip text="Estado derivado de cada ingreso: Fallecido si tiene fecha de fallecimiento registrada; Egresado si tiene fecha de egreso; Activo en los demás casos." />
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={porEstado} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}
                  paddingAngle={2} label={(e: any) => `${e.name}: ${e.value}`}>
                  {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Por sede */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Pacientes por sede
              <InfoTip text="Pacientes del corte y filtros seleccionados según la sede (oficina) donde se registró el ingreso hospitalario. El porcentaje es sobre el total filtrado." />
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300/50 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Sede</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Pacientes</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porSede.map(s => (
                    <tr key={s.name} className="border-b border-slate-300/30">
                      <td className="py-2 text-slate-700">{s.name}</td>
                      <td className="py-2 text-right font-semibold text-clinic-600">{s.value}</td>
                      <td className="py-2 text-right text-slate-400">
                        {kpis.total ? ((s.value / kpis.total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por especialidad */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Por especialidad (última valoración)
              <InfoTip text="Especialidad del profesional que realizó la valoración más reciente de gestión clínica de cada paciente. Se muestran las 8 más frecuentes." />
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, porEspecialidad.length * 34)}>
              <BarChart data={porEspecialidad} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
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
