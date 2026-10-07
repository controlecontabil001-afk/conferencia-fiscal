# Conferência Fiscal — V4

Versão com conferência completa do relatório do cliente contra o relatório do Domínio, incluindo fechamento de receita/valor total.

# Conferência Fiscal - Domínio + XML + Simples Nacional

Sistema web para publicação no Netlify.

## Principais funções

### 1. Conferência Domínio x XML
- aceita vários relatórios do Domínio de uma vez;
- aceita vários XMLs e vários ZIPs de uma vez;
- lê XMLs dentro de pastas e ZIPs, inclusive ZIP interno;
- ignora PDFs/DANFEs e outros arquivos existentes dentro do ZIP;
- identifica NF-e, NFC-e, CT-e e NFS-e;
- sinaliza documentos importados, faltantes, cancelados e itens para revisão;
- entrada e saída podem ficar juntas na conferência;
- os downloads dos faltantes são separados por tipo de documento.

### 2. XMLs faltantes separados por tipo
A versão atual NÃO mistura NF-e com NFC-e no mesmo XML.

- **NF-e:** unificadas somente com outras NF-e, até 1.000 por arquivo;
- **NFC-e:** unificadas somente com outras NFC-e, até 1.000 por arquivo;
- **CT-e:** separado de NF-e/NFC-e e consolidado por tipo;
- **NFS-e:** separado em ZIP próprio com XMLs originais, porque o layout pode variar por município/provedor;
- entrada e saída do mesmo tipo podem ficar juntas no mesmo arquivo unificado.

Há botões individuais para baixar NF-e, NFC-e, CT-e e NFS-e, além de um botão para baixar tudo separado por pastas em um ZIP.

### 3. Conferência relatório do cliente x Domínio
- aceita vários relatórios do cliente;
- aceita vários relatórios do Domínio;
- XML/ZIP opcional;
- aponta o que aparece somente no cliente, somente no Domínio e o que tem XML disponível para importação.

### 4. Relatório para Claude
Depois da conferência o sistema pode gerar:

`relatorio_conferencia_para_claude.md`

O relatório contém:
- instrução de análise;
- resumo automático;
- divergências;
- XMLs disponíveis;
- chaves sem XML;
- texto extraído dos relatórios do cliente e do Domínio.

O botão **Gerar relatório + abrir Claude** baixa o relatório e abre:

`https://claude.ai/new`

Depois basta anexar o arquivo `.md` no Claude. Não precisa chave de API.

### 5. Percentuais efetivos do Simples Nacional
- lê o extrato do Simples;
- identifica PA, RBT12 e Receita Bruta do PA;
- calcula RBT12 projetada: `RBT12 - mesmo mês do ano anterior + Receita Bruta do PA`;
- calcula percentuais efetivos dos Anexos I, II, III, IV e V.

## Deploy no Netlify

O projeto usa Vite.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Se esta pasta estiver dentro de outra pasta no GitHub, configure a **Base directory** no Netlify apontando para esta pasta.


## V5 – fluxo de Conferência de Relatórios

A aba **Conferência de Relatórios** agora trata o relatório do cliente como referência do que deveria existir no Domínio. Ela faz comparação estruturada por série + número, data e valor, localiza automaticamente os XMLs das notas faltantes e permite baixar os documentos por tipo.

Para revisão externa, o botão **Pacote Claude + XMLs** cria `PACOTE_CLAUDE_relatorio_com_XMLs.zip`, contendo:

- `RELATORIO_CONFERENCIA_CLAUDE.md`;
- `MANIFESTO_NOTAS_FALTANTES.csv`;
- textos extraídos dos relatórios do cliente e do Domínio;
- pasta `XMLs_Faltantes`, com NF-e, NFC-e e CT-e consolidados por tipo (até 1.000 por arquivo) e NFS-e preservadas separadamente.

O botão **Pacote + abrir Claude** baixa o pacote e abre `https://claude.ai/new`. Por segurança do navegador, o anexo não pode ser inserido automaticamente no Claude.
