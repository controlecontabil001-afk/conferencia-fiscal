import { onlyDigits } from './xml'

function moneyVariants(value) {
  if (!Number.isFinite(value)) return []
  const br = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const plain = value.toFixed(2)
  return [br, plain, br.replace(/\./g, ''), plain.replace('.', ',')]
}

export function buildReportIndex(text = '') {
  const normalized = text.replace(/\u00a0/g, ' ')
  const flat = normalized.replace(/\s+/g, ' ')
  const keys = new Set((normalized.match(/(?<!\d)\d{44}(?!\d)/g) || []).map(onlyDigits))
  const lines = normalized.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const numbers = new Map()

  const labelRegexes = [
    /(?:NF(?:-?e|C-?e|CE|S-?e)?|Nota(?:\s+Fiscal)?|Documento|N[º°o]\.?)[^0-9]{0,18}(\d{1,12})/gi,
    /(?:nNF|nCT|NumeroNfse|Número)[^0-9]{0,12}(\d{1,12})/gi
  ]

  lines.forEach((line, lineIndex) => {
    for (const regex of labelRegexes) {
      regex.lastIndex = 0
      let m
      while ((m = regex.exec(line))) {
        const num = String(Number(m[1]))
        if (!numbers.has(num)) numbers.set(num, [])
        numbers.get(num).push({ line, lineIndex })
      }
    }
  })

  return { text: normalized, flat, lines, keys, numbers }
}

function numberOccurrences(index, number) {
  if (!number) return []
  const clean = String(Number(number))
  const fromLabels = index.numbers.get(clean) || []
  if (fromLabels.length) return fromLabels
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\D)0*${escaped}(\\D|$)`)
  return index.lines
    .map((line, idx) => ({ line, lineIndex: idx }))
    .filter(({ line }) => re.test(line))
}

export function matchDocumentToReport(doc, index) {
  if (doc.cancelled) return { status: 'cancelled', confidence: 1, reason: 'Documento cancelado por evento XML.' }
  if (doc.authorized === false) return { status: 'ignored', confidence: 1, reason: `XML sem autorização (${doc.statusCode || 'status desconhecido'}).` }

  if (doc.key && index.keys.has(doc.key)) {
    return { status: 'imported', confidence: 1, reason: 'Chave de acesso encontrada no relatório.' }
  }

  const occurrences = numberOccurrences(index, doc.number)
  if (!occurrences.length) {
    return { status: 'missing', confidence: 0.95, reason: 'Número do documento não localizado no relatório.' }
  }

  const series = doc.series ? String(Number(doc.series)) : ''
  const values = moneyVariants(doc.value)
  let best = 0
  let reason = 'Número localizado, mas sem confirmação suficiente.'

  for (const { line } of occurrences) {
    let score = 0.55
    if (series) {
      const seriesRe = new RegExp(`(?:s[eé]rie|serie|ser)[^0-9]{0,8}0*${series}(?:\\D|$)`, 'i')
      if (seriesRe.test(line)) score += 0.18
    }
    if (values.some((v) => line.includes(v))) score += 0.20
    if (doc.model && line.includes(doc.model)) score += 0.05
    if (score > best) best = score
  }

  if (best >= 0.72) {
    reason = best >= 0.9 ? 'Número, série/valor compatíveis com o relatório.' : 'Número localizado com elementos compatíveis.'
    return { status: 'imported', confidence: Math.min(best, 0.99), reason }
  }

  if (occurrences.length === 1 && !doc.value && !doc.series) {
    return { status: 'review', confidence: 0.6, reason: 'Número localizado uma única vez, mas sem chave/série/valor para confirmar.' }
  }

  return { status: 'review', confidence: Math.max(best, 0.55), reason }
}

export function compareDocumentsToReport(docs, reportText) {
  const index = buildReportIndex(reportText)
  const compared = docs.map((doc) => {
    const result = matchDocumentToReport(doc, index)
    return { ...doc, compareStatus: result.status, confidence: result.confidence, compareReason: result.reason }
  })

  const xmlKeys = new Set(docs.map((d) => d.key).filter(Boolean))
  const reportKeysWithoutXml = [...index.keys].filter((key) => !xmlKeys.has(key))

  const counts = compared.reduce((acc, doc) => {
    acc[doc.compareStatus] = (acc[doc.compareStatus] || 0) + 1
    return acc
  }, {})

  return { compared, counts, reportKeysWithoutXml, index }
}

function pickLabeledNumbers(text, labels) {
  const results = []
  for (const label of labels) {
    const re = new RegExp(`${label}[^0-9]{0,24}(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+(?:[.,]\\d{2})?)`, 'gi')
    let m
    while ((m = re.exec(text))) results.push(m[1])
  }
  return results
}

export function summarizeReportText(text) {
  const index = buildReportIndex(text)
  const cnpjs = new Set((text.match(/(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g) || []).map(onlyDigits))
  const totals = pickLabeledNumbers(text, ['Total', 'Valor Total', 'Total Geral', 'Total das Notas'])
  return {
    accessKeys: index.keys.size,
    identifiedDocumentNumbers: index.numbers.size,
    cnpjs: [...cnpjs],
    totalCandidates: totals.slice(-10),
    chars: text.length
  }
}

export function deterministicReportComparison(clientText, dominioText, docs = []) {
  const client = buildReportIndex(clientText)
  const dominio = buildReportIndex(dominioText)

  const onlyClientKeys = [...client.keys].filter((k) => !dominio.keys.has(k))
  const onlyDominioKeys = [...dominio.keys].filter((k) => !client.keys.has(k))
  const commonKeys = [...client.keys].filter((k) => dominio.keys.has(k))

  const clientNumbers = new Set(client.numbers.keys())
  const dominioNumbers = new Set(dominio.numbers.keys())
  const onlyClientNumbers = [...clientNumbers].filter((n) => !dominioNumbers.has(n))
  const onlyDominioNumbers = [...dominioNumbers].filter((n) => !clientNumbers.has(n))
  const commonNumbers = [...clientNumbers].filter((n) => dominioNumbers.has(n))

  const docByKey = new Map(docs.filter((d) => d.key).map((d) => [d.key, d]))
  const keyMatchedDocs = onlyClientKeys.filter((k) => docByKey.has(k)).map((k) => docByKey.get(k))
  const numberMatchedDocs = docs.filter((d) => d.number && onlyClientNumbers.includes(String(Number(d.number))))
  const availableMap = new Map([...keyMatchedDocs, ...numberMatchedDocs].map((d) => [d.key || d.id, d]))

  return {
    onlyClientKeys,
    onlyDominioKeys,
    commonKeys,
    onlyClientNumbers,
    onlyDominioNumbers,
    commonNumbers,
    missingXmlForClient: onlyClientKeys.filter((k) => !docByKey.has(k)),
    availableXmlForClient: [...availableMap.values()],
    comparisonBasis: (client.keys.size || dominio.keys.size) ? 'key' : 'number',
    clientSummary: summarizeReportText(clientText),
    dominioSummary: summarizeReportText(dominioText)
  }
}
