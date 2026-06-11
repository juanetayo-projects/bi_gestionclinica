import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import { useValoracionesFiltradas, countBy } from '@/hooks/useValoraciones'
import { ESCALAS, type Valoracion } from '@/types'

const COLORS = ['#0D2D6B', '#16468E', '#4169b8', '#7494d4', '#a8bce6', '#94a3b8', '#cbd5e1', '#e2e8f0']

type TabKey = string // escala.key | 'barthel' | 'esas'

export default function EscalasPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const [tab, setTab] = useState<TabKey>('cam')

  const conEscala = useMemo(() => {
    if (tab === 'barthel') return data.filter(v => v.barthel_actual_fecha || v.barthel_previo_fecha || v.barthel_egreso_fecha)
    if (tab === 'esas') return data.filter(v => v.esas_fecha)
    return data.filter(v => (v as any)[`${tab}_fecha`])
  }, [data, tab])

  const porResultado = useMemo(() => {
    if (tab === 'barthel' || tab === 'esas') return []
    return countBy(conEscala, v => (v as any)[`${tab}_resultado`])
  }, [conEscala, tab])

  const barthelMomentos = useMemo(() => {
    if (tab !== 'barthel') return []
    const momentos = [
      { key: 'previo', label: 'Previo' },
      { key: 'actual', label: 'Actual' },
      { key: 'egreso', label: 'Egreso' },
    ]
    return momentos.map(m => {
      const aplicados = data.filter(v => (v as any)[`barthel_${m.key}_fecha`])
      const valores = aplicados
        .map(v => parseFloat((v as any)[`barthel_${m.key}_valoracion`]))
        .filter(n => !isNaN(n))
      const prom = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
      return { name: m.label, aplicados: aplicados.length, promedio: Math.round(prom * 10) / 10 }
    })
  }, [data, tab])

  const barthelCategorias = useMemo(() => {
    if (tab !== 'barthel') return []
    const cats = new Map<string, { Previo: number; Actual: number; Egreso: number }>()
    for (const v of data) {
      for (const m of ['previo', 'actual', 'egreso'] as const) {
        const res = (v as any)[`barthel_${m}_resultado`]
        if (!res) continue
        if (!cats.has(res)) cats.set(res, { Previo: 0, Actual: 0, Egreso: 0 })
        const label = m === 'previo' ? 'Previo' : m === 'actual' ? 'Actual' : 'Egreso'
        cats.get(res)![label as 'Previo' | 'Actual' | 'Egreso']++
      }
    }
    return [...cats.entries()].map(([name, vals]) => ({ name, ...vals }))
  }, [data, tab])

  const esasPromedios = useMemo(() => {
    if (tab !== 'esas') return []
    const sintomas: { key: keyof Valoracion; label: string }[] = [
      { key: 'sas_dolor', label: 'Dolor' },
      { key: 'sas_cansancio', label: 'Cansancio' },
      { key: 'sas_nauseas', label: 'Náuseas' },
      { key: 'sas_depresion', label: 'Depresión' },
      { key: 'sas_ansiedad', label: 'Ansiedad' },
      { key: 'sas_somnolencia', label: 'Somnolencia' },
      { key: 'sas_apetito', label: 'Apetito' },
      { key: 'sas_bienestar', label: 'Bienestar' },
      { key: 'sas_falta_aire', label: 'Falta de aire' },
      { key: 'sas_dificultad_dormir', label: 'Dif. dormir' },
    ]
    return sintomas.map(s => {
      const vals = conEscala.map(v => v[s.key] as number | null).filter((n): n is number => n != null)
      const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { name: s.label, promedio: Math.round(prom * 10) / 10, n: vals.length }
    })
  }, [conEscala, tab])

  const escalaActual = ESCALAS.find(e => e.key === tab)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Escalas Clínicas" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Escalas Clínicas" subtitle="Resultados de escalas aplicadas en gestión clínica" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        {/* Tabs de escalas */}
        <div className="flex flex-wrap gap-1.5">
          {[...ESCALAS.map(e => ({ key: e.key, nombre: e.nombre })),
            { key: 'esas', nombre: 'ESAS/SAS' },
            { key: 'barthel', nombre: 'Barthel' },
          ].map(e => (
            <button key={e.key} onClick={() => setTab(e.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === e.key ? 'bg-clinic-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-clinic-50'
              }`}>
              {e.nombre}
            </button>
          ))}
        </div>

        {/* KPI aplicados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">{conEscala.length.toLocaleString('es-CO')}</p>
            <p className="text-xs text-slate-500">
              {tab === 'barthel' ? 'Pacientes con Barthel' : tab === 'esas' ? 'Pacientes con ESAS/SAS' : `Escalas ${escalaActual?.nombre} aplicadas`}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">{data.length.toLocaleString('es-CO')}</p>
            <p className="text-xs text-slate-500">Total pacientes (filtro actual)</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-clinic-600">
              {data.length ? ((conEscala.length / data.length) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-slate-500">Cobertura de aplicación</p>
          </div>
        </div>

        {/* Contenido según escala */}
        {tab === 'barthel' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-4">Promedio Barthel por momento</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barthelMomentos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="promedio" name="Promedio" fill="#0D2D6B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aplicados" name="Aplicados" fill="#7494d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-4">Categorías por momento</h3>
              <ResponsiveContainer width="100%" height={Math.max(260, barthelCategorias.length * 40)}>
                <BarChart data={barthelCategorias} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Previo" fill="#a8bce6" />
                  <Bar dataKey="Actual" fill="#16468E" />
                  <Bar dataKey="Egreso" fill="#0D2D6B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : tab === 'esas' ? (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">Promedio de síntomas ESAS/SAS (0-10)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={esasPromedios}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="promedio" name="Promedio" fill="#0D2D6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-4">
                Distribución de resultados — {escalaActual?.titulo}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={porResultado} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}
                    paddingAngle={2} label={(e: any) => e.value}>
                    {porResultado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-4">Tabla de resultados</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Resultado</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">n</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porResultado.map(r => (
                    <tr key={r.name} className="border-b border-slate-100">
                      <td className="py-2 text-slate-700">{r.name}</td>
                      <td className="py-2 text-right font-semibold text-clinic-600">{r.value}</td>
                      <td className="py-2 text-right text-slate-400">
                        {conEscala.length ? ((r.value / conEscala.length) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
