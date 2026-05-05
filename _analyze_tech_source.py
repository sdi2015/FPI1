from pathlib import Path
import json
from collections import Counter, defaultdict

SOURCE = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Chris R - Working Folder\01_Task_Work\FPI-TECH-001')
OUT = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\02_Active_Build\FPI_202605\TECH_SOURCE_ANALYSIS_SUMMARY.json')

files = []
for p in SOURCE.rglob('*'):
    if p.is_file():
        files.append({
            'path': str(p.relative_to(SOURCE)).replace('\\', '/'),
            'bytes': p.stat().st_size,
            'extension': p.suffix.lower() or '(none)',
        })

by_extension = Counter(f['extension'] for f in files)
by_top_folder = Counter(f['path'].split('/')[0] for f in files)

json_summaries = {}
def load_json(rel):
    p = SOURCE / rel
    d = json.loads(p.read_text(encoding='utf-8'))
    json_summaries[rel] = summarize_json(d)
    return d

def summarize_json(d):
    if isinstance(d, dict):
        summary = {'type': 'object', 'keys': list(d.keys())[:40]}
        for key, value in d.items():
            if isinstance(value, list):
                summary[key] = {'type': 'array', 'count': len(value), 'sample_keys': list(value[0].keys())[:30] if value and isinstance(value[0], dict) else None}
            elif isinstance(value, dict):
                summary[key] = {'type': 'object', 'keys': list(value.keys())[:30]}
            elif isinstance(value, (str, int, float, bool)) or value is None:
                summary[key] = value if key not in {'source'} else 'redacted-source-reference'
        return summary
    if isinstance(d, list):
        return {'type': 'array', 'count': len(d), 'sample_keys': list(d[0].keys())[:30] if d and isinstance(d[0], dict) else None}
    return {'type': type(d).__name__}

# Normalized small contract output
try:
    normalized = load_json('01_Normalized_Model/synthetic-technology-health-adapter-output.json')
except Exception as exc:
    normalized = None
    json_summaries['01_Normalized_Model/synthetic-technology-health-adapter-output.json'] = {'error': str(exc)}

# CCTV demo snapshots and large datasets
for rel in [
    '04_CCTV_Monitoring_Demo/real-api-health-summary.json',
    '04_CCTV_Monitoring_Demo/region75-vms-health.json',
    '04_CCTV_Monitoring_Demo/region75-retention.json',
    '04_CCTV_Monitoring_Demo/region75-realdata.json',
    '04_CCTV_Monitoring_Demo/assets/qr/manifest.json',
]:
    try:
        load_json(rel)
    except Exception as exc:
        json_summaries[rel] = {'error': str(exc)}

tech_issue_counts = {}
if normalized:
    issues = normalized.get('technology_issues', [])
    tech_issue_counts = {
        'total': len(issues),
        'by_domain': Counter(i.get('domain') for i in issues),
        'by_status': Counter(i.get('status') for i in issues),
        'by_severity': Counter(i.get('severity') for i in issues),
        'by_freshness': Counter(i.get('freshness_status') for i in issues),
    }
    tech_issue_counts = {k: dict(v) if isinstance(v, Counter) else v for k, v in tech_issue_counts.items()}

# Extract safe metrics from region75 vms without printing raw camera identifiers.
def find_store_list(d):
    if isinstance(d, dict):
        for key in ('stores', 'data', 'store_health', 'storeHealth'):
            if isinstance(d.get(key), list):
                return d[key]
        for value in d.values():
            found = find_store_list(value)
            if found:
                return found
    return []

region_metrics = {}
try:
    region = json.loads((SOURCE / '04_CCTV_Monitoring_Demo/region75-vms-health.json').read_text(encoding='utf-8'))
    stores = find_store_list(region)
    region_metrics['store_count_detected'] = len(stores)
    if stores:
        status_counter = Counter(str(s.get('health_status') or s.get('status') or s.get('healthColor') or s.get('health_color') or 'unknown') for s in stores if isinstance(s, dict))
        region_metrics['store_status_distribution_detected'] = dict(status_counter)
        numeric_keys = Counter()
        for s in stores[:10]:
            if isinstance(s, dict):
                numeric_keys.update(k for k, v in s.items() if isinstance(v, (int, float)))
        region_metrics['sample_numeric_store_fields'] = dict(numeric_keys)
except Exception as exc:
    region_metrics['error'] = str(exc)

# Inspect JS modules at a structural level only.
js_modules = {}
for rel in [
    '04_CCTV_Monitoring_Demo/assets/js/services/normalization.js',
    '04_CCTV_Monitoring_Demo/assets/js/services/businessRules.js',
    '04_CCTV_Monitoring_Demo/assets/js/services/predictiveAgent.js',
    '04_CCTV_Monitoring_Demo/assets/js/services/repository.js',
    '04_CCTV_Monitoring_Demo/assets/js/ui/render.js',
    '04_CCTV_Monitoring_Demo/assets/js/ui/storeComplianceView.js',
    '04_CCTV_Monitoring_Demo/assets/js/data/mockData.js',
]:
    p = SOURCE / rel
    if p.exists():
        text = p.read_text(encoding='utf-8', errors='replace')
        js_modules[rel] = {
            'lines': text.count('\n') + 1,
            'export_count': text.count('export '),
            'function_count': text.count('function ') + text.count('=>'),
            'contains_ticket_workflow': 'ticket' in text.lower(),
            'contains_retention_logic': 'retention' in text.lower(),
            'contains_predictive_logic': 'predict' in text.lower(),
            'contains_policy_logic': 'policy' in text.lower() or 'compliance' in text.lower(),
        }

payload = {
    'source_root': str(SOURCE),
    'file_count': len(files),
    'total_bytes': sum(f['bytes'] for f in files),
    'by_extension': dict(by_extension),
    'by_top_folder': dict(by_top_folder),
    'technology_issue_counts': tech_issue_counts,
    'json_summaries': json_summaries,
    'region75_safe_metrics': region_metrics,
    'js_module_summaries': js_modules,
    'files': files,
}
OUT.write_text(json.dumps(payload, indent=2, default=str), encoding='utf-8')
print(OUT)
print('files', len(files), 'bytes', payload['total_bytes'])
print('extensions', dict(by_extension))
print('top folders', dict(by_top_folder))
print('tech issues', tech_issue_counts)
