import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, ClipboardCheck, BedDouble, Activity } from 'lucide-react'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import InfoTip from '@/components/ui/InfoTip'
import { useValoracionesFiltradas, useEvolucion, useCorteActivo, CORTE_TODOS } from '@/hooks/useValoraciones'
import { useStore } from '@/store/useStore'
import { labelCorte } from '@/utils/format'
import { MESES } from '@/types'
import type { Valoracion } from '@/types'

const CAL_ESCALA = ['#EAF0FA', '#B9CCE9', '#7FA0D6', '#3E6DAE', '#0D2D6B']
const PAGINA_TAM = 10

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function diaSemanaLunes0(iso: string): number { return (new Date(`${iso}T00:00:00`).getDay() + 6) % 7 }

/** Cualquier escala clínica aplicada (fecha registrada) */
function tieneEscalaAplicada(v: Valoracion): boolean {
  return !!(
    v.cam_fecha || v.esas_fecha || v.necpal_fecha || v.papscore_fecha || v.fragilidad_fecha ||
    v.fois_fecha || v.resvech_fecha || v.mna_fecha || v.yesavage_fecha || v.gijon_fecha ||
    v.barthel_actual_fecha || v.barthel_previo_fecha
  )
}

function diffDias(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`)
  const d2 = new Date(`${b}T00:00:00`)
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}

// ── Piezas reutilizables (gauge, anillos, popover) ─────────────────────────

function AnilloSimple({ pct, color, tamano = 96, grosor = 10, children }:
  { pct: number; color: string; tamano?: number; grosor?: number; children?: React.ReactNode }) {
  const r = (tamano - grosor) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#EAF0FA" strokeWidth={grosor} />
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={color} strokeWidth={grosor}
          strokeDasharray={c} strokeDashoffset={c - (clamped / 100) * c} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function AnillosConcentricos({ datos, tamano = 168, grosor = 14, onSegmentClick }:
  { datos: { nombre: string; valor: number; color: string }[]; tamano?: number; grosor?: number
    onSegmentClick?: (nombre: string, e: React.MouseEvent) => void }) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <svg width={tamano} height={tamano} className="-rotate-90 shrink-0">
      {datos.map((d, i) => {
        const r = tamano / 2 - grosor / 2 - i * (grosor + 4)
        if (r <= 0) return null
        const c = 2 * Math.PI * r
        const pct = d.valor / max
        return (
          <g key={d.nombre}>
            <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#EAF0FA" strokeWidth={grosor} />
            <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={d.color} strokeWidth={grosor}
              strokeDasharray={c} strokeDashoffset={c - pct * c} strokeLinecap="round"
              className={onSegmentClick ? 'cursor-pointer' : undefined}
              onClick={onSegmentClick ? (e) => onSegmentClick(d.nombre, e) : undefined} />
          </g>
        )
      })}
    </svg>
  )
}

interface PopCol { header: string; get: (v: Valoracion) => string | number }
type PopoverState = { x: number; y: number; titulo: string; columnas: PopCol[]; filas: Valoracion[] } | null

const COLS_BASICAS: PopCol[] = [
  { header: 'Paciente', get: (v) => v.nombre_paciente ?? '—' },
  { header: 'Especialidad', get: (v) => v.especialidad_ultima ?? '—' },
  { header: 'Estado', get: (v) => v.estado_paciente },
]

function abrirPopover(
  set: (p: PopoverState) => void,
  e: { clientX?: number; clientY?: number } | undefined,
  titulo: string, columnas: PopCol[], filas: Valoracion[],
) {
  if (!filas.length) return
  const cx = e?.clientX ?? window.innerWidth / 2
  const cy = e?.clientY ?? window.innerHeight / 2
  set({
    x: Math.max(8, Math.min(cx, window.innerWidth - 296)),
    y: Math.max(8, Math.min(cy, window.innerHeight - 280)),
    titulo, columnas, filas,
  })
}

function PopoverDetalle({ popover, onClose }: { popover: PopoverState; onClose: () => void }) {
  if (!popover) return null
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="fixed z-50 w-72 rounded-xl bg-white p-3 shadow-2xl"
        style={{ left: popover.x, top: popover.y }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-clinic-600">{popover.titulo}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-slate-400">
              {popover.columnas.map((c) => <th key={c.header} className="pb-1 pr-2 font-medium">{c.header}</th>)}
            </tr></thead>
            <tbody>
              {popover.filas.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  {popover.columnas.map((c) => <td key={c.header} className="py-1 pr-2 align-top text-slate-700">{String(c.get(f) ?? '') || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {popover.filas.length === 0 && <p className="py-2 text-center text-slate-400">Sin registros.</p>}
        </div>
      </div>
    </div>
  )
}

export default function PanelResumenPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { corte, cortes } = useCorteActivo()
  const { data: evolucion = [] } = useEvolucion()
  const { setFiltros } = useStore()

  const [mesCal, setMesCal] = useState(() => {
    if (corte && corte !== CORTE_TODOS) {
      const [y, m] = corte.split('-').map(Number)
      return { y, m: m - 1 }
    }
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [pagina, setPagina] = useState(1)
  const [popover, setPopover] = useState<PopoverState>(null)

  // ---- Resumen del corte activo vs. corte anterior ----
  const resumenCorte = useMemo(() => {
    const ordenada = [...evolucion].sort((a, b) => a.fecha_corte.localeCompare(b.fecha_corte))
    const idx = corte ? ordenada.findIndex((e) => e.fecha_corte === corte) : -1
    const anterior = idx > 0 ? ordenada[idx - 1] : null
    const total = data.length
    const delta = anterior ? total - anterior.total : null
    const deltaPct = anterior && anterior.total ? Math.round((delta! / anterior.total) * 100) : null
    return { total, anterior, delta, deltaPct }
  }, [data, evolucion, corte])

  // ---- Evolución mensual (todos los cortes, clic → filtra ese corte) ----
  const serieEvolucion = useMemo(() => {
    return [...evolucion]
      .sort((a, b) => a.fecha_corte.localeCompare(b.fecha_corte))
      .map((e) => {
        const [anio, mes] = e.fecha_corte.split('-')
        return { corte: e.fecha_corte, etiqueta: `${MESES[Number(mes)].substring(0, 3)} ${anio.substring(2)}`, total: e.total }
      })
  }, [evolucion])

  // ---- Cobertura de escalas aplicadas (gauge) ----
  const cobertura = useMemo(() => {
    const conEscala = data.filter(tieneEscalaAplicada).length
    const pct = data.length ? Math.round((conEscala / data.length) * 100) : 0
    let etiqueta = 'Sin datos', color = '#94a3b8'
    if (data.length) {
      if (pct >= 90) { etiqueta = 'Excelente'; color = '#16a34a' }
      else if (pct >= 75) { etiqueta = 'Buena'; color = '#0D2D6B' }
      else if (pct >= 50) { etiqueta = 'Regular'; color = '#ca8a04' }
      else { etiqueta = 'Baja'; color = '#dc2626' }
    }
    return { conEscala, pct, etiqueta, color }
  }, [data])

  // ---- Calendario de valoraciones (mes navegable) ----
  const calendario = useMemo(() => {
    const { y, m } = mesCal
    const primerDia = new Date(y, m, 1)
    const diasEnMes = new Date(y, m + 1, 0).getDate()
    const offset = diaSemanaLunes0(isoDate(primerDia))
    const porDia: Record<number, Valoracion[]> = {}
    data.forEach((v) => {
      if (!v.fecha_ultima_valoracion) return
      const d = new Date(`${v.fecha_ultima_valoracion}T00:00:00`)
      if (d.getFullYear() === y && d.getMonth() === m) (porDia[d.getDate()] ??= []).push(v)
    })
    const max = Math.max(1, ...Object.values(porDia).map((a) => a.length))
    const celdas: ({ dia: number; filas: Valoracion[] } | null)[] = Array.from({ length: offset }, () => null)
    for (let dia = 1; dia <= diasEnMes; dia++) celdas.push({ dia, filas: porDia[dia] ?? [] })
    const total = Object.values(porDia).reduce((a, b) => a + b.length, 0)
    return { celdas, max, total }
  }, [data, mesCal])

  // ---- Distribución por estado del paciente ----
  const porEstado = useMemo(() => {
    const conteo: Record<string, number> = {}
    data.forEach((v) => { conteo[v.estado_paciente] = (conteo[v.estado_paciente] ?? 0) + 1 })
    return [
      { nombre: 'Activo', valor: conteo['Activo'] ?? 0, color: '#16a34a' },
      { nombre: 'Egresado', valor: conteo['Egresado'] ?? 0, color: '#0284c7' },
      { nombre: 'Fallecido', valor: conteo['Fallecido'] ?? 0, color: '#334155' },
    ].sort((a, b) => b.valor - a.valor)
  }, [data])
  const totalEstados = porEstado.reduce((a, b) => a + b.valor, 0)

  // ---- Alertas combinadas ----
  const alertas = useMemo(() => {
    const refFecha = corte && corte !== CORTE_TODOS ? corte : isoDate(new Date())
    type Alerta = { key: string; tipo: 'seguimiento' | 'idc' | 'barthel'; v: Valoracion; orden: number }
    const lista: Alerta[] = []
    data.forEach((v) => {
      if (v.estancia_mayor_20_dias === 'Si' && v.estado_paciente === 'Activo') {
        const dias = v.fecha_ultima_valoracion ? diffDias(v.fecha_ultima_valoracion, refFecha) : 9999
        if (dias > 30) lista.push({ key: `s-${v.id}`, tipo: 'seguimiento', v, orden: -dias })
      }
    })
    data.forEach((v) => {
      if (v.estado_paciente === 'Fallecido' && !v.idc_fecha) lista.push({ key: `i-${v.id}`, tipo: 'idc', v, orden: 0 })
    })
    data.forEach((v) => {
      if (v.estado_paciente === 'Egresado' && !v.barthel_egreso_fecha) lista.push({ key: `b-${v.id}`, tipo: 'barthel', v, orden: 0 })
    })
    lista.sort((a, b) => a.orden - b.orden)
    return { total: lista.length, top: lista.slice(0, 8) }
  }, [data, corte])

  // ---- Ranking por especialidad ----
  const rankingEspecialidad = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach((v) => {
      const k = v.especialidad_ultima || 'Sin especialidad'
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    return [...map.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad).slice(0, 6)
  }, [data])

  // ---- Tabla paginada ----
  const filasOrdenadas = useMemo(
    () => [...data].sort((a, b) => (b.fecha_ultima_valoracion ?? '').localeCompare(a.fecha_ultima_valoracion ?? '')),
    [data]
  )
  const totalPaginas = Math.max(1, Math.ceil(filasOrdenadas.length / PAGINA_TAM))
  const filasPagina = filasOrdenadas.slice((pagina - 1) * PAGINA_TAM, pagina * PAGINA_TAM)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Panel Resumen" subtitle="Vista ejecutiva del programa de Gestión Clínica" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  const nombreMes = new Date(mesCal.y, mesCal.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      <Header title="Panel Resumen" subtitle="Vista ejecutiva del programa de Gestión Clínica" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <FiltersBar />

        {/* Fila 1: resumen del corte · evolución · cobertura de escalas */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-600">Resumen del corte</h3>
            <div className="text-xs text-slate-400">{labelCorte(corte)}</div>
            <div className="mt-2 text-3xl font-bold text-clinic-600">{resumenCorte.total}</div>
            <div className="text-xs text-slate-500">pacientes valorados</div>
            {resumenCorte.anterior && resumenCorte.deltaPct != null && (
              <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                resumenCorte.delta! > 0 ? 'bg-emerald-50 text-emerald-600' : resumenCorte.delta! < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {resumenCorte.delta! > 0 ? '▲' : resumenCorte.delta! < 0 ? '▼' : '·'} {Math.abs(resumenCorte.deltaPct)}% vs. mes anterior ({resumenCorte.anterior.total})
              </div>
            )}
          </div>

          <div className="card-chart p-5">
            <h3 className="mb-3 text-sm font-semibold text-clinic-600">
              Evolución mensual (todos los cortes)
              <InfoTip text="Total de pacientes valorados en cada snapshot mensual. Haz clic en una barra para filtrar todo el panel a ese corte." />
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={serieEvolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c7ced9" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#16468E" radius={[6, 6, 0, 0]} className="cursor-pointer"
                  onClick={(d: any) => { const item = d?.payload ?? d; if (item?.corte) setFiltros({ corte: item.corte }) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-600">
              Cobertura de escalas aplicadas
              <InfoTip text="Pacientes con al menos una escala clínica registrada (CAM, ESAS/SAS, NECPAL, PAPSCORE, Fragilidad, FOIS, RESVECH, MNA, Yesavage, Gijón o Barthel) sobre el total del corte y filtros seleccionados." />
            </h3>
            <div className="flex items-center gap-4">
              <AnilloSimple pct={cobertura.pct} color={cobertura.color}>
                <span className="text-xl font-bold" style={{ color: cobertura.color }}>{cobertura.pct}</span>
                <span className="text-[10px] text-slate-400">de 100</span>
              </AnilloSimple>
              <div>
                <div className="text-base font-bold" style={{ color: cobertura.color }}>{cobertura.etiqueta}</div>
                <div className="mt-1 text-xs text-slate-500">
                  <div>{cobertura.conEscala} de {data.length} pacientes</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fila 2: calendario · anillos por estado · alertas */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-600">Días con más valoraciones</h3>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => setMesCal((s) => { const m = s.m - 1; return m < 0 ? { y: s.y - 1, m: 11 } : { y: s.y, m } })}
                  className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-black/[0.04]">‹</button>
                <span className="w-28 text-center font-medium capitalize text-slate-600">{nombreMes}</span>
                <button onClick={() => setMesCal((s) => { const m = s.m + 1; return m > 11 ? { y: s.y + 1, m: 0 } : { y: s.y, m } })}
                  className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-black/[0.04]">›</button>
              </div>
            </div>
            <div className="mb-2 text-xs text-slate-400">{calendario.total} valoraciones en el mes</div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendario.celdas.map((c, i) => {
                if (!c) return <div key={i} />
                const n = c.filas.length
                const nivel = n === 0 ? 0 : Math.min(4, Math.ceil((n / calendario.max) * 4))
                return (
                  <div key={i}
                    onClick={(e) => {
                      if (!n) return
                      const fechaTxt = new Date(mesCal.y, mesCal.m, c.dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                      abrirPopover(setPopover, e, `${fechaTxt} · ${n} paciente(s)`, COLS_BASICAS, c.filas)
                    }}
                    className={`flex aspect-square items-center justify-center rounded text-[10px] font-medium ${n ? 'cursor-pointer' : ''}`}
                    style={{ background: CAL_ESCALA[nivel], color: nivel >= 3 ? 'white' : '#334155' }}>
                    {c.dia}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-600">Distribución por estado del paciente</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <AnillosConcentricos datos={porEstado.filter((e) => e.valor > 0)}
                  onSegmentClick={(nombre, e) => abrirPopover(setPopover, e, `${nombre} · ${porEstado.find((x) => x.nombre === nombre)?.valor ?? 0} paciente(s)`,
                    COLS_BASICAS, data.filter((v) => v.estado_paciente === nombre))} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-clinic-600">{totalEstados}</span>
                  <span className="text-[10px] text-slate-400">pacientes</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {porEstado.map((e) => (
                  <div key={e.nombre} className={`flex items-center gap-1.5 ${e.valor ? 'cursor-pointer hover:opacity-70' : ''}`}
                    onClick={(ev) => e.valor && abrirPopover(setPopover, ev, `${e.nombre} · ${e.valor} paciente(s)`, COLS_BASICAS,
                      data.filter((v) => v.estado_paciente === e.nombre))}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    <span className="text-slate-600">{e.nombre}</span>
                    <span className="font-semibold text-slate-800">{e.valor}</span>
                    <span className="text-slate-400">({totalEstados ? Math.round((e.valor / totalEstados) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-600">Alertas importantes</h3>
              <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#dc262622', color: '#dc2626' }}>
                {alertas.total} activas
              </span>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {alertas.top.length === 0 && <p className="text-xs text-slate-400">Sin alertas en el corte y filtros seleccionados.</p>}
              {alertas.top.map(({ key, tipo, v }) => {
                const cfg = tipo === 'seguimiento'
                  ? { icono: '🔴', texto: 'Larga estancia sin valoración reciente', color: '#dc2626' }
                  : tipo === 'idc'
                    ? { icono: '⚪', texto: 'Fallecido sin IDC-PAL registrado', color: '#64748b' }
                    : { icono: '🟠', texto: 'Egresado sin Barthel de egreso', color: '#ca8a04' }
                return (
                  <div key={key} className="flex items-start gap-2 rounded-lg p-2 shadow-neu-inset-sm">
                    <span>{cfg.icono}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-clinic-600">{v.nombre_paciente ?? `Ingreso ${v.ingreso}`}</span>
                        <span className="shrink-0 text-[10px]" style={{ color: cfg.color }}>{cfg.texto}</span>
                      </div>
                      <div className="truncate text-[11px] text-slate-500">{v.especialidad_ultima ?? 'Sin especialidad'} · {v.sede ?? 'Sin sede'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Fila 3: KPIs + ranking por especialidad */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center flex-shrink-0">
              <BedDouble className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-clinic-600 leading-tight">
                {(() => {
                  const vals = data.map((v) => v.estancia_total).filter((n): n is number => n != null)
                  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
                })()}
              </p>
              <p className="text-xs text-slate-500">Estancia promedio (días)</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-clinic-600 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-clinic-600 leading-tight">
                {(() => {
                  const vals = data.map((v) => v.cantidad_atenciones).filter((n): n is number => n != null)
                  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
                })()}
              </p>
              <p className="text-xs text-slate-500">Atenciones promedio por paciente</p>
            </div>
          </div>
          <div className="card-chart p-5">
            <h3 className="mb-3 text-sm font-semibold text-clinic-600 flex items-center gap-1.5">
              <Activity className="w-4 h-4" /> Valoraciones por especialidad
            </h3>
            {rankingEspecialidad.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos para el corte y filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={rankingEspecialidad} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#16468E" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tabla paginada */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-600">Pacientes del corte ({filasOrdenadas.length})</h3>
            <Link to="/valoraciones" className="text-xs font-medium text-clinic-500 hover:underline">Ir a Valoraciones ↗</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300/50 text-left">
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Paciente</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Especialidad</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Últ. valoración</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Estancia</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((v) => (
                  <tr key={v.id} className="border-b border-slate-300/30 hover:bg-black/[0.03]">
                    <td className="py-2 pr-3 text-slate-700">{v.nombre_paciente ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-500">{v.especialidad_ultima ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{v.fecha_ultima_valoracion ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-500">{v.estancia_total ?? '—'}d</td>
                    <td className="py-2 pr-3 text-slate-500">{v.estado_paciente}</td>
                  </tr>
                ))}
                {filasPagina.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sin registros para los filtros seleccionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <button className="btn-secondary" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1}>‹ Anterior</button>
              <span className="text-slate-500">Página {pagina} de {totalPaginas}</span>
              <button className="btn-secondary" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}>Siguiente ›</button>
            </div>
          )}
        </div>
      </div>

      <PopoverDetalle popover={popover} onClose={() => setPopover(null)} />
    </div>
  )
}
