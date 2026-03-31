# Comparador de Cuentas Remuneradas Chile

Comparador web para estimar que cuenta remunerada o cuenta digital conviene mas segun un monto dado, usando solo informacion publica verificable.

## Link directo

- https://sebastianarb.github.io/calculadora-gananciabancos-v2/

## Que compara hoy

- Copec Pay - Mis Ganancias
- MACH Premium - Ahorro 24/7
- Consorcio - Cuenta Mas Digital
- MACH - Ahorro 24/7
- Tenpo - Cuenta Remunerada
- Santander - Cuenta Vista Mas Lucas
- Banco de Chile - Cuenta FAN Ahorro

## Productos observados fuera del ranking automatico

- Mercado Pago

Estos productos aparecen informados en el sitio, pero sin un numero publico fijo y estable que permita compararlos automaticamente de forma honesta.

## Como funciona

- El scraper genera `data/latest.json` y un snapshot mensual en `data/YYYY-MM.json`.
- La interfaz ordena las cuentas por rentabilidad publica anual equivalente.
- Si una cuenta exige saldo minimo, se marca como no elegible para montos menores.
- Las notas de cada tarjeta explican restricciones, formas de abono y alertas importantes.
- Si una fuente publica se bloquea o falla temporalmente, el scraper la mueve a observados para no romper toda la actualizacion mensual.

## Actualizacion automatica

El workflow de GitHub Actions ejecuta el scraper una vez al mes y publica cambios en `data/*.json`.

## Ejecutar el scraper

```bash
npm install
npm run scrap
```
