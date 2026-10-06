function formatMoney(value) {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

export function buildClaudeReport({ data, texts, companyCnpj = '', clientFiles = [], dominioFiles = [], xmlFiles = [] }) {
  const basisLabel = data.comparisonBasis === 'key' ? 'chave de acesso' : 'número do documento'
  const onlyClient = data.comparisonBasis === 'key' ? data.onlyClientKeys : data.onlyClientNumbers
  const onlyDominio = data.comparisonBasis === 'key' ? data.onlyDominioKeys : data.onlyDominioNumbers
  const common = data.comparisonBasis === 'key' ? data.commonKeys : data.commonNumbers
  const now = new Date().toLocaleString('pt-BR')

  const lines = []
  lines.push('# RELATÓRIO PARA CONFERÊNCIA FISCAL NO CLAUDE')
  lines.push('')
  lines.push('## Instrução para o Claude')
  lines.push('Faça uma conferência fiscal usando somente os dados deste relatório. Não invente documentos, chaves, valores ou causas. Priorize chave de acesso; quando ela não existir, use número, série, data e valor. Identifique o que provavelmente falta no Domínio, o que existe somente no Domínio, quais XMLs já estão disponíveis para importação e quais pontos precisam de revisão manual. Responda em português do Brasil com as seções: Resumo, Divergências, XMLs disponíveis, Pontos para revisar e Ação recomendada.')
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
  lines.push(`- Itens em comum: ${common.length}`)
  lines.push(`- Somente no relatório do cliente: ${onlyClient.length}`)
  lines.push(`- Somente no relatório do Domínio: ${onlyDominio.length}`)
  lines.push(`- XMLs disponíveis para itens que parecem faltar no Domínio: ${data.availableXmlForClient.length}`)
  lines.push(`- Cliente: ${data.clientSummary.accessKeys} chave(s) e ${data.clientSummary.identifiedDocumentNumbers} número(s) identificados.`)
  lines.push(`- Domínio: ${data.dominioSummary.accessKeys} chave(s) e ${data.dominioSummary.identifiedDocumentNumbers} número(s) identificados.`)
  lines.push('')

  lines.push(`## Itens somente no cliente (${onlyClient.length})`)
  safeList(onlyClient).forEach((item) => lines.push(`- ${item}`))
  if (onlyClient.length > 5000) lines.push(`- ... ${onlyClient.length - 5000} item(ns) adicionais omitidos da listagem.`)
  lines.push('')

  lines.push(`## Itens somente no Domínio (${onlyDominio.length})`)
  safeList(onlyDominio).forEach((item) => lines.push(`- ${item}`))
  if (onlyDominio.length > 5000) lines.push(`- ... ${onlyDominio.length - 5000} item(ns) adicionais omitidos da listagem.`)
  lines.push('')

  lines.push(`## XMLs disponíveis para possível importação (${data.availableXmlForClient.length})`)
  if (!data.availableXmlForClient.length) lines.push('- Nenhum XML compatível foi localizado entre os arquivos enviados.')
  data.availableXmlForClient.forEach((doc) => lines.push(docLine(doc)))
  lines.push('')

  if (data.missingXmlForClient?.length) {
    lines.push(`## Chaves do cliente sem XML enviado ao sistema (${data.missingXmlForClient.length})`)
    safeList(data.missingXmlForClient).forEach((key) => lines.push(`- ${key}`))
    lines.push('')
  }

  lines.push('## Texto extraído dos relatórios do cliente')
  lines.push('```text')
  lines.push((texts?.clientText || '').slice(0, 120000))
  lines.push('```')
  lines.push('')
  lines.push('## Texto extraído dos relatórios do Domínio')
  lines.push('```text')
  lines.push((texts?.dominioText || '').slice(0, 120000))
  lines.push('```')
  lines.push('')
  lines.push('## Observação')
  lines.push('A comparação automática é um apoio. Quando o relatório não contém chave de acesso, a conferência por número pode exigir validação adicional por série, data, valor e tipo de documento.')

  return lines.join('\n')
}
