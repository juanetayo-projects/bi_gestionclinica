import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const AZUL: [number, number, number] = [13, 45, 107]   // #0D2D6B

async function loadLogoBase64(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const response = await fetch(`${base}logo-white.png`)
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export interface ExportTable {
  titulo: string          // título del reporte
  subtitulo?: string      // p.ej. periodo / filtros aplicados
  head: string[]
  body: (string | number | null)[][]
  nombreArchivo: string   // sin extensión
}

/** Exporta a Excel con títulos y nombre de la clínica */
export function exportTableToExcel({ titulo, subtitulo, head, body, nombreArchivo }: ExportTable) {
  const wb = XLSX.utils.book_new()
  const rows: (string | number | null)[][] = [
    [titulo],
    ['Clínica de Alta Complejidad Santa Bárbara — BI Gestión Clínica'],
    [subtitulo ?? `Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
    head,
    ...body,
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = head.map((h, i) => {
    const maxLen = Math.max(h.length, ...body.slice(0, 200).map(r => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) }
  })
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(head.length - 1, 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(head.length - 1, 1) } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(head.length - 1, 1) } },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}

/** Exporta a PDF con encabezado azul, logo y títulos */
export async function exportTableToPDF({ titulo, subtitulo, head, body, nombreArchivo }: ExportTable) {
  const landscape = head.length > 6
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const headerH = 24

  doc.setFillColor(...AZUL)
  doc.rect(0, 0, pageW, headerH, 'F')

  const logo = await loadLogoBase64()
  if (logo) doc.addImage(logo, 'PNG', 5, 3, 36, 17)

  const textX = logo ? 46 : 8
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, textX, 11)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Clínica de Alta Complejidad Santa Bárbara — BI Gestión Clínica', textX, 17)
  if (subtitulo) {
    doc.setFontSize(7.5)
    doc.text(subtitulo, pageW - doc.getTextWidth(subtitulo) - 5, 17)
  }

  autoTable(doc, {
    head: [head],
    body: body.map(r => r.map(c => c ?? '—')),
    startY: headerH + 3,
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [241, 245, 250] },
    margin: { left: 5, right: 5 },
  })

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(6.5)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 5, pageH - 3)
  doc.text('BI Gestión Clínica · Clínica Santa Bárbara', pageW / 2, pageH - 3, { align: 'center' })

  doc.save(`${nombreArchivo}.pdf`)
}
