# dash-anagrow

Relatório estático de performance de Google Ads + GA4 para a AnaGrow (e-commerce).

Publicado via GitHub Pages: https://metrics-odr.github.io/dash-anagrow/

Abra `index.html` em um navegador (ou sirva a pasta com qualquer servidor
estático, ex. `python3 -m http.server`). Não há build nem dependências de
rede em tempo de execução — o Chart.js está vendorizado em `assets/vendor/`.

- `assets/data.js` — dados diários mesclados (Google Ads + GA4), gerados a
  partir da planilha "AnaGrow" (abas *Google Ads* e *GA4*).
- `assets/app.js` — cálculo das métricas derivadas (CPM, CTR, CR, ConvLP,
  CPA) e renderização da tabela com mapa de calor e dos gráficos.
- `assets/style.css` — estilos do relatório.

Para atualizar os dados, reexporte as duas abas da planilha e regenere
`assets/data.js` (linha única `const RAW_DATA = [...]` com um objeto por dia:
`date`, `gasto`, `impressions`, `clicks`, `conversions`, `sessions`,
`pageviews`).

## Atualização automática

`assets/data.js` é regenerado automaticamente a cada hora pelo workflow
`.github/workflows/refresh-data.yml`, que roda `scripts/update_data.py`. O
script lê as abas *Google Ads* (gid `0`) e *GA4* (gid `1872956501`) da
planilha via export CSV público e só faz commit se algo mudou — o push para
`main` dispara o rebuild do GitHub Pages automaticamente.

**Importante:** para o script conseguir ler a planilha sem autenticação, ela
precisa estar compartilhada como "Qualquer pessoa com o link — Leitor". Sem
isso, o workflow falha (o log mostra claramente esse motivo).

Para rodar manualmente: aba *Actions* → *Refresh dashboard data* → *Run
workflow*.
