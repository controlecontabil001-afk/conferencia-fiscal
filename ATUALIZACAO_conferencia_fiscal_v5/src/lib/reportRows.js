function onlyDigits(value = '') { return String(value ?? '').replace(/\D+/g, '') }

function parseBrMoney(raw) {
  if (raw == null) return null
  let s = String(raw).trim().replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normInt(value) {
  if (value == null || value === '') return ''
  const digits = onlyDigits(String(value))
  if (!digits) return ''
  return String(Number(digits))
}

function dateToIso(value) {
  const m = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(value || '')
}

function cents(value) {
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

function recordId(rec) {
  return [rec.direction || '', rec.series || '', rec.number || rec.rawDocumentCode || '', rec.date || '', cents(rec.value) ?? ''].join('|')
}

function parseClientResulth(text = '') {
  const rows = []
  const lines = text.replace(/\u00a0/g, ' ').split(/\r?\n/)
  let currentFile = ''
  let currentDirection = ''
  let sawSynthetic = false

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue
    const fileMatch = line.match(/^===== ARQUIVO \d+: (.+?) =====$/)
    if (fileMatch) {
      currentFile = fileMatch[1]
      currentDirection = ''
      sawSynthetic = false
      continue
    }
    if (/RELAT[ÓO]RIO DE FATURAMENTO POR PEDIDO/i.test(line)) {
      currentDirection = 'Saída'
      sawSynthetic = true
      continue
    }
    if (/ACOMPANHAMENTO DE ENTRADAS/i.test(line)) currentDirection = 'Entrada'
    if (/ACOMPANHAMENTO DE SA[ÍI]DAS/i.test(line)) currentDirection = 'Saída'

    // Ex.: 01/09/2026 01/09/2026 56 11053312/00 / 5102/5405 ... 448,86| 0,00 0,00
    const m = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d{6,12})\/(\d{2})\s*\/\s*([0-9./-]+)\s+.*?\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\|/)
    if (!m) continue

    const rawDocumentCode = onlyDigits(m[4])
    const naturalOp = m[6]
    const value = parseBrMoney(m[7])
    const rec = {
      source: 'cliente',
      sourceFile: currentFile,
      format: sawSynthetic ? 'resulth-faturamento-sintetico' : 'cliente-tabular',
      direction: currentDirection || 'Saída',
      date: dateToIso(m[1]),
      issueDate: dateToIso(m[2]),
      orderType: m[3],
      rawDocumentCode,
      rawSuffix: m[5],
      nature: naturalOp,
      value,
      series: '',
      number: '',
      splitDigits: null,
      rawLine: line
    }
    rec.id = recordId(rec)
    rows.push(rec)
  }
  return rows
}

function parseDominio(text = '') {
  const rows = []
  const lines = text.replace(/\u00a0/g, ' ').split(/\r?\n/)
  let currentFile = ''
  let currentDirection = ''

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue
    const fileMatch = line.match(/^===== ARQUIVO \d+: (.+?) =====$/)
    if (fileMatch) {
      currentFile = fileMatch[1]
      currentDirection = ''
      continue
    }
    if (/ACOMPANHAMENTO DE ENTRADAS/i.test(line)) {
      currentDirection = 'Entrada'
      continue
    }
    if (/ACOMPANHAMENTO DE SA[ÍI]DAS/i.test(line)) {
      currentDirection = 'Saída'
      continue
    }
    if (!currentDirection) continue

    const dateMatch = line.match(/(?<!\d)(\d{2}\/\d{2}\/\d{4})(?!\d)/)
    if (!dateMatch) continue
    const after = line.slice((dateMatch.index || 0) + dateMatch[0].length)
    // Acompanhamento do Domínio: Nota Série Espécie Código Cliente/Fornecedor ... CFOP AC UF Valor Contábil Tipo
    const head = after.match(/^\s+(\d+)\s+([A-Za-z0-9]+)\s+([A-Za-z0-9]+)\s+(\d+)\s+/)
    if (!head) continue

    const typePos = line.search(/\s(?:ICMS|IPI|ISS|SUBTRI|ICMSA|ST\/AT)\s/i)
    const beforeTax = typePos >= 0 ? line.slice(0, typePos) : line
    const moneyMatches = [...beforeTax.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)]
    if (!moneyMatches.length) continue
    const value = parseBrMoney(moneyMatches[moneyMatches.length - 1][1])
    const cfopMatch = line.match(/\b([1256])[-.]?([0-9]{3})\b/)

    const rec = {
      source: 'dominio',
      sourceFile: currentFile,
      format: 'dominio-acompanhamento',
      direction: currentDirection,
      date: dateToIso(dateMatch[1]),
      number: normInt(head[1]),
      series: normInt(head[2]),
      species: head[3],
      internalCode: head[4],
      cfop: cfopMatch ? `${cfopMatch[1]}${cfopMatch[2]}` : '',
      value,
      rawLine: line
    }
    rec.id = recordId(rec)
    rows.push(rec)
  }
  return rows
}

function clientSplitCandidates(rawCode) {
  const raw = onlyDigits(rawCode)
  const out = []
  if (!raw) return out
  out.push({ splitDigits: 0, series: '', number: normInt(raw) })
  for (let n = 1; n <= Math.min(3, raw.length - 1); n += 1) {
    out.push({ splitDigits: n, series: normInt(raw.slice(0, n)), number: normInt(raw.slice(n)) })
  }
  return out
}

function compKey(series, number) {
  return `${normInt(series)}|${normInt(number)}`
}

export function inferClientSeriesSplit(clientRows = [], dominioRows = [], xmlDocs = []) {
  const domainKeys = new Set(dominioRows.map((r) => compKey(r.series, r.number)))
  const xmlKeys = new Set(xmlDocs.filter((d) => d.number).map((d) => compKey(d.series, d.number)))
  const scores = []

  for (let splitDigits = 0; splitDigits <= 3; splitDigits += 1) {
    let domainMatches = 0
    let xmlMatches = 0
    let eligible = 0
    for (const row of clientRows) {
      const candidate = clientSplitCandidates(row.rawDocumentCode).find((c) => c.splitDigits === splitDigits)
      if (!candidate) continue
      eligible += 1
      const key = compKey(candidate.series, candidate.number)
      if (domainKeys.has(key)) domainMatches += 1
      if (xmlKeys.has(key)) xmlMatches += 1
    }
    scores.push({ splitDigits, domainMatches, xmlMatches, eligible, score: domainMatches * 10 + xmlMatches })
  }

  scores.sort((a, b) => b.score - a.score || b.domainMatches - a.domainMatches || b.xmlMatches - a.xmlMatches)
  const best = scores[0] || { splitDigits: 0, domainMatches: 0, xmlMatches: 0, eligible: 0, score: 0 }
  // Sem evidência externa, o formato Resulth usado nos exemplos traz série nos 2 primeiros dígitos.
  if (best.score === 0 && clientRows.some((r) => r.format === 'resulth-faturamento-sintetico' && r.rawDocumentCode?.length === 8)) {
    return { ...best, splitDigits: 2, inferredBy: 'formato-resulth', scores }
  }
  return { ...best, inferredBy: 'correspondencia', scores }
}

export function normalizeClientRows(clientRows = [], splitDigits = 0) {
  return clientRows.map((row) => {
    if (!row.rawDocumentCode) return row
    const candidate = clientSplitCandidates(row.rawDocumentCode).find((c) => c.splitDigits === splitDigits) || clientSplitCandidates(row.rawDocumentCode)[0]
    const rec = { ...row, series: candidate?.series || '', number: candidate?.number || '', splitDigits }
    rec.id = recordId(rec)
    return rec
  })
}

export function parseReportRows(text = '', role = 'auto') {
  if (role === 'cliente') return parseClientResulth(text)
  if (role === 'dominio') return parseDominio(text)
  const dominio = parseDominio(text)
  return dominio.length ? dominio : parseClientResulth(text)
}

export function structuredRecordKey(record) {
  return compKey(record.series, record.number)
}

export function sumRecordValues(records = []) {
  return Math.round(records.reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0) * 100) / 100
}

export function recordMatchesXml(record, doc) {
  if (!record || !doc || doc.cancelled || doc.authorized === false) return false
  if (record.key && doc.key && onlyDigits(record.key) === onlyDigits(doc.key)) return true
  if (record.number && doc.number) {
    const numberOk = normInt(record.number) === normInt(doc.number)
    const seriesOk = !record.series || !doc.series || normInt(record.series) === normInt(doc.series)
    if (!numberOk || !seriesOk) return false
    if (Number.isFinite(record.value) && Number.isFinite(doc.value) && Math.abs(record.value - doc.value) > 0.01) return false
    return true
  }
  return false
}
