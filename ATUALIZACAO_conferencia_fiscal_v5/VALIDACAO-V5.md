# Validação V5 – Conferência Cliente x Domínio

A V5 foi ajustada para o fluxo real de conferência:

1. O relatório do cliente define quais notas deveriam existir.
2. O sistema lê o relatório correspondente do Domínio.
3. A comparação prioriza série + número, validando data e valor.
4. Em layouts Resulth onde `NF/ECF` vem como `11053312/00`, o sistema infere que `11` é a série e `053312` é a nota `53312`, usando o próprio Domínio/XML como evidência.
5. Notas existentes no cliente e ausentes no Domínio são classificadas como **FALTANDO NO DOMÍNIO**.
6. Os XMLs/ZIPs enviados são pesquisados automaticamente por série, número e valor. XMLs compatíveis ficam prontos para download/importação.
7. O pacote Claude contém relatório, manifesto CSV, textos extraídos e os XMLs faltantes separados/unificados por tipo.

## Teste com os relatórios de setembro enviados

- Linhas de vendas identificadas no relatório do cliente: **3.728**
- Linhas correspondentes identificadas no relatório de Saídas do Domínio: **2.184**
- Notas do cliente ausentes no Domínio: **1.544**
- Total das linhas do cliente: **R$ 1.529.513,18**
- Total das notas correspondentes encontradas no Domínio: **R$ 892.548,55**
- Valor das notas ausentes: **R$ 636.964,63**
- O mecanismo inferiu corretamente a separação de 2 dígitos de série no campo `NF/ECF`.

O primeiro item ausente detectado no teste foi série 11, nota 55170, em 17/09/2026.

> A quantidade de XMLs prontos depende dos XMLs/ZIPs efetivamente enviados junto com a conferência.
