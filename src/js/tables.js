/* ===========================================================
   tables.js
   -----------------------------------------------------------
   Buduje tabele i listy HTML (nie-Chart.js) na podstawie
   agregatów z data-loader.js.
   =========================================================== */

// ===========================================================
// GENERYCZNA TABELA proporcji wygrane/przegrane
// ===========================================================
function buildRatioTable(containerId, rows, nameKey, nameLabel, opts) {
  opts = opts || {};
  const minN = opts.minN || 1;
  const el = document.getElementById(containerId);
  if (!el) return;

  const filtered = rows.filter((r) => r.poz + r.neg >= minN);
  const head = `<tr><th>${nameLabel}</th><th>Razem</th><th>% wygranych</th><th>Wygrane</th><th>Przegrane</th></tr>`;
  const body = filtered
    .map((r) => {
      const total = r.poz + r.neg;
      return `<tr>
      <td class="name">${r[nameKey]}</td>
      <td class="num">${total}</td>
      <td><div class="barcell"><div class="minibar"><i style="width:${r.pct || 0}%"></i></div><span class="pct">${fmtPct(r.pct)}</span></div></td>
      <td class="num">${r.poz}</td>
      <td class="num">${r.neg}</td>
    </tr>`;
    })
    .join("");
  el.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

function buildTreatyTable(agregaty, containerId) {
  buildRatioTable(
    containerId || "treatyTable",
    agregaty.umowy,
    "panstwo",
    "Umowa (kraj)",
    { minN: 1 },
  );
}

function buildCityTable(agregaty, containerId) {
  buildRatioTable(
    containerId || "cityTable",
    agregaty.miasta,
    "miasto",
    "Sąd / miasto",
    { minN: 1 },
  );
}

function buildPrzepisyTable(agregaty, containerId, topN) {
  const rows = agregaty.przepisy.slice(0, topN || 12);
  buildRatioTable(
    containerId || "przepisyTable",
    rows,
    "przepis",
    "Powołany przepis",
    { minN: 1 },
  );
}

// ===========================================================
// RANKING TRICKÓW — lista z pojedynczym paskiem wygrane/przegrane
// ===========================================================
function buildTrickList(agregaty, containerId) {
  const el = document.getElementById(containerId || "trickList");
  if (!el) return;

  const rows = agregaty.tricki
    .slice()
    .sort((a, b) => b.poz + b.neg - (a.poz + a.neg));

  el.innerHTML = rows
    .map((t) => {
      const total = t.poz + t.neg;
      const wonW = total ? ((t.poz / total) * 100).toFixed(1) : 0;
      const lostW = total ? ((t.neg / total) * 100).toFixed(1) : 0;
      const skutecznoscFiskusa = total
        ? ((t.neg / total) * 100).toFixed(0)
        : "—";
      const blockColor = BLOCK_COLORS[t.kolor] || INK_FAINT;
      return `
      <div class="trick-row">
        <div class="trick-name">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${blockColor};margin-right:6px;"></span>
          ${t.nazwa}
        </div>
        <div class="trick-bars">
          <div class="trick-bar-line">
            <span class="tag">n=${total}</span>
            <div class="trick-bar-track">
              <div class="seg-won" style="width:${wonW}%"></div>
              <div class="seg-lost" style="width:${lostW}%"></div>
            </div>
          </div>
        </div>
        <div class="trick-delta">${skutecznoscFiskusa}% skut.</div>
      </div>
    `;
    })
    .join("");
}

// ===========================================================
// KARTY SPRAW — rozwijalna lista pojedynczych orzeczeń (np. dla widoku "przeglądaj sprawy")
// ===========================================================
function buildCaseCards(cases, containerId) {
  const el = document.getElementById(containerId || "caseCards");
  if (!el) return;

  el.innerHTML = cases
    .map((c) => {
      const pillClass = c.wynik_dla_marynarza === "negatywny" ? "lost" : "won";
      const pillText =
        c.wynik_dla_marynarza === "negatywny" ? "przegrana" : "wygrana";
      const tagsHtml = (c.tagi || [])
        .map((t) => `<span class="tag">${t}</span>`)
        .join("");
      return `
      <div class="case-card" onclick="this.classList.toggle('open')">
        <div class="log-row">
          <span class="log-sygn">${c.sygnatura}</span>
          <span class="log-date">${c.data_orzeczenia}</span>
          <span class="badge-court">${c.sad}${c.miasto ? " · " + c.miasto : ""}</span>
          <span class="pill ${pillClass}">${pillText}</span>
        </div>
        <div class="teza">${c.teza || ""}</div>
        <div class="detail">
          <p>${c.podsumowanie || ""}</p>
          <div class="tags">${tagsHtml}</div>
        </div>
      </div>
    `;
    })
    .join("");
}

window.Tables = {
  buildTreatyTable,
  buildCityTable,
  buildPrzepisyTable,
  buildTrickList,
  buildCaseCards,
};
