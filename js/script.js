document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calculator-form");
  const input = document.getElementById("monto");
  const raw = document.getElementById("monto_raw");
  const btn = document.getElementById("calcular");
  const consorcio = document.getElementById("consorcio");
  const santander = document.getElementById("santander");
  const mercadoPago = document.getElementById("mercadoPago");
  const aproximado = document.getElementById("aproximado");
  const tenpo = document.getElementById("tenpo");

  // Evita submit por Enter "natural" del formulario
  form.addEventListener("submit", (e) => e.preventDefault());

  // Formato con puntos mientras escribe (solo dígitos)
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (!digits) {
      input.value = "";
      raw.value = "";
      return;
    }
    input.value = Number(digits).toLocaleString("es-CL");
    raw.value = digits; // valor numérico sin puntos
  });

  // Función principal de cálculo y render
  function calcular(e) {
    if (e) e.preventDefault();

    if (!input.value) {
      input.reportValidity(); // Muestra el mensaje nativo "Rellena este campo"
      return;
    }

    const monto = Number(raw.value);

    /* Leyenda de abreviaturas
       an   = anual
       mes  = mensual
       n    = neto (descontando comisión)
    */

    // Tasas de interés anual por institución
    const int_anual_consorcio = 0.0525; // 5.25% anual - Consorcio
    const int_anual_santander = 0.016; // 1.6% anual  - Santander
    const int_anual_mercadoPago = 0.046; // 4.6% anual  - Mercado Pago
    const int_anual_tenpo = 0.06; // 6% anual    - Tenpo

    // Comisiones fijas
    const com_consorcio = 3500; // Comisión anual Consorcio en CLP

    // Helper para CLP (sin decimales)
    const CLP = (n) => Math.round(n).toLocaleString("es-CL") + " CLP";

    // =====================
    // CÁLCULOS DE GANANCIAS
    // =====================

    // CONSORCIO
    const gan_consorcio_an = monto * int_anual_consorcio; // Ganancia anual bruta
    const gan_consorcio_mes = gan_consorcio_an / 12; // Ganancia mensual bruta
    const gan_consorcio_an_n = gan_consorcio_an - com_consorcio * 12; // Ganancia anual neta
    const gan_consorcio_mes_n = gan_consorcio_an / 12 - com_consorcio; // Ganancia mensual neta

    // SANTANDER
    const gan_santander_an = monto * int_anual_santander; // Ganancia anual bruta
    const gan_santander_mes = gan_santander_an / 12; // Ganancia mensual bruta

    // MERCADO PAGO
    const gan_mercadoPago_an = monto * int_anual_mercadoPago; // Ganancia anual bruta
    const gan_mercadoPago_mes = gan_mercadoPago_an / 12; // Ganancia mensual bruta

    // TENPO
    const gan_tenpo_an = monto * int_anual_tenpo; // Ganancia anual bruta
    const gan_tenpo_mes = gan_tenpo_an / 12; // Ganancia mensual bruta

    // =====================
    // MOSTRAR RESULTADOS
    // =====================
    consorcio.innerHTML = `
      <h2>Consorcio (Cuenta Más Digital)</h2>
      <p>Ganancia anual con comision: ${CLP(gan_consorcio_an)}</p>
      <p>Ganancia mensual con comision: ${CLP(gan_consorcio_mes)}</p>
      <hr>
      <p>Ganancia anual sin comision: ${CLP(gan_consorcio_an_n)}</p>
      <p>Ganancia mensual sin comision: ${CLP(gan_consorcio_mes_n)}</p>
      <hr>
      <p>Comisión anual aproximada ${CLP(com_consorcio * 12)}</p>
      <p>Comision mensual aproximada ${CLP(com_consorcio)}</p>
    `;

    santander.innerHTML = `
      <h2>Santander (Más Lucas)</h2>
      <p>Ganancia anual bruta: ${CLP(gan_santander_an)}</p>
      <p>Ganancia mensual bruta: ${CLP(gan_santander_mes)}</p>
    `;

    mercadoPago.innerHTML = `
      <h2>Mercado Pago</h2>
      <p>Ganancia anual bruta: ${CLP(gan_mercadoPago_an)}</p>
      <p>Ganancia mensual bruta: ${CLP(gan_mercadoPago_mes)}</p>
    `;

    tenpo.innerHTML = `
      <h2>Tenpo (Cuenta Remunerada)</h2>
      <p>Ganancia anual bruta: ${CLP(gan_tenpo_an)}</p>
      <p>Ganancia mensual bruta: ${CLP(gan_tenpo_mes)}</p>
    `;
    aproximado.innerHTML = `<p>*Los cálculos son aproximados y pueden variar según las condiciones de cada banco.</p>`;

    document.querySelectorAll(".calculo").forEach((div) => {
      div.style.display = "inline-block";
    });

    const main = document.querySelector("main");
    main.style.marginTop = "0";
  }

  // Click en el botón
  btn.addEventListener("click", calcular);

  // Enter o Espacio dentro del formulario, ejecuta calcular()
  form.addEventListener("keydown", (e) => {
    const isEnter = e.key === "Enter";
    const isSpace = e.key === " " || e.code === "Space" || e.key === "Spacebar";

    if (isEnter || isSpace) {
      e.preventDefault(); // evita submit o scroll

      // Ejecuta la función calcular
      calcular(e);

      // Simula el clic con efecto
      btn.classList.add("activo");
      btn.click();

      setTimeout(() => {
        btn.classList.remove("activo");
      }, 200);
    }
  });
});
