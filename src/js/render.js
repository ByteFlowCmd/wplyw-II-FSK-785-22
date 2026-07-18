/* ===========================================================
   render.js
   -----------------------------------------------------------
   Punkt wejścia strony. Wczytuje dane (data-loader.js), buduje
   karty KPI, wywołuje wszystkie wykresy (charts.js) i tabele
   (tables.js), renderuje listę spraw.
   =========================================================== */

// Kamienie milowe — wyroki przełomowe do zaznaczenia na osi czasu.
// To jest teraz DODATEK, nie główna narracja strony. Dopisuj kolejne
// przełomowe wyroki tutaj w miarę potrzeb.
const MILESTONES = [
  { data: "2025-12-15", label: "785 ▸", sygn: "II FSK 785/22" },
];

function fmtPct2(p) {
  return p === null || p === undefined ? "—" : p.toFixed(1) + "%";
}

// ===========================================================
// KPI CARDS
// ===========================================================
function buildKPI(agregaty) {
  const grid = document.getElementById("kpiGrid");
  if (!grid) return;

  const o = agregaty.ogolem;
  const najlepszyRok = agregaty.trendRoczny
    .slice()
    .filter((r) => r.pct !== null)
    .sort((a, b) => b.pct - a.pct)[0];
  const ostatniRok = agregaty.trendRoczny[agregaty.trendRoczny.length - 1];
  const najczestszyTrick = agregaty.tricki
    .slice()
    .sort((a, b) => b.poz + b.neg - (a.poz + a.neg))[0];
  const najlepszySad = agregaty.sad
    .filter((s) => s.poz + s.neg >= 3)
    .sort((a, b) => b.pct - a.pct)[0];

  const cards = [
    {
      label: "Wszystkie sprawy w bazie",
      num: o.n,
      sub: `lata ${agregaty.trendRoczny[0] ? agregaty.trendRoczny[0].rok : "—"}–${ostatniRok ? ostatniRok.rok : "—"}`,
    },
    {
      label: "% wygranych ogółem",
      num: fmtPct2(o.pct),
      sub: `${o.poz} wygranych / ${o.neg} przegranych`,
    },
    {
      label: "Najlepszy rok dla marynarzy",
      num: najlepszyRok ? najlepszyRok.rok : "—",
      sub: najlepszyRok ? `${fmtPct2(najlepszyRok.pct)} skuteczności` : "",
    },
    {
      label: "Najczęstszy trick fiskusa",
      num: najczestszyTrick ? najczestszyTrick.nazwa : "—",
      sub: najczestszyTrick
        ? `${najczestszyTrick.poz + najczestszyTrick.neg} spraw`
        : "",
    },
    {
      label: "Sąd najbardziej przyjazny",
      num: najlepszySad ? najlepszySad.sad : "—",
      sub: najlepszySad ? `${fmtPct2(najlepszySad.pct)} skuteczności` : "",
    },
  ];

  grid.innerHTML = cards
    .map(
      (c) => `
    <div class="kpi">
      <div class="label">${c.label}</div>
      <div class="num">${c.num}</div>
      <div class="sub">${c.sub}</div>
    </div>
  `,
    )
    .join("");
}

// ===========================================================
// SERIE (sprawy rozstrzygnięte tego samego dnia, seryjnie)
// ===========================================================
function buildSeriesGrid(agregaty, containerId) {
  const el = document.getElementById(containerId || "seriesGrid");
  if (!el) return;
  const rows = agregaty.serie
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));
  el.innerHTML = rows
    .map((s) => {
      const pillClass = s.wynik === "negatywny" ? "lost" : "won";
      const pillText =
        s.wynik === "negatywny" ? "wszystkie przegrane" : "wszystkie wygrane";
      return `
      <div class="kpi">
        <div class="label">${s.data} &middot; ${s.sprawy.length} sprawy</div>
        <div style="font-family:var(--font-mono); font-size:13px; color:var(--ink); margin:6px 0;">${s.sprawy.join("<br>")}</div>
        <div class="sub" style="margin-bottom:8px;">${s.statek || "typ statku nieokreślony"}</div>
        <span class="pill ${pillClass}">${pillText}</span>
      </div>
    `;
    })
    .join("");
}

// ===========================================================
// GŁÓWNY START
// ===========================================================
async function main() {
  let agregaty;
  try {
    agregaty = await window.initData();
  } catch (err) {
    console.error("Błąd wczytywania danych:", err);
    document.body.innerHTML = `<div class="wrap" style="padding:60px 0;color:var(--lost);font-family:var(--font-mono)">
      Błąd wczytywania danych: ${err.message}. Sprawdź, czy pliki w src/data/ są dostępne (strona musi być serwowana przez lokalny serwer HTTP, nie otwierana jako plik://).
    </div>`;
    return;
  }

  // KPI
  buildKPI(agregaty);

  // wykresy
  window.Charts.buildHeroChart(agregaty, "heroChart", MILESTONES);
  window.Charts.buildYearlyTrendChart(agregaty, "yearlyTrendChart");
  window.Charts.buildMonthlyTrendChart(agregaty, "trendChart");
  window.Charts.buildVesselChart(agregaty, "vesselChart");
  window.Charts.buildBanderaChart(agregaty, "banderaChart");
  window.Charts.buildCourtChart(agregaty, "courtChart");
  window.Charts.buildTrickBlockChart(agregaty, "trickBlockChart");

  // tabele
  window.Tables.buildTreatyTable(agregaty, "treatyTable");
  window.Tables.buildCityTable(agregaty, "cityTable");
  window.Tables.buildPrzepisyTable(agregaty, "przepisyTable");
  window.Tables.buildTrickList(agregaty, "trickList");
  window.Tables.buildCaseCards(agregaty.sprawyRozstrzygniete, "caseCards");

  // serie
  buildSeriesGrid(agregaty, "seriesGrid");

  // udostępnij do debugowania w konsoli przeglądarki
  window.__agregaty = agregaty;
}

document.addEventListener("DOMContentLoaded", main);
