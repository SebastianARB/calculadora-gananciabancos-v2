// ===============================
// script.js - Calculadora Bancos
// ===============================

// --- Config: IDs que vienen del scraper (data/latest.json) ---
const IDS = {
  consorcioAnual: "tasa_consorcio_anual",   // % anual
  santanderAnual: "tasa_santander_anual",   // % anual
  tenpoDiaria: "tasa_tenpo_diaria"          // % diaria
};

// --- Ruta al JSON (ajusta si tu build cambia la carpeta) ---
const DATA_URL = "data/latest.json";

// --- Debug opcional: se activa en localhost ---
const DEBUG = location.hostname === "localhost";
const dlog = (...a) => { if (DEBUG) console.log(...a); };

// --- Utilidades numéricas ---
const pctAdecimal     = (p) => (p ?? 0) / 100;                 // 5.25 -> 0.0525
const diariaA_mensual = (rDia, dias = 30)  => Math.pow(1 + rDia, dias) - 1;
const diariaA_anual   = (rDia, dias = 365) => Math.pow(1 + rDia, dias) - 1;
const anualA_mensual  = (rAnual)           => Math.pow(1 + rAnual, 1 / 12) - 1;
const mensualA_anual  = (rMensual)         => Math.pow(1 + rMensual, 12) - 1;

function formatoCLP(n) {
  try {
    return Number(n).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    });
  } catch {
    return Math.round(Number(n) || 0).toString();
  }
}
function setTexto(sel, val) { const el = document.querySelector(sel); if (el) el.textContent = val; }
function pintaTasa(selector, rDecimal, etiqueta = "") {
  const el = document.querySelector(selector);
  if (!el) return;
  const pct = (rDecimal * 100).toFixed(4).replace(/\.?0+$/, ""); // 0.0525 -> "5.25"
  el.textContent = etiqueta ? `${pct}% ${etiqueta}` : `${pct}%`;
}
function debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
}

// --- Estado global (tasas en DECIMAL, listas para operar) ---
window.TASAS = {
  consorcio: { anual: 0, mensual: 0 },
  santander: { anual: 0, mensual: 0 },
  tenpo:     { diaria: 0, mensual: 0, anual: 0 }
};

// --- Carga de tasas desde data/latest.json ---
async function cargarTasas() {
  const url = `${DATA_URL}?ts=${Date.now()}`; // cache-busting
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    dlog("[latest.json]", json);

    if (!json || !Array.isArray(json.datos)) throw new Error("JSON inválido: falta 'datos[]'.");

    const mapa = Object.fromEntries(json.datos.map(d => [d.id, d.valor])); // valores en %
    dlog("[mapa ids→%]", mapa);

    // 1) Pasar a decimal
    const consorcioAnualDec = pctAdecimal(mapa[IDS.consorcioAnual]); // 5.25 -> 0.0525
    const santanderAnualDec = pctAdecimal(mapa[IDS.santanderAnual]); // 1.92 -> 0.0192
    const tenpoDiariaDec    = pctAdecimal(mapa[IDS.tenpoDiaria]);    // 0.0167 -> 0.000167

    // 2) Derivados útiles
    const consorcioMensualDec = anualA_mensual(consorcioAnualDec);
    const santanderMensualDec = anualA_mensual(santanderAnualDec);
    const tenpoMensualDec     = diariaA_mensual(tenpoDiariaDec, 30);
    const tenpoAnualDec       = diariaA_anual(tenpoDiariaDec, 365);

    // 3) Guardar en estado global
    window.TASAS = {
      consorcio: { anual: consorcioAnualDec, mensual: consorcioMensualDec },
      santander: { anual: santanderAnualDec, mensual: santanderMensualDec },
      tenpo:     { diaria: tenpoDiariaDec, mensual: tenpoMensualDec, anual: tenpoAnualDec }
    };
    dlog("[TASAS decimales]", window.TASAS);

    // 4) Pintar en UI si existen esos nodos
    pintaTasa("#tasa-consorcio-anual", consorcioAnualDec, "anual");
    pintaTasa("#tasa-consorcio-mensual", consorcioMensualDec, "mensual");
    pintaTasa("#tasa-santander-anual", santanderAnualDec, "anual");
    pintaTasa("#tasa-santander-mensual", santanderMensualDec, "mensual");
    pintaTasa("#tasa-tenpo-diaria", tenpoDiariaDec, "diaria");
    pintaTasa("#tasa-tenpo-mensual", tenpoMensualDec, "mensual");

    const $fecha = document.querySelector("#ultima-actualizacion");
    if ($fecha) $fecha.textContent = new Date(json.fecha).toLocaleString("es-CL");

  } catch (err) {
    console.error("No se pudo cargar data/latest.json:", err);
    // Fallback opcional: puedes setear valores por defecto aquí si quieres
  }
}

// --- Cálculo de ganancia ---
function calcularGanancia({ compuesto = true } = {}) {
  const capital = Number(document.querySelector("#monto")?.value || 0);
  const meses   = Number(document.querySelector("#meses")?.value || 1);
  const banco   = document.querySelector("#producto")?.value || "tenpo";

  if (!(capital > 0) || !(meses > 0)) {
    setTexto("#resultado-monto-final", "");
    setTexto("#resultado-interes", "");
    setTexto("#resultado-tasa-mensual", "");
    return { final: 0, interes: 0 };
  }

  const rMensual = window.TASAS?.[banco]?.mensual ?? 0;
  if (!(rMensual > 0)) {
    setTexto("#resultado-monto-final", "—");
    setTexto("#resultado-interes", "—");
    setTexto("#resultado-tasa-mensual", "—");
    return { final: 0, interes: 0 };
  }

  const final = compuesto
    ? capital * Math.pow(1 + rMensual, meses)   // Interés compuesto
    : capital * (1 + rMensual * meses);         // Interés simple

  const interes = final - capital;

  setTexto("#resultado-monto-final", formatoCLP(final));
  setTexto("#resultado-interes",     formatoCLP(interes));
  setTexto("#resultado-tasa-mensual", `${(rMensual * 100).toFixed(4).replace(/\.?0+$/, "")}%`);

  return { final, interes };
}

// --- Inicialización / eventos ---
document.addEventListener("DOMContentLoaded", async () => {
  await cargarTasas();

  const recalcular = debounce(() => calcularGanancia({ compuesto: true }), 200);

  document.querySelector("#calcular")?.addEventListener("click", () => {
    calcularGanancia({ compuesto: true });
  });

  ["#monto", "#meses", "#producto"].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("input", recalcular);
    if (el) el.addEventListener("change", recalcular);
  });

  // Calcula una vez al cargar
  calcularGanancia({ compuesto: true });
});


