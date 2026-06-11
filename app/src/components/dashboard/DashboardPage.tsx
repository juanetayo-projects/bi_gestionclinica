import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Users, BedDouble, LogOut as LogOutIcon, HeartPulse, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import { useValoracionesFiltradas, useEvolucion, countBy } from '@/hooks/useValoraciones'
import { MESES } from '@/types'

const COLORS = ['#0D2D6B', '#16468E', '#4169b8', '#7494d4', '#a8bce6', '#d3ddf2', '#94a3b8', '#cbd5e1']

export default function DashboardPage() {
  const { data, isLoading } = useValoracionesFiltradas()

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
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">Evolución mensual de pacientes valorados (todos los cortes)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={historicoMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">Pacientes por aseguradora</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, porAseguradora.length * 32)}>
              <BarChart data={porAseguradora} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Pacientes" fill="#16468E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Estado del paciente */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">Estado del paciente</h3>
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
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">Pacientes por sede</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Sede</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Pacientes</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porSede.map(s => (
                    <tr key={s.name} className="border-b border-slate-100">
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
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">Por especialidad (última valoración)</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, porEspecialidad.length * 34)}>
              <BarChart data={porEspecialidad} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
