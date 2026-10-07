function formatMoney(value) {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value) {
  const m = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value || '-')
}

function safeList(items = [], limit = 5000) {
  return items.slice(0, limit)
}

function docLine(doc) {
  const parts = [
    doc.type || 'Documento',
    doc.direction || 'Movimento não definido',
    `nº ${doc.number || '-'}`,
    `série ${doc.series || '-'}`,
    `valor ${formatMoney(doc.value)}`,
    doc.key ? `chave ${doc.key}` : 'sem chave detectada'
  ]
  return `- ${parts.join(' | ')}`
}

function missingRowLine(row) {
  return `- ${formatDate(row.date)} | ${row.direction || '-'} | série ${row.series || '-'} | nota ${row.number || row.rawDocumentCode || '-'} | ${formatMoney(row.value)} | XML: ${row.xmlFound ? `${row.xmlDoc?.type || 'localizado'}${row.xmlDoc?.key ? ` | chave ${row.xmlDoc.key}` : ''}` : 'NÃO LOCALIZADO'}`
}

export function buildClaudeReport({ data, texts, companyCnpj = '', clientFiles = [], dominioFiles = [], xmlFiles = [] }) {
  const structured = data.mode === 'structured'
  const basisLabel = structured
    ? 'série + número do documento, com validação por data e valor'
    : data.comparisonBasis === 'key' ? 'chave de acesso' : 'número do documento'
  const onlyClient = structured ? (data.onlyClientRows || []) : (data.comparisonBasis === 'key' ? data.onlyClientKeys : data.onlyClientNumbers)
  const onlyDominio = structured ? (data.onlyDominioRows || []) : (data.comparisonBasis === 'key' ? data.onlyDominioKeys : data.onlyDominioNumbers)
  const commonCount = structured ? (data.commonRows || []).length : (data.comparisonBasis === 'key' ? data.commonKeys.length : data.commonNumbers.length)
  const now = new Date().toLocaleString('pt-BR')

  const lines = []
  lines.push('# RELATÓRIO PARA CONFERÊNCIA FISCAL NO CLAUDE')
  lines.push('')
  lines.push('## Instrução para o Claude')
  lines.push('Confira o relatório do cliente contra o relatório do Domínio. O relatório do cliente representa o que deveria existir na escrituração. Marque como FALTANDO NO DOMÍNIO todo documento presente no cliente e ausente no Domínio. Valide número, série, data e valor; quando houver chave XML, use-a como confirmação adicional. Verifique também se o total/receita do cliente fecha com os documentos encontrados no Domínio. Para cada nota faltante que possuir XML no pacote, confirme que o XML corresponde à nota e informe que está pronta para importação. Não invente documentos, chaves, valores ou causas.')
  lines.push('')
  lines.push('Responda em português do Brasil nas seções: Resumo, Notas faltando no Domínio, XMLs prontos para importar, Divergências de valor, Itens a mais no Domínio, Fechamento da receita e Ação recomendada.')
  lines.push('')
  lines.push('## Identificação da conferência')
  lines.push(`- Gerado em: ${now}`)
  lines.push(`- CNPJ informado no sistema: ${companyCnpj || 'não informado'}`)
  lines.push(`- Base principal da comparação automática: ${basisLabel}`)
  lines.push(`- Relatórios do cliente: ${clientFiles.map((f) => f.name).join(', ') || 'nenhum nome disponível'}`)
  lines.push(`- Relatórios do Domínio: ${dominioFiles.map((f) => f.name).join(', ') || 'nenhum nome disponível'}`)
  lines.push(`- Arquivos XML/ZIP analisados: ${xmlFiles.map((f) => f.name).join(', ') || 'não enviados'}`)
  lines.push('')
  lines.push('## Resumo automático')
  lines.push(`- Itens em comum: ${commonCount}`)
  lines.push(`- Somente no relatório do cliente / faltando no Domínio: ${onlyClient.length}`)
  lines.push(`- Somente no relatório do Domínio: ${onlyDominio.length}`)
  lines.push(`- XMLs localizados para as notas faltantes: ${data.availableXmlForClient.length}`)
  lines.push(`- Receita/total do cliente comparável: ${Number.isFinite(data.clientRevenue) ? formatMoney(data.clientRevenue) : 'não detectado'} (${data.revenueSourceClient || 'sem fonte'})`)
  lines.push(`- Total das notas do Domínio que correspondem ao relatório do cliente: ${Number.isFinite(data.dominioRevenue) ? formatMoney(data.dominioRevenue) : 'não detectado'} (${data.revenueSourceDominio || 'sem fonte'})`)
  if (Number.isFinite(data.dominioPrintedRevenue)) lines.push(`- Total Geral impresso no relatório do Domínio: ${formatMoney(data.dominioPrintedRevenue)}`)
  if (Number.isFinite(data.missingTotal)) lines.push(`- Valor das notas do cliente ausentes no Domínio: ${formatMoney(data.missingTotal)}`)
  if (Number.isFinite(data.extraTotal)) lines.push(`- Valor dos itens a mais no Domínio: ${formatMoney(data.extraTotal)}`)
  lines.push(`- Diferença cliente - notas correspondentes no Domínio: ${Number.isFinite(data.revenueDifference) ? formatMoney(data.revenueDifference) : 'não calculada'}`)
  lines.push(`- Receita bateu: ${data.revenueMatches === true ? 'SIM' : data.revenueMatches === false ? 'NÃO' : 'REVISAR'}`)
  lines.push(`- Status geral da conferência: ${data.overallOk ? 'OK' : 'COM DIVERGÊNCIAS'}`)
  lines.push('')

  if (structured) {
    lines.push(`## Notas faltando no Domínio (${data.missingRows?.length || 0})`)
    if (!data.missingRows?.length) lines.push('- Nenhuma nota faltante identificada.')
    safeList(data.missingRows || []).forEach((row) => lines.push(missingRowLine(row)))
    if ((data.missingRows?.length || 0) > 5000) lines.push(`- ... ${(data.missingRows.length - 5000)} item(ns) adicionais omitidos.`)
    lines.push('')

    lines.push(`## Divergências de valor em documentos presentes nos dois relatórios (${data.valueMismatches?.length || 0})`)
    if (!data.valueMismatches?.length) lines.push('- Nenhuma divergência de valor detectada nos documentos em comum.')
    safeList(data.valueMismatches || []).forEach((item) => {
      lines.push(`- Série ${item.client.series} nota ${item.client.number}: cliente ${formatMoney(item.client.value)} | Domínio ${formatMoney(item.dominio.value)} | diferença ${formatMoney(item.difference)}`)
    })
    lines.push('')

    lines.push(`## Itens a mais no Domínio (${data.onlyDominioRows?.length || 0})`)
    if (!data.onlyDominioRows?.length) lines.push('- Nenhum item a mais detectado.')
    safeList(data.onlyDominioRows || []).forEach((row) => {
      lines.push(`- ${formatDate(row.date)} | ${row.direction || '-'} | série ${row.series || '-'} | nota ${row.number || '-'} | CFOP ${row.cfop || '-'} | ${formatMoney(row.value)}`)
    })
    lines.push('')
  } else {
    lines.push(`## Itens somente no cliente (${onlyClient.length})`)
    safeList(onlyClient).forEach((item) => lines.push(`- ${item}`))
    lines.push('')
    lines.push(`## Itens somente no Domínio (${onlyDominio.length})`)
    safeList(onlyDominio).forEach((item) => lines.push(`- ${item}`))
    lines.push('')
  }

  lines.push(`## XMLs disponíveis para importação (${data.availableXmlForClient.length})`)
  if (!data.availableXmlForClient.length) lines.push('- Nenhum XML compatível foi localizado entre os arquivos enviados.')
  data.availableXmlForClient.forEach((doc) => lines.push(docLine(doc)))
  lines.push('')

  lines.push('## Texto extraído dos relatórios do cliente')
  lines.push('```text')
  lines.push((texts?.clientText || '').slice(0, 160000))
  lines.push('```')
  lines.push('')
  lines.push('## Texto extraído dos relatórios do Domínio')
  lines.push('```text')
  lines.push((texts?.dominioText || '').slice(0, 160000))
  lines.push('```')
  lines.push('')
  lines.push('## Observação')
  lines.push('O pacote gerado pelo sistema contém este relatório, um manifesto CSV e os XMLs das notas identificadas como faltantes. NF-e, NFC-e e CT-e são consolidados por tipo em lotes de até 1.000 documentos para facilitar a conferência/importação.')

  return lines.join('\n')
}
