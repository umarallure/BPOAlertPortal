export type AgencyExecutiveSummaryRow = {
  metric: string
  thisWeek: number
  lastWeek: number
  deltaPercent: string
}

export type AgencyPerformanceRateRow = {
  kpi: string
  rate: string
  formula: string
  interpretation: string
}

export type CallCenterMetricRowExport = {
  metric: string
  thisWeek: number
  lastWeek: number
  deltaPercent: string
}

export type CallCenterFeedbackRowExport = {
  title: string
  description: string
  feedbackBy: string
  createdAt: string
}

export type CallCenterReportExport = {
  id: string
  centerName: string
  metrics: CallCenterMetricRowExport[]
  feedbacks?: CallCenterFeedbackRowExport[]
}

export type AgencyTopPerformers = {
  highestTransfer: { name: string, value: string }
  highestSales: { name: string, value: string }
  mostImproved: { name: string, value: string }
}

export async function downloadAgencyPerformanceReportPdf(params: {
  filename: string
  weekLabel: string
  executiveSummary: AgencyExecutiveSummaryRow[]
  performanceRates: AgencyPerformanceRateRow[]
  topPerformers: AgencyTopPerformers
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('WEEKLY AGENCY PERFORMANCE REPORT', marginX, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(params.weekLabel, pageWidth - marginX, 48, { align: 'right' })

  let cursorY = 70

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('1. EXECUTIVE SUMMARY', marginX, cursorY)
  cursorY += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('A quick overview of the agency’s weekly performance.', marginX, cursorY)
  cursorY += 10

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39] },
    head: [['Metric', 'This Week', 'Last Week', 'Change %']],
    body: params.executiveSummary.map(r => [
      r.metric,
      String(r.thisWeek),
      String(r.lastWeek),
      r.deltaPercent
    ])
  })

  cursorY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 22 : cursorY + 120

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('2. PERFORMANCE RATES', marginX, cursorY)

  autoTable(doc, {
    startY: cursorY + 12,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39] },
    head: [['KPI', 'Rate', 'Formula', 'Interpretation']],
    body: params.performanceRates.map(r => [
      r.kpi,
      r.rate,
      r.formula,
      r.interpretation
    ])
  })

  cursorY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 26 : cursorY + 140

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOP PERFORMERS OF THE WEEK', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Highlighting individuals or teams boosts morale.', pageWidth / 2, cursorY, { align: 'center' })
  cursorY += 18

  const lines = [
    `Highest Transfer: ${params.topPerformers.highestTransfer.name} – ${params.topPerformers.highestTransfer.value}`,
    `Highest Sales: ${params.topPerformers.highestSales.name} – ${params.topPerformers.highestSales.value}`,
    `Most Improved center: ${params.topPerformers.mostImproved.name} – ${params.topPerformers.mostImproved.value}`
  ]

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2)
    doc.text(wrapped, marginX, cursorY)
    cursorY += 14 * wrapped.length
  }

  doc.save(params.filename)
}

export async function downloadCallCenterPerformanceReportPdf(params: {
  filename: string
  weekLabel: string
  centers: CallCenterReportExport[]
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('WEEKLY CALL CENTER PERFORMANCE REPORT', marginX, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(params.weekLabel, pageWidth - marginX, 48, { align: 'right' })

  let cursorY = 70

  const centers = params.centers || []
  if (centers.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('No call center data available for the selected range.', marginX, cursorY)
    doc.save(params.filename)
    return
  }

  for (let i = 0; i < centers.length; i += 1) {
    const center = centers[i]
    if (!center) {
      continue
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`${i + 1}. ${center.centerName}`, marginX, cursorY)
    cursorY += 10

    autoTable(doc, {
      startY: cursorY + 10,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39] },
      head: [['Metric', 'This Week', 'Last Week', 'Change %']],
      body: (center.metrics || []).map(r => [
        r.metric,
        String(r.thisWeek),
        String(r.lastWeek),
        r.deltaPercent
      ])
    })

    cursorY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : cursorY + 160

    const feedbacks = center.feedbacks || []
    if (feedbacks.length > 0) {
      const pageHeight = doc.internal.pageSize.getHeight()
      if (cursorY > pageHeight - 80) {
        doc.addPage()
        cursorY = 60
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('LA Feedback:', marginX, cursorY)
      cursorY += 14

      for (const fb of feedbacks) {
        const timestamp = fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ''
        const byLine = timestamp
          ? `Feedback by ${fb.feedbackBy || 'admin'} (${timestamp}):`
          : `Feedback by ${fb.feedbackBy || 'admin'}:`
        const titleLine = fb.title || ''
        const descLine = fb.description || ''

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)

        const byWrapped = doc.splitTextToSize(byLine, pageWidth - marginX * 2)
        const titleWrapped = doc.splitTextToSize(titleLine, pageWidth - marginX * 2)
        const descWrapped = doc.splitTextToSize(descLine, pageWidth - marginX * 2)

        const neededHeight = 12 * (byWrapped.length + titleWrapped.length + descWrapped.length) + 10
        if (cursorY + neededHeight > pageHeight - 40) {
          doc.addPage()
          cursorY = 60
        }

        doc.text(byWrapped, marginX, cursorY)
        cursorY += 12 * byWrapped.length

        if (titleWrapped.length > 0) {
          doc.text(titleWrapped, marginX, cursorY)
          cursorY += 12 * titleWrapped.length
        }

        if (descWrapped.length > 0) {
          doc.text(descWrapped, marginX, cursorY)
          cursorY += 12 * descWrapped.length
        }

        cursorY += 10
      }
    }

    cursorY += 8

    const pageHeight = doc.internal.pageSize.getHeight()
    if (cursorY > pageHeight - 80 && i < centers.length - 1) {
      doc.addPage()
      cursorY = 60
    }
  }

  doc.save(params.filename)
}

export function buildAgencyPerformanceReportHtml(params: {
  weekLabel: string
  executiveSummary: AgencyExecutiveSummaryRow[]
  performanceRates: AgencyPerformanceRateRow[]
  topPerformers: AgencyTopPerformers
}) {
  const { weekLabel, executiveSummary, performanceRates, topPerformers } = params

  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const executiveRows = executiveSummary
    .map((r) => {
      return `
        <tr>
          <td>${esc(r.metric)}</td>
          <td class="num">${esc(r.thisWeek)}</td>
          <td class="num">${esc(r.lastWeek)}</td>
          <td class="num">${esc(r.deltaPercent)}</td>
          <td></td>
        </tr>
      `
    })
    .join('')

  const performanceRows = performanceRates
    .map((r) => {
      return `
        <tr>
          <td>${esc(r.kpi)}</td>
          <td class="num">${esc(r.rate)}</td>
          <td>${esc(r.formula)}</td>
          <td>${esc(r.interpretation)}</td>
        </tr>
      `
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Weekly Agency Performance Report</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 28px; color: #111827; }
    .header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 18px; }
    .header h1 { font-size: 18px; margin: 0; letter-spacing: 0.04em; text-transform: uppercase; }
    .header .week { font-size: 13px; color: #374151; white-space: nowrap; }
    h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.03em; }
    p.desc { margin: 0 0 10px; font-size: 12.5px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12.5px; vertical-align: top; }
    th { background: #f9fafb; text-align: left; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .top { margin-top: 20px; }
    .top h2 { text-align: center; margin-top: 26px; }
    .top .desc { text-align: center; }
    .top ul { list-style: none; padding: 0; margin: 10px 0 0; }
    .top li { margin: 6px 0; font-size: 13px; }
    @media print { body { margin: 14mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>WEEKLY AGENCY PERFORMANCE REPORT</h1>
    <div class="week">${esc(weekLabel)}</div>
  </div>

  <h2>1. EXECUTIVE SUMMARY</h2>
  <p class="desc">A quick overview of the agency’s weekly performance.</p>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>This Week</th>
        <th>Last Week</th>
        <th>Δ %</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${executiveRows}
    </tbody>
  </table>

  <h2>2. PERFORMANCE RATES</h2>
  <table>
    <thead>
      <tr>
        <th>KPI</th>
        <th>Rate</th>
        <th>Formula</th>
        <th>Interpretation</th>
      </tr>
    </thead>
    <tbody>
      ${performanceRows}
    </tbody>
  </table>

  <div class="top">
    <h2>TOP PERFORMERS OF THE WEEK</h2>
    <p class="desc">Highlighting individuals or teams boosts morale.</p>
    <ul>
      <li>🥇 Highest Transfer: ${esc(topPerformers.highestTransfer.name)} – ${esc(topPerformers.highestTransfer.value)}</li>
      <li>🥇 Highest Sales: ${esc(topPerformers.highestSales.name)} – ${esc(topPerformers.highestSales.value)}</li>
      <li>⭐ Most Improved center: ${esc(topPerformers.mostImproved.name)} – ${esc(topPerformers.mostImproved.value)}</li>
    </ul>
  </div>
</body>
</html>`
}

export function downloadHtmlReport(params: { filename: string, html: string }) {
  const blob = new Blob([params.html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = params.filename
  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 2000)
}

export function openPrintWindow(html: string) {
  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Popup blocked. Please allow popups to print/export the report.')
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
  }, 250)
}
