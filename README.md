# Comparador de Cuentas Remuneradas Chile

Comparador web para estimar que cuenta remunerada o cuenta digital conviene mas segun un monto dado, usando solo informacion publica verificable.

## Link directo

- https://sebastianarb.github.io/calculadora-gananciabancos-v2/

## Que compara hoy

- Copec Pay - Mis Ganancias
- Consorcio - Cuenta Mas Digital
- Tenpo - Cuenta Remunerada
- Santander - Cuenta Vista Mas Lucas

## Productos observados fuera del ranking automatico

- Mercado Pago
- Banco de Chile - Cuenta FAN Ahorro

Estos productos aparecen informados en el sitio, pero sin un numero publico fijo y estable que permita compararlos automaticamente de forma honesta.

## Como funciona

- El scraper genera `data/latest.json` y un snapshot mensual en `data/YYYY-MM.json`.
- La interfaz ordena las cuentas por rentabilidad publica anual equivalente.
- Si una cuenta exige saldo minimo, se marca como no elegible para montos menores.
- Las notas de cada tarjeta explican restricciones, formas de abono y alertas importantes.

## Actualizacion automatica

El workflow de GitHub Actions ejecuta el scraper una vez al mes y publica cambios en `data/*.json`.

## Ejecutar el scraper

```bash
npm install
npm run scrap
```
