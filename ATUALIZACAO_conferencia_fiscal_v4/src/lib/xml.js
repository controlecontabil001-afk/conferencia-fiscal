import JSZip from 'jszip'

export const onlyDigits = (value = '') => String(value).replace(/\D/g, '')

function firstByLocalName(root, names) {
  for (const name of names) {
    const list = root.getElementsByTagNameNS('*', name)
    if (list?.length) return list[0]
    const plain = root.getElementsByTagName(name)
    if (plain?.length) return plain[0]
  }
  return null
}

function textByLocalName(root, names) {
  const el = firstByLocalName(root, names)
  return el?.textContent?.trim() || ''
}

function attrByLocalName(root, names, attrName) {
  const el = firstByLocalName(root, names)
  return el?.getAttribute(attrName) || ''
}

function parseMoney(text) {
  if (!text) return null
  let value = String(text).trim().replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.')
  value = value.replace(/[^0-9.-]/g, '')
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function xmlDoc(raw) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  return doc
}

function removeXmlDeclaration(raw) {
  return raw.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim()
}

function splitByTag(raw, localName) {
  const pattern = new RegExp(`<(?:(?:[\\w.-]+):)?${localName}\\b[\\s\\S]*?<\\/(?:(?:[\\w.-]+):)?${localName}>`, 'gi')
  return raw.match(pattern) || []
}

function parseNfe(raw, sourceName) {
  const doc = xmlDoc(raw)
  if (!doc) return null
  const inf = firstByLocalName(doc, ['infNFe'])
  if (!inf) return null
  const id = inf.getAttribute('Id') || ''
  const key = (textByLocalName(doc, ['chNFe']) || id.replace(/^NFe/i, '')).replace(/\D/g, '')
  const model = textByLocalName(inf, ['mod'])
  const cStat = textByLocalName(doc, ['cStat'])
  const emit = firstByLocalName(inf, ['emit'])
  const dest = firstByLocalName(inf, ['dest'])
  const total = firstByLocalName(inf, ['ICMSTot'])
  const nNF = textByLocalName(inf, ['nNF'])
  return {
    id: key || `${sourceName}:${nNF}:${Math.random()}`,
    key,
    type: model === '65' ? 'NFC-e' : 'NF-e',
    model,
    number: nNF,
    series: textByLocalName(inf, ['serie']),
    date: textByLocalName(inf, ['dhEmi', 'dEmi']),
    emitterCnpj: onlyDigits(textByLocalName(emit || inf, ['CNPJ', 'CPF'])),
    recipientCnpj: onlyDigits(textByLocalName(dest || inf, ['CNPJ', 'CPF'])),
    emitterName: textByLocalName(emit || inf, ['xNome']),
    recipientName: textByLocalName(dest || inf, ['xNome']),
    value: parseMoney(textByLocalName(total || inf, ['vNF'])),
    statusCode: cStat,
    authorized: !cStat || ['100', '150'].includes(cStat),
    raw: removeXmlDeclaration(raw),
    family: 'nfe',
    sourceName
  }
}

function parseCte(raw, sourceName) {
  const doc = xmlDoc(raw)
  if (!doc) return null
  const inf = firstByLocalName(doc, ['infCte'])
  if (!inf) return null
  const id = inf.getAttribute('Id') || ''
  const key = (textByLocalName(doc, ['chCTe', 'chCte']) || id.replace(/^CTe/i, '')).replace(/\D/g, '')
  const emit = firstByLocalName(inf, ['emit'])
  const dest = firstByLocalName(inf, ['dest'])
  const rem = firstByLocalName(inf, ['rem'])
  return {
    id: key || `${sourceName}:${textByLocalName(inf, ['nCT'])}:${Math.random()}`,
    key,
    type: 'CT-e',
    model: textByLocalName(inf, ['mod']) || '57',
    number: textByLocalName(inf, ['nCT']),
    series: textByLocalName(inf, ['serie']),
    date: textByLocalName(inf, ['dhEmi', 'dEmi']),
    emitterCnpj: onlyDigits(textByLocalName(emit || inf, ['CNPJ', 'CPF'])),
    recipientCnpj: onlyDigits(textByLocalName(dest || inf, ['CNPJ', 'CPF'])),
    senderCnpj: onlyDigits(textByLocalName(rem || inf, ['CNPJ', 'CPF'])),
    emitterName: textByLocalName(emit || inf, ['xNome']),
    recipientName: textByLocalName(dest || inf, ['xNome']),
    value: parseMoney(textByLocalName(inf, ['vTPrest', 'vRec'])),
    statusCode: textByLocalName(doc, ['cStat']),
    authorized: !textByLocalName(doc, ['cStat']) || ['100', '150'].includes(textByLocalName(doc, ['cStat'])),
    raw: removeXmlDeclaration(raw),
    family: 'cte',
    sourceName
  }
}

function parseNfse(raw, sourceName) {
  const doc = xmlDoc(raw)
  if (!doc) return null
  const inf = firstByLocalName(doc, ['infNFSe', 'InfNfse', 'infNfse', 'Nfse', 'NFSe', 'CompNfse']) || doc.documentElement
  if (!inf) return null
  const id = inf.getAttribute?.('Id') || inf.getAttribute?.('id') || ''
  const number = textByLocalName(inf, ['nNFSe', 'NumeroNfse', 'Numero', 'NumeroNota', 'NumeroNFS'])
  const provider = firstByLocalName(inf, ['PrestadorServico', 'Prestador', 'emit', 'Emitente'])
  const taker = firstByLocalName(inf, ['TomadorServico', 'Tomador', 'dest', 'Destinatario'])
  const keyCandidate = textByLocalName(inf, ['ChaveAcesso', 'chNFSe', 'ChaveNfse', 'CodigoVerificacao']) || id
  return {
    id: keyCandidate || `${sourceName}:${number}:${Math.random()}`,
    key: onlyDigits(keyCandidate).length >= 30 ? onlyDigits(keyCandidate) : '',
    verificationCode: textByLocalName(inf, ['CodigoVerificacao', 'cVerif']),
    type: 'NFS-e',
    model: 'NFS-e',
    number,
    series: textByLocalName(inf, ['Serie', 'serie']),
    date: textByLocalName(inf, ['DataEmissao', 'dhEmi', 'Competencia', 'DataEmissaoNfse']),
    emitterCnpj: onlyDigits(textByLocalName(provider || inf, ['Cnpj', 'CNPJ', 'Cpf', 'CPF'])),
    recipientCnpj: onlyDigits(textByLocalName(taker || inf, ['Cnpj', 'CNPJ', 'Cpf', 'CPF'])),
    emitterName: textByLocalName(provider || inf, ['RazaoSocial', 'xNome', 'Nome']),
    recipientName: textByLocalName(taker || inf, ['RazaoSocial', 'xNome', 'Nome']),
    value: parseMoney(textByLocalName(inf, ['ValorServicos', 'vServ', 'ValorLiquidoNfse', 'ValorNota'])),
    statusCode: '',
    authorized: true,
    raw: removeXmlDeclaration(raw),
    family: 'nfse',
    sourceName
  }
}

function parseCancellationEvents(raw) {
  const cancelled = new Set()
  const events = [
    ...splitByTag(raw, 'procEventoNFe'),
    ...splitByTag(raw, 'procEventoCTe'),
    ...splitByTag(raw, 'evento')
  ]
  for (const eventRaw of events) {
    const doc = xmlDoc(eventRaw)
    if (!doc) continue
    const tpEvento = textByLocalName(doc, ['tpEvento'])
    const cStat = textByLocalName(doc, ['cStat'])
    if (tpEvento === '110111' && (!cStat || ['135', '136', '155'].includes(cStat))) {
      const key = onlyDigits(textByLocalName(doc, ['chNFe', 'chCTe', 'chCte']))
      if (key) cancelled.add(key)
    }
  }
  return cancelled
}

function detectNfseFragments(raw) {
  for (const tag of ['CompNfse', 'NFSe', 'Nfse']) {
    const parts = splitByTag(raw, tag)
    if (parts.length) return parts
  }
  const doc = xmlDoc(raw)
  if (!doc) return []
  const rootName = doc.documentElement?.localName || ''
  if (/nfse|nota|rps/i.test(rootName) || firstByLocalName(doc, ['infNFSe', 'InfNfse', 'infNfse'])) {
    return [raw]
  }
  return []
}

export function parseXmlText(raw, sourceName = 'arquivo.xml') {
  const docs = []
  const cancelledKeys = parseCancellationEvents(raw)

  const nfeParts = splitByTag(raw, 'nfeProc')
  for (const part of nfeParts) {
    const parsed = parseNfe(part, sourceName)
    if (parsed) docs.push(parsed)
  }

  const cteParts = splitByTag(raw, 'cteProc')
  for (const part of cteParts) {
    const parsed = parseCte(part, sourceName)
    if (parsed) docs.push(parsed)
  }

  if (!nfeParts.length && !cteParts.length) {
    const nfseParts = detectNfseFragments(raw)
    for (const part of nfseParts) {
      const parsed = parseNfse(part, sourceName)
      if (parsed?.number || parsed?.key || parsed?.verificationCode) docs.push(parsed)
    }
  }

  for (const item of docs) {
    if (item.key && cancelledKeys.has(item.key)) item.cancelled = true
  }

  return { docs, cancelledKeys }
}

async function processZipBuffer(buffer, sourceLabel, onXml, stats, depth = 0) {
  if (depth > 2) {
    stats.ignoredZipEntries += 1
    return
  }

  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  stats.zipEntries += entries.length

  for (const entry of entries) {
    const lower = entry.name.toLowerCase()
    if (lower.endsWith('.xml')) {
      stats.xmlFiles += 1
      const text = await entry.async('text')
      await onXml({ name: `${sourceLabel}/${entry.name}`, text })
    } else if (lower.endsWith('.zip')) {
      stats.nestedZipFiles += 1
      const nested = await entry.async('arraybuffer')
      await processZipBuffer(nested, `${sourceLabel}/${entry.name}`, onXml, stats, depth + 1)
    } else {
      stats.ignoredZipEntries += 1
    }
  }
}

export async function parseXmlFiles(files, companyCnpj = '', onProgress = null) {
  const allDocs = []
  const cancelledKeys = new Set()
  const errors = []
  const stats = {
    inputFiles: files.length,
    zipFiles: 0,
    nestedZipFiles: 0,
    zipEntries: 0,
    xmlFiles: 0,
    ignoredZipEntries: 0,
    parsedXmlFiles: 0,
    duplicateDocuments: 0
  }

  const handleXml = async ({ name, text }) => {
    try {
      const result = parseXmlText(text, name)
      result.docs.forEach((doc) => allDocs.push(doc))
      result.cancelledKeys.forEach((key) => cancelledKeys.add(key))
    } catch (error) {
      errors.push(`${name}: ${error.message}`)
    }
    stats.parsedXmlFiles += 1
    if (onProgress) onProgress({ ...stats, current: name })
    // Evita travar a interface quando o ZIP tem milhares de XMLs.
    if (stats.parsedXmlFiles % 80 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  for (const file of files) {
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.zip')) {
        stats.zipFiles += 1
        await processZipBuffer(await file.arrayBuffer(), file.name, handleXml, stats)
      } else if (lower.endsWith('.xml')) {
        stats.xmlFiles += 1
        await handleXml({ name: file.name, text: await file.text() })
      }
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`)
    }
  }

  const cnpj = onlyDigits(companyCnpj)
  const unique = new Map()
  for (const doc of allDocs) {
    if (doc.key && cancelledKeys.has(doc.key)) doc.cancelled = true
    if (cnpj) {
      if (doc.emitterCnpj === cnpj) doc.direction = 'Saída'
      else if (doc.recipientCnpj === cnpj || doc.senderCnpj === cnpj) doc.direction = 'Entrada'
      else doc.direction = 'Terceiro'
    } else {
      doc.direction = 'Não definido'
    }
    const key = doc.key || `${doc.type}|${doc.series}|${doc.number}|${doc.date}|${doc.value}|${doc.sourceName}`
    if (!unique.has(key)) unique.set(key, doc)
    else stats.duplicateDocuments += 1
  }

  return { docs: [...unique.values()], errors, stats }
}

function chunk(items, size = 1000) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function nfeWrapper(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProcs xmlns="http://www.portalfiscal.inf.br/nfe" total="${items.length}">\n${items.map((i) => i.raw).join('\n')}\n</nfeProcs>`
}

function cteWrapper(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<cteProcs xmlns="http://www.portalfiscal.inf.br/cte" total="${items.length}">\n${items.map((i) => i.raw).join('\n')}\n</cteProcs>`
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

function downloadableMissing(docs) {
  return docs.filter((d) => d.compareStatus === 'missing' && d.authorized !== false && !d.cancelled)
}

export function getMissingTypeCounts(docs) {
  const counts = { 'NF-e': 0, 'NFC-e': 0, 'CT-e': 0, 'NFS-e': 0, Outros: 0 }
  for (const doc of downloadableMissing(docs)) {
    if (Object.prototype.hasOwnProperty.call(counts, doc.type)) counts[doc.type] += 1
    else counts.Outros += 1
  }
  return counts
}

function typeConfig(type) {
  if (type === 'NF-e') return { prefix: 'NFE', folder: 'NF-e', wrapper: nfeWrapper }
  if (type === 'NFC-e') return { prefix: 'NFCE', folder: 'NFC-e', wrapper: nfeWrapper }
  if (type === 'CT-e') return { prefix: 'CTE', folder: 'CT-e', wrapper: cteWrapper }
  if (type === 'NFS-e') return { prefix: 'NFSE', folder: 'NFS-e', wrapper: null }
  return { prefix: 'OUTROS', folder: 'Outros', wrapper: null }
}

export async function buildMissingDownloadByType(docs, type) {
  const selected = downloadableMissing(docs).filter((d) => d.type === type)
  if (!selected.length) throw new Error(`Não há ${type} faltante para baixar.`)
  const cfg = typeConfig(type)

  // NF-e, NFC-e e CT-e podem ser consolidados por tipo, independentemente de serem entrada ou saída.
  if (cfg.wrapper) {
    const parts = chunk(selected, 1000)
    if (parts.length === 1) {
      return {
        blob: new Blob([cfg.wrapper(parts[0])], { type: 'application/xml;charset=utf-8' }),
        filename: `faltantes_${cfg.prefix}_unificado.xml`
      }
    }
    const zip = new JSZip()
    parts.forEach((items, idx) => {
      zip.file(`faltantes_${cfg.prefix}_parte_${String(idx + 1).padStart(2, '0')}.xml`, cfg.wrapper(items))
    })
    return {
      blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
      filename: `faltantes_${cfg.prefix}_unificados.zip`
    }
  }

  // NFS-e não possui um único layout nacional para todos os provedores/municípios.
  // Para não corromper a estrutura, os XMLs ficam separados dentro de um ZIP exclusivo de NFS-e.
  if (selected.length === 1) {
    return {
      blob: new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${selected[0].raw}`], { type: 'application/xml;charset=utf-8' }),
      filename: `faltante_${cfg.prefix}_${safeName(selected[0].number || 'documento')}.xml`
    }
  }
  const zip = new JSZip()
  selected.forEach((doc, idx) => {
    const base = `${cfg.prefix}_${doc.number || idx + 1}_${doc.key?.slice(-8) || idx + 1}.xml`
    zip.file(safeName(base), `<?xml version="1.0" encoding="UTF-8"?>\n${doc.raw}`)
  })
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    filename: `faltantes_${cfg.prefix}.zip`
  }
}

export async function buildMissingDownload(docs) {
  const missing = downloadableMissing(docs)
  if (!missing.length) throw new Error('Não há documentos faltantes para baixar.')

  const zip = new JSZip()
  const types = ['NF-e', 'NFC-e', 'CT-e', 'NFS-e']

  for (const type of types) {
    const selected = missing.filter((d) => d.type === type)
    if (!selected.length) continue
    const cfg = typeConfig(type)

    if (cfg.wrapper) {
      chunk(selected, 1000).forEach((items, idx) => {
        const suffix = selected.length > 1000 ? `_parte_${String(idx + 1).padStart(2, '0')}` : '_unificado'
        zip.file(`${cfg.folder}/faltantes_${cfg.prefix}${suffix}.xml`, cfg.wrapper(items))
      })
    } else {
      selected.forEach((doc, idx) => {
        const base = `${cfg.prefix}_${doc.number || idx + 1}_${doc.key?.slice(-8) || idx + 1}.xml`
        zip.file(`${cfg.folder}/${safeName(base)}`, `<?xml version="1.0" encoding="UTF-8"?>\n${doc.raw}`)
      })
    }
  }

  const others = missing.filter((d) => !types.includes(d.type))
  others.forEach((doc, idx) => {
    const base = `${doc.type || 'Documento'}_${doc.number || idx + 1}_${doc.key?.slice(-8) || idx + 1}.xml`
    zip.file(`Outros/${safeName(base)}`, `<?xml version="1.0" encoding="UTF-8"?>\n${doc.raw}`)
  })

  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    filename: 'faltantes_Dominio_separados_por_tipo.zip'
  }
}
