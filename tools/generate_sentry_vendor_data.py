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


SECURITY_ALIGNMENT_TERMS = {
    'physical security', 'retail security', 'security', 'fire', 'life safety', 'access control', 'access', 'badge',
    'camera', 'video', 'vision', 'cctv', 'alarm', 'monitoring', 'intrusion', 'threat', 'incident', 'evidence',
    'case management', 'robot', 'drone', 'patrol', 'associate safety', 'worker safety', 'duress', 'panic',
    'device posture', 'device', 'iot', 'network', 'law enforcement', 'alpr', 'lpr', 'loss prevention', 'asset protection',
}
MODERATE_ALIGNMENT_TERMS = {
    'analytics', 'workflow', 'automation', 'operations', 'risk', 'compliance', 'vendor', 'readiness', 'intelligence',
    'dispatch', 'inspection', 'audit', 'training', 'communications', 'reporting', 'identity', 'sensor',
}
NO_GO_TERMS = {'no go', 'no-go', 'ruled out', 'not aligned', 'failed assessment', 'do not proceed', 'deprioritize'}
GOVERNANCE_RISK_TERMS = {
    'legal', 'privacy', 'biometric', 'regulatory', 'lawsuit', 'concern', 'scrutiny', 'surveillance', 'sensitive',
    'consent', 'unresolved', 'risk', 'compliance gap', 'not approved',
}
POSITIVE_ASSESSMENT_TERMS = {'recommended', 'recommend', 'shortlist', 'validated', 'go-forward', 'go forward', 'approved', 'proven'}


def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def term_hits(text: str, terms: set[str]) -> int:
    return sum(1 for term in terms if term in text)


def deterministic_tie_breaker(*parts: str) -> float:
    digest = hashlib.sha1('|'.join(parts).lower().encode('utf-8')).hexdigest()
    # Stable nudge between -1.2 and +1.2 so similar records can sort consistently without random scoring.
    return ((int(digest[:4], 16) % 25) - 12) / 10


def parse_record_date(date_tracked: str, tracker_month: str) -> datetime | None:
    if date_tracked:
        try:
            return datetime.fromisoformat(date_tracked[:10]).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    match = re.search(r'(20\d{2})[-_]?([01]\d)', tracker_month or '')
    if match:
        year, month = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12:
            return datetime(year, month, 1, tzinfo=timezone.utc)
    return None


def score_strategic_relevance(category: str, use_case: str, adds_value: str, tags: list[str], domains: list[str]) -> float:
    text = f"{category} {use_case} {adds_value} {' '.join(tags)} {' '.join(domains)}".lower()
    strong_hits = term_hits(text, SECURITY_ALIGNMENT_TERMS)
    moderate_hits = term_hits(text, MODERATE_ALIGNMENT_TERMS)
    score = min(25, strong_hits * 3.2 + moderate_hits * 1.35)
    if tags and tags != ['Uncategorized emerging technology']:
        score += min(5, len(tags) * 1.6)
    if domains and domains != ['Vendor Intelligence & Recommendations']:
        score += min(4, len(domains) * 1.2)
    if strong_hits >= 4:
        score = max(score, 20)
    elif strong_hits >= 2:
        score = max(score, 14)
    elif moderate_hits:
        score = max(score, 8)
    return round(clamp(score, 0, 25), 1)


def score_maturity_readiness(maturity: str, status: str, initial_results: str, analysis_completed: str) -> float:
    text = f'{maturity} {status} {initial_results} {analysis_completed}'.lower()
    if any(term in text for term in NO_GO_TERMS):
        return 0
    score = 6.0
    if any(term in text for term in ['production', 'deployed', 'validated', 'mature', 'commercial', 'enterprise-ready', 'proven']):
        score = 17.0
    elif any(term in text for term in ['pilot', 'scaling', 'growth', 'field trial', 'beta', 'active assessment']):
        score = 12.0
    elif any(term in text for term in ['concept', 'early', 'startup', 'unvalidated', 'limited evidence']):
        score = 6.0
    try:
        numeric = float(status)
        # Tracker numeric ratings appear to be 0-5 style values; scale into the 0-20 readiness band.
        score = max(score, clamp(numeric, 0, 5) * 4)
    except ValueError:
        pass
    if analysis_completed.strip().lower() in {'yes', 'y', 'complete', 'completed', 'true'}:
        score += 1.5
    if any(term in text for term in POSITIVE_ASSESSMENT_TERMS):
        score += 1.5
    return round(clamp(score, 0, 20), 1)


def score_evidence_quality(analysis_completed: str, initial_results: str, source_url: str, notes: str, use_case: str, adds_value: str) -> float:
    score = 0.0
    if analysis_completed.strip().lower() in {'yes', 'y', 'complete', 'completed', 'true'}:
        score += 4
    elif analysis_completed.strip() and analysis_completed.strip().lower() not in {'no', 'n', 'false'}:
        score += 2
    if source_url.strip():
        score += 4
    result_len = len(initial_results.strip())
    notes_len = len(notes.strip())
    score += min(6, result_len / 35)
    score += min(4, notes_len / 45)
    if use_case.strip():
        score += 1
    if adds_value.strip():
        score += 1
    if result_len > 80 and source_url.strip() and (notes_len > 40 or adds_value.strip()):
        score = max(score, 16)
    return round(clamp(score, 0, 20), 1)


def score_capability_coverage(tags: list[str], domains: list[str]) -> float:
    generic = not tags or tags == ['Uncategorized emerging technology']
    if generic and domains == ['Vendor Intelligence & Recommendations']:
        return 3.0
    score = 3 + min(9, len(tags) * 3) + min(3, len([domain for domain in domains if domain != 'Vendor Intelligence & Recommendations']) * 1.5)
    return round(clamp(score, 0, 15), 1)


def score_freshness(date_tracked: str, tracker_month: str) -> float:
    parsed = parse_record_date(date_tracked, tracker_month)
    if not parsed:
        return 2.0
    age_days = max(0, (NOW - parsed).days)
    if age_days <= 180:
        return 10.0
    if age_days <= 365:
        return 8.0
    if age_days <= 730:
        return 6.0
    if age_days <= 1095:
        return 4.0
    return 2.0


def score_governance_risk(category: str, status: str, initial_results: str, notes: str, source_url: str) -> tuple[float, str | None]:
    text = f'{category} {status} {initial_results} {notes}'.lower()
    if any(term in text for term in NO_GO_TERMS):
        return 0.0, 'no-go'
    positive_hits = term_hits(text, POSITIVE_ASSESSMENT_TERMS)
    risk_hits = term_hits(text, GOVERNANCE_RISK_TERMS)
    score = 4.0 + min(5, positive_hits * 2) - min(5, risk_hits * 1.3)
    if source_url.strip():
        score += 1
    if risk_hits and positive_hits == 0:
        cap = 'risk-review'
    else:
        cap = None
    return round(clamp(score, 0, 10), 1), cap


def evidence_level(score: float) -> str:
    if score >= 16:
        return 'Strong'
    if score >= 8:
        return 'Partial'
    return 'Limited'


def build_recommendation_rationale(strategic: float, maturity: float, evidence: float, capability: float, governance_cap: str | None) -> str:
    strengths: list[str] = []
    if strategic >= 20:
        strengths.append('strong FPI/security use-case alignment')
    elif strategic >= 10:
        strengths.append('moderate operational relevance')
    else:
        strengths.append('unclear security relevance')
    if maturity >= 16:
        strengths.append('mature or production-ready signals')
    elif maturity >= 10:
        strengths.append('pilot or scaling maturity')
    else:
        strengths.append('early maturity evidence')
    if evidence >= 16:
        strengths.append('strong documented evidence')
    elif evidence >= 8:
        strengths.append('partial assessment evidence')
    else:
        strengths.append('limited tracker evidence')
    if capability >= 11:
        strengths.append('multi-domain capability coverage')
    if governance_cap == 'no-go':
        strengths.append('explicit no-go or not-aligned governance signal')
    elif governance_cap == 'risk-review':
        strengths.append('governance/privacy/legal risk requires validation')
    return '; '.join(strengths).capitalize() + '.'


def score_vendor_solution(
    *,
    record_id: str,
    company: str,
    product: str,
    category: str,
    use_case: str,
    adds_value: str,
    maturity: str,
    status: str,
    analysis_completed: str,
    initial_results: str,
    notes: str,
    source_url: str,
    tracker_month: str,
    date_tracked: str,
    tags: list[str],
    domains: list[str],
) -> dict[str, Any]:
    strategic = score_strategic_relevance(category, use_case, adds_value, tags, domains)
    maturity_points = score_maturity_readiness(maturity, status, initial_results, analysis_completed)
    evidence = score_evidence_quality(analysis_completed, initial_results, source_url, notes, use_case, adds_value)
    capability = score_capability_coverage(tags, domains)
    freshness = score_freshness(date_tracked, tracker_month)
    governance, governance_cap = score_governance_risk(category, status, initial_results, notes, source_url)
    raw_score = strategic + maturity_points + evidence + capability + freshness + governance
    completeness_adjustment = min(1.5, sum(bool(value.strip()) for value in [use_case, adds_value, maturity, status, initial_results, source_url, date_tracked]) * 0.18)
    final_score = raw_score + completeness_adjustment + deterministic_tie_breaker(record_id, company, product, category, tracker_month)
    product_is_placeholder = product.strip().lower() in {'n/a', 'na', 'none', 'unknown', 'tbd', '-'}
    low_context = not use_case.strip() and not adds_value.strip() and not initial_results.strip()
    if governance_cap == 'no-go':
        final_score = min(final_score, 34)
    elif product_is_placeholder:
        # Placeholder tracker rows are retained for transparency but should not compete with evaluated solutions.
        final_score = min(final_score, 34 if low_context else 34.9)
    elif governance_cap == 'risk-review':
        final_score = min(final_score, 84)
    final_score = round(clamp(final_score), 1)
    return {
        'recommendationScore': final_score,
        'scoreBreakdown': {
            'strategicRelevance': strategic,
            'maturityReadiness': maturity_points,
            'evidenceQuality': evidence,
            'capabilityCoverage': capability,
            'freshness': freshness,
            'governanceRisk': governance,
        },
        'evidenceLevel': evidence_level(evidence),
        'strategicFitRationale': build_recommendation_rationale(strategic, maturity_points, evidence, capability, governance_cap),
    }


def maturity_sort_value(record: dict[str, Any]) -> float:
    breakdown = record.get('scoreBreakdown') or {}
    return float(breakdown.get('maturityReadiness') or 0)


def evidence_sort_value(record: dict[str, Any]) -> float:
    breakdown = record.get('scoreBreakdown') or {}
    return float(breakdown.get('evidenceQuality') or 0)


def capability_sort_value(record: dict[str, Any]) -> float:
    breakdown = record.get('scoreBreakdown') or {}
    return float(breakdown.get('capabilityCoverage') or 0)


def recency_sort_value(record: dict[str, Any]) -> float:
    parsed = parse_record_date(record.get('dateTracked', ''), record.get('trackerMonth', ''))
    return parsed.timestamp() if parsed else 0


def vendor_sort_key(record: dict[str, Any]) -> tuple[float, float, float, float, float]:
    return (
        float(record.get('recommendationScore') or 0),
        evidence_sort_value(record),
        maturity_sort_value(record),
        capability_sort_value(record),
        recency_sort_value(record),
    )


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
                adds_value = mapped.get('add_value_to_walmart', '')
                notes = mapped.get('additional_notes', '')
                status = mapped.get('status') or mapped.get('score') or mapped.get('initial_assessment_results') or ''
                maturity = mapped.get('maturity_level', '')
                source_url = mapped.get('source_url_publisher', '')
                analysis_completed = mapped.get('analysis_completed') or mapped.get('complete_initial_assessment') or ''
                initial_results = mapped.get('initial_assessment_results', '')
                tracker_month = path.stem.replace('EmergingTechTracker_', '')
                date_tracked = parse_excel_date(mapped.get('date', ''))
                tags = capability_tags(category, use_case, product, notes)
                domains = risk_domains(tags)
                record_id = hashlib.sha1(f'{company}|{product}|{path.name}'.encode('utf-8')).hexdigest()[:12]
                score_details = score_vendor_solution(
                    record_id=record_id,
                    company=company,
                    product=product,
                    category=category or 'Uncategorized emerging technology',
                    use_case=use_case,
                    adds_value=adds_value,
                    maturity=maturity or 'Unknown',
                    status=status or 'Tracked',
                    analysis_completed=analysis_completed,
                    initial_results=initial_results,
                    notes=notes,
                    source_url=source_url,
                    tracker_month=tracker_month,
                    date_tracked=date_tracked,
                    tags=tags,
                    domains=domains,
                )
                records.append({
                    'id': f'SENTRY-{record_id}',
                    'company': company,
                    'technologyProduct': product,
                    'category': category or 'Uncategorized emerging technology',
                    'useCase': use_case,
                    'addsValueToWalmart': adds_value,
                    'maturityLevel': maturity or 'Unknown',
                    'sourceUrlPublisher': source_url,
                    'assessmentStatus': status or 'Tracked',
                    'analysisCompleted': analysis_completed,
                    'initialAssessmentResults': initial_results,
                    'additionalNotes': notes,
                    'trackerMonth': tracker_month,
                    'sourceWorkbook': path.name,
                    'sourceSheet': sheet_name,
                    'dateTracked': date_tracked,
                    'capabilityTags': tags,
                    'riskDomains': domains,
                    **score_details,
                })
    return records


def dedupe_latest(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        key = (record['company'].lower(), record['technologyProduct'].lower())
        if key not in by_key or record['trackerMonth'] >= by_key[key]['trackerMonth']:
            by_key[key] = record
    return sorted(by_key.values(), key=vendor_sort_key, reverse=True)


def top_candidates(records: list[dict[str, Any]], tag: str, limit: int = 6) -> list[dict[str, Any]]:
    matches = [record for record in records if tag in record['capabilityTags']]
    return [candidate_summary(record) for record in sorted(matches, key=vendor_sort_key, reverse=True)[:limit]]


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
        'scoreBreakdown': record.get('scoreBreakdown', {}),
        'evidenceLevel': record.get('evidenceLevel', 'Limited'),
        'strategicFitRationale': record.get('strategicFitRationale', ''),
        'dateTracked': record.get('dateTracked', ''),
        'rationale': record.get('strategicFitRationale') or record['addsValueToWalmart'] or record['useCase'] or 'SENTRY tracker candidate aligned to this capability gap.',
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
    candidates = sorted(records, key=vendor_sort_key, reverse=True)[:5]
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
            'governanceNote': 'Vendor intelligence is sponsored by SENTRY. Store-level reports and assessment requests are represented as workflow-ready demo payloads until approved backend integrations are connected. Vendor recommendation scores are generated from available tracker metadata and should be validated by Security, Legal, Privacy, Procurement, and operational stakeholders before vendor selection or production deployment.',
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
