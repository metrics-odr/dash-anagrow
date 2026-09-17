/* AnaGrow — relatório de performance Google Ads + GA4 */

const WEEKDAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_PT_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtBRL(v) {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtInt(v) {
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtPct(v, digits = 2) {
  if (!isFinite(v)) return '—';
  return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%';
}

// ---- Build the metric rows -------------------------------------------------

function buildMetrics(raw) {
  return raw.map(r => {
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    const cpm = r.impressions > 0 ? (r.gasto / r.impressions) * 1000 : 0;
    const cr = r.clicks > 0 ? r.conversions / r.clicks : 0;
    const convLP = r.pageviews > 0 ? r.conversions / r.pageviews : 0;
    const cpa = r.conversions > 0 ? r.gasto / r.conversions : Infinity;
    const d = parseDate(r.date);
    return {
      ...r,
      weekday: d.getDay(),
      weekdayName: WEEKDAYS_PT[d.getDay()],
      ctr, cpm, cr, convLP, cpa,
    };
  });
}

const METRICS = buildMetrics(RAW_DATA);
// newest first for the table
const METRICS_DESC = [...METRICS].sort((a, b) => b.date.localeCompare(a.date));

// ---- Heatmap color scale ----------------------------------------------------
// Sequential, one hue per column (dataviz skill categorical slots 1-4),
// darker/more saturated = higher value.
const HEAT_HUES = {
  gasto: { h: 213, s: 62 },  // blue   (slot 1)
  ctr:   { h: 16,  s: 72 },  // orange (slot 2)
  cr:    { h: 160, s: 65 },  // aqua   (slot 3)
  convLP:{ h: 40,  s: 100 }, // gold   (slot 4)
};

function heatColor(hue, t) {
  // t in [0,1] -> lightness from 92% (near-surface) down to 28% (dense)
  const l = 92 - t * 64;
  return `hsl(${hue.h} ${hue.s}% ${l}%)`;
}

function heatTextColor(t) {
  return t > 0.55 ? '#ffffff' : '#0b0b0b';
}

function scaleFns(values) {
  const finite = values.filter(v => isFinite(v));
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  return v => isFinite(v) ? Math.min(1, Math.max(0, (v - min) / range)) : 0;
}

// ---- KPI cards ---------------------------------------------------------------

function renderKPIs() {
  const totalGasto = METRICS.reduce((s, r) => s + r.gasto, 0);
  const totalImpr = METRICS.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = METRICS.reduce((s, r) => s + r.clicks, 0);
  const totalConv = METRICS.reduce((s, r) => s + r.conversions, 0);
  const totalPV = METRICS.reduce((s, r) => s + r.pageviews, 0);
  const totalSessions = METRICS.reduce((s, r) => s + r.sessions, 0);

  const avgCTR = totalImpr > 0 ? totalClicks / totalImpr : 0;
  const avgCPM = totalImpr > 0 ? (totalGasto / totalImpr) * 1000 : 0;
  const avgCPA = totalConv > 0 ? totalGasto / totalConv : Infinity;
  const avgCR = totalClicks > 0 ? totalConv / totalClicks : 0;

  const cards = [
    { label: 'Investimento total', value: fmtBRL(totalGasto) },
    { label: 'Conversões totais', value: totalConv.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) },
    { label: 'CPA médio', value: fmtBRL(avgCPA) },
    { label: 'CTR médio', value: fmtPct(avgCTR) },
    { label: 'CR médio (conv/clique)', value: fmtPct(avgCR) },
    { label: 'CPM médio', value: fmtBRL(avgCPM) },
    { label: 'Cliques totais', value: fmtInt(totalClicks) },
    { label: 'Sessões (GA4)', value: fmtInt(totalSessions) },
    { label: 'Page Views (GA4)', value: fmtInt(totalPV) },
  ];

  const wrap = document.getElementById('kpi-grid');
  wrap.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
    </div>
  `).join('');
}

// ---- Main table with heatmap -------------------------------------------------

function renderTable() {
  const scaleGasto = scaleFns(METRICS.map(r => r.gasto));
  const scaleCTR = scaleFns(METRICS.map(r => r.ctr));
  const scaleCR = scaleFns(METRICS.map(r => r.cr));
  const scaleConvLP = scaleFns(METRICS.map(r => r.convLP));

  const tbody = document.getElementById('main-table-body');
  tbody.innerHTML = METRICS_DESC.map(r => {
    const tGasto = scaleGasto(r.gasto);
    const tCTR = scaleCTR(r.ctr);
    const tCR = scaleCR(r.cr);
    const tConvLP = scaleConvLP(r.convLP);
    return `
      <tr>
        <td class="col-date">${fmtDateBR(r.date)}</td>
        <td class="col-weekday">${WEEKDAYS_PT_SHORT[r.weekday]}</td>
        <td class="heat-cell" style="background:${heatColor(HEAT_HUES.gasto, tGasto)};color:${heatTextColor(tGasto)}">${fmtBRL(r.gasto)}</td>
        <td>${fmtBRL(r.cpm)}</td>
        <td>${fmtInt(r.impressions)}</td>
        <td class="heat-cell" style="background:${heatColor(HEAT_HUES.ctr, tCTR)};color:${heatTextColor(tCTR)}">${fmtPct(r.ctr)}</td>
        <td>${fmtInt(r.clicks)}</td>
        <td class="heat-cell" style="background:${heatColor(HEAT_HUES.cr, tCR)};color:${heatTextColor(tCR)}">${fmtPct(r.cr)}</td>
        <td>${fmtInt(r.pageviews)}</td>
        <td class="heat-cell" style="background:${heatColor(HEAT_HUES.convLP, tConvLP)};color:${heatTextColor(tConvLP)}">${fmtPct(r.convLP)}</td>
        <td>${r.conversions.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
        <td>${fmtBRL(r.cpa)}</td>
      </tr>
    `;
  }).join('');
}

// ---- Chart helpers -----------------------------------------------------------

const CHART_INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9' };
const HUE = {
  blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100',
  magenta: '#e87ba4', green: '#008300', violet: '#4a3aa7', red: '#e34948',
};

Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.color = CHART_INK.secondary;
Chart.defaults.borderColor = CHART_INK.grid;

function baseLineOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { backgroundColor: '#fff', titleColor: CHART_INK.primary, bodyColor: CHART_INK.secondary, borderColor: CHART_INK.grid, borderWidth: 1 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 12, color: CHART_INK.muted } },
      y: { title: { display: !!yLabel, text: yLabel, color: CHART_INK.muted }, grid: { color: CHART_INK.grid }, ticks: { color: CHART_INK.muted } },
    },
  };
}

// 1) Gasto (bar) — visão diária de investimento
function chartGasto() {
  new Chart(document.getElementById('chart-gasto'), {
    type: 'bar',
    data: {
      labels: METRICS.map(r => fmtDateBR(r.date)),
      datasets: [{
        label: 'Gasto (R$)',
        data: METRICS.map(r => r.gasto),
        backgroundColor: HUE.blue,
        borderRadius: 4,
        maxBarThickness: 10,
      }],
    },
    options: {
      ...baseLineOptions('R$'),
      plugins: { ...baseLineOptions().plugins, legend: { display: false } },
    },
  });
}

// 2) Conversões (linha) — mesma base temporal, medida diferente -> gráfico separado
function chartConversoes() {
  new Chart(document.getElementById('chart-conversoes'), {
    type: 'line',
    data: {
      labels: METRICS.map(r => fmtDateBR(r.date)),
      datasets: [{
        label: 'Conversões',
        data: METRICS.map(r => r.conversions),
        borderColor: HUE.aqua,
        backgroundColor: HUE.aqua,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.25,
        fill: false,
      }],
    },
    options: {
      ...baseLineOptions('conversões'),
      plugins: { ...baseLineOptions().plugins, legend: { display: false } },
    },
  });
}

// 3) CTR / CR / ConvLP — mesma unidade (%), um eixo só
function chartFunnelRates() {
  new Chart(document.getElementById('chart-rates'), {
    type: 'line',
    data: {
      labels: METRICS.map(r => fmtDateBR(r.date)),
      datasets: [
        { label: 'CTR', data: METRICS.map(r => r.ctr * 100), borderColor: HUE.orange, backgroundColor: HUE.orange, pointRadius: 0, borderWidth: 2, tension: 0.25 },
        { label: 'CR (conv/clique)', data: METRICS.map(r => r.cr * 100), borderColor: HUE.aqua, backgroundColor: HUE.aqua, pointRadius: 0, borderWidth: 2, tension: 0.25 },
        { label: 'ConvLP (conv/pageview)', data: METRICS.map(r => r.convLP * 100), borderColor: HUE.yellow, backgroundColor: HUE.yellow, pointRadius: 0, borderWidth: 2, tension: 0.25 },
      ],
    },
    options: baseLineOptions('%'),
  });
}

// 4) CPM / CPA — mesma unidade (R$), um eixo só
function chartCosts() {
  const cpaData = METRICS.map(r => isFinite(r.cpa) ? r.cpa : null);
  new Chart(document.getElementById('chart-costs'), {
    type: 'line',
    data: {
      labels: METRICS.map(r => fmtDateBR(r.date)),
      datasets: [
        { label: 'CPM', data: METRICS.map(r => r.cpm), borderColor: HUE.blue, backgroundColor: HUE.blue, pointRadius: 0, borderWidth: 2, tension: 0.25 },
        { label: 'CPA', data: cpaData, borderColor: HUE.violet, backgroundColor: HUE.violet, pointRadius: 0, borderWidth: 2, tension: 0.25, spanGaps: true },
      ],
    },
    options: baseLineOptions('R$'),
  });
}

// 5) Funil do período (totais): Impressões -> Cliques -> Page Views -> Conversões
function chartFunnel() {
  const totalImpr = METRICS.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = METRICS.reduce((s, r) => s + r.clicks, 0);
  const totalPV = METRICS.reduce((s, r) => s + r.pageviews, 0);
  const totalConv = METRICS.reduce((s, r) => s + r.conversions, 0);

  // ordinal ramp (sequential blue, light->dark), lightest step still >=2:1 contrast
  const ramp = ['#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];
  const stages = ['Impressões', 'Cliques', 'Page Views', 'Conversões'];
  const values = [totalImpr, totalClicks, totalPV, totalConv];

  new Chart(document.getElementById('chart-funnel'), {
    type: 'bar',
    data: {
      labels: stages,
      datasets: [{
        label: 'Total no período',
        data: values,
        backgroundColor: ramp,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.x;
              const pctOfImpr = totalImpr > 0 ? (v / totalImpr * 100).toFixed(2) + '% das impressões' : '';
              return `${fmtInt(v)}  (${pctOfImpr})`;
            },
          },
        },
      },
      scales: {
        // escala log: impressões, cliques, page views e conversões vivem em
        // ordens de grandeza muito diferentes — linear deixaria as 3 últimas invisíveis.
        x: {
          type: 'logarithmic',
          grid: { color: CHART_INK.grid },
          ticks: { color: CHART_INK.muted, callback: v => fmtInt(v) },
        },
        y: { grid: { display: false }, ticks: { color: CHART_INK.primary, font: { weight: '600' } } },
      },
    },
  });
}

// 6) Desempenho médio por dia da semana
function chartWeekday() {
  const buckets = Array.from({ length: 7 }, () => ({ gasto: 0, conv: 0, clicks: 0, n: 0 }));
  METRICS.forEach(r => {
    const b = buckets[r.weekday];
    b.gasto += r.gasto; b.conv += r.conversions; b.clicks += r.clicks; b.n += 1;
  });
  // reorder Mon..Sun for readability
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = order.map(i => WEEKDAYS_PT_SHORT[i]);
  const avgGasto = order.map(i => buckets[i].gasto / buckets[i].n);
  const avgConv = order.map(i => buckets[i].conv / buckets[i].n);
  const avgCPA = order.map(i => (buckets[i].conv > 0 ? buckets[i].gasto / buckets[i].conv : null));

  new Chart(document.getElementById('chart-weekday'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Gasto médio (R$)', data: avgGasto, backgroundColor: HUE.blue, yAxisID: 'y', borderRadius: 4, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: 'R$ / dia (média)' }, grid: { color: CHART_INK.grid } },
      },
    },
  });

  new Chart(document.getElementById('chart-weekday-conv'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Conversões médias', data: avgConv, backgroundColor: HUE.aqua, borderRadius: 4, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: 'conversões / dia (média)' }, grid: { color: CHART_INK.grid } },
      },
    },
  });
}

// 7) Cliques (Ads) vs Sessões/Page Views (GA4) — checagem de perda de rastreamento
function chartTrackingGap() {
  new Chart(document.getElementById('chart-tracking'), {
    type: 'line',
    data: {
      labels: METRICS.map(r => fmtDateBR(r.date)),
      datasets: [
        { label: 'Cliques (Google Ads)', data: METRICS.map(r => r.clicks), borderColor: HUE.blue, backgroundColor: HUE.blue, pointRadius: 0, borderWidth: 2, tension: 0.2 },
        { label: 'Sessões (GA4)', data: METRICS.map(r => r.sessions), borderColor: HUE.orange, backgroundColor: HUE.orange, pointRadius: 0, borderWidth: 2, tension: 0.2 },
        { label: 'Page Views (GA4)', data: METRICS.map(r => r.pageviews), borderColor: HUE.aqua, backgroundColor: HUE.aqua, pointRadius: 0, borderWidth: 2, tension: 0.2 },
      ],
    },
    options: baseLineOptions('contagem'),
  });
}

function renderTrackingNote() {
  const totalClicks = METRICS.reduce((s, r) => s + r.clicks, 0);
  const totalSessions = METRICS.reduce((s, r) => s + r.sessions, 0);
  const gapPct = ((totalClicks - totalSessions) / totalClicks) * 100;
  const el = document.getElementById('tracking-note');
  if (el) {
    el.textContent = `No período, o Google Ads registrou ${fmtInt(totalClicks)} cliques, contra ${fmtInt(totalSessions)} sessões no GA4 — uma diferença de ${gapPct.toFixed(1)}%. Isso é esperado (cliques inválidos, robôs, perda de parâmetros de UTM, usuários que fecham a página antes de carregar o GA4), mas vale monitorar se o gap crescer muito mês a mês.`;
  }
}

// ---- Init ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('period-label').textContent =
    `${fmtDateBR(METRICS[0].date)} — ${fmtDateBR(METRICS[METRICS.length - 1].date)} (${METRICS.length} dias)`;
  renderKPIs();
  renderTable();
  chartGasto();
  chartConversoes();
  chartFunnelRates();
  chartCosts();
  chartFunnel();
  chartWeekday();
  chartTrackingGap();
  renderTrackingNote();
});
