const DATA_URL = "data/latest.json";

const state = {
  payload: null
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;
}

function annualToMonthly(ratePercent) {
  const decimal = Number(ratePercent || 0) / 100;
  return (Math.pow(1 + decimal, 1 / 12) - 1) * 100;
}

function normalizeInput() {
  const input = document.getElementById("monto");
  const rawInput = document.getElementById("monto_raw");
  if (!input || !rawInput) return;

  const digits = input.value.replace(/\D/g, "");
  rawInput.value = digits;
  input.value = digits ? Number(digits).toLocaleString("es-CL") : "";
}

function readAmount() {
  return Number(document.getElementById("monto_raw")?.value || 0);
}

function updateHeaderMeta() {
  const payload = state.payload;
  if (!payload) return;

  const updatedAt = document.getElementById("ultima-actualizacion");
  const total = document.getElementById("total-productos");

  if (updatedAt) {
    updatedAt.textContent = new Date(payload.fecha).toLocaleString("es-CL");
  }

  if (total) {
    total.textContent = String((payload.productos || []).length);
  }
}

function mapProduct(product, amount) {
  const annualRate = Number(product.tasa?.anualEquivalente || product.tasa?.valor || 0);
  const monthlyRate = annualToMonthly(annualRate);
  const eligible = amount >= Number(product.minSaldo || 0);

  return {
    ...product,
    annualRate,
    monthlyRate,
    annualGain: amount * (annualRate / 100),
    monthlyGain: amount * (monthlyRate / 100),
    eligible
  };
}

function sortProducts(products) {
  return [...products].sort((left, right) => {
    if (left.eligible !== right.eligible) {
      return left.eligible ? -1 : 1;
    }

    return right.annualRate - left.annualRate;
  });
}

function renderWinner(products, amount) {
  const winner = products.find((product) => product.eligible);
  const winnerName = document.getElementById("winner-name");
  const winnerCopy = document.getElementById("winner-copy");
  const note = document.getElementById("aproximado");

  if (!winner) {
    if (winnerName) winnerName.textContent = "Aun no hay cuentas elegibles";
    if (winnerCopy) {
      winnerCopy.textContent = "Sube el monto para alcanzar los saldos minimos requeridos por las cuentas con abono de ganancias.";
    }
    if (note) {
      note.textContent = "La comparacion usa rentabilidad publica bruta. Algunas instituciones exigen saldo minimo para empezar a generar ganancias.";
    }
    return;
  }

  if (winnerName) {
    winnerName.textContent = winner.institucion;
  }

  if (winnerCopy) {
    winnerCopy.textContent = `${winner.nombre} lidera para ${formatCurrency(amount)} con una tasa anual equivalente publica de ${formatPercent(winner.annualRate)} y una ganancia anual estimada de ${formatCurrency(winner.annualGain)}.`;
  }

  if (note) {
    note.textContent = state.payload?.criterios?.ranking || "";
  }
}

function renderProductCard(product, index) {
  const notes = (product.notas || [])
    .map((note) => `<li>${note}</li>`)
    .join("");

  const ineligiblePill = product.eligible
    ? `<span class="pill pill--good">Monto elegible</span>`
    : `<span class="pill pill--warn">Requiere ${formatCurrency(product.minSaldo || 0)}</span>`;

  return `
    <article class="card ${index === 0 && product.eligible ? "card--winner" : ""} ${product.eligible ? "" : "card--ineligible"}">
      <div class="card__top">
        <div>
          <p class="card__bank">${product.institucion}</p>
          <p class="card__product">${product.nombre}</p>
        </div>
        <span class="card__rank">${index + 1}</span>
      </div>

      <div class="pill-row">
        <span class="pill">${formatPercent(product.annualRate)} anual</span>
        <span class="pill">${product.abono}</span>
        ${ineligiblePill}
      </div>

      <dl class="metrics">
        <div>
          <dt>Ganancia anual</dt>
          <dd>${formatCurrency(product.annualGain)}</dd>
        </div>
        <div>
          <dt>Ganancia mensual</dt>
          <dd>${formatCurrency(product.monthlyGain)}</dd>
        </div>
        <div>
          <dt>Saldo minimo</dt>
          <dd>${formatCurrency(product.minSaldo || 0)}</dd>
        </div>
        <div>
          <dt>Mantencion</dt>
          <dd>${product.costoMantencion}</dd>
        </div>
      </dl>

      <p class="card__meta">
        Liquidez: ${product.liquidez}. Fuente capturada: ${product.fuente?.detalle || "No informada"}.
      </p>

      <ul class="card__notes">${notes}</ul>
      <a class="card__source" href="${product.fuente?.url || "#"}" target="_blank" rel="noreferrer">Ver fuente oficial</a>
    </article>
  `;
}

function renderRanking(products) {
  const container = document.getElementById("ranking-grid");
  if (!container) return;

  container.innerHTML = products.map(renderProductCard).join("");
}

function renderTable(products) {
  const table = document.getElementById("results-table");
  if (!table) return;

  table.innerHTML = products
    .map((product) => {
      return `
        <tr>
          <td class="table-bank">${product.institucion}</td>
          <td>${formatPercent(product.annualRate)}</td>
          <td>${formatCurrency(product.annualGain)}</td>
          <td>${formatCurrency(product.monthlyGain)}</td>
          <td>${formatCurrency(product.minSaldo || 0)}</td>
          <td>${product.abono}</td>
        </tr>
      `;
    })
    .join("");
}

function renderObserved() {
  const container = document.getElementById("observed-grid");
  if (!container) return;

  const observed = state.payload?.observados || [];
  container.innerHTML = observed
    .map((item) => {
      const links = (item.fuentes || [])
        .map((source) => {
          return `<div><a href="${source.url}" target="_blank" rel="noreferrer">${source.titulo}</a></div>`;
        })
        .join("");

      return `
        <article class="observed-card">
          <p class="eyebrow">${item.institucion}</p>
          <h3>${item.nombre}</h3>
          <p>${item.detalle}</p>
          ${links}
        </article>
      `;
    })
    .join("");
}

function render() {
  const amount = readAmount();
  if (!state.payload || !(amount > 0)) return;

  const products = sortProducts(
    (state.payload.productos || []).map((product) => mapProduct(product, amount))
  );

  renderWinner(products, amount);
  renderRanking(products);
  renderTable(products);
  renderObserved();
}

async function loadData() {
  const response = await fetch(`${DATA_URL}?ts=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${DATA_URL}: HTTP ${response.status}`);
  }

  state.payload = await response.json();
  updateHeaderMeta();
  renderObserved();
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("calculator-form");
  const amountInput = document.getElementById("monto");
  const button = document.getElementById("calcular");

  form?.addEventListener("submit", (event) => event.preventDefault());
  amountInput?.addEventListener("input", normalizeInput);
  amountInput?.addEventListener("change", normalizeInput);

  button?.addEventListener("click", () => {
    if (!(readAmount() > 0)) {
      amountInput?.reportValidity();
      return;
    }
    render();
  });

  form?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      button?.click();
    }
  });

  try {
    await loadData();
    render();
  } catch (error) {
    const note = document.getElementById("aproximado");
    if (note) {
      note.textContent = "No se pudieron cargar los datos del comparador.";
    }
    console.error(error);
  }
});
