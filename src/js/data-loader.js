/* ===========================================================
   data-loader.js
   -----------------------------------------------------------
   Wczytuje surowe pliki roczne (src/data/orzeczeniaRRRR.json)
   oraz katalog tricków (src/data/bareizmy.json), scala je
   w jedną listę spraw i liczy WSZYSTKIE agregaty potrzebne
   do wykresów/tabel (charts.js, tables.js, render.js).

   Żeby dodać nowy rok: wrzuć plik src/data/orzeczeniaRRRR.json
   w formacie identycznym jak istniejące i dopisz nazwę pliku
   do CONFIG.dataFiles poniżej. Nic więcej nie trzeba zmieniać —
   statystyki przeliczą się same.
   =========================================================== */

const CONFIG = {
  dataFiles: [
    "src/data/orzeczenia2023.json",
    "src/data/orzeczenia2024.json",
    "src/data/orzeczenia2025.json",
    "src/data/orzeczenia2026.json",
    // kolejne lata (2022, 2021, 2020...) dopisuj tutaj
  ],
  tricksFile: "src/data/bareizmy.json",
  // opcjonalny plik z ręcznie kuratorowanymi "kamieniami milowymi"
  // (np. wyrok 785/22 i inne przełomowe orzeczenia) - patrz milestones.js
  minWordOverlapForTrickMatch: 0.4,
};

// ===========================================================
// 1. WCZYTYWANIE PLIKÓW
// ===========================================================
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok)
    throw new Error(`Nie udało się wczytać ${path} (status ${res.status})`);
  return res.json();
}

async function loadRawData() {
  const [yearArrays, tricksTaxonomyRaw] = await Promise.all([
    Promise.all(
      CONFIG.dataFiles.map((f) =>
        fetchJson(f).catch((err) => {
          console.warn(`Pomijam ${f}: ${err.message}`);
          return [];
        }),
      ),
    ),
    fetchJson(CONFIG.tricksFile).catch((err) => {
      console.warn(`Nie wczytano katalogu tricków: ${err.message}`);
      return [];
    }),
  ]);

  const cases = yearArrays.flat();
  const tricksTaxonomy = flattenTricksTaxonomy(tricksTaxonomyRaw);
  return { cases, tricksTaxonomy };
}

// spłaszcza strukturę blok -> bareizmy[] do jednej listy {nr, nazwa, blok, nazwa_bloku, kolor, ...}
function flattenTricksTaxonomy(blocks) {
  const out = [];
  (blocks || []).forEach((block) => {
    (block.bareizmy || []).forEach((t) => {
      out.push(
        Object.assign(
          {
            blok: block.blok,
            nazwa_bloku: block.nazwa_bloku,
            kolor: block.kolor,
          },
          t,
        ),
      );
    });
  });
  return out;
}

// ===========================================================
// 2. DOPASOWANIE TRICKÓW DO SPRAW (heurystyka tekstowa)
// ===========================================================
// Wyciąga frazy w cudzysłowach „..." z tekstu (podsumowanie / uzasadnienie)
function extractQuotedPhrases(text) {
  if (!text) return [];
  const re = /[„"]([^„”"]{4,80})[”"]/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

function normalizeWords(str) {
  return str
    .toLowerCase()
    .replace(/[.,;:!?()„”"]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// współczynnik Dice'a na zbiorach słów - miara podobieństwa dwóch fraz
function wordOverlapScore(a, b) {
  const wa = new Set(normalizeWords(a));
  const wb = new Set(normalizeWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared++;
  });
  return (2 * shared) / (wa.size + wb.size);
}

// dla jednej sprawy zwraca listę nr tricków (z taksonomii), które prawdopodobnie zastosowano
function detectTricksForCase(kejs, tricksTaxonomy) {
  // priorytet: ręczne wskazanie w danych sprawy
  if (Array.isArray(kejs.tricki_nr) && kejs.tricki_nr.length) {
    return kejs.tricki_nr.slice();
  }
  const text = [kejs.podsumowanie, kejs.uzasadnienie_sadu]
    .filter(Boolean)
    .join(" ");
  const phrases = extractQuotedPhrases(text);
  if (!phrases.length || !tricksTaxonomy.length) return [];

  const foundNr = new Set();
  phrases.forEach((phrase) => {
    let best = null,
      bestScore = 0;
    tricksTaxonomy.forEach((t) => {
      const score = wordOverlapScore(phrase, t.nazwa);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    });
    if (best && bestScore >= CONFIG.minWordOverlapForTrickMatch)
      foundNr.add(best.nr);
  });
  return Array.from(foundNr);
}

// ===========================================================
// 3. KATEGORYZACJA TYPU STATKU (na podstawie słów kluczowych)
// ===========================================================
const VESSEL_RULES = [
  { kategoria: "badawczy/sejsmiczny", test: /badaw|sejsmicz|research|survey/i },
  {
    kategoria: "mieszkalny/kwaterunkowy",
    test: /mieszkaln|kwaterunk|accommodation|floatel|hotel/i,
  },
  { kategoria: "wiertniczy/jack-up", test: /wiertnicz|jack-?up|\brig\b/i },
  { kategoria: "tankowiec/chemikaliowiec", test: /tankow|chemikaliow|tanker/i },
  {
    kategoria: "holownik/zaopatrzeniowiec",
    test: /holownik|zaopatrzeniow|\btug\b|\bsupply\b|psv/i,
  },
  { kategoria: "FPSO", test: /fpso/i },
  { kategoria: "układacz rur", test: /uk[łl]adacz rur|pipelay/i },
  {
    kategoria: "wsparcia nurkowego (DSV)",
    test: /nurkow|\bdsv\b|diving support/i,
  },
  {
    kategoria: "offshore (wielozadaniowy)",
    test: /offshore|oscv|mrsv|multi ?purpose/i,
  },
  {
    kategoria: "towarowy/transportowy",
    test: /towarow|transportow|cargo|bulk|container|\blng\b/i,
  },
];

function categorizeVessel(statekTyp) {
  if (!statekTyp) return "brak danych";
  const hit = VESSEL_RULES.find((r) => r.test.test(statekTyp));
  return hit ? hit.kategoria : "inny/nieskategoryzowany";
}

// ===========================================================
// 4. WYCIĄGANIE KRAJU UMOWY (konwencji) Z PRZEPISÓW POWOŁANYCH
// ===========================================================
function extractTreatyCountry(przepisyPowolane) {
  if (!Array.isArray(przepisyPowolane)) return null;
  for (const p of przepisyPowolane) {
    const m = p.match(/Konwencji PL-([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]+)/);
    if (m) return m[1];
  }
  return null;
}

// ===========================================================
// 5. POMOCNICZE LICZNIKI WYNIK/WYGRANA-PRZEGRANA
// ===========================================================
function isWin(kejs) {
  return kejs.wynik_dla_marynarza === "pozytywny";
}
function isLoss(kejs) {
  return kejs.wynik_dla_marynarza === "negatywny";
}

function bump(bucket, key, win) {
  if (!bucket[key]) bucket[key] = { poz: 0, neg: 0 };
  if (win) bucket[key].poz++;
  else bucket[key].neg++;
}

function pct(poz, neg) {
  const n = poz + neg;
  if (n === 0) return null;
  return Math.round((poz / n) * 1000) / 10;
}

// ===========================================================
// 6. GŁÓWNA FUNKCJA AGREGUJĄCA
// ===========================================================
function buildAggregates(cases, tricksTaxonomy) {
  // odfiltruj sprawy bez jednoznacznego wyniku (np. "umorzenie") z liczników poz/neg,
  // ale zachowaj je w pełnej liście `wszystkie` (np. do przyszłych wykresów)
  const rozstrzygniete = cases.filter((c) => isWin(c) || isLoss(c));

  // --- OGÓŁEM + PO LATACH ---
  const ogolemByYear = {};
  rozstrzygniete.forEach((c) => {
    const year = (c.data_orzeczenia || "").slice(0, 4);
    if (!year) return;
    bump(ogolemByYear, year, isWin(c));
  });
  const totalPoz = rozstrzygniete.filter(isWin).length;
  const totalNeg = rozstrzygniete.filter(isLoss).length;

  // --- SĄD (WSA / NSA) ---
  const bySad = {};
  rozstrzygniete.forEach((c) => bump(bySad, c.sad || "nieznany", isWin(c)));

  // --- MIASTA ---
  const byMiasto = {};
  rozstrzygniete.forEach((c) =>
    bump(byMiasto, c.miasto || "nieznane", isWin(c)),
  );

  // --- STATKI (skategoryzowane) ---
  const byStatek = {};
  rozstrzygniete.forEach((c) =>
    bump(byStatek, categorizeVessel(c.statek_typ), isWin(c)),
  );

  // --- BANDERY ---
  const byBandera = {};
  rozstrzygniete.forEach((c) =>
    bump(byBandera, c.statek_bandera || "brak danych", isWin(c)),
  );

  // --- UMOWY (konwencje PL-X) ---
  const byUmowa = {};
  rozstrzygniete.forEach((c) => {
    const kraj = extractTreatyCountry(c.przepisy_powolane);
    if (kraj) bump(byUmowa, kraj, isWin(c));
  });

  // --- PRZEPISY POWOŁANE ---
  const byPrzepis = {};
  rozstrzygniete.forEach((c) => {
    (c.przepisy_powolane || []).forEach((p) => bump(byPrzepis, p, isWin(c)));
  });

  // --- TRICKI (dopasowane heurystycznie do katalogu bareizmów) ---
  const byTrick = {}; // nr -> {poz, neg}
  rozstrzygniete.forEach((c) => {
    const nrs = detectTricksForCase(c, tricksTaxonomy);
    c._tricki_wykryte = nrs; // zapisujemy na sprawie, przyda się w kartach szczegółów
    nrs.forEach((nr) => bump(byTrick, nr, isWin(c)));
  });
  const trickiZTaksonomia = tricksTaxonomy
    .map((t) => ({
      nr: t.nr,
      nazwa: t.nazwa,
      blok: t.blok,
      nazwa_bloku: t.nazwa_bloku,
      kolor: t.kolor,
      poz: (byTrick[t.nr] || { poz: 0 }).poz,
      neg: (byTrick[t.nr] || { neg: 0 }).neg,
    }))
    .filter((t) => t.poz + t.neg > 0);

  // --- TREND MIESIĘCZNY ---
  const byMonth = {};
  rozstrzygniete.forEach((c) => {
    const month = (c.data_orzeczenia || "").slice(0, 7);
    if (!month) return;
    bump(byMonth, month, isWin(c));
  });
  const trendMiesieczny = Object.keys(byMonth)
    .sort()
    .map((m) => ({
      miesiac: m,
      poz: byMonth[m].poz,
      neg: byMonth[m].neg,
    }));

  // --- SERIE (te same daty + ten sam wynik + zbliżony typ statku) ---
  const seriesMap = {};
  rozstrzygniete.forEach((c) => {
    const key = `${c.data_orzeczenia}__${c.wynik_dla_marynarza}__${categorizeVessel(c.statek_typ)}`;
    if (!seriesMap[key]) {
      seriesMap[key] = {
        data: c.data_orzeczenia,
        wynik: c.wynik_dla_marynarza,
        statek: c.statek_typ,
        sprawy: [],
      };
    }
    seriesMap[key].sprawy.push(c.sygnatura);
  });
  const serie = Object.values(seriesMap).filter((s) => s.sprawy.length >= 2);

  // --- ROCZNE KPI (do porównań rok do roku) ---
  const lata = Object.keys(ogolemByYear).sort();
  const trendRoczny = lata.map((y) => ({
    rok: y,
    poz: ogolemByYear[y].poz,
    neg: ogolemByYear[y].neg,
    pct: pct(ogolemByYear[y].poz, ogolemByYear[y].neg),
  }));

  return {
    wszystkieSprawy: cases,
    sprawyRozstrzygniete: rozstrzygniete,
    ogolem: {
      n: totalPoz + totalNeg,
      poz: totalPoz,
      neg: totalNeg,
      pct: pct(totalPoz, totalNeg),
    },
    trendRoczny,
    sad: mapToArray(bySad, "sad"),
    miasta: mapToArray(byMiasto, "miasto"),
    statki: mapToArray(byStatek, "kategoria"),
    bandery: mapToArray(byBandera, "bandera"),
    umowy: mapToArray(byUmowa, "panstwo"),
    przepisy: mapToArray(byPrzepis, "przepis").sort(
      (a, b) => b.poz + b.neg - (a.poz + a.neg),
    ),
    tricki: trickiZTaksonomia,
    trickiTaksonomiaPelna: tricksTaxonomy,
    trend_miesieczny: trendMiesieczny,
    serie,
  };
}

function mapToArray(bucket, keyName) {
  return Object.keys(bucket)
    .map((k) =>
      Object.assign({
        [keyName]: k,
        poz: bucket[k].poz,
        neg: bucket[k].neg,
        pct: pct(bucket[k].poz, bucket[k].neg),
      }),
    )
    .sort((a, b) => b.poz + b.neg - (a.poz + a.neg));
}

// ===========================================================
// 7. PUNKT WEJŚCIA
// ===========================================================
async function initData() {
  const { cases, tricksTaxonomy } = await loadRawData();
  const agregaty = buildAggregates(cases, tricksTaxonomy);
  return agregaty;
}

// eksport do reszty modułów (render.js wywoła window.initData())
window.initData = initData;
window.__dataLoaderInternals = {
  categorizeVessel,
  extractTreatyCountry,
  detectTricksForCase,
  pct,
};
