# Validação V4 — relatório do cliente x Domínio

Nesta versão, a aba **Relatório do cliente x relatório do Domínio** trata o relatório do cliente como a referência do que deveria existir na competência.

A conferência mostra:

- documentos em comum;
- notas que estão no cliente e faltam no Domínio;
- notas que estão no Domínio e não aparecem no relatório do cliente;
- XMLs já disponíveis para importar;
- total/receita detectada no relatório do cliente;
- total/receita detectada no relatório do Domínio;
- diferença entre os dois totais;
- indicador **Receita bateu? SIM / NÃO / REVISAR**;
- indicador geral **Conferência OK / Conferência com divergência**.

Para o valor total, o sistema prioriza rótulos explícitos como **Total Geral**, **Valor Total**, **Total das Notas**, **Receita Bruta**, **Receita Total** e **Faturamento**. Quando não encontra um total utilizável e existem XMLs enviados, usa a soma dos XMLs que foram relacionados ao respectivo relatório.

Os XMLs faltantes continuam separados por tipo de documento: NF-e, NFC-e, CT-e e NFS-e, sem separar entrada e saída.
