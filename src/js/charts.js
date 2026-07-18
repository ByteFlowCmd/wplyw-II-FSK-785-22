/* ===========================================================
   charts.js
   -----------------------------------------------------------
   Wszystkie definicje wykresów Chart.js. Każda funkcja przyjmuje
   `agregaty` (obiekt zwrócony przez data-loader.js: initData())
   i rysuje wykres w podanym elemencie <canvas>.

   Wywołanie zbiorcze: window.Charts.renderAll(agregaty, opts)
   opts.milestones (opcjonalnie) = [{ data:'2025-12-15', label:'785 ▸' }, ...]
   =========================================================== */

const WON = "#5FA88C";
const LOST = "#B5503F";
const BRASS = "#C99A3C";
const INK = "#ECE6D9";
const INK_DIM = "#9FB0BD";
const INK_FAINT = "#5E7081";
const GRID = "rgba(236,230,217,0.07)";
const TOOLTIP_BG = "#16283A";
const TOOLTIP_BORDER = "rgba(236,230,217,0.15)";

// kolory bloków bareizmów (dopasowane do palety strony)
const BLOCK_COLORS = {
  blue: "#5B8DBE",
  amber: BRASS,
  purple: "#8B6FB0",
  red: LOST,
  gray: INK_FAINT,
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = INK_DIM;

function fmtPct(p) {
  return p === null || p === undefined ? "—" : p.toFixed(1) + "%";
}

const baseTooltip = {
  backgroundColor: TOOLTIP_BG,
  borderColor: TOOLTIP_BORDER,
  borderWidth: 1,
  titleFont: { family: "'JetBrains Mono', monospace", size: 12 },
  bodyFont: { family: "'Inter', sans-serif", size: 12 },
  padding: 10,
};

// ===========================================================
// 1. HERO TIMELINE — rozrzut wszystkich spraw w czasie
// ===========================================================
function buildHeroChart(agregaty, canvasId, milestones) {
  milestones = milestones || [];
  const rows = agregaty.sprawyRozstrzygniete;
  const won = rows
    .filter((r) => r.wynik_dla_marynarza === "pozytywny")
    .map((r) => ({
      x: new Date(r.data_orzeczenia).getTime(),
      y: 0.5,
      sygn: r.sygnatura,
      data: r.data_orzeczenia,
      sad: r.sad,
      statek: r.statek_typ,
    }));
  const lost = rows
    .filter((r) => r.wynik_dla_marynarza === "negatywny")
    .map((r) => ({
      x: new Date(r.data_orzeczenia).getTime(),
      y: 0.5,
      sygn: r.sygnatura,
      data: r.data_orzeczenia,
      sad: r.sad,
      statek: r.statek_typ,
    }));

  const allDates = rows
    .map((r) => new Date(r.data_orzeczenia).getTime())
    .filter(Boolean);
  const minDate = allDates.length
    ? Math.min(...allDates)
    : new Date("2017-01-01").getTime();
  const maxDate = allDates.length
    ? Math.max(...allDates)
    : new Date().getTime();

  const milestoneLinePlugin = {
    id: "milestoneLines",
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      milestones.forEach((m) => {
        const x = scales.x.getPixelForValue(new Date(m.data).getTime());
        if (x < chartArea.left || x > chartArea.right) return;
        ctx.save();
        ctx.strokeStyle = BRASS;
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = BRASS;
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(m.label || "", x + 6, chartArea.top + 12);
        ctx.restore();
      });
    },
  };

  return new Chart(document.getElementById(canvasId), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Korzystny",
          data: won,
          backgroundColor: WON,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: "Niekorzystny",
          data: lost,
          backgroundColor: LOST,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: Object.assign({}, baseTooltip, {
          callbacks: {
            title: (items) => items[0].raw.sygn,
            label: (item) => {
              const r = item.raw;
              const lines = [r.data, r.sad];
              if (r.statek) lines.push(r.statek);
              return lines;
            },
          },
        }),
      },
      scales: {
        x: {
          type: "linear",
          min: minDate,
          max: maxDate,
          grid: { color: GRID, display: false },
          ticks: {
            color: INK_FAINT,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (v) => new Date(v).getFullYear(),
            stepSize: 365 * 24 * 3600 * 1000,
          },
          border: { color: TOOLTIP_BORDER },
        },
        y: { min: 0, max: 1, display: false, grid: { display: false } },
      },
    },
    plugins: [milestoneLinePlugin],
  });
}

// ===========================================================
// 2. TREND ROCZNY — stacked bar poz/neg per rok + linia % wygranych
// ===========================================================
function buildYearlyTrendChart(agregaty, canvasId) {
  const rows = agregaty.trendRoczny;
  return new Chart(document.getElementById(canvasId), {
    data: {
      labels: rows.map((r) => r.rok),
      datasets: [
        {
          type: "bar",
          label: "Korzystne",
          data: rows.map((r) => r.poz),
          backgroundColor: WON,
          borderRadius: 3,
          stack: "s",
          order: 2,
        },
        {
          type: "bar",
          label: "Niekorzystne",
          data: rows.map((r) => r.neg),
          backgroundColor: LOST,
          borderRadius: 3,
          stack: "s",
          order: 2,
        },
        {
          type: "line",
          label: "% wygranych",
          data: rows.map((r) => r.pct),
          borderColor: BRASS,
          backgroundColor: BRASS,
          yAxisID: "y1",
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: BRASS,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "start",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: INK_DIM,
            font: { size: 12 },
          },
        },
        tooltip: baseTooltip,
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: INK_FAINT,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
          },
        },
        y: {
          stacked: true,
          grid: { color: GRID },
          ticks: { color: INK_FAINT },
        },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          grid: { display: false },
          ticks: { color: BRASS, callback: (v) => v + "%" },
        },
      },
    },
  });
}

// ===========================================================
// 3. TREND MIESIĘCZNY
// ===========================================================
function buildMonthlyTrendChart(agregaty, canvasId) {
  const rows = agregaty.trend_miesieczny;
  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: rows.map((r) => r.miesiac),
      datasets: [
        {
          label: "Korzystne",
          data: rows.map((r) => r.poz),
          backgroundColor: WON,
          borderRadius: 3,
          maxBarThickness: 30,
        },
        {
          label: "Niekorzystne",
          data: rows.map((r) => r.neg),
          backgroundColor: LOST,
          borderRadius: 3,
          maxBarThickness: 30,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: INK_FAINT,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
          },
        },
        y: {
          stacked: true,
          grid: { color: GRID },
          ticks: { color: INK_FAINT, stepSize: 2 },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "start",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: INK_DIM,
            font: { size: 12 },
          },
        },
        tooltip: baseTooltip,
      },
    },
  });
}

// ===========================================================
// 4. WYKRES POZIOMY — pomocnicza fabryka (statki / bandery / sądy)
// ===========================================================
function buildRatioBarChart(rows, canvasId, opts) {
  opts = opts || {};
  const nameKey = opts.nameKey;
  const minN = opts.minN || 1;
  const filtered = rows
    .filter((r) => r.poz + r.neg >= minN)
    .sort((a, b) => b.poz + b.neg - (a.poz + a.neg));

  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: filtered.map((r) => `${r[nameKey]}  (n=${r.poz + r.neg})`),
      datasets: [
        {
          label: "% wygranych",
          data: filtered.map((r) => r.pct),
          backgroundColor: BRASS,
          borderRadius: 3,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: Object.assign({}, baseTooltip, {
          callbacks: {
            label: (ctx) =>
              ctx.parsed.x === null
                ? "brak spraw"
                : ctx.parsed.x + "% wygranych",
          },
        }),
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: GRID },
          ticks: { callback: (v) => v + "%", color: INK_FAINT },
        },
        y: {
          grid: { display: false },
          ticks: { color: INK_DIM, font: { size: 12 } },
        },
      },
    },
  });
}

function buildVesselChart(agregaty, canvasId) {
  return buildRatioBarChart(agregaty.statki, canvasId, {
    nameKey: "kategoria",
    minN: 3,
  });
}
function buildBanderaChart(agregaty, canvasId) {
  return buildRatioBarChart(agregaty.bandery, canvasId, {
    nameKey: "bandera",
    minN: 2,
  });
}
function buildCourtChart(agregaty, canvasId) {
  return buildRatioBarChart(agregaty.sad, canvasId, {
    nameKey: "sad",
    minN: 1,
  });
}

// ===========================================================
// 5. BLOKI BAREIZMÓW — stacked horizontal bar poz/neg per blok
// ===========================================================
function buildTrickBlockChart(agregaty, canvasId) {
  const byBlock = {};
  agregaty.tricki.forEach((t) => {
    if (!byBlock[t.blok])
      byBlock[t.blok] = {
        blok: t.blok,
        nazwa_bloku: t.nazwa_bloku,
        kolor: t.kolor,
        poz: 0,
        neg: 0,
      };
    byBlock[t.blok].poz += t.poz;
    byBlock[t.blok].neg += t.neg;
  });
  const rows = Object.values(byBlock).sort((a, b) =>
    a.blok.localeCompare(b.blok),
  );

  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: rows.map((r) => `Blok ${r.blok} — ${r.nazwa_bloku}`),
      datasets: [
        {
          label: "Wygrane mimo tricku",
          data: rows.map((r) => r.poz),
          backgroundColor: WON,
          borderRadius: 3,
          stack: "s",
        },
        {
          label: "Przegrane przez trick",
          data: rows.map((r) => r.neg),
          backgroundColor: LOST,
          borderRadius: 3,
          stack: "s",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "start",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: INK_DIM,
            font: { size: 12 },
          },
        },
        tooltip: baseTooltip,
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: GRID },
          ticks: { color: INK_FAINT },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: INK_DIM, font: { size: 12 } },
        },
      },
    },
  });
}

window.Charts = {
  buildHeroChart,
  buildYearlyTrendChart,
  buildMonthlyTrendChart,
  buildVesselChart,
  buildBanderaChart,
  buildCourtChart,
  buildTrickBlockChart,
};
