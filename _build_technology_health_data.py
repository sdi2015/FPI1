from pathlib import Path
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone

SOURCE = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Chris R - Working Folder\01_Task_Work\FPI-TECH-001')
TARGET = Path(r'C:\Users\j0w16ja\OneDrive - Walmart Inc\FPI - D Team\02_Foundry_Pack\foundry_pack\02_Active_Build\FPI_202605\public\data\technology-health.json')

normalized = json.loads((SOURCE / '01_Normalized_Model/synthetic-technology-health-adapter-output.json').read_text(encoding='utf-8'))
real_api = json.loads((SOURCE / '04_CCTV_Monitoring_Demo/real-api-health-summary.json').read_text(encoding='utf-8'))
region_vms = json.loads((SOURCE / '04_CCTV_Monitoring_Demo/region75-vms-health.json').read_text(encoding='utf-8'))
region_real = json.loads((SOURCE / '04_CCTV_Monitoring_Demo/region75-realdata.json').read_text(encoding='utf-8'))

stores = region_vms.get('stores', [])
recorders = region_vms.get('recorders', [])
cameras = region_vms.get('cameras', [])
real_summary = region_real.get('summary', {})
region_summary = region_vms.get('summary', {})

recorders_by_site = defaultdict(list)
for recorder in recorders:
    recorders_by_site[recorder.get('site_alias', 'Unknown')].append(recorder)

camera_by_site = defaultdict(list)
for camera in cameras:
    camera_by_site[camera.get('site_alias', 'Unknown')].append(camera)

store_health = []
for store in stores:
    site_alias = store.get('site_alias', 'Unknown')
    site_cameras = camera_by_site.get(site_alias, [])
    issue_count = sum(1 for cam in site_cameras if cam.get('is_issue'))
    ptz_count = sum(1 for cam in site_cameras if cam.get('is_ptz'))
    missing_profile = sum(1 for cam in site_cameras if str(cam.get('recording_profile') or '').lower() in {'not in source', 'none', '', 'missing'})
    misplaced_subnet = int(store.get('misplaced_subnet_count') or sum(1 for cam in site_cameras if cam.get('misplaced_subnet')))
    store_health.append({
        'siteAlias': site_alias,
        'region': store.get('region', 'Region 75'),
        'facilityType': store.get('facility_type', 'Store'),
        'vmsPlatform': store.get('vms_platform', 'VMS'),
        'healthStatus': store.get('health_status', 'Unknown'),
        'onlinePercent': round(float(store.get('online_percent') or 0), 1),
        'totalCameras': int(store.get('total_cameras') or 0),
        'onlineCameras': int(store.get('online_cameras') or 0),
        'offlineCameras': int(store.get('offline_cameras') or 0),
        'unknownStatus': int(store.get('unknown_status') or 0),
        'ipTotal': int(store.get('ip_total') or 0),
        'ipOnline': int(store.get('ip_online') or 0),
        'ipOffline': int(store.get('ip_offline') or 0),
        'analogTotal': int(store.get('analog_total') or 0),
        'analogOnline': int(store.get('analog_online') or 0),
        'analogOffline': int(store.get('analog_offline') or 0),
        'vsrvCount': int(store.get('vsrv_count') or len(recorders_by_site.get(site_alias, []))),
        'issueCameraCount': issue_count,
        'ptzCount': ptz_count,
        'missingProfileCount': missing_profile,
        'misplacedSubnetCount': misplaced_subnet,
        'lastScan': store.get('last_scan'),
        'scanError': store.get('scan_error'),
    })

recorder_health = []
for recorder in recorders:
    site_alias = recorder.get('site_alias', 'Unknown')
    recorder_health.append({
        'siteAlias': site_alias,
        'recorderAlias': recorder.get('recorder_alias') or f"Recorder {len(recorder_health) + 1}",
        'vmsPlatform': recorder.get('vms_platform', 'VMS'),
        'recorderStatus': recorder.get('recorder_status', 'Unknown'),
        'alive': bool(recorder.get('alive')),
        'cameraCount': int(recorder.get('camera_count') or 0),
        'lastSeen': recorder.get('last_seen'),
    })

status_counts = Counter(s['healthStatus'] for s in store_health)
recorder_status_counts = Counter(r['recorderStatus'] for r in recorder_health)
camera_category_counts = Counter(str(cam.get('category') or 'Uncategorized') for cam in cameras)
camera_status_counts = Counter(str(cam.get('status_label') or cam.get('camera_status_code') or 'Unknown') for cam in cameras)
manufacturer_counts = Counter(str(cam.get('manufacturer') or 'Unknown') for cam in cameras)

critical_stores = [s for s in store_health if s['healthStatus'].lower() == 'critical']
warning_stores = [s for s in store_health if s['healthStatus'].lower() == 'warning']
top_offline = sorted(store_health, key=lambda s: (s['offlineCameras'], -s['onlinePercent']), reverse=True)[:12]
top_issue = sorted(store_health, key=lambda s: (s['issueCameraCount'], s['missingProfileCount'], s['misplacedSubnetCount']), reverse=True)[:12]

# Synthetic work queue based on safe aggregates only.
work_queue = []
for store in top_offline[:8]:
    severity = 'Critical' if store['healthStatus'] == 'Critical' or store['offlineCameras'] >= 20 else 'High' if store['offlineCameras'] >= 8 else 'Medium'
    channel = 'ServiceChannel' if severity in {'Critical', 'High'} else 'Me@Walmart'
    work_queue.append({
        'id': f"cam-ticket-{store['siteAlias'].lower()}",
        'siteAlias': store['siteAlias'],
        'title': f"Grouped CCTV outage review for {store['offlineCameras']} offline cameras",
        'severity': severity,
        'channel': channel,
        'assignmentGroup': 'Security Technology Technicians / CCTV Service Program',
        'status': 'Ready for simulated ticket',
        'evidenceRequired': True,
        'sla': '24h response' if severity == 'Critical' else '72h review',
    })

predictive = []
for store in sorted(store_health, key=lambda s: (s['onlinePercent'], -s['offlineCameras']))[:10]:
    drivers = []
    if store['onlinePercent'] < 85:
        drivers.append('Below critical online-health threshold')
    elif store['onlinePercent'] < 98:
        drivers.append('Below healthy online-health threshold')
    if store['missingProfileCount']:
        drivers.append('Recording profile gap')
    if store['misplacedSubnetCount']:
        drivers.append('Network placement exception')
    if store['analogOffline']:
        drivers.append('Analog camera validation gap')
    score = min(100, round((100 - store['onlinePercent']) * 3 + store['offlineCameras'] * 0.7 + store['missingProfileCount'] * 0.15 + store['misplacedSubnetCount'] * 2))
    predictive.append({
        'siteAlias': store['siteAlias'],
        'riskScore': score,
        'forecast': 'Critical service risk' if score >= 70 else 'Degradation likely' if score >= 40 else 'Watch list',
        'drivers': drivers[:4] or ['Online health trend watch'],
        'recommendedAction': 'Open grouped CCTV service ticket' if score >= 70 else 'Validate VMS/recorder and retention profile health',
    })

payload = {
    'metadata': {
        'sourceTask': 'FPI-TECH-001',
        'sourceOwner': 'Chris R / Chris Routzahn',
        'classification': 'Walmart Internal / Need-to-Know - Draft',
        'dataMode': 'synthetic_demo_and_sanitized_aggregate',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'sourceNote': 'Raw camera/network identifiers are intentionally excluded from default UI data. Use approved role-gated detail before exposing technical identifiers.',
        'analyzedFileCount': sum(1 for p in SOURCE.rglob('*') if p.is_file()),
    },
    'adapterRun': normalized.get('adapter_run', {}),
    'sourceFreshness': normalized.get('source_freshness', []),
    'technologyIssues': normalized.get('technology_issues', []),
    'fleetSummary': {
        'totalCameras': real_api.get('fleet', {}).get('total_cameras', 0),
        'onlineCameras': real_api.get('fleet', {}).get('online', 0),
        'offlineCameras': real_api.get('fleet', {}).get('offline', 0),
        'onlinePercent': real_api.get('fleet', {}).get('online_pct', 0),
        'status': real_api.get('fleet', {}).get('status', 'unknown'),
        'storeCount': real_api.get('store_count', 0),
        'storeHealthDistribution': real_api.get('store_health_distribution', {}),
        'thresholds': real_api.get('thresholds', {}),
        'intelSummary': real_api.get('intel_summary', {}),
        'marchSummary': real_api.get('march', {}),
    },
    'regionSummary': {
        'region': region_summary.get('region') or real_summary.get('region') or 'Region 75',
        'stores': real_summary.get('stores') or len(stores),
        'recorders': real_summary.get('recorders') or len(recorders),
        'totalCameras': real_summary.get('total_cameras') or len(cameras),
        'onlineCameras': real_summary.get('online_cameras') or sum(s['onlineCameras'] for s in store_health),
        'offlineCameras': real_summary.get('offline_cameras') or sum(s['offlineCameras'] for s in store_health),
        'issueCameras': real_summary.get('issue_cameras') or sum(s['issueCameraCount'] for s in store_health),
        'ipCameras': real_summary.get('ip_cameras') or sum(s['ipTotal'] for s in store_health),
        'analogCameras': real_summary.get('analog_cameras') or sum(s['analogTotal'] for s in store_health),
        'onlinePercent': real_summary.get('online_percent') or round(sum(s['onlineCameras'] for s in store_health) / max(1, sum(s['totalCameras'] for s in store_health)) * 100, 1),
        'healthStatus': real_summary.get('health_status') or 'Warning',
        'storeHealthDistribution': dict(status_counts),
        'recordingProfileAssigned': real_summary.get('recording_profile_assigned'),
        'recordingProfileMissing': real_summary.get('recording_profile_missing') or sum(s['missingProfileCount'] for s in store_health),
        'retentionOk': real_summary.get('retention_ok'),
        'retentionBelow30d': real_summary.get('retention_below_30d'),
        'retentionUnknown': real_summary.get('retention_unknown'),
    },
    'storeHealth': store_health,
    'recorderHealth': recorder_health,
    'analytics': {
        'storeStatusCounts': dict(status_counts),
        'recorderStatusCounts': dict(recorder_status_counts),
        'cameraCategoryCounts': dict(camera_category_counts.most_common(12)),
        'cameraStatusCounts': dict(camera_status_counts.most_common(12)),
        'manufacturerCounts': dict(manufacturer_counts.most_common(10)),
        'topOfflineStores': top_offline,
        'topIssueStores': top_issue,
    },
    'complianceSummary': {
        'policySource': 'AP-14 visible policy scan notes; division-specific guideline thresholds remain configurable.',
        'policyImplications': [
            'Create service tickets for non-operational cameras through the CCTV Service Program.',
            'Route physical camera add/remove/move work to authorized Security Technology Technicians or designated contractors.',
            'Flag prohibited/private area coverage risks when camera placement metadata exists.',
            'Flag unauthorized audio recording if audio metadata exists.',
            'Keep retention thresholds configurable because visible AP-14 text does not define one fixed duration.',
        ],
        'storeComplianceCards': len(store_health),
        'criticalServiceTicketCandidates': sum(1 for s in store_health if s['healthStatus'] == 'Critical' or s['offlineCameras'] >= 20),
        'profileWarnings': sum(s['missingProfileCount'] for s in store_health),
        'networkPlacementFlags': sum(s['misplacedSubnetCount'] for s in store_health),
    },
    'predictiveSummary': {
        'scope': 'Region 75 sanitized aggregate/store-level CCTV health',
        'candidates': predictive,
    },
    'workQueue': work_queue,
    'governanceChecklist': [
        'Source owner approval',
        'Data classification review',
        'Secrets-management design',
        'Read-only versus writeback approval',
        'Rate limit and failure-mode design',
        'Audit logging and retention design',
        'Role-based access rules for engineer detail',
        'Mapping tests from source payload to FPI TechnologyIssue',
        'Synthetic fallback behavior',
        'Integration review sign-off',
    ],
}

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(payload, indent=2), encoding='utf-8')
print(TARGET)
print('stores', len(store_health), 'recorders', len(recorder_health), 'work_queue', len(work_queue), 'bytes', TARGET.stat().st_size)
