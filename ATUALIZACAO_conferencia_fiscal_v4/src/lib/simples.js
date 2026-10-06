const annexes = {
  I: {
    label: 'Anexo I - Comércio',
    taxes: ['IRPJ', 'CSLL', 'COFINS', 'PIS/Pasep', 'CPP', 'ICMS'],
    brackets: [
      [0, 180000, 0.04, 0, [0.055, 0.035, 0.1274, 0.0276, 0.415, 0.34]],
      [180000.01, 360000, 0.073, 5940, [0.055, 0.035, 0.1274, 0.0276, 0.415, 0.34]],
      [360000.01, 720000, 0.095, 13860, [0.055, 0.035, 0.1274, 0.0276, 0.42, 0.335]],
      [720000.01, 1800000, 0.107, 22500, [0.055, 0.035, 0.1274, 0.0276, 0.42, 0.335]],
      [1800000.01, 3600000, 0.143, 87300, [0.055, 0.035, 0.1274, 0.0276, 0.42, 0.335]],
      [3600000.01, 4800000, 0.19, 378000, [0.135, 0.10, 0.2827, 0.0613, 0.421, 0]]
    ]
  },
  II: {
    label: 'Anexo II - Indústria',
    taxes: ['IRPJ', 'CSLL', 'COFINS', 'PIS/Pasep', 'CPP', 'IPI', 'ICMS'],
    brackets: [
      [0, 180000, 0.045, 0, [0.055, 0.035, 0.1151, 0.0249, 0.375, 0.075, 0.32]],
      [180000.01, 360000, 0.078, 5940, [0.055, 0.035, 0.1151, 0.0249, 0.375, 0.075, 0.32]],
      [360000.01, 720000, 0.10, 13860, [0.055, 0.035, 0.1151, 0.0249, 0.375, 0.075, 0.32]],
      [720000.01, 1800000, 0.112, 22500, [0.055, 0.035, 0.1151, 0.0249, 0.375, 0.075, 0.32]],
      [1800000.01, 3600000, 0.147, 85500, [0.055, 0.035, 0.1151, 0.0249, 0.375, 0.075, 0.32]],
      [3600000.01, 4800000, 0.30, 720000, [0.085, 0.075, 0.2096, 0.0454, 0.235, 0.35, 0]]
    ]
  },
  III: {
    label: 'Anexo III - Serviços',
    taxes: ['IRPJ', 'CSLL', 'COFINS', 'PIS/Pasep', 'CPP', 'ISS'],
    capIss: true,
    brackets: [
      [0, 180000, 0.06, 0, [0.04, 0.035, 0.1282, 0.0278, 0.434, 0.335]],
      [180000.01, 360000, 0.112, 9360, [0.04, 0.035, 0.1405, 0.0305, 0.434, 0.32]],
      [360000.01, 720000, 0.135, 17640, [0.04, 0.035, 0.1364, 0.0296, 0.434, 0.325]],
      [720000.01, 1800000, 0.16, 35640, [0.04, 0.035, 0.1364, 0.0296, 0.434, 0.325]],
      [1800000.01, 3600000, 0.21, 125640, [0.04, 0.035, 0.1282, 0.0278, 0.434, 0.335]],
      [3600000.01, 4800000, 0.33, 648000, [0.35, 0.15, 0.1603, 0.0347, 0.305, 0]]
    ]
  },
  IV: {
    label: 'Anexo IV - Serviços',
    taxes: ['IRPJ', 'CSLL', 'COFINS', 'PIS/Pasep', 'CPP', 'ISS'],
    capIss: true,
    brackets: [
      [0, 180000, 0.045, 0, [0.188, 0.152, 0.1767, 0.0383, 0, 0.445]],
      [180000.01, 360000, 0.09, 8100, [0.198, 0.152, 0.2055, 0.0445, 0, 0.40]],
      [360000.01, 720000, 0.102, 12420, [0.208, 0.152, 0.1973, 0.0427, 0, 0.40]],
      [720000.01, 1800000, 0.14, 39780, [0.178, 0.192, 0.189, 0.041, 0, 0.40]],
      [1800000.01, 3600000, 0.22, 183780, [0.188, 0.192, 0.1808, 0.0392, 0, 0.40]],
      [3600000.01, 4800000, 0.33, 828000, [0.535, 0.215, 0.2055, 0.0445, 0, 0]]
    ]
  },
  V: {
    label: 'Anexo V - Serviços',
    taxes: ['IRPJ', 'CSLL', 'COFINS', 'PIS/Pasep', 'CPP', 'ISS'],
    brackets: [
      [0, 180000, 0.155, 0, [0.25, 0.15, 0.141, 0.0305, 0.2885, 0.14]],
      [180000.01, 360000, 0.18, 4500, [0.23, 0.15, 0.141, 0.0305, 0.2785, 0.17]],
      [360000.01, 720000, 0.195, 9900, [0.24, 0.15, 0.1492, 0.0323, 0.2385, 0.19]],
      [720000.01, 1800000, 0.205, 17100, [0.21, 0.15, 0.1574, 0.0341, 0.2385, 0.21]],
      [1800000.01, 3600000, 0.23, 62100, [0.23, 0.125, 0.141, 0.0305, 0.2385, 0.235]],
      [3600000.01, 4800000, 0.305, 540000, [0.35, 0.155, 0.1644, 0.0356, 0.295, 0]]
    ]
  }
}

const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000

function chooseBracket(rbt12, config) {
  return config.brackets.find((b) => rbt12 >= b[0] && rbt12 <= b[1]) || null
}

function distributeWithRounding(effective, shares, taxes, capIss) {
  let raw = shares.map((share) => effective * share)
  const issIndex = taxes.indexOf('ISS')

  if (capIss && issIndex >= 0 && raw[issIndex] > 0.05) {
    const federalShareTotal = shares.reduce((acc, share, idx) => idx === issIndex ? acc : acc + share, 0)
    const federalEffective = effective - 0.05
    raw = shares.map((share, idx) => {
      if (idx === issIndex) return 0.05
      return federalShareTotal > 0 ? federalEffective * (share / federalShareTotal) : 0
    })
  }

  const effectiveRounded = round4(effective)
  const rounded = raw.map(round4)
  const sumRounded = round4(rounded.reduce((a, b) => a + b, 0))
  const residual = round4(effectiveRounded - sumRounded)
  if (Math.abs(residual) >= 0.0001) {
    let maxIndex = 0
    rounded.forEach((value, idx) => {
      if (value > rounded[maxIndex]) maxIndex = idx
    })
    rounded[maxIndex] = round4(rounded[maxIndex] + residual)
  }
  return rounded
}

export function calculateAnnex(annexKey, rbt12) {
  const config = annexes[annexKey]
  if (!config || !Number.isFinite(rbt12) || rbt12 <= 0) return null
  const bracket = chooseBracket(rbt12, config)
  if (!bracket) {
    return {
      annexKey,
      label: config.label,
      error: rbt12 > 4800000 ? 'RBT12 acima do limite de R$ 4,8 milhões.' : 'RBT12 fora das faixas configuradas.'
    }
  }
  const [lower, upper, nominal, deduction, shares] = bracket
  const effective = ((rbt12 * nominal) - deduction) / rbt12
  const components = distributeWithRounding(effective, shares, config.taxes, config.capIss)
  return {
    annexKey,
    label: config.label,
    range: { lower, upper },
    nominal,
    deduction,
    effective,
    effectiveRounded: round4(effective),
    taxes: config.taxes.map((tax, idx) => ({ tax, rate: components[idx] }))
  }
}

export function calculateAllAnnexes(rbt12) {
  return Object.keys(annexes).map((key) => calculateAnnex(key, rbt12))
}

export function getAnnexLabel(key) {
  return annexes[key]?.label || key
}
