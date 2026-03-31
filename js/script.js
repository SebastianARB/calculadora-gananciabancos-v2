const DATA_URL = "data/latest.json";

const IDS = {
  consorcioAnual: "tasa_consorcio_anual",
  santanderAnual: "tasa_santander_anual",
  tenpoDiaria: "tasa_tenpo_diaria"
};

const state = {
  tasas: null
};

function clp(value) {
  return Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  });
}

function percent(value) {
  return `${(value * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function annualToMonthly(rate) {
  return Math.pow(1 + rate, 1 / 12) - 1;
}

function dailyToMonthly(rate, days = 30) {
  return Math.pow(1 + rate, days) - 1;
}

function dailyToAnnual(rate, days = 365) {
  return Math.pow(1 + rate, days) - 1;
}

function renderCard(targetId, title, annualRate, monthlyRate, capital, sourceUrl) {
  const node = document.getElementById(targetId);
  if (!node) return;

  const annualGain = capital * annualRate;
  const monthlyGain = capital * monthlyRate;

  node.innerHTML = `
    <h2>${title}</h2>
    <p>Tasa anual estimada: ${percent(annualRate)}</p>
    <p>Tasa mensual estimada: ${percent(monthlyRate)}</p>
    <p>Ganancia anual estimada: ${clp(annualGain)}</p>
    <p>Ganancia mensual estimada: ${clp(monthlyGain)}</p>
    <p><a href="${sourceUrl}" target="_blank" rel="noreferrer">Ver fuente</a></p>
  `;
  node.style.display = "inline-block";
}

function renderUnavailableCard() {
  const node = document.getElementById("mercadoPago");
  if (!node) return;

  node.innerHTML = `
    <h2>Mercado Pago</h2>
    <p>Sin tasa automática disponible en esta versión.</p>
    <p>La calculadora se está alimentando solo con las instituciones presentes en <code>data/latest.json</code>.</p>
  `;
  node.style.display = "inline-block";
}

async function loadRates() {
  const response = await fetch(`${DATA_URL}?ts=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${DATA_URL}: HTTP ${response.status}`);
  }

  const json = await response.json();
  const values = Object.fromEntries((json.datos || []).map((item) => [item.id, item]));

  const consorcioAnnual = (values[IDS.consorcioAnual]?.valor || 0) / 100;
  const santanderAnnual = (values[IDS.santanderAnual]?.valor || 0) / 100;
  const tenpoDaily = (values[IDS.tenpoDiaria]?.valor || 0) / 100;

  state.tasas = {
    fecha: json.fecha,
    consorcio: {
      annual: consorcioAnnual,
      monthly: annualToMonthly(consorcioAnnual),
      source: values[IDS.consorcioAnual]?.fuente || "#"
    },
    santander: {
      annual: santanderAnnual,
      monthly: annualToMonthly(santanderAnnual),
      source: values[IDS.santanderAnual]?.fuente || "#"
    },
    tenpo: {
      annual: dailyToAnnual(tenpoDaily),
      monthly: dailyToMonthly(tenpoDaily),
      source: values[IDS.tenpoDiaria]?.fuente || "#"
    }
  };
}

function updateTimestamp() {
  const node = document.getElementById("ultima-actualizacion");
  if (!node || !state.tasas?.fecha) return;

  node.textContent = `Última actualización de datos: ${new Date(state.tasas.fecha).toLocaleString("es-CL")}`;
}

function readCapital() {
  const raw = document.getElementById("monto_raw")?.value || "";
  return Number(raw || 0);
}

function renderResults() {
  const capital = readCapital();
  const note = document.getElementById("aproximado");

  if (!(capital > 0) || !state.tasas) {
    if (note) note.textContent = "";
    return;
  }

  renderCard("consorcio", "Consorcio", state.tasas.consorcio.annual, state.tasas.consorcio.monthly, capital, state.tasas.consorcio.source);
  renderCard("santander", "Santander", state.tasas.santander.annual, state.tasas.santander.monthly, capital, state.tasas.santander.source);
  renderCard("tenpo", "Tenpo", state.tasas.tenpo.annual, state.tasas.tenpo.monthly, capital, state.tasas.tenpo.source);
  renderUnavailableCard();

  if (note) {
    note.textContent = "Los cálculos son estimados y pueden variar según condiciones, topes y cambios de cada institución.";
  }
}

function formatInput() {
  const input = document.getElementById("monto");
  const raw = document.getElementById("monto_raw");
  if (!input || !raw) return;

  const digits = input.value.replace(/\D/g, "");
  raw.value = digits;
  input.value = digits ? Number(digits).toLocaleString("es-CL") : "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("calculator-form");
  const input = document.getElementById("monto");
  const button = document.getElementById("calcular");

  form?.addEventListener("submit", (event) => event.preventDefault());

  input?.addEventListener("input", formatInput);

  button?.addEventListener("click", () => {
    if (!readCapital()) {
      input?.reportValidity();
      return;
    }
    renderResults();
  });

  form?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      button?.click();
    }
  });

  try {
    await loadRates();
    updateTimestamp();
  } catch (error) {
    const note = document.getElementById("aproximado");
    if (note) {
      note.textContent = "No se pudieron cargar las tasas automáticas.";
    }
    console.error(error);
  }
});
