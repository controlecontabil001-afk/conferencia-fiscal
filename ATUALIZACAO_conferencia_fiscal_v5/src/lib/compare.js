import { onlyDigits } from './xml'
import { inferClientSeriesSplit, normalizeClientRows, parseReportRows, recordMatchesXml, structuredRecordKey, sumRecordValues } from './reportRows'

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

function parseBrMoney(raw) {
  if (raw == null) return null
  let s = String(raw).trim().replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function moneyTokens(line = '') {
  const out = []
  const re = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))/g
  let m
  while ((m = re.exec(line))) {
    const value = parseBrMoney(m[1])
    if (Number.isFinite(value)) out.push({ raw: m[0], value, index: m.index })
  }
  return out
}

function pickTotalCandidates(text = '') {
  const lines = text.replace(/\u00a0/g, ' ').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const labels = [
    { re: /\btotal\s+geral\b/i, weight: 100, label: 'Total Geral' },
    { re: /\bvalor\s+total\b/i, weight: 92, label: 'Valor Total' },
    { re: /\btotal\s+das\s+notas\b/i, weight: 92, label: 'Total das Notas' },
    { re: /\breceita\s+bruta\b/i, weight: 90, label: 'Receita Bruta' },
    { re: /\breceita\s+total\b/i, weight: 88, label: 'Receita Total' },
    { re: /\bfaturamento\b/i, weight: 84, label: 'Faturamento' },
    { re: /\btotal\b/i, weight: 55, label: 'Total' }
  ]

  const candidates = []
  lines.forEach((line, lineIndex) => {
    const matched = labels.find((x) => x.re.test(line))
    if (!matched) return
    const nums = moneyTokens(line)
    if (!nums.length) return
    for (const token of nums) {
      candidates.push({
        value: token.value,
        raw: token.raw,
        label: matched.label,
        line,
        lineIndex,
        score: matched.weight + Math.min(lineIndex / Math.max(lines.length, 1), 1) * 8
      })
    }
  })

  candidates.sort((a, b) => (b.score - a.score) || (b.lineIndex - a.lineIndex))
  return candidates
}

function reportContainsDoc(index, doc) {
  if (doc.key && index.keys.has(doc.key)) return true
  return numberOccurrences(index, doc.number).length > 0
}

function sumDocs(docs = []) {
  return docs.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0)
}

function typeBreakdown(docs = []) {
  const out = {}
  for (const d of docs) {
    const type = d.type || 'Outro'
    if (!out[type]) out[type] = { count: 0, total: 0 }
    out[type].count += 1
    if (Number.isFinite(d.value)) out[type].total += d.value
  }
  return out
}

export function summarizeReportText(text) {
  const index = buildReportIndex(text)
  const cnpjs = new Set((text.match(/(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g) || []).map(onlyDigits))
  const totalCandidates = pickTotalCandidates(text)
  const bestTotal = totalCandidates[0] || null
  return {
    accessKeys: index.keys.size,
    identifiedDocumentNumbers: index.numbers.size,
    cnpjs: [...cnpjs],
    totalCandidates: totalCandidates.slice(0, 10),
    bestTotal,
    chars: text.length
  }
}

export function deterministicReportComparison(clientText, dominioText, docs = []) {
  const client = buildReportIndex(clientText)
  const dominio = buildReportIndex(dominioText)
  const validDocs = docs.filter((d) => !d.cancelled && d.authorized !== false)

  // 1) Tenta primeiro uma leitura estruturada das tabelas. Isso resolve relatórios em que
  // o cliente imprime série+número em um único campo (ex.: 11053312/00), enquanto o
  // Domínio mostra Nota 53312 e Série 11 em colunas separadas.
  const rawClientRows = parseReportRows(clientText, 'cliente')
  const dominioRowsAll = parseReportRows(dominioText, 'dominio')
  const clientDirections = new Set(rawClientRows.map((r) => r.direction).filter(Boolean))
  const dominioRows = clientDirections.size ? dominioRowsAll.filter((r) => clientDirections.has(r.direction)) : dominioRowsAll
  const splitInfo = inferClientSeriesSplit(rawClientRows, dominioRows, validDocs)
  const normalizedClientRows = normalizeClientRows(rawClientRows, splitInfo.splitDigits)
  const dedupe = (rows) => [...new Map(rows.map((r) => [`${r.direction || ''}|${r.series || ''}|${r.number || r.rawDocumentCode || ''}|${r.date || ''}|${Number.isFinite(r.value) ? Math.round(r.value * 100) : ''}`, r])).values()]
  const clientRows = dedupe(normalizedClientRows)
  const dominioRowsUnique = dedupe(dominioRows)

  if (clientRows.length && dominioRowsUnique.length) {
    const domainByKey = new Map()
    dominioRowsUnique.forEach((row) => {
      const key = structuredRecordKey(row)
      if (!domainByKey.has(key)) domainByKey.set(key, [])
      domainByKey.get(key).push(row)
    })

    const clientByKey = new Map()
    clientRows.forEach((row) => {
      const key = structuredRecordKey(row)
      if (!clientByKey.has(key)) clientByKey.set(key, [])
      clientByKey.get(key).push(row)
    })

    const commonRows = []
    const onlyClientRows = []
    const valueMismatches = []
    const consumedDomain = new Set()

    for (const cRow of clientRows) {
      const key = structuredRecordKey(cRow)
      const candidates = domainByKey.get(key) || []
      let chosenIndex = -1
      for (let i = 0; i < candidates.length; i += 1) {
        const dRow = candidates[i]
        if (consumedDomain.has(dRow.id)) continue
        const valueOk = !Number.isFinite(cRow.value) || !Number.isFinite(dRow.value) || Math.abs(cRow.value - dRow.value) <= 0.01
        const dateOk = !cRow.date || !dRow.date || cRow.date === dRow.date
        if (valueOk && dateOk) { chosenIndex = i; break }
        if (chosenIndex < 0) chosenIndex = i
      }
      if (chosenIndex >= 0) {
        const dRow = candidates[chosenIndex]
        consumedDomain.add(dRow.id)
        commonRows.push({ client: cRow, dominio: dRow })
        if (Number.isFinite(cRow.value) && Number.isFinite(dRow.value) && Math.abs(cRow.value - dRow.value) > 0.01) {
          valueMismatches.push({ client: cRow, dominio: dRow, difference: Math.round((cRow.value - dRow.value) * 100) / 100 })
        }
      } else {
        onlyClientRows.push(cRow)
      }
    }

    const onlyDominioRows = dominioRowsUnique.filter((row) => !consumedDomain.has(row.id))

    const availableXmlForClient = []
    const missingRows = []
    const usedXml = new Set()
    for (const row of onlyClientRows) {
      const xml = validDocs.find((doc) => {
        const id = doc.key || doc.id
        return !usedXml.has(id) && recordMatchesXml(row, doc)
      }) || null
      if (xml) {
        usedXml.add(xml.key || xml.id)
        availableXmlForClient.push(xml)
      }
      missingRows.push({ ...row, xmlFound: Boolean(xml), xmlDoc: xml })
    }

    const clientSummary = summarizeReportText(clientText)
    const dominioSummary = summarizeReportText(dominioText)
    const clientRowsTotal = sumRecordValues(clientRows)
    const commonClientTotal = sumRecordValues(commonRows.map((x) => x.client))
    const commonDominioTotal = sumRecordValues(commonRows.map((x) => x.dominio))
    const missingTotal = sumRecordValues(onlyClientRows)
    const extraTotal = sumRecordValues(onlyDominioRows)
    const clientRevenue = clientRows.length ? clientRowsTotal : clientSummary.bestTotal?.value ?? null
    const dominioComparableRevenue = commonDominioTotal + extraTotal
    const dominioPrintedRevenue = dominioSummary.bestTotal?.value ?? null
    const revenueDifference = Number.isFinite(clientRevenue)
      ? Math.round((clientRevenue - commonDominioTotal) * 100) / 100
      : null
    const revenueMatches = Number.isFinite(revenueDifference) ? Math.abs(revenueDifference) <= 0.01 && onlyClientRows.length === 0 && valueMismatches.length === 0 : null

    const onlyClientKeys = onlyClientRows.map((r) => structuredRecordKey(r))
    const onlyDominioKeys = onlyDominioRows.map((r) => structuredRecordKey(r))
    const commonKeys = commonRows.map((x) => structuredRecordKey(x.client))
    const overallOk = onlyClientRows.length === 0 && onlyDominioRows.length === 0 && valueMismatches.length === 0 && revenueMatches !== false

    return {
      mode: 'structured',
      comparisonBasis: 'series-number',
      clientSeriesSplit: splitInfo,
      clientRows,
      dominioRows: dominioRowsUnique,
      dominioRowsAll,
      ignoredDominioRowsByDirection: dominioRowsAll.filter((r) => !dominioRows.includes(r)),
      commonRows,
      onlyClientRows,
      onlyDominioRows,
      missingRows,
      valueMismatches,
      onlyClientKeys,
      onlyDominioKeys,
      commonKeys,
      onlyClientNumbers: onlyClientRows.map((r) => r.number),
      onlyDominioNumbers: onlyDominioRows.map((r) => r.number),
      commonNumbers: commonRows.map((x) => x.client.number),
      availableXmlForClient,
      missingXmlForClient: missingRows.filter((r) => !r.xmlFound).map((r) => structuredRecordKey(r)),
      clientSummary,
      dominioSummary,
      clientDocsFromXml: validDocs.filter((d) => clientRows.some((r) => recordMatchesXml(r, d))),
      dominioDocsFromXml: validDocs.filter((d) => dominioRowsUnique.some((r) => recordMatchesXml(r, d))),
      clientXmlBreakdown: typeBreakdown(validDocs.filter((d) => clientRows.some((r) => recordMatchesXml(r, d)))),
      dominioXmlBreakdown: typeBreakdown(validDocs.filter((d) => dominioRowsUnique.some((r) => recordMatchesXml(r, d)))),
      clientRevenue,
      dominioRevenue: commonDominioTotal,
      dominioPrintedRevenue,
      dominioComparableRevenue,
      commonClientTotal,
      commonDominioTotal,
      missingTotal,
      extraTotal,
      revenueDifference,
      revenueMatches,
      revenueSourceClient: 'soma das linhas identificadas no relatório do cliente',
      revenueSourceDominio: 'soma das linhas do Domínio correspondentes ao relatório do cliente',
      overallOk
    }
  }

  // 2) Fallback genérico para outros layouts: chaves de acesso e números localizados no texto.
  const onlyClientKeys = [...client.keys].filter((k) => !dominio.keys.has(k))
  const onlyDominioKeys = [...dominio.keys].filter((k) => !client.keys.has(k))
  const commonKeys = [...client.keys].filter((k) => dominio.keys.has(k))

  const clientNumbers = new Set(client.numbers.keys())
  const dominioNumbers = new Set(dominio.numbers.keys())
  const onlyClientNumbers = [...clientNumbers].filter((n) => !dominioNumbers.has(n))
  const onlyDominioNumbers = [...dominioNumbers].filter((n) => !clientNumbers.has(n))
  const commonNumbers = [...clientNumbers].filter((n) => dominioNumbers.has(n))

  const docByKey = new Map(validDocs.filter((d) => d.key).map((d) => [d.key, d]))
  const keyMatchedDocs = onlyClientKeys.filter((k) => docByKey.has(k)).map((k) => docByKey.get(k))
  const numberMatchedDocs = validDocs.filter((d) => d.number && onlyClientNumbers.includes(String(Number(d.number))))
  const availableMap = new Map([...keyMatchedDocs, ...numberMatchedDocs].map((d) => [d.key || d.id, d]))

  const clientDocsFromXml = validDocs.filter((d) => reportContainsDoc(client, d))
  const dominioDocsFromXml = validDocs.filter((d) => reportContainsDoc(dominio, d))
  const missingDocsFromXml = [...availableMap.values()]

  const clientSummary = summarizeReportText(clientText)
  const dominioSummary = summarizeReportText(dominioText)
  const clientRevenue = clientSummary.bestTotal?.value ?? (clientDocsFromXml.length ? sumDocs(clientDocsFromXml) : null)
  const dominioRevenue = dominioSummary.bestTotal?.value ?? (dominioDocsFromXml.length ? sumDocs(dominioDocsFromXml) : null)
  const revenueDifference = Number.isFinite(clientRevenue) && Number.isFinite(dominioRevenue)
    ? Math.round((clientRevenue - dominioRevenue) * 100) / 100
    : null

  const comparisonBasis = (client.keys.size || dominio.keys.size) ? 'key' : 'number'
  const onlyClientCount = comparisonBasis === 'key' ? onlyClientKeys.length : onlyClientNumbers.length
  const onlyDominioCount = comparisonBasis === 'key' ? onlyDominioKeys.length : onlyDominioNumbers.length
  const revenueMatches = Number.isFinite(revenueDifference) ? Math.abs(revenueDifference) <= 0.01 : null
  const overallOk = onlyClientCount === 0 && onlyDominioCount === 0 && revenueMatches !== false

  return {
    mode: 'generic',
    onlyClientKeys,
    onlyDominioKeys,
    commonKeys,
    onlyClientNumbers,
    onlyDominioNumbers,
    commonNumbers,
    missingXmlForClient: onlyClientKeys.filter((k) => !docByKey.has(k)),
    availableXmlForClient: missingDocsFromXml,
    comparisonBasis,
    clientSummary,
    dominioSummary,
    clientDocsFromXml,
    dominioDocsFromXml,
    clientXmlBreakdown: typeBreakdown(clientDocsFromXml),
    dominioXmlBreakdown: typeBreakdown(dominioDocsFromXml),
    clientRevenue,
    dominioRevenue,
    revenueDifference,
    revenueMatches,
    revenueSourceClient: clientSummary.bestTotal ? `relatório (${clientSummary.bestTotal.label})` : (clientDocsFromXml.length ? 'soma dos XMLs localizados no relatório' : 'não detectado'),
    revenueSourceDominio: dominioSummary.bestTotal ? `relatório (${dominioSummary.bestTotal.label})` : (dominioDocsFromXml.length ? 'soma dos XMLs localizados no relatório' : 'não detectado'),
    overallOk
  }
}
