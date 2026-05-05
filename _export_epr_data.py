from pathlib import Path
import json, sqlite3
from collections import Counter, defaultdict

source = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Cody S - Working Folder\03_Handoff_Drafts\fpi-dashboard')
target = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\02_Active_Build\FPI_202605\public\data\executive-protection-readiness.json')
seed = json.loads((source / 'seed_data.json').read_text(encoding='utf-8'))
stats = json.loads((source / 'incident_stats.json').read_text(encoding='utf-8'))
build = json.loads((source / 'FPI_DASHBOARD_BUILD_2026-05-04.json').read_text(encoding='utf-8'))

con = sqlite3.connect(str(source / 'fpi_dashboard.db'))
con.row_factory = sqlite3.Row
incidents = [dict(r) for r in con.execute('select * from incidents order by incident_date desc, incident_time desc limit 120').fetchall()]
security_incidents = [dict(r) for r in con.execute('select * from security_incidents order by date desc').fetchall()]
security_solutions = [dict(r) for r in con.execute('select * from security_solutions order by name').fetchall()]
con.close()

severity_counts = Counter(str(i.get('severity')) for i in incidents)
incident_type_counts = Counter(i.get('incident_type') or 'Unknown' for i in incidents)
state_counts = Counter(i.get('state') or 'Unknown' for i in incidents)
facility_counts = Counter(str(i.get('facility_id')) for i in incidents)
security_type_counts = Counter(i.get('incident_type') or 'Unknown' for i in security_incidents)
security_store_counts = Counter(str(i.get('store_number')) for i in security_incidents)
security_cost_by_type = defaultdict(float)
for inc in security_incidents:
    security_cost_by_type[inc.get('incident_type') or 'Unknown'] += float(inc.get('estimated_lawsuit_cost') or 0)

sample_hotels = build.get('sample_data', {}).get('sample_hotels', [])
nearby_facilities = build.get('sample_data', {}).get('nearby_facilities', [])
features = build.get('features_built_today', [])

doc_inventory = []
for p in sorted(source.rglob('*')):
    if p.is_dir():
        continue
    rel = str(p.relative_to(source)).replace('\\', '/')
    if rel.startswith('_analysis') or rel.startswith('_export'):
        continue
    doc_inventory.append({'path': rel, 'bytes': p.stat().st_size, 'extension': p.suffix.lower() or '(none)'})

payload = {
    'metadata': {
        'source_folder': str(source),
        'data_environment': 'synthetic/demo',
        'classification': 'Walmart internal demo data - do not treat as production travel, safety, or incident data',
        'analysis_status': 'All files in source folder inventoried; markdown/code/templates/json/sqlite assets mapped into implementation domains.',
        'file_count_analyzed': len(doc_inventory),
    },
    'source_inventory': doc_inventory,
    'executive_summary': {
        'modules': [
            'Field Operations Intelligence',
            'Visit Planning & Routing',
            'Hotel Safety Intelligence / Spotnana handoff',
            'Incident Intelligence',
            'Security Mitigation Manager',
            'Task Owner / Remediation Workflow',
        ],
        'recommended_ui_home': 'EPR tab with subtabs: Overview, Visit Planner, Hotel Intelligence, Incident Risk, Security Mitigation, Tasks & Governance',
        'business_value': build.get('business_metrics', {}),
    },
    'kpis': {
        'visit_facilities': len(seed.get('facilities', [])),
        'tasks': len(seed.get('tasks', [])),
        'remediations': len(seed.get('remediations', [])),
        'markets': len(seed.get('markets', [])),
        'incident_records': stats.get('statistics', {}).get('total', 0),
        'recent_incidents': stats.get('statistics', {}).get('recent', 0),
        'security_incidents': len(security_incidents),
        'security_solutions': len(security_solutions),
        'hotel_recommendations': len(sample_hotels),
    },
    'field_operations': {
        'facilities': seed.get('facilities', []),
        'markets': seed.get('markets', []),
        'top_facilities_by_incident_sample': facility_counts.most_common(10),
    },
    'visit_planner': {
        'route_facilities': seed.get('facilities', []),
        'nearby_facilities': nearby_facilities,
        'workflow': ['Select high-risk facilities', 'Optimize route', 'Generate visit plan', 'Hand off travel needs to Hotel Intelligence'],
    },
    'hotel_intelligence': {
        'workflow': build.get('user_workflows', {}).get('field_leader_booking_hotel', {}),
        'safety_scoring': build.get('key_algorithms', {}).get('safety_scoring', {}),
        'recommendation_ranking': build.get('key_algorithms', {}).get('recommendation_ranking', {}),
        'hotels': sample_hotels,
    },
    'incident_intelligence': {
        'stats': stats,
        'recent_incident_sample': incidents[:30],
        'incident_type_counts': incident_type_counts.most_common(12),
        'severity_counts': severity_counts.most_common(),
        'state_counts': state_counts.most_common(),
    },
    'security_mitigation': {
        'incidents': security_incidents[:80],
        'solutions': security_solutions,
        'incident_type_counts': security_type_counts.most_common(),
        'store_counts': security_store_counts.most_common(12),
        'cost_by_type': sorted(security_cost_by_type.items(), key=lambda x: x[1], reverse=True),
        'recommender_rules': next((f.get('rules_implemented') for f in features if 'Risk Mitigation Recommender' in f.get('feature_name','')), []),
        'roi_formula': next((f.get('formulas') for f in features if 'ROI Math' in f.get('feature_name','')), {}),
    },
    'tasks_governance': {
        'tasks': seed.get('tasks', []),
        'remediations': seed.get('remediations', []),
        'features': [f for f in features if 'Task' in f.get('feature_name', '') or 'Tasks' in f.get('feature_name', '')],
    },
}

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, indent=2), encoding='utf-8')
print(target)
print('files analyzed', len(doc_inventory), 'json bytes', target.stat().st_size)
