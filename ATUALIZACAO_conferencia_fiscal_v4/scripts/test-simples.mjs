import { calculateAnnex } from '../src/lib/simples.js'

const cases = [
  ['I', 528121.37, 0.0688],
  ['II', 7213.34, 0.0450],
  ['III', 348500.00, 0.0851],
  ['IV', 644179.99, 0.0827],
  ['V', 1200000.00, 0.1908]
]

for (const [annex, rbt12, expected] of cases) {
  const result = calculateAnnex(annex, rbt12)
  if (!result || result.effectiveRounded !== expected) {
    throw new Error(`Falha no Anexo ${annex}: esperado ${expected}, obtido ${result?.effectiveRounded}`)
  }
}

console.log('OK - cálculos dos cinco anexos conferem com os exemplos da planilha-base.')
