from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_TECH_PATH = PROJECT_ROOT / 'public' / 'data' / 'technology-health.json'
TARGET_PATH = PROJECT_ROOT / 'public' / 'data' / 'technology-health-region75.json'
REGION75_REALDATA_PATH = Path(
    r"C:\Users\c0r04l8\OneDrive - Walmart Inc\Jason Wilbur's files - FPI - D Team\02_Foundry_Pack\foundry_pack\03_Workspaces\Chris R - Working Folder\01_Task_Work\FPI-TECH-001\04_CCTV_Monitoring_Demo\region75-realdata.json"
)


def normalize_manufacturer(value: str | None) -> str:
    return (value or 'Unknown').strip().upper()


def normalize_profile(value: str | None) -> str:
    return (value or '').strip()


def infer_days_offline(camera: dict[str, Any]) -> int:
    # Deterministic synthetic-from-real derivation (camera_id + status) so renders stay stable.
    camera_id = int(camera.get('camera_id') or 0)
    status = str(camera.get('status_label') or '').lower()
    if status == 'offline':
        return 1 + (camera_id % 28)
    if status == 'unknown':
        return 1 + (camera_id % 7)
    return 0


def map_camera_type(camera: dict[str, Any]) -> str:
    return 'Analog' if bool(camera.get('is_analog')) else 'IP'


def make_vsrv_alias(store_number: str, vsrv_n: int | None) -> str:
    normalized = f"S{store_number.zfill(5)}"
    vsrv_index = 1 if not vsrv_n else max(1, min(99, int(vsrv_n)))
    return f"VSRV{vsrv_index:02d}.{normalized}.US"


def build_dataset() -> None:
    baseline = json.loads(BASE_TECH_PATH.read_text(encoding='utf-8'))
    region75 = json.loads(REGION75_REALDATA_PATH.read_text(encoding='utf-8'))

    stores = region75.get('stores', [])
    recorders = region75.get('recorders', [])
    cameras = region75.get('cameras', [])
    summary = region75.get('summary', {})

    generated_at = datetime.now(timezone.utc)

    store_by_number = {str(store.get('store')).zfill(5): store for store in stores}

    recorder_lookup: dict[tuple[str, int], dict[str, Any]] = {}
    recorder_by_store: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for recorder in recorders:
        store_number = str(recorder.get('store')).zfill(5)
        vsrv_n = int(recorder.get('vsrv_n') or 1)
        recorder_lookup[(store_number, vsrv_n)] = recorder
        recorder_by_store[store_number].append(recorder)

    ip_usage = Counter(str(camera.get('ip_address') or '') for camera in cameras if camera.get('ip_address'))

    store_directory = []
    store_health = []
    for store in stores:
        store_number = str(store.get('store')).zfill(5)
        store_name = store.get('name') or f'Store {store_number}'
        store_directory.append(
            {
                'storeNumber': store_number,
                'storeName': store_name,
                'siteAlias': store_number,
                'region': str(store.get('region') or '75'),
                'regionName': store.get('region_name') or 'Region 75',
                'market': str(store.get('market') or ''),
                'marketName': store.get('market_name') or 'Unknown Market',
                'city': store.get('city') or '',
                'state': store.get('state') or '',
                'storeHealthPercent': float(store.get('online_percent') or 0),
                'storeHealthStatus': store.get('health_status') or 'Warning',
                'totalCameras': int(store.get('total_cameras') or 0),
                'offlineCameras': int(store.get('offline_cameras') or 0),
                'recorderCount': int(store.get('vsrv_count') or 0),
                'lastCheckIn': store.get('last_scan') or generated_at.isoformat(),
                'healthReason': (
                    'Offline camera cluster detected'
                    if int(store.get('offline_cameras') or 0) > 0
                    else 'Unknown-status cameras require recorder validation'
                    if int(store.get('unknown_status') or 0) > 0
                    else 'Store operating within camera health threshold'
                ),
            }
        )
        store_health.append(
            {
                'siteAlias': f"{store_number} {store_name}",
                'region': str(store.get('region') or '75'),
                'facilityType': store.get('format') or 'Store',
                'vmsPlatform': 'Intellicene',
                'healthStatus': store.get('health_status') or 'Warning',
                'onlinePercent': float(store.get('online_percent') or 0),
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
                'vsrvCount': int(store.get('vsrv_count') or 0),
                'issueCameraCount': 0,
                'ptzCount': 0,
                'missingProfileCount': 0,
                'misplacedSubnetCount': int(store.get('misplaced_count') or 0),
                'lastScan': store.get('last_scan') or generated_at.isoformat(),
                'scanError': store.get('scan_error'),
            }
        )

    camera_inventory = []
    profile_warnings = []
    network_flags = []

    for camera in cameras:
        store_number = str(camera.get('store')).zfill(5)
        store = store_by_number.get(store_number, {})
        vsrv_n = camera.get('vsrv_n')
        resolved_vsrv_n = int(vsrv_n) if isinstance(vsrv_n, int) and vsrv_n > 0 else 1
        recorder = recorder_lookup.get((store_number, resolved_vsrv_n))
        recorder_alias = make_vsrv_alias(store_number, resolved_vsrv_n)
        recorder_fqdn = recorder.get('hostname') if recorder else f"{recorder_alias.lower()}.wal-mart.com"

        status_label = str(camera.get('status_label') or 'Unknown')
        camera_type = map_camera_type(camera)
        days_offline = infer_days_offline(camera)
        last_seen = (generated_at - timedelta(days=days_offline)).isoformat() if days_offline else (store.get('last_scan') or generated_at.isoformat())

        item = {
            'cameraId': int(camera.get('camera_id') or 0),
            'storeNumber': store_number,
            'storeName': store.get('name') or f'Store {store_number}',
            'siteAlias': store_number,
            'cameraName': camera.get('camera_name') or f"CAM-{camera.get('camera_id')}",
            'cameraType': camera_type,
            'statusLabel': status_label,
            'isIssue': bool(camera.get('is_issue')),
            'ipAddress': camera.get('ip_address') or '',
            'macAddress': camera.get('mac_address') or '',
            'manufacturer': normalize_manufacturer(camera.get('manufacturer')),
            'model': camera.get('model') or 'Unknown',
            'recordingProfile': normalize_profile(camera.get('recording_profile')),
            'retentionDays': camera.get('retention_days'),
            'daysOffline': days_offline,
            'lastSeen': last_seen,
            'assignedVsrvNumber': resolved_vsrv_n,
            'assignedServerAlias': recorder_alias,
            'assignedServerFqdn': recorder_fqdn,
            'recorderIpAddress': recorder.get('ip') if recorder else '',
            'firmwareVersion': camera.get('firmware_version') or '',
            'misplacedSubnet': bool(camera.get('misplaced_subnet')),
            'classificationNote': camera.get('classification_note') or '',
            'networkSegment': '192.168.x.x' if str(camera.get('ip_address') or '').startswith('192.168.') else 'other',
        }
        camera_inventory.append(item)

        if normalize_profile(camera.get('recording_profile')).lower() in {'', 'none', 'not in source', 'missing'}:
            profile_warnings.append(
                {
                    'storeNumber': store_number,
                    'storeName': store.get('name') or f'Store {store_number}',
                    'cameraName': item['cameraName'],
                    'recorderAssigned': recorder_alias,
                    'severity': 'High' if status_label in {'Offline', 'Unknown'} else 'Medium',
                    'warningType': 'No Recording Profile',
                }
            )

        if item['misplacedSubnet']:
            network_flags.append(
                {
                    'storeNumber': store_number,
                    'storeName': store.get('name') or f'Store {store_number}',
                    'cameraName': item['cameraName'],
                    'ipAddress': item['ipAddress'],
                    'flagType': 'Incorrect Subnet Placement',
                    'detail': item['classificationNote'] or 'Camera subnet does not align with expected store network segment.',
                    'severity': 'High',
                }
            )

    for ip_address, count in ip_usage.items():
        if not ip_address or count < 2:
            continue
        duplicates = [camera for camera in camera_inventory if camera['ipAddress'] == ip_address][:5]
        for camera in duplicates:
            network_flags.append(
                {
                    'storeNumber': camera['storeNumber'],
                    'storeName': camera['storeName'],
                    'cameraName': camera['cameraName'],
                    'ipAddress': ip_address,
                    'flagType': 'Duplicate IP',
                    'detail': f'Duplicate IP detected across {count} camera records within Region 75 inventory.',
                    'severity': 'Medium',
                }
            )

    invalid_segments = [camera for camera in camera_inventory if camera['networkSegment'] == 'other']
    for camera in invalid_segments[:40]:
        network_flags.append(
            {
                'storeNumber': camera['storeNumber'],
                'storeName': camera['storeName'],
                'cameraName': camera['cameraName'],
                'ipAddress': camera['ipAddress'],
                'flagType': 'Invalid Network Segment',
                'detail': 'Camera IP address is outside expected 192.168.x.x store camera segment.',
                'severity': 'Medium',
            }
        )

    store_health_by_number = {entry['siteAlias'].split(' ')[0]: entry for entry in store_health}
    for camera in camera_inventory:
        store_entry = store_health_by_number.get(camera['storeNumber'])
        if not store_entry:
            continue
        if camera['isIssue']:
            store_entry['issueCameraCount'] += 1
        if camera['cameraType'] == 'IP' and camera['statusLabel'] == 'Offline':
            store_entry['ipOffline'] += 1
        if camera['cameraType'] == 'Analog' and camera['statusLabel'] == 'Offline':
            store_entry['analogOffline'] += 1
        if camera['cameraType'] == 'IP' and camera.get('isIssue'):
            store_entry['ptzCount'] += 1 if camera.get('cameraName', '').find('PTZ') >= 0 else 0
    for warning in profile_warnings:
        store_entry = store_health_by_number.get(warning['storeNumber'])
        if store_entry:
            store_entry['missingProfileCount'] += 1
    for flag in network_flags:
        store_entry = store_health_by_number.get(flag['storeNumber'])
        if store_entry:
            store_entry['misplacedSubnetCount'] += 1

    recorder_health = []
    for recorder in recorders:
        store_number = str(recorder.get('store')).zfill(5)
        recorder_health.append(
            {
                'siteAlias': f"{store_number} {(store_by_number.get(store_number, {}).get('name') or '')}".strip(),
                'recorderAlias': recorder.get('hostname') or make_vsrv_alias(store_number, int(recorder.get('vsrv_n') or 1)),
                'vmsPlatform': 'Intellicene',
                'recorderStatus': recorder.get('recorder_status') or 'Unknown',
                'alive': bool(recorder.get('alive')),
                'cameraCount': int(recorder.get('camera_count') or 0),
                'lastSeen': recorder.get('last_seen') or generated_at.isoformat(),
            }
        )

    baseline['metadata']['sourceNote'] = 'Region 75 Intellicene CCTV/VMS view using real store/camera inventory with Windows-based VSRV server assignments.'
    baseline['metadata']['generatedAt'] = generated_at.isoformat()
    baseline['metadata']['dataMode'] = 'region75_realistic_operational_snapshot'

    baseline['regionSummary']['region'] = str(summary.get('region') or baseline['regionSummary'].get('region') or '75')
    baseline['regionSummary']['stores'] = int(summary.get('stores') or len(stores))
    baseline['regionSummary']['recorders'] = int(summary.get('recorders') or len(recorders))
    baseline['regionSummary']['totalCameras'] = int(summary.get('total_cameras') or len(cameras))
    baseline['regionSummary']['onlineCameras'] = int(summary.get('online_cameras') or baseline['regionSummary'].get('onlineCameras') or 0)
    baseline['regionSummary']['offlineCameras'] = int(summary.get('offline_cameras') or baseline['regionSummary'].get('offlineCameras') or 0)
    baseline['regionSummary']['issueCameras'] = int(summary.get('issue_cameras') or baseline['regionSummary'].get('issueCameras') or 0)
    baseline['regionSummary']['ipCameras'] = int(summary.get('ip_cameras') or baseline['regionSummary'].get('ipCameras') or 0)
    baseline['regionSummary']['analogCameras'] = int(summary.get('analog_cameras') or baseline['regionSummary'].get('analogCameras') or 0)
    baseline['regionSummary']['onlinePercent'] = float(summary.get('online_percent') or baseline['regionSummary'].get('onlinePercent') or 0)
    baseline['regionSummary']['healthStatus'] = summary.get('health_status') or baseline['regionSummary'].get('healthStatus') or 'Warning'
    baseline['regionSummary']['recordingProfileAssigned'] = int(summary.get('recording_profile_assigned') or 0)
    baseline['regionSummary']['recordingProfileMissing'] = int(summary.get('recording_profile_missing') or 0)
    baseline['regionSummary']['retentionOk'] = int(summary.get('retention_ok') or 0)
    baseline['regionSummary']['retentionBelow30d'] = int(summary.get('retention_below_30d') or 0)
    baseline['regionSummary']['retentionUnknown'] = int(summary.get('retention_unknown') or 0)
    baseline['regionSummary']['storeHealthDistribution'] = dict(Counter(store.get('health_status', 'Unknown') for store in stores))

    baseline['storeHealth'] = store_health
    baseline['recorderHealth'] = recorder_health
    baseline['storeDirectory'] = store_directory
    baseline['cameraInventory'] = camera_inventory
    baseline['profileWarnings'] = profile_warnings
    baseline['networkPlacementFlags'] = network_flags

    offline_cameras = [camera for camera in camera_inventory if camera['statusLabel'] == 'Offline']
    unknown_cameras = [camera for camera in camera_inventory if camera['statusLabel'] == 'Unknown']
    unstable_candidates = [camera for camera in camera_inventory if camera['isIssue'] and camera['statusLabel'] in {'Offline', 'Unknown'}]

    baseline['eventSummary'] = {
        'retentionBelowPolicyCount': int(summary.get('retention_below_30d') or 0),
        'vsrvRecorderDegradedCount': sum(1 for recorder in recorders if str(recorder.get('recorder_status') or '').lower() in {'offline', 'critical', 'degraded', 'warning', 'unknown'}),
        'vsrvStorageDegradedCount': max(1, len([flag for flag in network_flags if flag['flagType'] == 'Duplicate IP']) // 5),
        'vsrvTemperatureWarningCount': max(1, len(recorders) // 25),
        'cameraOfflineAlertCount': len(offline_cameras),
        'repeatedCameraInstabilityCount': len(unstable_candidates),
        'offlineClusterStoreCount': len({camera['storeNumber'] for camera in offline_cameras}),
        'unknownCameraCount': len(unknown_cameras),
    }

    baseline['analytics'] = {
        'storeStatusCounts': dict(Counter(store.get('health_status', 'Unknown') for store in stores)),
        'recorderStatusCounts': dict(Counter((recorder.get('recorder_status') or 'Unknown') for recorder in recorders)),
        'cameraCategoryCounts': dict(Counter(camera['cameraType'] for camera in camera_inventory)),
        'cameraStatusCounts': dict(Counter(camera['statusLabel'] for camera in camera_inventory)),
        'manufacturerCounts': dict(Counter(camera['manufacturer'] for camera in camera_inventory).most_common(10)),
        'topOfflineStores': sorted(store_health, key=lambda store: store['offlineCameras'], reverse=True)[:12],
        'topIssueStores': sorted(store_health, key=lambda store: (store['issueCameraCount'] + store['missingProfileCount'] + store['misplacedSubnetCount']), reverse=True)[:12],
    }

    baseline['complianceSummary']['profileWarnings'] = len(profile_warnings)
    baseline['complianceSummary']['networkPlacementFlags'] = len(network_flags)
    baseline['complianceSummary']['storeComplianceCards'] = len(stores)
    baseline['complianceSummary']['criticalServiceTicketCandidates'] = sum(
        1
        for store in stores
        if str(store.get('health_status') or '').lower() == 'critical' or int(store.get('offline_cameras') or 0) >= 20
    )

    TARGET_PATH.write_text(json.dumps(baseline, indent=2), encoding='utf-8')
    print(f'Wrote {TARGET_PATH}')
    print(f"stores={len(stores)} recorders={len(recorders)} cameras={len(camera_inventory)}")
    print(f"profile_warnings={len(profile_warnings)} network_flags={len(network_flags)} offline={len(offline_cameras)}")


if __name__ == '__main__':
    build_dataset()
