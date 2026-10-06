# Validação da versão 0.2

Alterações solicitadas em 06/10/2026:

1. Relatório gerado para uso direto no Claude (`claude.ai/new`).
2. Vários PDFs/Excel continuam permitidos simultaneamente.
3. Vários XMLs/ZIPs continuam permitidos simultaneamente.
4. ZIP de exemplo recebido contém 3.833 arquivos no total, sendo 3.730 XMLs e 102 PDFs; o leitor ignora PDFs e processa XMLs nas pastas internas.
5. XMLs faltantes passam a ser separados por tipo:
   - NF-e somente com NF-e;
   - NFC-e somente com NFC-e;
   - CT-e separado;
   - NFS-e separado.
6. Entrada e saída podem permanecer juntas dentro do mesmo grupo/tipo.
7. NF-e/NFC-e/CT-e são divididos em lotes de até 1.000 documentos.
8. NFS-e preserva os XMLs originais devido à diversidade de layouts municipais/provedores.
