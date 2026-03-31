import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config", "fuentes.json");
const DATA_DIR = path.join(ROOT, "data");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value = "") {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function parseValue(rawText, source) {
  const text = cleanText(rawText);
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");

  if (source.parse === "regex_percent") {
    const match = new RegExp(source.regex).exec(text);
    if (!match) return null;
    const numeric = Number(match[1].replace(",", ".").replace("%", ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (source.parse === "number_percent" || source.parse === "number_decimal") {
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const numeric = Number(match[0]);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const numeric = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

async function extractByRegexFromNodes(page, selector, source) {
  const texts = await page.$$eval(selector, (nodes) =>
    nodes.map((node) => (node.textContent || "").trim())
  );
  const regex = new RegExp(source.regex);

  for (const text of texts) {
    const match = regex.exec(text);
    if (!match) continue;

    const value = Number(match[1].replace(",", ".").replace("%", ""));
    if (Number.isFinite(value)) {
      return {
        rawText: cleanText(text),
        value
      };
    }
  }

  return null;
}

async function extractByRegexFromBody(page, source) {
  const text = await page.evaluate(() => document.body?.innerText || "");
  const cleaned = cleanText(text);
  const regex = new RegExp(source.regex);
  const match = regex.exec(cleaned);

  if (!match) return null;

  const value = Number(match[1].replace(",", ".").replace("%", ""));
  if (!Number.isFinite(value)) return null;

  return {
    rawText: cleanText(match[0]),
    value
  };
}

function annualEquivalentPercent(value, period) {
  if (!Number.isFinite(value)) return null;
  const decimal = value / 100;

  if (period === "monthly") {
    return (Math.pow(1 + decimal, 12) - 1) * 100;
  }

  if (period === "daily") {
    return (Math.pow(1 + decimal, 365) - 1) * 100;
  }

  return value;
}

function buildProduct(source, value, rawText) {
  return {
    id: source.id,
    nombre: source.nombre,
    institucion: source.institucion,
    tipoCuenta: source.tipoCuenta,
    estado: "verificado_publico",
    comparar: source.compare !== false,
    tasa: {
      valor: value,
      periodo: source.ratePeriod,
      unidad: "percent",
      anualEquivalente: annualEquivalentPercent(value, source.ratePeriod),
      textoFuente: cleanText(rawText)
    },
    minSaldo: source.minBalance || 0,
    abono: source.payout || "no informado",
    liquidez: source.availability || "No informada",
    costoMantencion: source.maintenance || "No informado",
    notas: source.notes || [],
    fuente: {
      titulo: source.sourceTitle || source.nombre,
      url: source.url,
      detalle: cleanText(rawText)
    }
  };
}

async function scrapeProduct(page, source, attempt = 1) {
  const maxAttempts = 3;

  try {
    await page.goto(source.url, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    if (source.preClickAll) {
      try {
        await page.waitForSelector(source.preClickAll, { timeout: 5000 });
        const nodes = await page.$$(source.preClickAll);
        for (const node of nodes) {
          await node.click();
          await sleep(80);
        }
      } catch {
        // Ignore optional expanders.
      }
    }

    if (source.selector) {
      await page.waitForSelector(source.selector, { timeout: 30000 });
    }

    let extracted = null;

    if (source.parse === "regex_percent" && source.readBody) {
      extracted = await extractByRegexFromBody(page, source);
    } else if (source.parse === "regex_percent" && source.searchAll) {
      extracted = await extractByRegexFromNodes(page, source.selector, source);
    }

    if (!extracted) {
      const rawText = source.readBody
        ? await page.evaluate(() => document.body?.innerText || "")
        : await page.$eval(
            source.selector,
            (element, attr) => (attr ? element.getAttribute(attr) : element.textContent),
            source.attr || null
          );

      const value = parseValue(rawText, source);
      if (value === null || Number.isNaN(value)) {
        throw new Error(`No pude parsear ${source.id}`);
      }

      extracted = {
        rawText: cleanText(rawText),
        value
      };
    }

    console.log(`OK ${source.id}: ${extracted.value}`);
    return buildProduct(source, extracted.value, extracted.rawText);
  } catch (error) {
    console.warn(`Intento ${attempt} fallo para ${source.id}: ${error.message}`);
    if (attempt < maxAttempts) {
      await sleep(1200 * attempt);
      return scrapeProduct(page, source, attempt + 1);
    }
    throw error;
  }
}

function validateProducts(products) {
  for (const product of products) {
    if (!Number.isFinite(product.tasa?.valor)) {
      throw new Error(`Valor invalido en ${product.id}`);
    }

    if (product.tasa.valor < 0) {
      throw new Error(`Valor negativo en ${product.id}`);
    }
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  const products = [];
  for (const source of config.productos) {
    const product = await scrapeProduct(page, source);
    products.push(product);
  }

  await browser.close();

  validateProducts(products);

  const now = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
  const month = dayjs().format("YYYY-MM");

  products.sort((left, right) => {
    return (right.tasa?.anualEquivalente || 0) - (left.tasa?.anualEquivalente || 0);
  });

  const payload = {
    fecha: now,
    mes: month,
    criterios: {
      ranking: "La comparacion usa rentabilidad bruta publica anual equivalente y no descuenta condiciones personalizadas ni comisiones variables."
    },
    productos: products,
    observados: config.observados || []
  };

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, `${month}.json`),
    JSON.stringify(payload, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "latest.json"),
    JSON.stringify(payload, null, 2)
  );

  console.log(`Guardado en data/latest.json y data/${month}.json`);
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
