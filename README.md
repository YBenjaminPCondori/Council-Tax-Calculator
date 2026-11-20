# Newham Council Tax Reduction Calculator

A browser calculator for the 2026–27 working-age scenario. The React interface accepts a Council Tax band, employment figures, and recurring benefit payments. Supply a weekly applicable amount and, if there are assessable earnings, a weekly earnings disregard from an assessment or a scenario you want to test. The estimate uses Newham’s full band charge and assumes a £0 non-dependant deduction. Newham Council determines the final award.

## Run locally

Use Node.js 20.19+ on the 20.x line or Node.js 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The blue theme starts in light or dark mode based on your device setting. Use the switch in the header to choose a mode. The browser remembers that choice locally. Calculator figures are processed in memory and clear on reload. The app uses no accounts, APIs or analytics. For a production build, run `npm run build` and serve `dist/` with a static web server. `npm run preview` serves that build locally.

## Map visualizer

Open **Map visualizer** in the main navigation to explore the 50-metre Carrack Mews study area. Select Woolspinners House or Softwood House and choose a flat. **Use Band … in calculator** fills the band field while preserving the other figures you entered. Both views use the same build from the repository root.

Edit the map bands in `band-map/public/council-tax-bands.json`. The map marks its flat outlines as approximate and its room counts as examples. See the [map details and sources](band-map/README.md).

## Engine and verification

- `src/engine/calculate.ts` exports the independently testable `calculate(input)` and `toWeekly(amount, frequency)` functions. The result is either a complete estimate or an insufficient-information result with reasons and any known intermediates. Invalid input raises a `CalculationInputError` with a field identifier.
- `src/engine/policy.ts` holds the year-specific band charges, rates and benefit treatments. `src/engine/money.ts` handles exact arithmetic and money display.
- Run `npm test` for the synthetic scenarios and the cross-check against Newham’s Band C ready reckoner.
- See the [mathematical specification and source mapping](docs/calculation-specification.md) for formulas, policy references, rounding and missing rules.
