# Carrack Mews Council Tax bands

This local browser MVP shows the two target buildings in a north-up site map and a rotatable 3D view.

Run the app from the repository root as described in the [main launch guide](../README.md#run-locally), then open **Map visualizer**.

## Explore

Select Woolspinners House or Softwood House. Use **Use Band … in calculator** to carry a selected flat’s band into the calculator. Move your pointer over a flat in the cutaway to light its interior in its Council Tax band colour. The flat number buttons also respond to keyboard focus. Click or tap a flat to open its full address, band and example room counts. Drag to orbit, scroll to zoom, or use the zoom buttons. **Front view** faces the buildings from Gallions Road. Use **Map** to return to the 50-metre study area centred on the E16 2EG postcode reference point.

Flat 8 at Woolspinners House opens a property evidence viewer with the official Band F listing and EPC. The unmeasured 3D shell and floor outline are illustrative, and Effective Floor Area stays pending until a measured plan is supplied.

## Edit the bands

Edit `band-map/public/council-tax-bands.json` from the repository root. A production build copies it to `dist/council-tax-bands.json`. The building keys are `woolspinners` and `softwood`. Each contains one value for each flat number from 1 to 14. Use A–H, or `null` for an unknown band.

## Sources and model limits

- Bands and floor numbering follow the supplied valuation data and layout. The postcode centre is from [Postcodes.io](https://api.postcodes.io/postcodes/E162EG).
- Map context contains data from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under the ODbL. The building footprints are approximate outlines aligned to the aerial reference and the surrounding mapped street network.
- The attached street-level and aerial collage informed the procedural façade, roof, entrance and site geometry. Window and balcony spacing, façade depth, rear elevations and flat outlines are approximate. Room and bedroom counts are fictional examples defined in `src/data.ts`.
- A WebGL-capable browser displays the 3D model. A front elevation with flat selection is available when WebGL cannot start.
