from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Any

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\Desktop\SENTRY\Vendor Assessments\Emerging Tech Trackers')
OUTPUT_PATH = PROJECT_ROOT / 'public' / 'data' / 'fpi-sentry-vendor-intelligence.json'
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def shared_strings(z: zipfile.ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in z.namelist():
        return []
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    return [''.join(t.text or '' for t in si.findall('.//a:t', NS)) for si in root.findall('a:si', NS)]


def column_index(cell_ref: str) -> int:
    letters = ''.join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter.upper()) - ord('A') + 1
    return index - 1


def cell_value(cell: ET.Element, strings: list[str]) -> str | None:
    value = cell.find('a:v', NS)
    cell_type = cell.attrib.get('t')
    if cell_type == 's' and value is not None:
        return strings[int(value.text or '0')]
    if cell_type == 'inlineStr':
        return ''.join(t.text or '' for t in cell.findall('.//a:t', NS))
    return value.text if value is not None else None


def worksheet_rows(z: zipfile.ZipFile, sheet_index: int, strings: list[str]) -> list[list[str]]:
    sheet_path = f'xl/worksheets/sheet{sheet_index}.xml'
    if sheet_path not in z.namelist():
        return []
    root = ET.fromstring(z.read(sheet_path))
    rows: list[list[str]] = []
    for row in root.findall('a:sheetData/a:row', NS):
        cells = row.findall('a:c', NS)
        if not cells:
            continue
        values: list[str] = []
        for cell in cells:
            ref = cell.attrib.get('r', '')
            idx = column_index(ref) if ref else len(values)
            while len(values) <= idx:
                values.append('')
            values[idx] = clean(cell_value(cell, strings))
        rows.append(values)
    return rows


def clean(value: Any) -> str:
    if value is None:
        return ''
    return re.sub(r'\s+', ' ', str(value).strip())


def norm_header(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', value.strip().lower()).strip('_')


def parse_excel_date(value: str) -> str:
    if not value:
        return ''
    try:
        serial = float(value)
        if serial > 20000:
            return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()
    except ValueError:
        pass
    return value


def maturity_score(maturity: str, status: str) -> float:
    text = f'{maturity} {status}'.lower()
    score = 50.0
    if any(term in text for term in ['pilot', 'validated', 'deployed', 'mature', 'production']):
        score += 18
    if any(term in text for term in ['growth', 'scaling', 'commercial']):
        score += 12
    if any(term in text for term in ['early', 'concept', 'startup']):
        score -= 8
    if any(term in text for term in ['no go', 'ruled out', 'not aligned']):
        score -= 30
    if any(term in text for term in ['go', 'recommend', 'shortlist']):
        score += 15
    try:
        numeric = float(status)
        score += min(20, numeric * 7)
    except ValueError:
        pass
    return max(0, min(100, round(score, 1)))


def capability_tags(category: str, use_case: str, product: str, notes: str) -> list[str]:
    text = f'{category} {use_case} {product} {notes}'.lower()
    tag_map = {
        'Video Analytics': ['camera', 'video', 'vision', 'cctv', 'computer vision', 'analytics'],
        'Alarm Monitoring': ['alarm', 'monitoring', 'intrusion', 'sensor'],
        'Access Control': ['access', 'badge', 'lock', 'credential'],
        'Fire/Life Safety': ['fire', 'life safety', 'smoke', 'suppression'],
        'Threat Intelligence': ['threat', 'risk', 'violence', 'incident', 'intelligence'],
        'Robotics / Autonomous Patrol': ['robot', 'drone', 'autonomous', 'patrol'],
        'Associate Safety': ['associate', 'worker', 'safety', 'panic', 'duress'],
        'Network / Device Posture': ['network', 'device', 'iot', 'cyber', 'firmware'],
        'Evidence / Case Management': ['case', 'evidence', 'workflow', 'investigation', 'reporting'],
    }
    tags = [tag for tag, terms in tag_map.items() if any(term in text for term in terms)]
    if not tags and category:
        tags.append(category[:42])
    return sorted(set(tags))[:5]


def risk_domains(tags: list[str]) -> list[str]:
    domain_map = {
        'Video Analytics': 'Camera & Technical Control Monitoring',
        'Alarm Monitoring': 'Fire-System Monitoring & Assurance',
        'Access Control': 'Network & Security Device Posture',
        'Fire/Life Safety': 'Fire-System Monitoring & Assurance',
        'Threat Intelligence': 'Threat Detection & Risk Scoring',
        'Robotics / Autonomous Patrol': 'Law Enforcement / Security Vendor Analysis / External Coordination',
        'Associate Safety': 'Executive Protection Readiness',
        'Network / Device Posture': 'Network & Security Device Posture',
        'Evidence / Case Management': 'Remediation Orchestration',
    }
    return sorted({domain_map[tag] for tag in tags if tag in domain_map}) or ['Vendor Intelligence & Recommendations']


def parse_workbook(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with zipfile.ZipFile(path) as z:
        strings = shared_strings(z)
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = workbook.findall('a:sheets/a:sheet', NS)
        for sheet_index, sheet in enumerate(sheets, start=1):
            sheet_name = sheet.attrib.get('name', f'Sheet{sheet_index}')
            if sheet_name.lower() == 'data':
                continue
            rows = worksheet_rows(z, sheet_index, strings)
            if not rows:
                continue
            header_index = next((idx for idx, row in enumerate(rows[:12]) if any(norm_header(cell) in {'company', 'cmpany'} for cell in row)), None)
            if header_index is None:
                continue
            headers = [norm_header(cell) for cell in rows[header_index]]
            for row in rows[header_index + 1:]:
                mapped = {headers[i]: clean(row[i]) for i in range(min(len(headers), len(row))) if headers[i]}
                company = mapped.get('company') or mapped.get('cmpany') or ''
                product = mapped.get('technology_product') or mapped.get('product') or ''
                if not company or not product:
                    continue
                category = mapped.get('category', '')
                use_case = mapped.get('use_case', '')
                notes = mapped.get('additional_notes', '')
                status = mapped.get('status') or mapped.get('score') or mapped.get('initial_assessment_results') or ''
                maturity = mapped.get('maturity_level', '')
                tags = capability_tags(category, use_case, product, notes)
                record_id = hashlib.sha1(f'{company}|{product}|{path.name}'.encode('utf-8')).hexdigest()[:12]
                records.append({
                    'id': f'SENTRY-{record_id}',
                    'company': company,
                    'technologyProduct': product,
                    'category': category or 'Uncategorized emerging technology',
                    'useCase': use_case,
                    'addsValueToWalmart': mapped.get('add_value_to_walmart', ''),
                    'maturityLevel': maturity or 'Unknown',
                    'sourceUrlPublisher': mapped.get('source_url_publisher', ''),
                    'assessmentStatus': status or 'Tracked',
                    'analysisCompleted': mapped.get('analysis_completed') or mapped.get('complete_initial_assessment') or '',
                    'initialAssessmentResults': mapped.get('initial_assessment_results', ''),
                    'additionalNotes': notes,
                    'trackerMonth': path.stem.replace('EmergingTechTracker_', ''),
                    'sourceWorkbook': path.name,
                    'sourceSheet': sheet_name,
                    'dateTracked': parse_excel_date(mapped.get('date', '')),
                    'capabilityTags': tags,
                    'riskDomains': risk_domains(tags),
                    'recommendationScore': maturity_score(maturity, status),
                })
    return records


def dedupe_latest(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        key = (record['company'].lower(), record['technologyProduct'].lower())
        if key not in by_key or record['trackerMonth'] >= by_key[key]['trackerMonth']:
            by_key[key] = record
    return sorted(by_key.values(), key=lambda item: item['recommendationScore'], reverse=True)


def top_candidates(records: list[dict[str, Any]], tag: str, limit: int = 6) -> list[dict[str, Any]]:
    matches = [record for record in records if tag in record['capabilityTags']]
    return [candidate_summary(record) for record in sorted(matches, key=lambda item: item['recommendationScore'], reverse=True)[:limit]]


def candidate_summary(record: dict[str, Any]) -> dict[str, Any]:
    return {
        'vendorId': record['id'],
        'company': record['company'],
        'technologyProduct': record['technologyProduct'],
        'category': record['category'],
        'recommendationScore': record['recommendationScore'],
        'maturityLevel': record['maturityLevel'],
        'assessmentStatus': record['assessmentStatus'],
        'capabilityTags': record['capabilityTags'],
        'rationale': record['addsValueToWalmart'] or record['useCase'] or 'SENTRY tracker candidate aligned to this capability gap.',
    }


def build_solution_plays(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    plays = [
        ('camera-coverage-gap', 'Camera coverage or video evidence gap', 'Video Analytics', 'Use when stores have offline cameras, weak coverage, missing retention, or investigation evidence gaps.'),
        ('alarm-monitoring-gap', 'Alarm monitoring or fire/life-safety assurance gap', 'Alarm Monitoring', 'Use when alarm, panel, monitoring, dispatch, or assurance exceptions need provider review.'),
        ('access-control-gap', 'Access-control or security-device posture gap', 'Access Control', 'Use when doors, credentials, access exceptions, or perimeter controls require vendor options.'),
        ('threat-intel-gap', 'Threat detection and risk intelligence need', 'Threat Intelligence', 'Use when incident pattern analysis, threat triage, or intelligence workflows need vendor support.'),
        ('patrol-automation-gap', 'Patrol augmentation or autonomous security option', 'Robotics / Autonomous Patrol', 'Use when a store needs additional deterrence, patrol cadence, or exterior monitoring options.'),
        ('evidence-workflow-gap', 'Evidence, case, and remediation workflow gap', 'Evidence / Case Management', 'Use when stores need stronger reporting, audit trail, closure evidence, or case workflow support.'),
    ]
    return [
        {
            'playId': play_id,
            'issue': issue,
            'capabilityTag': tag,
            'whenToUse': when,
            'recommendedCandidates': top_candidates(records, tag, 5),
        }
        for play_id, issue, tag, when in plays
    ]


def build_assessment_queue(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = sorted(records, key=lambda item: item['recommendationScore'], reverse=True)[:5]
    statuses = ['Intake Draft', 'SENTRY Triage', 'Evidence Requested', 'Assessment Scheduled', 'Recommendation Pending']
    return [
        {
            'requestId': f'SA-{idx + 1:04d}',
            'company': record['company'],
            'technologyProduct': record['technologyProduct'],
            'requestedBy': 'FPI Store / Market User',
            'storeContext': 'Canonical FPI scoped store population',
            'status': statuses[idx % len(statuses)],
            'priority': 'High' if idx < 2 else 'Medium',
            'reason': record['useCase'] or record['addsValueToWalmart'] or 'Prospective vendor evaluation requested through SENTRY.',
            'createdAt': NOW.isoformat(),
        }
        for idx, record in enumerate(candidates)
    ]


def build_provider_report_template() -> dict[str, Any]:
    return {
        'apiStatus': 'Backend/API seam prepared - no production submission in this shell build.',
        'reportTypes': ['Positive Performance', 'Service Concern', 'Missed SLA', 'Evidence Gap', 'Professionalism', 'Technical Quality', 'Recommendation'],
        'requiredFields': ['facilityId', 'providerName', 'reportType', 'rating', 'summary', 'impact', 'requestedFollowUp'],
        'optionalFields': ['workOrderId', 'incidentId', 'photosOrEvidenceUrl', 'contactName', 'market', 'state'],
    }


def build_data() -> dict[str, Any]:
    raw_records: list[dict[str, Any]] = []
    source_files = sorted(SOURCE_DIR.glob('*.xlsx'))
    for path in source_files:
        raw_records.extend(parse_workbook(path))
    records = dedupe_latest(raw_records)
    category_counts = Counter(record['category'] for record in records).most_common(12)
    capability_counts = Counter(tag for record in records for tag in record['capabilityTags']).most_common(12)
    assessed = [record for record in records if record['analysisCompleted'] or record['initialAssessmentResults'] or record['assessmentStatus'] not in {'Tracked', ''}]
    recommended = [record for record in records if record['recommendationScore'] >= 70]
    return {
        'metadata': {
            'generatedAt': NOW.isoformat(),
            'sponsor': 'SENTRY',
            'dataMode': 'SENTRY sponsored tracker import / local demo JSON',
            'sourcePath': str(SOURCE_DIR),
            'sourceFiles': [path.name for path in source_files],
            'governanceNote': 'Vendor intelligence is sponsored by SENTRY. Store-level reports and assessment requests are represented as workflow-ready demo payloads until approved backend integrations are connected.',
        },
        'summary': {
            'trackedVendors': len({record['company'] for record in records}),
            'trackedSolutions': len(records),
            'assessedSolutions': len(assessed),
            'recommendedCandidates': len(recommended),
            'capabilityAreas': len({tag for record in records for tag in record['capabilityTags']}),
            'sourceTrackers': len(source_files),
        },
        'vendors': records,
        'solutionPlays': build_solution_plays(records),
        'assessmentQueue': build_assessment_queue(records),
        'providerReportTemplate': build_provider_report_template(),
        'categoryCounts': category_counts,
        'capabilityCounts': capability_counts,
    }


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = build_data()
    OUTPUT_PATH.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f'wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}')
    print(f"vendors={data['summary']['trackedVendors']} solutions={data['summary']['trackedSolutions']}")


if __name__ == '__main__':
    main()
