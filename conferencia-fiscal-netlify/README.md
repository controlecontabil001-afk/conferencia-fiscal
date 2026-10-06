# Conferência Fiscal - Domínio + XML + Simples Nacional

Sistema web preparado para deploy no Netlify.

## O que já está funcionando

### 1. Conferência Domínio x XML
- Upload do relatório do Domínio em PDF, XLSX/XLS, CSV ou TXT.
- Upload de XMLs individuais ou ZIPs.
- Reconhecimento de NF-e (modelo 55), NFC-e (65), CT-e e estruturas comuns de NFS-e.
- NF-e, NFC-e, CT-e, entradas, saídas e serviços aparecem em uma única grade.
- Conferência principal pela chave de acesso; quando não existe chave no relatório, usa número/série/valor como apoio e pode marcar `Revisar`.
- Eventos de cancelamento encontrados nos XMLs são desconsiderados da lista de faltantes.
- Botão **Baixar XML faltante**:
  - NF-e + NFC-e são consolidadas em um único XML no formato `nfeProcs`, em lotes de até 1.000 documentos.
  - Se houver mais de 1.000 documentos ou documentos de famílias XML diferentes (CT-e/NFS-e), é gerado um único ZIP com tudo que falta.

### 2. Conferência de relatórios
- Compara relatório do cliente x relatório do Domínio.
- Mostra chaves que existem nos dois lados, só no cliente e só no Domínio.
- Se os XMLs forem enviados, identifica quais divergências já têm XML disponível para importação e permite baixá-las.
- Botão opcional de análise por IA através de Netlify Function.

### 3. Percentuais efetivos do Simples Nacional
- Upload do Extrato do Simples Nacional em PDF.
- Leitura do PA, RBT12, Receita Bruta do PA e receitas mensais anteriores.
- Projeção automática da próxima RBT12:

  `RBT12 atual - receita do mesmo mês do ano anterior + Receita Bruta do PA`

- Cálculo de alíquota efetiva e percentuais efetivos de IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ICMS, IPI e ISS, conforme o anexo.
- Anexos I, II, III, IV e V.
- Regra de teto de 5% do ISS aplicada nos Anexos III e IV com redistribuição do excedente entre os demais tributos.

## Como rodar no computador

Requer Node.js 20+.

```bash
npm install
npm run dev
```

Abra o endereço informado pelo Vite.

## Como colocar no Netlify

### Opção recomendada - Git
1. Suba esta pasta para um repositório GitHub/GitLab.
2. No Netlify, use **Add new site > Import an existing project**.
3. O `netlify.toml` já define:
   - Build: `npm run build`
   - Pasta publicada: `dist`
   - Functions: `netlify/functions`
4. Faça o deploy.

### IA opcional
No painel do Netlify, configure em **Site configuration > Environment variables**:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional; padrão no projeto: `gpt-6-astra`)

Sem a chave, as conferências determinísticas continuam funcionando; apenas o botão “Explicar divergências com IA” fica indisponível.

## Privacidade
Os XMLs e relatórios são lidos no navegador. O conteúdo só é enviado para IA quando o usuário clica explicitamente no botão de análise por IA. A chave da API fica protegida na Netlify Function e não é exposta no JavaScript do navegador.

## Observação sobre NFS-e e CT-e
NF-e/NFC-e usam a mesma família de XML e podem ser consolidadas no mesmo arquivo de forma segura para este fluxo. CT-e e NFS-e usam esquemas diferentes; por isso, quando há mistura de tipos, o sistema mantém esses XMLs sem reescrevê-los e entrega tudo no mesmo ZIP. Isso evita gerar um XML único tecnicamente inválido.

## Próximas melhorias recomendadas
- Ajustar o parser exatamente ao modelo do relatório do Domínio usado no escritório, assim que houver um PDF real de exemplo.
- Adicionar autenticação e cadastro de empresas.
- Criar histórico de conferências em banco (Supabase, por exemplo).
- Integrar recebimento automático de relatórios por e-mail.
- Adicionar mais layouts municipais de NFS-e conforme os clientes usados no escritório.
