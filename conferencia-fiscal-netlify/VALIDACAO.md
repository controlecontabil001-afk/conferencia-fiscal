# Validação feita com os arquivos de exemplo enviados

Os arquivos de exemplo do usuário **não foram copiados para dentro do projeto**.

## XML consolidado
- O exemplo de NF-e usa uma raiz `nfeProcs` com vários `nfeProc` dentro (242 documentos).
- O exemplo de NFC-e usa a mesma raiz `nfeProcs` e contém 1.000 documentos.
- O gerador deste projeto segue o mesmo conceito para NF-e/NFC-e e limita cada arquivo consolidado a 1.000 documentos.

## RBT12 do extrato de exemplo
Valores lidos do extrato enviado:
- PA: 08/2026
- RBT12: R$ 3.581.248,67
- Receita do mesmo mês do ano anterior (08/2025): R$ 338.946,01
- Receita Bruta do PA: R$ 357.643,23
- RBT12 projetada: R$ 3.599.945,89

Cálculo: `3.581.248,67 - 338.946,01 + 357.643,23 = 3.599.945,89`.

## Percentuais efetivos
O arquivo `scripts/test-simples.mjs` valida os cinco anexos com os valores de teste presentes na planilha-base enviada. Execute:

```bash
npm run test:simples
```
