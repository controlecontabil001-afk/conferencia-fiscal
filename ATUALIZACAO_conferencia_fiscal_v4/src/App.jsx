import React, { useMemo, useState } from 'react'
import { extractTextFromFile, extractTextFromFiles, parseSimplesExtract } from './lib/pdf'
import { buildMissingDownload, buildMissingDownloadByType, getMissingTypeCounts, onlyDigits, parseXmlFiles } from './lib/xml'
import { compareDocumentsToReport, deterministicReportComparison } from './lib/compare'
import { calculateAllAnnexes, calculateAnnex, getAnnexLabel } from './lib/simples'
import { buildClaudeReport } from './lib/claudeReport'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function pct(rate, digits = 4) {
  if (!Number.isFinite(rate)) return '-'
  return `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function FileDrop({ label, hint, accept, multiple = false, files = [], onChange }) {
  const names = files.map((f) => f.name)
  return (
    <label className="file-drop">
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => onChange(multiple ? [...e.target.files] : e.target.files?.[0] ? [e.target.files[0]] : [])}
      />
      <span className="file-icon">＋</span>
      <strong>{label}</strong>
      <small>{hint}</small>
      {names.length > 0 && (
        <div className="file-list">
          {names.slice(0, 4).map((name) => <span key={name}>{name}</span>)}
          {names.length > 4 && <span>+ {names.length - 4} arquivo(s)</span>}
        </div>
      )}
    </label>
  )
}

function Kpi({ label, value, tone = '' }) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    imported: ['Importada', 'ok'],
    missing: ['Faltando', 'danger'],
    review: ['Revisar', 'warn'],
    cancelled: ['Cancelada', 'muted'],
    ignored: ['Ignorada', 'muted']
  }
  const [label, tone] = map[status] || [status, 'muted']
  return <span className={`pill ${tone}`}>{label}</span>
}

function formatDate(value) {
  if (!value) return '-'
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value).slice(0, 10)
}

function DominioTab({ companyCnpj }) {
  const [reportFiles, setReportFiles] = useState([])
  const [xmlFiles, setXmlFiles] = useState([])
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [progress, setProgress] = useState('')

  async function run() {
    if (!reportFiles.length || !xmlFiles.length) {
      setError('Envie o relatório do Domínio e os XMLs/ZIPs para iniciar a conferência.')
      return
    }
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const [reportText, parsed] = await Promise.all([
        extractTextFromFiles(reportFiles),
        parseXmlFiles(xmlFiles, companyCnpj, (p) => setProgress(`Lendo XMLs: ${p.parsedXmlFiles} arquivo(s)`))
      ])
      if (!parsed.docs.length) throw new Error('Nenhum documento fiscal reconhecido nos XMLs enviados.')
      const compared = compareDocumentsToReport(parsed.docs, reportText)
      setData({ ...compared, errors: parsed.errors, stats: parsed.stats, reportText })
    } catch (e) {
      setError(e.message || 'Falha ao processar os arquivos.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function downloadMissing() {
    try {
      const file = await buildMissingDownload(data.compared)
      downloadBlob(file.blob, file.filename)
    } catch (e) {
      setError(e.message)
    }
  }

  async function downloadMissingType(type) {
    try {
      const file = await buildMissingDownloadByType(data.compared, type)
      downloadBlob(file.blob, file.filename)
    } catch (e) {
      setError(e.message)
    }
  }

  const visible = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.compared
    return data.compared.filter((d) => d.compareStatus === filter)
  }, [data, filter])

  const missingCount = data?.counts?.missing || 0
  const missingTypes = data ? getMissingTypeCounts(data.compared) : {}

  return (
    <section className="panel-stack">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Conferência 1</span>
          <h2>Importação do Domínio x XML</h2>
          <p>O sistema lê o relatório de documentos importados no Domínio, cruza com os XMLs e sinaliza o que não entrou. NF-e, NFC-e, CT-e e NFS-e aparecem na mesma lista.</p>
        </div>
        <div className="hero-badge">Chave de acesso = conferência principal</div>
      </div>

      <div className="grid-2">
        <FileDrop label="Relatórios do Domínio" hint="Selecione vários PDFs/Excel de uma vez" accept=".pdf,.xlsx,.xls,.csv,.txt" multiple files={reportFiles} onChange={setReportFiles} />
        <FileDrop label="XMLs para conferir" hint="Pode enviar XML e/ou ZIP com vários XMLs" accept=".xml,.zip" multiple files={xmlFiles} onChange={setXmlFiles} />
      </div>

      <div className="action-row">
        <button className="primary" onClick={run} disabled={busy}>{busy ? (progress || 'Conferindo…') : 'Conferir importação'}</button>
        {data && <span className="muted-text">{data.compared.length} documento(s) fiscal(is) identificado(s)</span>}
      </div>

      {error && <div className="alert danger">{error}</div>}
      {data?.errors?.length > 0 && <div className="alert warn">Alguns arquivos não puderam ser lidos: {data.errors.join(' | ')}</div>}
      {data?.stats && <div className="alert info">ZIP/XML processados: {data.stats.xmlFiles} XML(s) lido(s){data.stats.zipFiles ? ` dentro de ${data.stats.zipFiles} ZIP(s)` : ''}. Arquivos não XML dentro do ZIP são ignorados automaticamente.</div>}
      {data?.reportKeysWithoutXml?.length > 0 && (
        <div className="alert warn">O relatório contém {data.reportKeysWithoutXml.length} chave(s) que não estavam entre os XMLs enviados. Isso pode indicar XML não fornecido ao sistema.</div>
      )}

      {data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Importadas" value={data.counts.imported || 0} tone="ok" />
            <Kpi label="Faltando" value={missingCount} tone="danger" />
            <Kpi label="Revisar" value={data.counts.review || 0} tone="warn" />
            <Kpi label="Canceladas/ignoradas" value={(data.counts.cancelled || 0) + (data.counts.ignored || 0)} />
          </div>

          <div className="toolbar">
            <div className="filters">
              {[
                ['all', 'Todas'], ['missing', 'Faltando'], ['imported', 'Importadas'], ['review', 'Revisar'], ['cancelled', 'Canceladas']
              ].map(([value, label]) => (
                <button key={value} className={filter === value ? 'chip active' : 'chip'} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <div className="download-actions">
              {['NF-e', 'NFC-e', 'CT-e', 'NFS-e'].map((type) => (
                <button key={type} className="success compact-btn" onClick={() => downloadMissingType(type)} disabled={!missingTypes[type]}>
                  {type} ({missingTypes[type] || 0})
                </button>
              ))}
              <button className="secondary compact-btn" onClick={downloadMissing} disabled={!missingCount}>Baixar todos separados</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th><th>Tipo</th><th>Movimento</th><th>Número</th><th>Série</th><th>Data</th><th>Valor</th><th>Chave</th><th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <tr key={doc.id}>
                    <td><StatusPill status={doc.compareStatus} /></td>
                    <td>{doc.type}</td>
                    <td>{doc.direction}</td>
                    <td>{doc.number || '-'}</td>
                    <td>{doc.series || '-'}</td>
                    <td>{formatDate(doc.date)}</td>
                    <td>{Number.isFinite(doc.value) ? money.format(doc.value) : '-'}</td>
                    <td className="mono">{doc.key ? `…${doc.key.slice(-12)}` : '-'}</td>
                    <td className="reason">{doc.compareReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note-box">
            <strong>Download por tipo:</strong> NF-e e NFC-e ficam em arquivos unificados separados, mesmo que misturem entrada e saída. CT-e também fica separado. Cada lote vai até 1.000 documentos. NFS-e fica em um ZIP próprio com os XMLs originais, porque os layouts podem variar entre municípios/provedores.
          </div>
        </>
      )}
    </section>
  )
}

function ReportTab({ companyCnpj }) {
  const [clientFiles, setClientFiles] = useState([])
  const [dominioFiles, setDominioFiles] = useState([])
  const [xmlFiles, setXmlFiles] = useState([])
  const [data, setData] = useState(null)
  const [texts, setTexts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [claudeStatus, setClaudeStatus] = useState('')
  const [error, setError] = useState('')

  async function run() {
    if (!clientFiles.length || !dominioFiles.length) {
      setError('Envie o relatório do cliente e o relatório do Domínio.')
      return
    }
    setBusy(true)
    setError('')
    setClaudeStatus('')
    setProgress('')
    try {
      const [clientText, dominioText, parsed] = await Promise.all([
        extractTextFromFiles(clientFiles),
        extractTextFromFiles(dominioFiles),
        xmlFiles.length ? parseXmlFiles(xmlFiles, companyCnpj, (p) => setProgress(`Lendo XMLs: ${p.parsedXmlFiles} arquivo(s)`)) : Promise.resolve({ docs: [], errors: [], stats: null })
      ])
      const comparison = deterministicReportComparison(clientText, dominioText, parsed.docs)
      setTexts({ clientText, dominioText })
      setData({ ...comparison, xmlDocs: parsed.docs, errors: parsed.errors, stats: parsed.stats })
    } catch (e) {
      setError(e.message || 'Falha na comparação.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function openClaude() {
    if (!data || !texts) return
    setError('')
    const report = buildClaudeReport({
      data,
      texts,
      companyCnpj,
      clientFiles,
      dominioFiles,
      xmlFiles
    })

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, 'relatorio_conferencia_para_claude.md')

    try {
      await navigator.clipboard.writeText('Analise o arquivo relatorio_conferencia_para_claude.md que vou anexar. Faça a conferência fiscal conforme as instruções contidas no próprio relatório e me diga exatamente o que falta no Domínio e o que devo importar.')
    } catch {
      // O relatório baixado já contém todas as instruções necessárias.
    }

    window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer')
    setClaudeStatus('O relatório relatorio_conferencia_para_claude.md foi baixado e o Claude foi aberto. Anexe o arquivo no Claude. Se o texto de instrução tiver sido copiado, basta colar (Ctrl+V) e enviar junto com o relatório.')
  }

  function downloadClaudeReport() {
    if (!data || !texts) return
    const report = buildClaudeReport({ data, texts, companyCnpj, clientFiles, dominioFiles, xmlFiles })
    downloadBlob(new Blob([report], { type: 'text/markdown;charset=utf-8' }), 'relatorio_conferencia_para_claude.md')
    setClaudeStatus('Relatório para o Claude baixado com sucesso.')
  }

  async function downloadAvailableXmls() {
    const docs = data.availableXmlForClient.map((d) => ({ ...d, compareStatus: 'missing' }))
    try {
      const file = await buildMissingDownload(docs)
      downloadBlob(file.blob, file.filename)
    } catch (e) {
      setError(e.message)
    }
  }

  async function downloadAvailableXmlType(type) {
    const docs = data.availableXmlForClient.map((d) => ({ ...d, compareStatus: 'missing' }))
    try {
      const file = await buildMissingDownloadByType(docs, type)
      downloadBlob(file.blob, file.filename)
    } catch (e) {
      setError(e.message)
    }
  }

  const availableTypes = data ? getMissingTypeCounts(data.availableXmlForClient.map((d) => ({ ...d, compareStatus: 'missing' }))) : {}

  return (
    <section className="panel-stack">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Conferência 2</span>
          <h2>Relatório do cliente x relatório do Domínio</h2>
          <p>O relatório do cliente é a referência do que deveria existir. O sistema compara documento por documento com o relatório do Domínio, aponta o que faltou importar, o que está a mais e confere se a receita/valor total bateu. Os XMLs são opcionais, mas quando enviados o sistema entrega os faltantes prontos para importação.</p>
        </div>
        <div className="hero-badge">Gerar relatório e abrir direto no Claude</div>
      </div>

      <div className="grid-3">
        <FileDrop label="Relatórios do cliente" hint="Selecione vários PDFs/Excel de uma vez" accept=".pdf,.xlsx,.xls,.csv,.txt" multiple files={clientFiles} onChange={setClientFiles} />
        <FileDrop label="Relatórios do Domínio" hint="Selecione vários PDFs/Excel de uma vez" accept=".pdf,.xlsx,.xls,.csv,.txt" multiple files={dominioFiles} onChange={setDominioFiles} />
        <FileDrop label="XMLs ou ZIPs (opcional)" hint="Pode enviar vários XMLs/ZIPs; o sistema lê as pastas internas" accept=".xml,.zip" multiple files={xmlFiles} onChange={setXmlFiles} />
      </div>

      <div className="action-row">
        <button className="primary" onClick={run} disabled={busy}>{busy ? (progress || 'Comparando…') : 'Comparar relatórios'}</button>
      </div>
      {error && <div className="alert danger">{error}</div>}
      {data?.errors?.length > 0 && <div className="alert warn">Alguns XMLs não puderam ser lidos: {data.errors.join(' | ')}</div>}
      {data?.stats && <div className="alert info">Foram lidos {data.stats.xmlFiles} XML(s){data.stats.zipFiles ? ` dentro de ${data.stats.zipFiles} ZIP(s)` : ''}. PDFs e outros arquivos existentes dentro do ZIP são ignorados.</div>}

      {data && (
        <>
          <div className={data.overallOk ? "alert ok" : "alert warn"}>
            <strong>{data.overallOk ? 'Conferência OK:' : 'Conferência com divergência:'}</strong>{' '}
            {data.overallOk
              ? 'os documentos identificados no relatório do cliente estão compatíveis com o relatório do Domínio e não foi encontrada diferença de receita.'
              : 'existem documentos e/ou valores que precisam ser revisados antes de considerar a escrituração fechada.'}
          </div>

          <div className="kpi-grid">
            <Kpi label={data.comparisonBasis === 'key' ? 'Notas em comum' : 'Números em comum'} value={data.comparisonBasis === 'key' ? data.commonKeys.length : data.commonNumbers.length} tone="ok" />
            <Kpi label="Faltando no Domínio" value={data.comparisonBasis === 'key' ? data.onlyClientKeys.length : data.onlyClientNumbers.length} tone="danger" />
            <Kpi label="A mais no Domínio" value={data.comparisonBasis === 'key' ? data.onlyDominioKeys.length : data.onlyDominioNumbers.length} tone="warn" />
            <Kpi label="XML pronto para importar" value={data.availableXmlForClient.length} tone="ok" />
          </div>

          <div className="kpi-grid">
            <Kpi label="Receita / total do cliente" value={Number.isFinite(data.clientRevenue) ? money.format(data.clientRevenue) : 'Não detectada'} />
            <Kpi label="Receita / total no Domínio" value={Number.isFinite(data.dominioRevenue) ? money.format(data.dominioRevenue) : 'Não detectada'} />
            <Kpi label="Diferença de receita" value={Number.isFinite(data.revenueDifference) ? money.format(data.revenueDifference) : '-'} tone={data.revenueMatches === true ? 'ok' : data.revenueMatches === false ? 'danger' : ''} />
            <Kpi label="Receita bateu?" value={data.revenueMatches === true ? 'SIM' : data.revenueMatches === false ? 'NÃO' : 'REVISAR'} tone={data.revenueMatches === true ? 'ok' : data.revenueMatches === false ? 'danger' : 'warn'} />
          </div>

          <div className="note-box">
            <strong>Como o sistema fecha a receita:</strong> primeiro procura no próprio relatório valores como “Total Geral”, “Valor Total”, “Receita Bruta” ou “Faturamento”. Se o relatório não trouxer um total confiável e você tiver enviado XMLs, ele usa a soma dos XMLs que conseguiu relacionar a cada relatório. Cliente: {data.revenueSourceClient}. Domínio: {data.revenueSourceDominio}.
          </div>

          <div className="split-card">
            <div>
              <h3>Leitura automática</h3>
              <p><strong>Cliente:</strong> {data.clientSummary.accessKeys} chave(s), {data.clientSummary.identifiedDocumentNumbers} número(s) identificado(s).</p>
              <p><strong>Domínio:</strong> {data.dominioSummary.accessKeys} chave(s), {data.dominioSummary.identifiedDocumentNumbers} número(s) identificado(s).</p>
              {data.onlyClientKeys.length === 0 && data.clientSummary.accessKeys === 0 && (
                <div className="alert warn compact">O relatório do cliente não trouxe chaves de acesso detectáveis. Nesse caso, use a análise por IA e/ou envie um relatório que contenha número, série, valor e data.</div>
              )}
            </div>
            <div className="right-actions stacked-actions">
              <div className="download-actions">
                {['NF-e', 'NFC-e', 'CT-e', 'NFS-e'].map((type) => (
                  <button key={type} className="success compact-btn" disabled={!availableTypes[type]} onClick={() => downloadAvailableXmlType(type)}>
                    {type} ({availableTypes[type] || 0})
                  </button>
                ))}
                <button className="secondary compact-btn" disabled={!data.availableXmlForClient.length} onClick={downloadAvailableXmls}>Todos separados</button>
              </div>
              <div className="download-actions">
                <button className="secondary" onClick={downloadClaudeReport}>Baixar relatório para Claude</button>
                <button className="primary" onClick={openClaude}>Gerar relatório + abrir Claude</button>
              </div>
            </div>
          </div>

          {claudeStatus && <div className="alert info">{claudeStatus}</div>}
          <div className="note-box"><strong>Claude:</strong> o sistema gera um relatório .md com o resumo da conferência, divergências, XMLs disponíveis e o texto extraído dos relatórios. O botão abre https://claude.ai/new; basta anexar o arquivo baixado. Nenhuma chave de API é necessária.</div>

          {data.comparisonBasis === 'key' && data.onlyClientKeys.length > 0 && (
            <div className="table-wrap compact-table">
              <table>
                <thead><tr><th>Chaves que estão no cliente e não no Domínio</th><th>XML enviado?</th></tr></thead>
                <tbody>
                  {data.onlyClientKeys.slice(0, 300).map((key) => (
                    <tr key={key}><td className="mono">{key}</td><td>{data.availableXmlForClient.some((d) => d.key === key) ? <span className="pill ok">Sim</span> : <span className="pill danger">Não</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.comparisonBasis === 'number' && data.onlyClientNumbers.length > 0 && (
            <div className="table-wrap compact-table">
              <table>
                <thead><tr><th>Números que estão no cliente e não no Domínio</th><th>XML compatível enviado?</th></tr></thead>
                <tbody>
                  {data.onlyClientNumbers.slice(0, 300).map((num) => (
                    <tr key={num}><td className="mono">{num}</td><td>{data.availableXmlForClient.some((d) => String(Number(d.number)) === num) ? <span className="pill ok">Sim</span> : <span className="pill danger">Não</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.comparisonBasis === 'key' && data.onlyDominioKeys.length > 0 && (
            <div className="table-wrap compact-table">
              <table>
                <thead><tr><th>Chaves que estão no Domínio e não aparecem no relatório do cliente</th></tr></thead>
                <tbody>
                  {data.onlyDominioKeys.slice(0, 300).map((key) => (
                    <tr key={key}><td className="mono">{key}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CurrencyInput({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step="0.01" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </label>
  )
}

function SimplesTab() {
  const [extractFile, setExtractFile] = useState([])
  const [parsed, setParsed] = useState(null)
  const [rbt12, setRbt12] = useState(null)
  const [prior, setPrior] = useState(null)
  const [rpa, setRpa] = useState(null)
  const [annex, setAnnex] = useState('I')
  const [mode, setMode] = useState('projected')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function readExtract() {
    if (!extractFile[0]) {
      setError('Envie o Extrato do Simples Nacional em PDF.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const text = await extractTextFromFile(extractFile[0])
      const result = parseSimplesExtract(text)
      setParsed(result)
      setRbt12(result.rbt12)
      setPrior(result.priorRevenue)
      setRpa(result.rpa)
      if (!Number.isFinite(result.rbt12) || !Number.isFinite(result.rpa)) {
        setError('O PDF foi lido, mas não consegui identificar RBT12 e Receita Bruta do PA. Você pode preencher os valores manualmente abaixo.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const projected = [rbt12, prior, rpa].every(Number.isFinite) ? rbt12 - prior + rpa : null
  const rbtUsed = mode === 'projected' ? projected : rbt12
  const result = calculateAnnex(annex, rbtUsed)
  const allResults = calculateAllAnnexes(rbtUsed)

  return (
    <section className="panel-stack">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Cálculo 3</span>
          <h2>Percentuais efetivos do Simples Nacional</h2>
          <p>O extrato é lido automaticamente. Para projetar a próxima competência, o sistema faz: RBT12 atual - receita do mesmo mês do ano anterior + Receita Bruta do PA.</p>
        </div>
        <div className="hero-badge">Anexos I, II, III, IV e V</div>
      </div>

      <div className="grid-2 align-start">
        <div>
          <FileDrop label="Extrato do Simples Nacional" hint="PDF do PGDAS-D / extrato de apuração" accept=".pdf" files={extractFile} onChange={setExtractFile} />
          <div className="action-row"><button className="primary" onClick={readExtract} disabled={busy}>{busy ? 'Lendo extrato…' : 'Ler extrato'}</button></div>
          {error && <div className="alert warn">{error}</div>}
        </div>

        <div className="form-card">
          <div className="field-grid">
            <CurrencyInput label="RBT12 do extrato" value={rbt12} onChange={setRbt12} />
            <CurrencyInput label={`Receita ${parsed?.priorMonth || 'mesmo mês do ano anterior'}`} value={prior} onChange={setPrior} />
            <CurrencyInput label="Receita Bruta do PA - competência" value={rpa} onChange={setRpa} />
          </div>
          {parsed?.pa && <p className="small-info">PA identificado: <strong>{parsed.pa}</strong>{parsed.factorR ? ` • Fator R: ${parsed.factorR}` : ''}</p>}
        </div>
      </div>

      <div className="formula-card">
        <div>
          <span>RBT12 projetada</span>
          <strong>{Number.isFinite(projected) ? money.format(projected) : '-'}</strong>
        </div>
        <code>{Number.isFinite(rbt12) ? number.format(rbt12) : 'RBT12'} - {Number.isFinite(prior) ? number.format(prior) : 'mês ano anterior'} + {Number.isFinite(rpa) ? number.format(rpa) : 'RPA'} = {Number.isFinite(projected) ? number.format(projected) : '?'}</code>
      </div>

      <div className="mode-row">
        <label><input type="radio" checked={mode === 'projected'} onChange={() => setMode('projected')} /> Usar RBT12 projetada para a próxima competência</label>
        <label><input type="radio" checked={mode === 'current'} onChange={() => setMode('current')} /> Usar RBT12 do próprio extrato</label>
      </div>

      <div className="annex-tabs">
        {['I', 'II', 'III', 'IV', 'V'].map((key) => <button key={key} onClick={() => setAnnex(key)} className={annex === key ? 'active' : ''}>Anexo {key}</button>)}
      </div>

      {result && !result.error && (
        <div className="tax-result">
          <div className="tax-head">
            <div>
              <span>{getAnnexLabel(annex)}</span>
              <h3>Alíquota efetiva: {pct(result.effectiveRounded)}</h3>
            </div>
            <div className="tax-meta">
              <span>Nominal <strong>{pct(result.nominal, 2)}</strong></span>
              <span>Dedução <strong>{money.format(result.deduction)}</strong></span>
              <span>Faixa <strong>{money.format(result.range.lower)} a {money.format(result.range.upper)}</strong></span>
            </div>
          </div>
          <div className="tax-grid">
            {result.taxes.map((tax) => (
              <div className="tax-item" key={tax.tax}><span>{tax.tax}</span><strong>{pct(tax.rate)}</strong></div>
            ))}
          </div>
          {(annex === 'III' || annex === 'IV') && <p className="small-info">Quando o percentual efetivo do ISS ultrapassa 5%, o sistema limita o ISS a 5% e redistribui o excedente entre os demais tributos do anexo, conforme a lógica da planilha-base.</p>}
        </div>
      )}
      {result?.error && <div className="alert danger">{result.error}</div>}

      {Number.isFinite(rbtUsed) && (
        <details className="all-annexes">
          <summary>Ver alíquota efetiva em todos os anexos</summary>
          <div className="mini-grid">
            {allResults.map((r) => <div key={r.annexKey}><span>Anexo {r.annexKey}</span><strong>{r.error ? '-' : pct(r.effectiveRounded)}</strong></div>)}
          </div>
        </details>
      )}
    </section>
  )
}

export default function App() {
  const [tab, setTab] = useState('dominio')
  const [companyCnpj, setCompanyCnpj] = useState(() => localStorage.getItem('conferencia_company_cnpj') || '')

  function updateCnpj(value) {
    const cleaned = onlyDigits(value).slice(0, 14)
    setCompanyCnpj(cleaned)
    localStorage.setItem('conferencia_company_cnpj', cleaned)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">CF</div>
          <div><strong>Conferência Fiscal</strong><span>Domínio + XML + Simples Nacional</span></div>
        </div>
        <label className="cnpj-box">
          <span>CNPJ da empresa (para Entrada/Saída)</span>
          <input value={companyCnpj} onChange={(e) => updateCnpj(e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" />
        </label>
      </header>

      <nav className="tabs">
        <button className={tab === 'dominio' ? 'active' : ''} onClick={() => setTab('dominio')}><span>01</span> Conferência Domínio</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><span>02</span> Conferência de Relatórios</button>
        <button className={tab === 'simples' ? 'active' : ''} onClick={() => setTab('simples')}><span>03</span> Percentuais do Simples</button>
      </nav>

      <main>
        {tab === 'dominio' && <DominioTab companyCnpj={companyCnpj} />}
        {tab === 'reports' && <ReportTab companyCnpj={companyCnpj} />}
        {tab === 'simples' && <SimplesTab />}
      </main>

      <footer>
        <span>Os arquivos fiscais são processados no navegador. Para análise por IA, o sistema gera um relatório que você pode anexar diretamente no Claude.</span>
        <span>v0.2</span>
      </footer>
    </div>
  )
}
