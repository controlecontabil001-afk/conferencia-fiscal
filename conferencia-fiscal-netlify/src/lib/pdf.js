import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import * as XLSX from 'xlsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

function groupPageItems(items) {
  const rows = []
  for (const item of items) {
    if (!item?.str?.trim()) continue
    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0
    let row = rows.find((r) => Math.abs(r.y - y) <= 2.5)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push({ x, text: item.str })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    const lines = groupPageItems(content.items)
    pages.push(`--- PÁGINA ${pageNo} ---\n${lines.join('\n')}`)
  }
  return pages.join('\n')
}

export async function extractTabularText(file) {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const blocks = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
    blocks.push(`--- ABA ${name} ---`)
    for (const row of rows) {
      const line = row.map((v) => String(v ?? '').trim()).filter(Boolean).join(' | ')
      if (line) blocks.push(line)
    }
  }
  return blocks.join('\n')
}

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return extractPdfText(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return extractTabularText(file)
  if (name.endsWith('.csv') || name.endsWith('.txt')) return file.text()
  throw new Error(`Formato não suportado para relatório: ${file.name}`)
}

export function brMoneyToNumber(value) {
  if (value == null || value === '') return null
  const text = String(value).replace(/R\$\s*/gi, '').replace(/\s/g, '')
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  const n = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function moneyMatches(text) {
  return [...text.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)]
    .map((m) => brMoneyToNumber(m[1]))
    .filter(Number.isFinite)
}

function moneyForLabel(text, needle) {
  const lines = text.split(/\r?\n/)
  const target = needle.toLocaleLowerCase('pt-BR')
  const idx = lines.findIndex((line) => line.toLocaleLowerCase('pt-BR').includes(target))
  if (idx < 0) return null

  // PDF de tabela pode colocar o rótulo em uma linha e os valores na linha seguinte.
  for (let offset = 0; offset <= 2 && idx + offset < lines.length; offset += 1) {
    const values = moneyMatches(lines[idx + offset])
    if (values.length) return values[values.length - 1]
  }
  return null
}

export function parseSimplesExtract(text) {
  const compact = text.replace(/\u00a0/g, ' ')
  const pa = compact.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o\s*\(PA\)\s*:\s*(\d{2}\/\d{4})/i)?.[1] || null
  const rpa = moneyForLabel(compact, 'Receita Bruta do PA')
  const rbt12 = moneyForLabel(compact, 'Receita bruta acumulada nos doze meses anteriores ao PA')

  const monthly = new Map()
  const monthPattern = /(0[1-9]|1[0-2])\/(20\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g
  let m
  while ((m = monthPattern.exec(compact))) {
    const key = `${m[1]}/${m[2]}`
    if (!monthly.has(key)) monthly.set(key, brMoneyToNumber(m[3]))
  }

  let priorMonth = null
  let priorRevenue = null
  if (pa) {
    const [mm, yyyy] = pa.split('/')
    priorMonth = `${mm}/${Number(yyyy) - 1}`
    priorRevenue = monthly.get(priorMonth) ?? null
  }

  const projectedRbt12 = [rbt12, priorRevenue, rpa].every((v) => Number.isFinite(v))
    ? rbt12 - priorRevenue + rpa
    : null

  const factorMatch = compact.match(/Fator\s*r\s*=\s*([^\n]+)/i)

  return {
    pa,
    rpa,
    rbt12,
    priorMonth,
    priorRevenue,
    projectedRbt12,
    factorR: factorMatch?.[1]?.trim() || null,
    monthly: Object.fromEntries(monthly)
  }
}
