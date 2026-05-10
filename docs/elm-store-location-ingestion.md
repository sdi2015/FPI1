# ELM Store Location Ingestion

## Important Access Note

This project does not include credentials or browser session access for Confluence or ELM. The frontend should not scrape or directly authenticate into ELM from the client. Export ELM store-location data through an approved process, then ingest the exported CSV/JSON file locally.

## Expected Fields

Minimum required fields:

- Store/facility number
- Address
- Latitude
- Longitude

Accepted aliases include:

- Store number: `store_number`, `storeNumber`, `store_num`, `store`, `number`, `facility_number`, `facility_id`, `Location`
- Latitude: `latitude`, `lat`, `Latitude`, `LATITUDE`
- Longitude: `longitude`, `lng`, `lon`, `Longitude`, `LONGITUDE`
- Address: `address`, `Address`, `street_address`, `streetAddress`
- City/state: `city`, `City`, `state`, `State`

## Ingest Commands

For XLSX exports like `Locations_Master_Status_v7_GOOGLE_COLORIZED.xlsx`:

```bash
npm run ingest:elm-locations:xlsx -- C:\path\to\Locations_Master_Status_v7_GOOGLE_COLORIZED.xlsx
```

The XLSX ingester reads the `All_Verified` sheet by default. You can pass a different sheet as the second argument.

For CSV exports:

```bash
npm run ingest:elm-locations -- C:\path\to\elm-store-locations.csv
```

For JSON exports:

```bash
npm run ingest:elm-locations -- C:\path\to\elm-store-locations.json
```

The command:

1. Normalizes the ELM location export.
2. Writes browser-readable locations to:

```text
public/data/elm-store-locations.json
```

3. Enriches the FPI canonical master data with latitude/longitude when the store number matches:

```text
public/data/fpi-canonical-master.json
```

## Aviation Integration

Aviation facility scans now attempt to merge:

1. Live facility API, if enabled.
2. FPI canonical facilities joined to ELM store locations.
3. Existing seeded aviation facilities.

Relevant files:

```text
src/services/elmStoreLocationService.ts
src/services/facilityDataAdapter.ts
src/data/fpiRawTypes.ts
src/data/fpiTypes.ts
src/data/fpiAdapter.ts
tools/ingest-elm-store-locations.mjs
tools/ingest_elm_store_locations_xlsx.py
```

## Current Ingestion Result

The following approved local workbook was ingested:

```text
C:\Users\j0w16ja\OneDrive - Walmart Inc\Desktop\ELM\Locations_Master_Status_v7_GOOGLE_COLORIZED.xlsx
```

Result:

- 5,266 ELM location rows written to `public/data/elm-store-locations.json`
- 10 matching FPI canonical facilities enriched in `public/data/fpi-canonical-master.json`
- Aviation facility scans now load the ELM store-location inventory in addition to seeded demo facilities and FPI-enriched locations
- FPI Command Center now merges the full ELM store-location inventory into its facility profiles at runtime
- FPI overview metrics now surface ELM location count, geocoded facility count, and ELM review-priority pin count
- FPI facility detail now displays ELM address, coordinates, source, final status, priority, notes, and Google validation status when available


If `public/data/elm-store-locations.json` is absent, Aviation continues to use the existing seeded facility data.

## Example Format

See:

```text
public/data/elm-store-locations.example.json
```
