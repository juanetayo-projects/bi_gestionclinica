import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Users, Cake, MapPin, Home, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import InfoTip from '@/components/ui/InfoTip'
import ExportButtons from '@/components/ui/ExportButtons'
import { useValoracionesFiltradas, useCorteActivo, countBy } from '@/hooks/useValoraciones'
import { subtituloExport } from '@/utils/format'
import type { Valoracion } from '@/types'

const COLOR_F = '#4169b8'   // mujeres
const COLOR_M = '#0D2D6B'   // hombres
const COLORS = ['#0D2D6B', '#16468E', '#4169b8', '#7494d4', '#a8bce6', '#d3ddf2', '#94a3b8', '#cbd5e1']

const GRUPOS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
  '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79',
  '80-84', '85 ó más',
]

function grupoEtario(edad: number | null): string | null {
  if (edad == null || edad < 0) return null
  if (edad >= 85) return '85 ó más'
  const i = Math.floor(edad / 5)
  return GRUPOS[i] ?? null
}

function esMujer(sexo: string | null) {
  return (sexo ?? '').toLowerCase().startsWith('m') && !(sexo ?? '').toLowerCase().startsWith('mas')
}
function esHombre(sexo: string | null) {
  const s = (sexo ?? '').toLowerCase()
  return s.startsWith('h') || s.startsWith('mas')
}

function statsEdad(rows: Valoracion[]) {
  const edades = rows.map(v => v.edad).filter((e): e is number => e != null)
  if (edades.length === 0) return { n: 0, prom: null as number | null, min: null as number | null, max: null as number | null }
  return {
    n: edades.length,
    prom: edades.reduce((s, e) => s + e, 0) / edades.length,
    min: Math.min(...edades),
    max: Math.max(...edades),
  }
}

export default function DemografiaPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte } = useCorteActivo()

  const buildExport = () => {
    if (!data.length) return null
    return {
      titulo: 'Demografía — Caracterización de la población',
      subtitulo: subtituloExport(corte, data.length),
      head: ['Ingreso', 'Paciente', 'Sexo', 'Edad', 'F. Nacimiento', 'Estado civil', 'Municipio', 'Departamento', 'Zona'],
      body: data.map(v => [
        v.ingreso, v.nombre_paciente, v.sexo, v.edad, v.fecha_nacimiento,
        v.estado_civil, v.municipio_residencia, v.departamento_residencia, v.zona_residencia,
      ]),
      nombreArchivo: `demografia_${corte ?? 'actual'}`,
    }
  }

  const mujeres = useMemo(() => data.filter(v => esMujer(v.sexo)), [data])
  const hombres = useMemo(() => data.filter(v => esHombre(v.sexo)), [data])

  const kpis = useMemo(() => {
    const st = statsEdad(data)
    return {
      total: data.length,
      mujeres: mujeres.length,
      hombres: hombres.length,
      edadProm: st.prom,
    }
  }, [data, mujeres, hombres])

  // Pirámide: hombres en negativo (izquierda), mujeres en positivo (derecha)
  const piramide = useMemo(() => {
    return [...GRUPOS].reverse().map(grupo => {
      const enGrupo = data.filter(v => grupoEtario(v.edad) === grupo)
      return {
        grupo,
        Hombres: -enGrupo.filter(v => esHombre(v.sexo)).length,
        Mujeres: enGrupo.filter(v => esMujer(v.sexo)).length,
      }
    })
  }, [data])

  // Distribución de edad apilada por sexo (jóvenes → mayores)
  const distribucion = useMemo(() => {
    return GRUPOS.map(grupo => {
      const enGrupo = data.filter(v => grupoEtario(v.edad) === grupo)
      return {
        grupo,
        Mujeres: enGrupo.filter(v => esMujer(v.sexo)).length,
        Hombres: enGrupo.filter(v => esHombre(v.sexo)).length,
      }
    }).filter(g => g.Mujeres + g.Hombres > 0)
  }, [data])

  const tablaGenero = useMemo(() => ([
    { genero: 'Mujeres', ...statsEdad(mujeres) },
    { genero: 'Hombres', ...statsEdad(hombres) },
    { genero: 'Total', ...statsEdad(data) },
  ]), [data, mujeres, hombres])

  const porZona = useMemo(() => countBy(data, v => v.zona_residencia), [data])
  const porEstadoCivil = useMemo(() => countBy(data, v => v.estado_civil), [data])
  const porMunicipio = useMemo(() => countBy(data, v => v.municipio_residencia).slice(0, 10), [data])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Demografía" subtitle="Caracterización de la población valorada" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Demografía" subtitle="Caracterización de la población valorada · Pirámide poblacional" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        <div className="flex items-center">
          <ExportButtons build={buildExport} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pacientes', value: kpis.total.toLocaleString('es-CO'), icon: Users, color: 'bg-clinic-600' },
            { label: 'Mujeres', value: `${kpis.mujeres} (${kpis.total ? ((kpis.mujeres / kpis.total) * 100).toFixed(1) : 0}%)`, icon: Users, color: 'bg-sky-600' },
            { label: 'Hombres', value: `${kpis.hombres} (${kpis.total ? ((kpis.hombres / kpis.total) * 100).toFixed(1) : 0}%)`, icon: Users, color: 'bg-indigo-700' },
            { label: 'Edad promedio', value: kpis.edadProm != null ? kpis.edadProm.toFixed(1) : '—', icon: Cake, color: 'bg-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-clinic-600 leading-tight truncate">{value}</p>
                <p className="text-xs text-slate-500 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Pirámide poblacional */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Pirámide poblacional
              <InfoTip text="Pacientes agrupados en rangos de edad de 5 años (grupos quinquenales). La edad se calcula con la fecha de nacimiento al cierre del corte mensual. Hombres a la izquierda, mujeres a la derecha." />
            </h3>
            <ResponsiveContainer width="100%" height={460}>
              <BarChart data={piramide} layout="vertical" stackOffset="sign" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => String(Math.abs(v))} />
                <YAxis type="category" dataKey="grupo" width={62} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => Math.abs(v)} />
                <Legend />
                <Bar dataKey="Hombres" stackId="p" fill={COLOR_M} />
                <Bar dataKey="Mujeres" stackId="p" fill={COLOR_F} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-5">
            {/* Tabla edad por género */}
            <div className="card-chart p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-4">
                Edad por género
                <InfoTip text="n = pacientes con edad registrada. Promedio, mínimo y máximo de la edad calculada a la fecha de corte, separados por género administrativo registrado en GoMedisys." />
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Género</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">n</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Promedio</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Mín</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Máx</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaGenero.map(r => (
                    <tr key={r.genero} className={`border-b border-slate-100 ${r.genero === 'Total' ? 'font-bold' : ''}`}>
                      <td className="py-2 text-slate-700">{r.genero}</td>
                      <td className="py-2 text-right text-clinic-600 font-semibold">{r.n}</td>
                      <td className="py-2 text-right text-slate-600">{r.prom != null ? r.prom.toFixed(1) : '—'}</td>
                      <td className="py-2 text-right text-slate-600">{r.min ?? '—'}</td>
                      <td className="py-2 text-right text-slate-600">{r.max ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Zona de residencia */}
            <div className="card-chart p-5">
              <h3 className="text-sm font-semibold text-clinic-600 mb-2 flex items-center gap-1.5">
                <Home className="w-4 h-4" /> Zona de residencia
                <InfoTip text="Zona (urbana/rural) registrada en los datos de residencia del paciente en GoMedisys. 'Sin dato' agrupa pacientes sin zona registrada." />
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porZona} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}
                    paddingAngle={2} label={(e: any) => `${e.name}: ${e.value}`}>
                    {porZona.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Distribución de edad por sexo */}
        <div className="card-chart p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">
            Distribución de edad de los pacientes atendidos
            <InfoTip text="Pacientes por grupo de edad quinquenal, apilados por sexo. Solo se muestran los grupos con al menos un paciente en el corte y filtros seleccionados." />
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distribucion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="grupo" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Mujeres" stackId="d" fill={COLOR_F} />
              <Bar dataKey="Hombres" stackId="d" fill={COLOR_M} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Municipio de residencia */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Municipio de residencia (top 10)
              <InfoTip text="Los 10 municipios con más pacientes según la dirección de residencia registrada. Pacientes sin municipio aparecen como 'Sin dato'." />
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, porMunicipio.length * 30)}>
              <BarChart data={porMunicipio} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Pacientes" fill="#16468E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Estado civil */}
          <div className="card-chart p-5">
            <h3 className="text-sm font-semibold text-clinic-600 mb-4">
              Estado civil
              <InfoTip text="Estado civil registrado en GoMedisys. El porcentaje es sobre el total de pacientes del corte y filtros seleccionados." />
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Estado civil</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Pacientes</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porEstadoCivil.map(e => (
                    <tr key={e.name} className="border-b border-slate-100">
                      <td className="py-2 text-slate-700">{e.name}</td>
                      <td className="py-2 text-right font-semibold text-clinic-600">{e.value}</td>
                      <td className="py-2 text-right text-slate-400">
                        {kpis.total ? ((e.value / kpis.total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
