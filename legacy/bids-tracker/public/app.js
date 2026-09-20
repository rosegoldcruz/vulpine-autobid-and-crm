let companyChart, statusChart, monthChart;

async function loadAll() {
  const [bids, kpis] = await Promise.all([
    fetch('/api/bids').then(r => r.json()),
    fetch('/api/kpis').then(r => r.json())
  ]);
  renderKpis(kpis);
  renderCharts(kpis);
  renderTable(bids);
}

function money(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function renderKpis(kpis) {
  const cards = [
    { label: 'Total Bids Sent', value: kpis.totalBids },
    { label: 'Total Pipeline Revenue', value: money(kpis.totalValue) },
    { label: 'Total Projected Profit', value: money(kpis.totalProfit) },
    { label: 'Estimated Cost (Revenue With Profit - Profit)', value: money(kpis.estimatedCost) },
    { label: 'Profit Coverage', value: `${kpis.profitCoverageCount}/${kpis.totalBids} (${(kpis.profitCoveragePct || 0).toFixed(1)}%)` },
    { label: 'Total Units Bid', value: kpis.totalUnits || 0 },
    { label: 'Average Bid', value: money(kpis.avgBid) },
    { label: 'Average Profit per Bid', value: money(kpis.avgProfitPerBid) },
    { label: 'Records Needing Review', value: kpis.recordsNeedingReview || 0 }
  ];
  document.getElementById('kpiRow').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>
  `).join('');
}

function renderCharts(kpis) {
  const companyLabels = Object.keys(kpis.byCompany);
  const companyValues = Object.values(kpis.byCompany);
  const statusLabels = Object.keys(kpis.byStatus);
  const statusValues = Object.values(kpis.byStatus);
  const monthLabels = Object.keys(kpis.byMonth).sort();
  const monthValues = monthLabels.map(m => kpis.byMonth[m]);

  const palette = ['#4f7cff', '#7c5cff', '#ff6b9d', '#ffb648', '#4ddba0', '#4dc9ff', '#ff8a4d'];

  if (companyChart) companyChart.destroy();
  companyChart = new Chart(document.getElementById('companyChart'), {
    type: 'bar',
    data: { labels: companyLabels, datasets: [{ data: companyValues, backgroundColor: '#4f7cff' }] },
    options: baseOpts(true)
  });

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: { labels: statusLabels, datasets: [{ data: statusValues, backgroundColor: palette }] },
    options: baseOpts(false)
  });

  if (monthChart) monthChart.destroy();
  monthChart = new Chart(document.getElementById('monthChart'), {
    type: 'line',
    data: { labels: monthLabels, datasets: [{ data: monthValues, borderColor: '#4ddba0', tension: 0.3 }] },
    options: baseOpts(true)
  });
}

function baseOpts(hasAxes) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#c3c8d6' } } },
    scales: hasAxes ? {
      x: { ticks: { color: '#9aa1b1' }, grid: { color: '#262a35' } },
      y: { ticks: { color: '#9aa1b1' }, grid: { color: '#262a35' } }
    } : {}
  };
}

function renderTable(bids) {
  const body = document.getElementById('bidsBody');
  body.innerHTML = bids.map(b => `
    <tr data-id="${b.id}">
      <td><input value="${esc(b.project_name || '')}" data-field="project_name"></td>
      <td><input value="${esc(b.company_name || '')}" data-field="company_name"></td>
      <td><input type="number" value="${b.units ?? ''}" data-field="units" style="width:70px"></td>
      <td><input type="number" value="${b.bid_amount ?? ''}" data-field="bid_amount" style="width:110px"></td>
      <td>${money(b.projected_profit)}</td>
      <td><input type="date" value="${b.sent_date || ''}" data-field="sent_date"></td>
      <td>
        <select data-field="status">
          ${['Sent', 'Follow-Up', 'Won', 'Lost'].map(s =>
            `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="del-btn" data-id="${b.id}">✕</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', onEdit);
  });
  body.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', onDelete);
  });
}

function esc(s) {
  return String(s).replace(/"/g, '&quot;');
}

async function onEdit(e) {
  const row = e.target.closest('tr');
  const id = row.dataset.id;
  const field = e.target.dataset.field;
  const value = e.target.value;
  await fetch(`/api/bids/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value })
  });
  loadAll();
}

async function onDelete(e) {
  const id = e.target.dataset.id;
  if (!confirm('Delete this bid?')) return;
  await fetch(`/api/bids/${id}`, { method: 'DELETE' });
  loadAll();
}

document.getElementById('pdfInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  const statusEl = document.getElementById('uploadStatus');
  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      statusEl.textContent = `Processing ${file.name}...`;
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Upload failed with ${res.status}`);
      }

      const result = await res.json();
      successCount += 1;
      if (result.needs_review) {
        statusEl.textContent = `${file.name} added — extracted with fallback OCR, double-check fields.`;
      } else {
        statusEl.textContent = `${file.name} added.`;
      }
    } catch (err) {
      failCount += 1;
      statusEl.textContent = `${file.name} failed: ${err.message}`;
    }
  }

  statusEl.textContent = `Upload complete: ${successCount} succeeded, ${failCount} failed.`;
  e.target.value = '';
  loadAll();
});

loadAll();
