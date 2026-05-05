from pathlib import Path
import json
from collections import defaultdict

build_root = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\02_Active_Build\FPI_202605')
source_root = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Cody S - Working Folder\03_Handoff_Drafts\fpi-dashboard')
data_path = build_root / 'public' / 'data' / 'executive-protection-readiness.json'
report_path = build_root / 'EPR_SOURCE_ANALYSIS_AND_UI_IMPLEMENTATION.md'

data = json.loads(data_path.read_text(encoding='utf-8'))

category_rules = [
    ('Markdown handoff / product notes', lambda p: p.suffix.lower() == '.md'),
    ('FastAPI / Python application logic', lambda p: p.suffix.lower() == '.py' and 'services' not in p.parts),
    ('Python service modules', lambda p: p.suffix.lower() == '.py' and 'services' in p.parts),
    ('Jinja / HTML templates', lambda p: p.suffix.lower() == '.html'),
    ('JSON source data / captured payloads', lambda p: p.suffix.lower() == '.json'),
    ('SQLite operational demo database', lambda p: p.suffix.lower() == '.db'),
    ('Runtime / environment files', lambda p: p.suffix.lower() in {'.txt', '.bat'} or p.name in {'requirements.txt', '8'}),
]

def category_for(path_str: str) -> str:
    p = Path(path_str)
    for label, rule in category_rules:
        try:
            if rule(p):
                return label
        except Exception:
            pass
    return 'Other analyzed source assets'

files_by_category = defaultdict(list)
for item in data['source_inventory']:
    files_by_category[category_for(item['path'])].append(item)

implementation_map = [
    ('Executive Protection Readiness / Overview', 'Program modules, source-package KPIs, highest-risk visit facilities, and source coverage.'),
    ('Executive Protection Readiness / Visit Planner', 'Route facilities, visit workflow, field planning queue, and travel handoff flow.'),
    ('Executive Protection Readiness / Hotel Intelligence', 'Hotel safety scoring, Spotnana-style recommendation ranking, safety factors, and preferred hotel options.'),
    ('Executive Protection Readiness / Incident Risk', 'Incident counts, recent incident samples, incident-type mix, severity/state distributions.'),
    ('Executive Protection Readiness / Security Mitigation', 'Security Mitigation Manager incidents, control catalog, recommender rules, cost/ROI inputs.'),
    ('Executive Protection Readiness / Tasks & Governance', 'Task ownership, remediation counts, priority/SLA queue, evidence-required governance.'),
    ('Executive Protection Readiness / Source Analysis', 'Every inventoried Cody handoff file grouped by type with path/type/size visibility.'),
]

lines = []
lines.append('# Executive Protection Readiness Source Analysis + UI Implementation')
lines.append('')
lines.append('Status: **Finished and implemented into the active FPI UI build.**')
lines.append('')
lines.append(f'Source folder analyzed: `{source_root}`')
lines.append(f'Active build folder: `{build_root}`')
lines.append('')
lines.append('## Data package generated')
lines.append('')
lines.append('- `public/data/executive-protection-readiness.json`')
lines.append(f"- Data environment: `{data['metadata']['data_environment']}`")
lines.append(f"- Classification note: {data['metadata']['classification']}")
lines.append(f"- Files inventoried in generated data package: **{len(data['source_inventory'])}**")
lines.append('')
lines.append('## Key extracted metrics')
lines.append('')
for key, value in data['kpis'].items():
    lines.append(f'- **{key.replace("_", " ").title()}**: {value}')
lines.append('')
lines.append('## UI placement')
lines.append('')
for target, details in implementation_map:
    lines.append(f'- **{target}** — {details}')
lines.append('')
lines.append('## Source files analyzed by category')
lines.append('')
for category in sorted(files_by_category):
    items = sorted(files_by_category[category], key=lambda x: x['path'].lower())
    lines.append(f'### {category} ({len(items)})')
    lines.append('')
    for item in items:
        lines.append(f'- `{item["path"]}` — {item["bytes"]:,} bytes')
    lines.append('')
lines.append('## Implementation files changed/created')
lines.append('')
lines.extend([
    '- `public/data/executive-protection-readiness.json` — normalized EPR data package created from the Cody handoff folder.',
    '- `src/data/eprTypes.ts` — typed EPR data model for the UI.',
    '- `src/data/useEprData.ts` — React loader hook for the EPR JSON package.',
    '- `src/components/views/ExecutiveProtectionReadinessView.tsx` — EPR workspace rebuilt with sub-tabs.',
    '- `src/epr.css` — dedicated EPR presentation layer.',
    '- `src/main.tsx` — imports the EPR stylesheet.',
])
lines.append('')
lines.append('## Notes')
lines.append('')
lines.append('- The old Command Center remains separate from EPR.')
lines.append('- Travel, hotel safety, incident intelligence, security mitigation, and task governance now live under the Executive Protection Readiness main tab as sub-tabs.')
lines.append('- Source data appears to be synthetic/demo handoff data, not production protection/travel records.')

report_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(report_path)
