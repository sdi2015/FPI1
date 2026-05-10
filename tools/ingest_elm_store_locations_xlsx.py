import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

INPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else None
SHEET_NAME = sys.argv[2] if len(sys.argv) > 2 else 'All_Verified'
PUBLIC_OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path('public/data/elm-store-locations.json')
MASTER_PATH = Path(sys.argv[4]) if len(sys.argv) > 4 else Path('public/data/fpi-canonical-master.json')

if not INPUT:
    print('Usage: python tools/ingest_elm_store_locations_xlsx.py <xlsx> [sheet] [public-out-json] [master-json]', file=sys.stderr)
    sys.exit(1)


def column_index(cell_ref: str) -> int:
    letters = re.match(r'([A-Z]+)', cell_ref).group(1)
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - 64
    return value - 1


def read_shared_strings(zip_file: zipfile.ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in zip_file.namelist():
        return []
    root = ET.fromstring(zip_file.read('xl/sharedStrings.xml'))
    return [''.join(text.text or '' for text in item.findall('.//a:t', NS)) for item in root.findall('a:si', NS)]


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get('t')
    value_node = cell.find('a:v', NS)
    if cell_type == 's' and value_node is not None:
        return shared[int(value_node.text)]
    if cell_type == 'inlineStr':
        return ''.join(text.text or '' for text in cell.findall('.//a:t', NS))
    return value_node.text if value_node is not None else ''


def workbook_sheets(zip_file: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zip_file.read('xl/workbook.xml'))
    rels = ET.fromstring(zip_file.read('xl/_rels/workbook.xml.rels'))
    relmap = {rel.attrib['Id']: rel.attrib['Target'].lstrip('/') for rel in rels}
    sheets: dict[str, str] = {}
    for sheet in workbook.find('a:sheets', NS):
        target = relmap[sheet.attrib[RID]]
        sheets[sheet.attrib['name']] = target if target.startswith('xl/') else f'xl/{target}'
    return sheets


def read_sheet_rows(xlsx_path: Path, sheet_name: str) -> list[list[str]]:
    with zipfile.ZipFile(xlsx_path) as zip_file:
        sheets = workbook_sheets(zip_file)
        if sheet_name not in sheets:
            raise ValueError(f'Sheet {sheet_name!r} not found. Available sheets: {", ".join(sheets)}')
        shared = read_shared_strings(zip_file)
        root = ET.fromstring(zip_file.read(sheets[sheet_name]))
        rows: list[list[str]] = []
        for row in root.findall('.//a:sheetData/a:row', NS):
            values: list[str] = []
            for cell in row.findall('a:c', NS):
                index = column_index(cell.attrib['r'])
                while len(values) <= index:
                    values.append('')
                values[index] = cell_value(cell, shared).strip()
            rows.append(values)
        return rows


def normalize_header(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', value.strip().lower()).strip('_')


def first(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key, '').strip()
        if value:
            return value
    return ''


def number(value: str):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def normalize_location(row: dict[str, str]):
    store_number = first(row, 'location_number', 'store_number', 'facility_number', 'location')
    latitude = number(first(row, 'latitude', 'lat'))
    longitude = number(first(row, 'longitude', 'lng', 'lon'))
    if not store_number or latitude is None or longitude is None:
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    city = first(row, 'physical_city', 'city')
    state = first(row, 'physical_state', 'state')
    zip_code = first(row, 'physical_zip_code', 'zip', 'postal_code')
    address = first(row, 'physical_address_line_1', 'address', 'street_address')
    return {
        'store_number': re.sub(r'^Store\s*#', '', store_number, flags=re.I).strip(),
        'facility_id': store_number.strip(),
        'banner': first(row, 'banner_desc', 'banner'),
        'location_name': first(row, 'location_name', 'facility_name', 'store_name'),
        'address': address,
        'city': city,
        'state': state,
        'zip_code': zip_code,
        'latitude': latitude,
        'longitude': longitude,
        'final_status': first(row, 'final_status_v6', 'status'),
        'final_priority': first(row, 'final_priority_v6', 'priority'),
        'final_notes': first(row, 'final_notes_v6', 'notes'),
        'google_status': first(row, 'google_status'),
        'google_priority': first(row, 'google_priority'),
        'source': 'ELM Locations Master Status v7 Google Colorized',
        'last_updated': '',
    }


def read_locations() -> list[dict]:
    rows = read_sheet_rows(INPUT, SHEET_NAME)
    if not rows:
        return []
    headers = [normalize_header(value) for value in rows[0]]
    locations = []
    seen = set()
    for values in rows[1:]:
        record = {headers[index]: values[index] if index < len(values) else '' for index in range(len(headers)) if headers[index]}
        location = normalize_location(record)
        if not location:
            continue
        key = location['store_number']
        if key in seen:
            continue
        seen.add(key)
        locations.append(location)
    return locations


def enrich_master(locations: list[dict]) -> int:
    if not MASTER_PATH.exists():
        return 0
    master = json.loads(MASTER_PATH.read_text(encoding='utf-8'))
    index = {item['store_number']: item for item in locations}
    index.update({item['store_number'].lstrip('0'): item for item in locations})
    enriched = 0
    facilities = master.get('facilities') or []
    for facility in facilities:
        facility_id = str(facility.get('facility_id', '')).strip()
        location = index.get(facility_id) or index.get(facility_id.lstrip('0'))
        if not location:
            continue
        enriched += 1
        facility['address'] = location['address'] or facility.get('address')
        facility['city'] = location['city'] or facility.get('city')
        facility['state'] = location['state'] or facility.get('state')
        facility['latitude'] = location['latitude']
        facility['longitude'] = location['longitude']
        facility['location_source'] = location['source']
    MASTER_PATH.write_text(json.dumps(master, indent=2) + '\n', encoding='utf-8')
    return enriched


def main():
    locations = read_locations()
    if not locations:
        raise SystemExit('No valid ELM locations found.')
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(json.dumps(locations, indent=2) + '\n', encoding='utf-8')
    enriched = enrich_master(locations)
    priority_counts = {}
    status_counts = {}
    for item in locations:
        priority_counts[item['final_priority'] or 'Unknown'] = priority_counts.get(item['final_priority'] or 'Unknown', 0) + 1
        status_counts[item['final_status'] or 'Unknown'] = status_counts.get(item['final_status'] or 'Unknown', 0) + 1
    print(f'ELM rows ingested: {len(locations)}')
    print(f'FPI canonical facilities enriched: {enriched}')
    print(f'Wrote: {PUBLIC_OUT}')
    print(f'Updated: {MASTER_PATH}')
    print('Priority counts:', json.dumps(priority_counts, sort_keys=True))
    print('Status counts:', json.dumps(status_counts, sort_keys=True))


if __name__ == '__main__':
    main()
