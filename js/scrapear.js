// js/scrapear.js  (o scripts/scrapear.js si esa es tu ruta)
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config", "fuentes.json");
const DATA_DIR = path.join(ROOT, "data");

// --- helpers ---

async function extractByRegexFromAll(page, selector, fuente) {
  const textos = await page.$$eval(selector, (nodes) =>
    nodes.map((n) => (n.textContent || "").trim())
  );
  const re = new RegExp(fuente.regex);
  for (const txt of textos) {
    const m = re.exec(txt);
    if (m) {
      const numero = m[1].replace(",", ".").replace("%", "");
      const n = Number(numero);
      if (Number.isFinite(n)) {
        return { texto: txt, valor: n };
      }
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const limpiar = (t = "") =>
  t
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseValue(texto, fuente) {
  // Para number_* normalizo a punto decimal
  const t = limpiar(texto).replace(/\./g, "").replace(/,/g, ".");

  if (fuente.parse === "regex_percent") {
    if (!fuente.regex) throw new Error(`Falta 'regex' en ${fuente.id}`);
    const re = new RegExp(fuente.regex);
    const m = re.exec(texto); // uso texto crudo para que matchee tal cual
    if (!m) return null;
    const numero = m[1].replace(",", ".").replace("%", "");
    const n = Number(numero);
    return Number.isFinite(n) ? n : null;
  }

  if (fuente.parse === "number_percent" || fuente.parse === "number_decimal") {
    const m = t.match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  const n = Number(t.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function scrapear(page, fuente, intento = 1) {
  const MAX_INT = 3;
  try {
    await page.goto(fuente.url, { waitUntil: "networkidle2", timeout: 60000 });

    // 👇 Abrir acordeones si la fuente lo pide
    if (fuente.preClickAll) {
      try {
        await page.waitForSelector(fuente.preClickAll, { timeout: 5000 });
        const titles = await page.$$(fuente.preClickAll);
        for (const t of titles) {
          await t.click();
          await sleep(50);
        }
      } catch (_) {
        // si no existe el selector, seguimos normal
      }
    }

    // Esperar el selector principal
    await page.waitForSelector(fuente.selector, { timeout: 30000 });

    // 🔎 Caso especial: regex_percent + searchAll => revisar TODOS los nodos del selector
    if (fuente.parse === "regex_percent" && fuente.searchAll) {
      const encontrado = await extractByRegexFromAll(
        page,
        fuente.selector,
        fuente
      );
      if (encontrado) {
        console.log(`✔ ${fuente.id}:`, encontrado.valor);
        return {
          id: fuente.id,
          valor: encontrado.valor,
          raw: limpiar(encontrado.texto),
          fuente: fuente.url,
        };
      }
      // si no encontró en varios, seguimos con el elemento principal
    }

    // Leer texto del primer match del selector (modo normal)
    const texto = await page.$eval(
      fuente.selector,
      (el, attr) => (attr ? el.getAttribute(attr) : el.textContent),
      fuente.attr || null
    );

    const valor = parseValue(texto, fuente);
    if (valor === null || Number.isNaN(valor)) {
      throw new Error(`No pude parsear ${fuente.id} desde "${limpiar(texto)}"`);
    }

    console.log(`✔ ${fuente.id}:`, valor);
    return { id: fuente.id, valor, raw: limpiar(texto), fuente: fuente.url };
  } catch (e) {
    console.warn(`Intento ${intento} falló para ${fuente.id}: ${e.message}`);
    if (intento < MAX_INT) {
      await sleep(1200 * intento);
      return scrapear(page, fuente, intento + 1);
    }
    throw e;
  }
}

function validar(entries) {
  for (const e of entries) {
    if (!Number.isFinite(e.valor)) throw new Error(`Valor inválido en ${e.id}`);
    if (e.valor < 0) throw new Error(`Valor negativo en ${e.id}`);
  }
}

async function main() {
  const fuentes = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  const browser = await puppeteer.launch({
    headless: true, // en versiones nuevas usa true/false
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  const resultados = [];
  for (const f of fuentes) {
    const r = await scrapear(page, f);
    resultados.push(r);
  }

  await browser.close();

  validar(resultados);

  const now = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
  const mes = dayjs().format("YYYY-MM");
  const payload = { fecha: now, mes, datos: resultados };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  fs.writeFileSync(
    path.join(DATA_DIR, `${mes}.json`),
    JSON.stringify(payload, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, `latest.json`),
    JSON.stringify(payload, null, 2)
  );

  console.log(`\n✅ Guardado en data/latest.json y data/${mes}.json`);
}

main().catch((err) => {
  console.error("❌ ERROR:", err.message);
  process.exit(1);
});
