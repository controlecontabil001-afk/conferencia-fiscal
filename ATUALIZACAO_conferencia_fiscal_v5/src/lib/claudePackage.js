import JSZip from 'jszip'

function formatMoney(value) {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function csvCell(value) {
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function removeXmlDeclaration(raw = '') {
  return String(raw).replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
}

function chunk(items, size = 1000) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function nfeWrapper(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProcs xmlns="http://www.portalfiscal.inf.br/nfe" total="${items.length}">\n${items.map((i) => removeXmlDeclaration(i.raw)).join('\n')}\n</nfeProcs>`
}

function cteWrapper(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<cteProcs xmlns="http://www.portalfiscal.inf.br/cte" total="${items.length}">\n${items.map((i) => removeXmlDeclaration(i.raw)).join('\n')}\n</cteProcs>`
}

function safeName(name) {
  return String(name || 'arquivo').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

function addXmlsByType(zip, docs = []) {
  const groups = new Map()
  for (const doc of docs) {
    const type = doc.type || 'Outros'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(doc)
  }

  for (const [type, selected] of groups) {
    if (type === 'NF-e' || type === 'NFC-e') {
      const prefix = type === 'NF-e' ? 'NFE' : 'NFCE'
      chunk(selected, 1000).forEach((items, idx) => {
        const suffix = selected.length > 1000 ? `_parte_${String(idx + 1).padStart(2, '0')}` : '_unificado'
        zip.file(`XMLs_Faltantes/${type}/faltantes_${prefix}${suffix}.xml`, nfeWrapper(items))
      })
    } else if (type === 'CT-e') {
      chunk(selected, 1000).forEach((items, idx) => {
        const suffix = selected.length > 1000 ? `_parte_${String(idx + 1).padStart(2, '0')}` : '_unificado'
        zip.file(`XMLs_Faltantes/CT-e/faltantes_CTE${suffix}.xml`, cteWrapper(items))
      })
    } else {
      selected.forEach((doc, idx) => {
        const base = `${type}_${doc.number || idx + 1}_${doc.key?.slice(-8) || idx + 1}.xml`
        zip.file(`XMLs_Faltantes/${safeName(type)}/${safeName(base)}`, `<?xml version="1.0" encoding="UTF-8"?>\n${removeXmlDeclaration(doc.raw)}`)
      })
    }
  }
}

export async function buildClaudePackage({ reportText, data, texts }) {
  const zip = new JSZip()
  zip.file('RELATORIO_CONFERENCIA_CLAUDE.md', reportText)
  zip.file('RELATORIO_CLIENTE_EXTRAIDO.txt', texts?.clientText || '')
  zip.file('RELATORIO_DOMINIO_EXTRAIDO.txt', texts?.dominioText || '')

  const rows = data?.missingRows || []
  const header = ['Data', 'Direção', 'Série', 'Nota', 'Valor', 'XML encontrado', 'Tipo XML', 'Chave XML', 'Arquivo origem XML']
  const csv = [header.map(csvCell).join(';')]
  for (const row of rows) {
    csv.push([
      row.date || '', row.direction || '', row.series || '', row.number || row.rawDocumentCode || '',
      Number.isFinite(row.value) ? formatMoney(row.value) : '', row.xmlFound ? 'SIM' : 'NÃO',
      row.xmlDoc?.type || '', row.xmlDoc?.key || '', row.xmlDoc?.sourceName || ''
    ].map(csvCell).join(';'))
  }
  zip.file('MANIFESTO_NOTAS_FALTANTES.csv', '\ufeff' + csv.join('\n'))

  addXmlsByType(zip, data?.availableXmlForClient || [])

  zip.file('LEIA-ME.txt', [
    'PACOTE DE CONFERÊNCIA FISCAL PARA O CLAUDE',
    '',
    '1. Abra o arquivo RELATORIO_CONFERENCIA_CLAUDE.md no Claude.',
    '2. Anexe também os XMLs existentes na pasta XMLs_Faltantes. NF-e/NFC-e/CT-e já são consolidados por tipo, em lotes de até 1.000 documentos.',
    '3. Peça ao Claude para validar se cada XML corresponde às notas marcadas como faltantes no relatório do cliente e ausentes no Domínio.',
    '4. O arquivo MANIFESTO_NOTAS_FALTANTES.csv contém a lista estruturada para conferência.',
    '',
    'Importante: o navegador não consegue anexar arquivos automaticamente ao Claude; o sistema abre a página e entrega este pacote pronto.'
  ].join('\n'))

  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    filename: 'PACOTE_CLAUDE_relatorio_com_XMLs.zip'
  }
}
