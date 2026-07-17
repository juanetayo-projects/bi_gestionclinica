import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { HeartPulse, Hash, Layers, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import InfoTip from '@/components/ui/InfoTip'
import ExportButtons from '@/components/ui/ExportButtons'
import { useValoracionesFiltradas, useCorteActivo } from '@/hooks/useValoraciones'
import { subtituloExport } from '@/utils/format'

/** Capítulos CIE-10 por rango de código */
const CAPITULOS: { desde: string; hasta: string; nombre: string }[] = [
  { desde: 'A00', hasta: 'B99', nombre: 'Infecciosas y parasitarias' },
  { desde: 'C00', hasta: 'D48', nombre: 'Neoplasias (tumores)' },
  { desde: 'D50', hasta: 'D89', nombre: 'Sangre e inmunidad' },
  { desde: 'E00', hasta: 'E90', nombre: 'Endocrinas y metabólicas' },
  { desde: 'F00', hasta: 'F99', nombre: 'Trastornos mentales' },
  { desde: 'G00', hasta: 'G99', nombre: 'Sistema nervioso' },
  { desde: 'H00', hasta: 'H59', nombre: 'Ojo y anexos' },
  { desde: 'H60', hasta: 'H95', nombre: 'Oído' },
  { desde: 'I00', hasta: 'I99', nombre: 'Sistema circulatorio' },
  { desde: 'J00', hasta: 'J99', nombre: 'Sistema respiratorio' },
  { desde: 'K00', hasta: 'K93', nombre: 'Sistema digestivo' },
  { desde: 'L00', hasta: 'L99', nombre: 'Piel y tejido subcutáneo' },
  { desde: 'M00', hasta: 'M99', nombre: 'Osteomuscular' },
  { desde: 'N00', hasta: 'N99', nombre: 'Genitourinario' },
  { desde: 'O00', hasta: 'O99', nombre: 'Embarazo y parto' },
  { desde: 'P00', hasta: 'P96', nombre: 'Afecciones perinatales' },
  { desde: 'Q00', hasta: 'Q99', nombre: 'Malformaciones congénitas' },
  { desde: 'R00', hasta: 'R99', nombre: 'Síntomas y signos' },
  { desde: 'S00', hasta: 'T98', nombre: 'Traumatismos y envenenamientos' },
  { desde: 'V01', hasta: 'Y98', nombre: 'Causas externas' },
  { desde: 'Z00', hasta: 'Z99', nombre: 'Factores de salud y contacto' },
]

function capituloCIE10(code: string | null): string {
  if (!code || code.length < 3) return 'Sin diagnóstico'
  const c = code.substring(0, 3).toUpperCase()
  for (const cap of CAPITULOS) {
    if (c >= cap.desde && c <= cap.hasta) return cap.nombre
  }
  return 'Otros'
}

export default function DiagnosticosPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte } = useCorteActivo()

  const total = data.length

  const buildExport = () => {
    if (!data.length) return null
    return {
      titulo: 'Diagnósticos CIE-10 — Gestión Clínica',
      subtitulo: subtituloExport(corte, data.length),
      head: ['Ingreso', 'Paciente', 'Código CIE-10', 'Diagnóstico', 'Capítulo'],
      body: data.map(v => [
        v.ingreso, v.nombre_paciente, v.dx_principal_codigo, v.dx_principal_nombre,
        capituloCIE10(v.dx_principal_codigo),
      ]),
      nombreArchivo: `diagnosticos_${corte ?? 'actual'}`,
    }
  }

  const porCapitulo = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of data) {
      const cap = capituloCIE10(v.dx_principal_codigo)
      map.set(cap, (map.get(cap) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const topDiagnosticos = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string; n: number }>()
    for (const v of data) {
      if (!v.dx_principal_codigo) continue
      const k = v.dx_principal_codigo
      const e = map.get(k)
      if (e) e.n += 1
      else map.set(k, { codigo: k, nombre: v.dx_principal_nombre ?? '', n: 1 })
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 15)
  }, [data])

  const kpis = useMemo(() => ({
    conDx: data.filter(v => v.dx_principal_codigo).length,
    distintos: new Set(data.map(v => v.dx_principal_codigo).filter(Boolean)).size,
    capituloTop: porCapitulo.find(c => c.name !== 'Sin diagnóstico')?.name ?? '—',
  }), [data, porCapitulo])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Diagnósticos" subtitle="Diagnóstico principal agrupado por CIE-10" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Diagnósticos" subtitle="Diagnóstico principal del encuentro · Agrupación CIE-10" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        <div className="flex items-center">
          <ExportButtons build={buildExport} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Pacientes con diagnóstico', value: `${kpis.conDx} de ${total}`, icon: HeartPulse, color: 'bg-clinic-600' },
            { label: 'Diagnósticos distintos', value: String(kpis.distintos), icon: Hash, color: 'bg-sky-600' },
            { label: 'Capítulo más frecuente', value: kpis.capituloTop, icon: Layers, color: 'bg-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-clinic-600 leading-tight truncate" title={value}>{value}</p>
                <p className="text-xs text-slate-500 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Por capítulo CIE-10 */}
        <div className="card-chart p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">
            Pacientes por capítulo CIE-10
            <InfoTip text="El diagnóstico principal actual del ingreso se clasifica en los 21 capítulos de la CIE-10 según el rango de su código (ej. I00–I99 = Sistema circulatorio). Cada paciente cuenta una vez." />
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(260, porCapitulo.length * 30)}>
            <BarChart data={porCapitulo} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" name="Pacientes" fill="#0D2D6B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top diagnósticos */}
        <div className="card-chart p-5">
          <h3 className="text-sm font-semibold text-clinic-600 mb-4">
            Diagnósticos más frecuentes (top 15)
            <InfoTip text="Los 15 códigos CIE-10 con más pacientes en el corte y filtros seleccionados. El porcentaje es sobre el total de pacientes filtrados (incluyendo los que no tienen diagnóstico registrado)." />
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300/50 text-left">
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Diagnóstico</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Capítulo</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Pacientes</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {topDiagnosticos.map(d => (
                  <tr key={d.codigo} className="border-b border-slate-300/30 hover:bg-black/[0.03]">
                    <td className="py-2 pr-3 font-mono text-xs font-semibold text-clinic-600">{d.codigo}</td>
                    <td className="py-2 pr-3 text-slate-700">{d.nombre}</td>
                    <td className="py-2 pr-3 text-slate-400 text-xs">{capituloCIE10(d.codigo)}</td>
                    <td className="py-2 text-right font-semibold text-clinic-600">{d.n}</td>
                    <td className="py-2 text-right text-slate-400">{total ? ((d.n / total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
