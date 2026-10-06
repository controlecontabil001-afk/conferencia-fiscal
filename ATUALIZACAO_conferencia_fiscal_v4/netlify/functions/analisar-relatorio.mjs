const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
})

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text
  const texts = []
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) texts.push(content.text)
    }
  }
  return texts.join('\n')
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' })
  if (!process.env.OPENAI_API_KEY) {
    return json(503, { error: 'A IA ainda não foi configurada. Defina OPENAI_API_KEY nas variáveis do Netlify.' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const clientText = String(body.clientText || '').slice(0, 70000)
    const dominioText = String(body.dominioText || '').slice(0, 70000)
    const deterministic = body.deterministic || {}

    if (!clientText || !dominioText) return json(400, { error: 'Os dois relatórios são obrigatórios.' })

    const prompt = `Você é um assistente de conferência fiscal. Compare dois relatórios: um enviado pelo cliente e outro extraído do sistema Domínio.

Regras importantes:
- Não invente notas, valores, CNPJs ou causas.
- Priorize chave de acesso, depois número/série/data/valor.
- Quando os dados não forem suficientes, escreva claramente "não foi possível confirmar".
- Se houver XML disponível para uma divergência, diga que o XML pode ser importado; se não houver, diga que o XML precisa ser obtido.
- Entregue uma resposta curta e operacional em português do Brasil, com: Resumo, Divergências encontradas, Provável ação e Itens que precisam de revisão manual.
- Não dê parecer jurídico/tributário; a tarefa é conferência documental.

RESUMO DETERMINÍSTICO DO SISTEMA:
${JSON.stringify(deterministic, null, 2)}

RELATÓRIO DO CLIENTE:
${clientText}

RELATÓRIO DO DOMÍNIO:
${dominioText}`

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-astra',
        input: prompt,
        max_output_tokens: 1800
      })
    })

    const payload = await response.json()
    if (!response.ok) {
      return json(response.status, { error: payload?.error?.message || 'Falha na API de IA.' })
    }

    return json(200, { analysis: extractOutputText(payload) })
  } catch (error) {
    return json(500, { error: error?.message || 'Erro interno ao analisar relatórios.' })
  }
}
