from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEAM_ROOT = PROJECT_ROOT.parents[3]
SOURCE_DATA = TEAM_ROOT / "data"
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
NOW = datetime(2026, 5, 5, 12, 0, tzinfo=timezone.utc)


def read_csv(name: str) -> list[dict[str, str]]:
    with (SOURCE_DATA / name).open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def number(value: Any, fallback: float = 0) -> float:
    try:
        if value in (None, ""):
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def integer(value: Any, fallback: int = 0) -> int:
    return int(round(number(value, fallback)))


def yes_no(value: Any) -> bool:
    return str(value).strip().lower() in {"yes", "y", "true", "1"}


def iso(days_delta: int, hours_delta: int = 0) -> str:
    return (NOW + timedelta(days=days_delta, hours=hours_delta)).isoformat().replace("+00:00", "Z")


def risk_tier(score: float) -> str:
    if score >= 85:
        return "Critical"
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def severity_for_priority(priority: str) -> str:
    normalized = priority.lower()
    if normalized == "critical":
        return "Critical"
    if normalized == "high":
        return "High"
    if normalized == "medium":
        return "Medium"
    return "Low"


def build_inputs() -> dict[str, list[dict[str, str]]]:
    return {
        "facilities": read_csv("facilities.csv"),
        "technology": read_csv("security_technology.csv"),
        "tasks": read_csv("tasks.csv"),
        "remediations": read_csv("remediations.csv"),
        "leadership": read_csv("store_leadership.csv"),
        "users": read_csv("users.csv"),
        "hotels": read_csv("hotels.csv"),
        "incidents": read_csv("region_75_incidents (2).csv"),
    }


def enrich_facilities(inputs: dict[str, list[dict[str, str]]]) -> list[dict[str, Any]]:
    task_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for task in inputs["tasks"]:
        task_counts[task["facility_id"]][task["priority"]] += 1
        task_counts[task["facility_id"]]["open"] += 0 if task["status"] == "Closed" else 1
        task_counts[task["facility_id"]]["overdue"] += 1 if task["status"] in {"Open", "Blocked"} and task["priority"] in {"Critical", "High"} else 0

    leadership_by_id = {row["facility_id"]: row for row in inputs["leadership"]}
    tech_by_id = {row["facility_id"]: row for row in inputs["technology"]}
    facilities: list[dict[str, Any]] = []

    for row in inputs["facilities"]:
        facility_id = row["facility_id"]
        counts = task_counts[facility_id]
        tech = tech_by_id.get(facility_id, {})
        leadership = leadership_by_id.get(facility_id, {})
        camera_count = integer(tech.get("camera_count"))
        score = min(100, counts["Critical"] * 18 + counts["High"] * 10 + counts["open"] * 4 + max(0, camera_count - 80) * 0.12)
        facilities.append({
            "facility_id": facility_id,
            "facility_name": row.get("facility_name") or f"Store #{facility_id}",
            "market": row.get("market") or leadership.get("market") or "Unknown",
            "region": row.get("region") or "Unknown",
            "division": row.get("division") or "Unknown",
            "city": leadership.get("city") or "Unknown",
            "state": leadership.get("state") or "Unknown",
            "address": leadership.get("address") or "Unknown",
            "banner": "Supercenter",
            "open_task_count": counts["open"],
            "overdue_task_count": counts["overdue"],
            "critical_task_count": counts["Critical"],
            "avg_remediation_hours": integer(row.get("avg_remediation_hours")),
            "risk_score": round(score, 1),
            "risk_tier": risk_tier(score),
            "data_mode": "canonical_demo",
        })
    return facilities


def build_master(inputs: dict[str, list[dict[str, str]]], facilities: list[dict[str, Any]]) -> dict[str, Any]:
    facility_by_id = {facility["facility_id"]: facility for facility in facilities}
    tasks: list[dict[str, Any]] = []
    alarm_signals: list[dict[str, Any]] = []
    camera_issues: list[dict[str, Any]] = []

    for index, task in enumerate(inputs["tasks"]):
        facility = facility_by_id.get(task["facility_id"])
        if not facility:
            continue
        evidence_required = yes_no(task.get("evidence_required"))
        priority = task.get("priority") or "Medium"
        status = task.get("status") or "Open"
        tasks.append({**task, "evidence_required": evidence_required, "sla_hours": integer(task.get("sla_hours"))})

        title = (task.get("title") or "").lower()
        severity = severity_for_priority(priority)
        if "camera" in title or "dvr" in title or "network" in title:
            camera_issues.append({
                "camera_issue_id": f"CAM-{1000 + index}",
                "facility_id": task["facility_id"],
                "facility_name": facility["facility_name"],
                "region": facility["region"],
                "market": facility["market"],
                "camera_id": f"{task['facility_id']}-CAM-{(index % 24) + 1:02d}",
                "camera_area": "Sales Floor" if "camera" in title else "Network Closet",
                "camera_issue_type": task.get("title") or "Camera/VMS exception",
                "severity": severity,
                "status": status,
                "detected_at": iso(-2, index % 12),
                "retention_days_available": max(7, 45 - index % 21),
                "last_good_frame_at": iso(-1, -(index % 8)),
                "vms_health": "Degraded" if severity in {"Critical", "High"} else "Normal",
                "network_health": "Warning" if "network" in title else "Normal",
                "vendor_ticket_id": f"VND-{7000 + index}" if status != "Closed" else "",
                "notes": task.get("description") or "Canonical task-derived camera exception",
            })
        if "fire" in title or "alarm" in title or "suppression" in title:
            alarm_signals.append({
                "signal_id": f"SIG-{1000 + index}",
                "facility_id": task["facility_id"],
                "facility_name": facility["facility_name"],
                "region": facility["region"],
                "market": facility["market"],
                "signal_type": "Fire Panel Trouble" if "fire" in title else "Alarm Exception",
                "signal_category": "Life Safety",
                "severity": severity,
                "priority": priority,
                "occurred_at": iso(-3, index % 10),
                "acknowledged_at": iso(-3, (index % 10) + 1),
                "status": status,
                "source_panel_type": "EST4 / canonical demo",
                "source_zone": "Main Building",
                "false_alarm_likelihood": round((index % 6) / 10, 2),
                "dispatch_required": severity in {"Critical", "High"},
                "notes": task.get("description") or "Canonical task-derived alarm signal",
            })

    panel_inventory = []
    for index, tech in enumerate(inputs["technology"]):
        facility = facility_by_id.get(tech["facility_id"])
        if not facility:
            continue
        panel_inventory.append({
            "panel_id": f"PAN-{tech['facility_id']}",
            "facility_id": tech["facility_id"],
            "facility_name": facility["facility_name"],
            "panel_type": tech.get("intrusion_detection") or "Security panel",
            "panel_vendor": (tech.get("intrusion_detection") or "Unknown").split(" ")[0],
            "panel_model": tech.get("dvr_model") or "Unknown",
            "firmware_version": f"2026.{(index % 9) + 1}",
            "health_score": max(35, 100 - facility["risk_score"]),
            "status": "Trouble" if facility["risk_score"] >= 85 else "Warning" if facility["risk_score"] >= 60 else "Normal",
            "last_inspection_date": iso(-30 - index),
            "next_inspection_due": iso(180 - index),
            "battery_health": "Replace" if facility["risk_score"] >= 85 else "Good",
            "line_supervision": "Normal",
            "data_mode": "canonical_demo",
        })

    return {
        "metadata": [{
            "dataset_name": "fpi_canonical_program_master",
            "classification": "Walmart Internal / Synthetic Demo",
            "data_mode": "canonical_demo",
            "generated_at": NOW.isoformat(),
            "region": "Canonical cross-service demo",
            "source_note": "Generated from top-level FPI data folder CSVs so facility_id is shared across FPI, EPR, Fire, Technology, and Remediation views.",
            "facility_count": len(facilities),
        }],
        "facilities": facilities,
        "security_technology": [{**row, "camera_count": integer(row.get("camera_count")), "card_readers": integer(row.get("card_readers")), "panic_buttons": integer(row.get("panic_buttons")), "asset_protection_towers": integer(row.get("asset_protection_towers"))} for row in inputs["technology"]],
        "panel_inventory": panel_inventory,
        "alarm_signals": alarm_signals,
        "camera_issues": camera_issues,
        "incidents": inputs["incidents"][:120],
        "tasks": tasks,
        "remediations": [{**row, "sla_hours": integer(row.get("sla_hours")), "reopened_count": integer(row.get("reopened_count"))} for row in inputs["remediations"]],
        "store_leadership": inputs["leadership"],
        "users": inputs["users"],
        "schema_column_catalog": [],
        "data_dictionary": [],
    }


def build_fire(facilities: list[dict[str, Any]], master: dict[str, Any]) -> dict[str, Any]:
    sites = []
    devices = []
    events = []
    inspections = []
    service_records = []
    deficiencies = []
    compliance_reports = []
    recommendations = []

    signal_count = Counter(signal["facility_id"] for signal in master["alarm_signals"])
    task_count = Counter(task["facility_id"] for task in master["tasks"] if task.get("status") != "Closed")

    for index, facility in enumerate(facilities):
        facility_id = facility["facility_id"]
        active_troubles = min(4, signal_count[facility_id])
        open_deficiencies = min(6, task_count[facility_id] // 2)
        false_alarms = index % 4
        panel_type = ["Edwards EST4", "Honeywell VISTA", "Siemens Cerberus", "Notifier NFS2"][index % 4]
        site = {
            "id": facility_id,
            "name": facility["facility_name"],
            "city": facility["city"],
            "state": facility["state"],
            "region": facility["region"],
            "format": facility["banner"],
            "sqft": 145000 + index * 4250,
            "panelType": panel_type,
            "monitoringType": "IP/Cellular",
            "lastInspection": iso(-45 - index),
            "nextInspectionDue": iso(275 - index),
            "openDeficiencies": open_deficiencies,
            "falseAlarms90Days": false_alarms,
            "activeTroubles": active_troubles,
            "riskScore": facility["risk_score"],
            "complianceStatus": "Escalated" if active_troubles else "Action Required" if open_deficiencies else "Normal",
            "contractor": ["Metro Fire Services", "Cintas", "Johnson Controls", "APi National Service Group"][index % 4],
            "ahj": f"{facility['city']} Fire Department",
            "status": "Operational",
        }
        sites.append(site)
        for device_index in range(6):
            devices.append({
                "id": f"DEV-{facility_id}-{device_index + 1}",
                "siteId": facility_id,
                "address": f"{device_index + 1:03d}",
                "type": ["Smoke Detector", "Pull Station", "Waterflow", "Tamper", "Horn/Strobe", "Panel"][device_index],
                "area": ["Grocery", "Front End", "Receiving", "Pharmacy", "Sales Floor", "Electrical Room"][device_index],
                "panel": panel_type,
                "installDate": iso(-900 - device_index),
                "lastTested": iso(-40 - device_index),
                "status": "Trouble" if device_index < active_troubles else "Normal",
                "serviceCount": device_index % 3,
                "falseAlarmCount": false_alarms if device_index == 0 else 0,
            })
        for event_index in range(max(1, active_troubles + false_alarms)):
            events.append({
                "id": f"EVT-{facility_id}-{event_index + 1}",
                "siteId": facility_id,
                "deviceId": f"DEV-{facility_id}-{(event_index % 6) + 1}",
                "date": iso(-event_index - index),
                "type": "Trouble" if active_troubles else "Supervisory",
                "rootCause": "Panel trouble / task-derived signal",
                "area": "Main Building",
                "cmsReceived": iso(-event_index - index, 1),
                "timeToAcknowledge": 6 + event_index,
                "timeToRestore": 45 + event_index * 5,
                "notes": "Canonical fire event generated from shared facility scope.",
            })
        inspections.append({
            "id": f"INSP-{facility_id}",
            "siteId": facility_id,
            "date": site["lastInspection"],
            "type": "Annual",
            "inspector": "FPI Fire Assurance",
            "contractor": site["contractor"],
            "result": "Pass with deficiencies" if open_deficiencies else "Pass",
            "deviceTestCompletion": 96 - open_deficiencies,
            "cmsVerified": True,
            "documentationComplete": open_deficiencies == 0,
        })
        for deficiency_index in range(open_deficiencies):
            severity = "Critical" if deficiency_index == 0 and active_troubles else "High" if deficiency_index < 2 else "Medium"
            deficiencies.append({
                "id": f"DEF-{facility_id}-{deficiency_index + 1}",
                "siteId": facility_id,
                "severity": severity,
                "category": "Panel / Device",
                "finding": "Open task indicates fire-system assurance gap.",
                "dateIdentified": iso(-10 - deficiency_index),
                "discovered": "Task queue",
                "dueDate": iso(7 - deficiency_index),
                "status": "Open",
                "retestRequired": True,
            })
        if open_deficiencies or active_troubles:
            service_records.append({
                "id": f"SVC-{facility_id}",
                "siteId": facility_id,
                "dateOpened": iso(-5 - index),
                "dateClosed": None,
                "issueType": "Fire panel trouble" if active_troubles else "Deficiency remediation",
                "area": "Electrical Room",
                "technician": "FPI Field Engineer",
                "rootCause": "Shared task queue exception",
                "resolution": "Pending verification",
                "repeatIssue": false_alarms > 1,
                "slaStatus": "Open",
            })
            recommendations.append({
                "id": f"REC-{facility_id}",
                "siteId": facility_id,
                "severity": "High" if active_troubles else "Medium",
                "category": "Assurance",
                "title": "Complete fire-system remediation evidence package",
                "evidence": "Task and deficiency records share the canonical facility_id.",
                "action": "Dispatch vendor, attach evidence, and retest affected devices.",
                "expectedBenefit": "Reduced false alarms and verified closure posture.",
                "suggestedDue": iso(10),
                "confidence": 0.86,
            })
        compliance_reports.append({
            "id": f"COMP-{facility_id}",
            "siteId": facility_id,
            "reportDate": iso(-20 - index),
            "reportType": "FPI Fire Assurance",
            "inspector": "FPI Governance",
            "status": site["complianceStatus"],
            "deficienciesFound": open_deficiencies,
            "criticalFindings": 1 if active_troubles else 0,
            "riskImpact": risk_tier(facility["risk_score"]),
            "findings": "Canonical shared-key fire/life-safety summary.",
        })

    return {
        "exportDate": NOW.isoformat(),
        "version": "2026.05.canonical-demo",
        "description": "Canonical FPI Fire/Life Safety dataset generated from shared facility_id data.",
        "summary": {
            "totalSites": len(sites),
            "totalDevices": len(devices),
            "totalEvents": len(events),
            "totalInspections": len(inspections),
            "totalServiceRecords": len(service_records),
            "totalDeficiencies": len(deficiencies),
            "totalComplianceReports": len(compliance_reports),
        },
        "data": {
            "sites": sites,
            "devices": devices,
            "events": events,
            "inspections": inspections,
            "serviceRecords": service_records,
            "deficiencies": deficiencies,
            "complianceReports": compliance_reports,
            "recommendations": recommendations,
            "workOrders": [],
            "config": {"scopeKey": "facility_id"},
        },
    }


def build_technology(facilities: list[dict[str, Any]], inputs: dict[str, list[dict[str, str]]], master: dict[str, Any]) -> dict[str, Any]:
    tech_by_id = {row["facility_id"]: row for row in inputs["technology"]}
    store_health = []
    recorder_health = []
    work_queue = []
    technology_issues = []
    predictive = []

    tasks_by_facility: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for task in master["tasks"]:
        tasks_by_facility[task["facility_id"]].append(task)

    for index, facility in enumerate(facilities):
        facility_id = facility["facility_id"]
        tech = tech_by_id.get(facility_id, {})
        total = max(1, integer(tech.get("camera_count"), 80))
        issue_count = len([task for task in tasks_by_facility[facility_id] if any(word in (task.get("title") or "").lower() for word in ["camera", "dvr", "network", "access"] )])
        offline = min(total, issue_count * 3 + (index % 3))
        online = total - offline
        online_percent = round((online / total) * 100, 1)
        health = "Critical" if online_percent < 90 or facility["risk_score"] >= 85 else "Warning" if online_percent < 96 or issue_count else "Healthy"
        store_health.append({
            "siteAlias": facility_id,
            "region": facility["region"],
            "facilityType": facility["banner"],
            "vmsPlatform": tech.get("cctv_system") or "Unknown",
            "healthStatus": health,
            "onlinePercent": online_percent,
            "totalCameras": total,
            "onlineCameras": online,
            "offlineCameras": offline,
            "unknownStatus": 0,
            "ipTotal": round(total * 0.72),
            "ipOnline": max(0, round(total * 0.72) - offline),
            "ipOffline": min(offline, round(total * 0.72)),
            "analogTotal": total - round(total * 0.72),
            "analogOnline": total - round(total * 0.72),
            "analogOffline": 0,
            "vsrvCount": 2 if total > 90 else 1,
            "issueCameraCount": issue_count,
            "ptzCount": max(2, total // 30),
            "missingProfileCount": index % 4,
            "misplacedSubnetCount": issue_count if issue_count else index % 2,
            "lastScan": iso(-1, index),
            "scanError": None,
        })
        for recorder_index in range(2 if total > 90 else 1):
            recorder_health.append({
                "siteAlias": facility_id,
                "recorderAlias": f"{facility_id}-NVR-{recorder_index + 1}",
                "vmsPlatform": tech.get("cctv_system") or "Unknown",
                "recorderStatus": "Warning" if offline and recorder_index == 0 else "Online",
                "alive": not (offline and recorder_index == 0 and health == "Critical"),
                "cameraCount": total // (2 if total > 90 else 1),
                "lastSeen": iso(0, -recorder_index),
            })
        for task in tasks_by_facility[facility_id]:
            title = task.get("title") or "Technology remediation"
            if any(word in title.lower() for word in ["camera", "dvr", "network", "access", "alarm"]):
                severity = severity_for_priority(task.get("priority", "Medium"))
                issue_id = f"TECH-{task['task_id']}"
                technology_issues.append({
                    "issue_id": issue_id,
                    "facility_id": facility_id,
                    "domain": "Camera/VMS" if "camera" in title.lower() or "dvr" in title.lower() else "Network/Security Device" if "network" in title.lower() else "Access Control" if "access" in title.lower() else "Fire Alarm",
                    "status": "Critical" if severity == "Critical" else "Warning",
                    "severity": severity,
                    "summary": title,
                    "source_id": "canonical-top-level-data",
                    "confidence": "High",
                    "freshness_status": "Current",
                    "creates_remediation_id": task["task_id"],
                    "risk_driver_ids": ["shared-facility-risk"],
                    "role_visibility": ["FPI-AP-TECH-HEALTH", "FPI-FIELD-OPS-REMEDIATION"],
                    "engineer_detail_ref": facility_id,
                })
                work_queue.append({
                    "id": f"WQ-{task['task_id']}",
                    "siteAlias": facility_id,
                    "title": title,
                    "severity": severity,
                    "channel": "FPI canonical task queue",
                    "assignmentGroup": task.get("owner_role") or "Field Engineer",
                    "status": task.get("status") or "Open",
                    "evidenceRequired": bool(task.get("evidence_required")),
                    "sla": f"{task.get('sla_hours', 24)}h",
                })
        predictive.append({
            "siteAlias": facility_id,
            "riskScore": round(facility["risk_score"], 1),
            "forecast": "Elevated service risk" if facility["risk_score"] >= 70 else "Stable with monitoring",
            "drivers": ["Open work queue", "Camera/NVR posture", "Shared facility risk score"],
            "recommendedAction": "Prioritize evidence capture and vendor dispatch." if facility["risk_score"] >= 70 else "Continue normal assurance cadence.",
        })

    total_cameras = sum(item["totalCameras"] for item in store_health)
    online_cameras = sum(item["onlineCameras"] for item in store_health)
    offline_cameras = sum(item["offlineCameras"] for item in store_health)
    status_counts = dict(Counter(item["healthStatus"] for item in store_health))
    recorder_counts = dict(Counter(item["recorderStatus"] for item in recorder_health))
    online_percent = round((online_cameras / total_cameras) * 100, 1) if total_cameras else 0

    return {
        "metadata": {
            "sourceTask": "Canonical cross-service data refresh",
            "sourceOwner": "FPI Coding Expert Agent Pack",
            "classification": "Walmart Internal / Synthetic Demo",
            "dataMode": "canonical_demo",
            "generatedAt": NOW.isoformat(),
            "sourceNote": "Built from top-level FPI data folder CSVs; storeHealth.siteAlias equals facility_id.",
            "analyzedFileCount": 4,
        },
        "adapterRun": {"adapter_id": "canonical-technology-health", "adapter_mode": "Local JSON", "run_started_at": iso(0, -1), "run_completed_at": iso(0), "result": "Success", "record_count": len(store_health), "warnings": []},
        "sourceFreshness": [{"source_id": "canonical-top-level-data", "source_label": "FPI top-level data folder", "adapter_mode": "Local JSON", "freshness_status": "Current", "last_demo_update": NOW.isoformat(), "confidence": "High"}],
        "technologyIssues": technology_issues,
        "fleetSummary": {"totalCameras": total_cameras, "onlineCameras": online_cameras, "offlineCameras": offline_cameras, "onlinePercent": online_percent, "status": "Warning" if offline_cameras else "Healthy", "storeCount": len(store_health), "storeHealthDistribution": status_counts, "thresholds": {"warning": "<96% online", "critical": "<90% online"}, "intelSummary": {}, "marchSummary": {}},
        "regionSummary": {"region": "Canonical", "stores": len(store_health), "recorders": len(recorder_health), "totalCameras": total_cameras, "onlineCameras": online_cameras, "offlineCameras": offline_cameras, "issueCameras": sum(item["issueCameraCount"] for item in store_health), "ipCameras": sum(item["ipTotal"] for item in store_health), "analogCameras": sum(item["analogTotal"] for item in store_health), "onlinePercent": online_percent, "healthStatus": "Warning" if offline_cameras else "Healthy", "storeHealthDistribution": status_counts, "recordingProfileMissing": sum(item["missingProfileCount"] for item in store_health)},
        "storeHealth": store_health,
        "recorderHealth": recorder_health,
        "analytics": {"storeStatusCounts": status_counts, "recorderStatusCounts": recorder_counts, "cameraCategoryCounts": {"IP": sum(item["ipTotal"] for item in store_health), "Analog": sum(item["analogTotal"] for item in store_health)}, "cameraStatusCounts": {"Online": online_cameras, "Offline": offline_cameras}, "manufacturerCounts": dict(Counter((tech_by_id.get(item["siteAlias"], {}).get("dvr_model") or "Unknown").split(" ")[0] for item in store_health)), "topOfflineStores": sorted(store_health, key=lambda item: item["offlineCameras"], reverse=True)[:12], "topIssueStores": sorted(store_health, key=lambda item: item["issueCameraCount"], reverse=True)[:12]},
        "complianceSummary": {"policySource": "FPI canonical data", "policyImplications": ["Shared facility_id supports exact scoped filtering.", "Evidence-required tasks should drive remediation SLAs."], "storeComplianceCards": len(store_health), "criticalServiceTicketCandidates": len([item for item in store_health if item["healthStatus"] == "Critical"]), "profileWarnings": sum(item["missingProfileCount"] for item in store_health), "networkPlacementFlags": sum(item["misplacedSubnetCount"] for item in store_health)},
        "predictiveSummary": {"scope": "Canonical FPI stores", "candidates": sorted(predictive, key=lambda item: item["riskScore"], reverse=True)[:12]},
        "workQueue": work_queue,
        "governanceChecklist": ["facility_id is the canonical scope key", "Store scope must filter exact IDs", "Projection fallback disabled for canonical datasets"],
    }


def build_epr(facilities: list[dict[str, Any]], inputs: dict[str, list[dict[str, str]]], master: dict[str, Any]) -> dict[str, Any]:
    tasks = [{**task, "facility_id": integer(task["facility_id"]), "evidence_required": bool(task.get("evidence_required")), "sla_hours": integer(task.get("sla_hours"))} for task in master["tasks"]]
    remediations = master["remediations"]
    epr_facilities = [{**facility, "facility_id": integer(facility["facility_id"]), "latitude": 38.9072 + index * 0.02, "longitude": -77.0369 - index * 0.02} for index, facility in enumerate(facilities)]
    facility_ids = [facility["facility_id"] for facility in epr_facilities]
    incidents = []
    for index, incident in enumerate(inputs["incidents"][:120]):
        facility_id = integer(facility_ids[index % len(facility_ids)])
        incidents.append({
            "id": index + 1,
            "facility_id": facility_id,
            "incident_date": incident.get("Incident Occurred Date"),
            "incident_time": incident.get("Incident Occurred Time"),
            "incident_type": incident.get("Incident Type") or "Security Incident",
            "severity": 4 if "Weapon" in incident.get("Incident Type", "") else 3 if "Threat" in incident.get("Incident Type", "") else 2,
            "description": incident.get("Comments") or "Region incident record",
            "city": incident.get("City"),
            "state": incident.get("State"),
            "region": integer(incident.get("Region"), 75),
            "market": integer(incident.get("Market"), 0),
        })
    incident_type_counts = Counter(item["incident_type"] for item in incidents).most_common()
    severity_counts = Counter(str(item["severity"]) for item in incidents).most_common()
    state_counts = Counter(item.get("state") or "Unknown" for item in incidents).most_common()
    hotels = []
    for index, hotel in enumerate(inputs["hotels"]):
        amenities = [item.strip() for item in hotel.get("amenities", "").split(",") if item.strip()]
        hotels.append({
            "hotel_id": f"HOT-{index + 1:03d}",
            "name": hotel.get("hotel_name") or "Hotel",
            "brand": hotel.get("brand") or "Unknown",
            "address": hotel.get("address") or "Unknown",
            "city": hotel.get("city") or "Unknown",
            "state": hotel.get("state") or "Unknown",
            "rating": number(hotel.get("star_rating")),
            "price_per_night": number(hotel.get("nightly_rate_usd")),
            "walmart_preferred": yes_no(hotel.get("business_center")) and yes_no(hotel.get("wifi")),
            "distance_from_airport": number(hotel.get("distance_to_downtown_mi")),
            "amenities": amenities,
            "safety_score": {"overall_score": integer(hotel.get("safety_score")), "crime_index": max(1, 100 - integer(hotel.get("safety_score"))), "store_incidents": index % 5, "news_sentiment": "Neutral", "safety_features": amenities[:4] or ["WiFi"], "risk_factors": []},
        })

    return {
        "metadata": {"source_folder": str(SOURCE_DATA), "data_environment": "canonical_demo", "classification": "Walmart Internal / Synthetic Demo", "analysis_status": "Canonical EPR package generated from shared facility_id data.", "file_count_analyzed": 8},
        "executive_summary": {"modules": ["Visit Planner", "Hotel Intelligence", "Incident Risk", "Security Mitigation", "Task Governance"], "recommended_ui_home": "Executive Protection Readiness uses facility_id as the same canonical key as Command Center and service tabs.", "business_value": {"shared_scope": True}},
        "kpis": {"visit_facilities": len(epr_facilities), "tasks": len(tasks), "remediations": len(remediations), "markets": len(set(facility["market"] for facility in epr_facilities)), "incident_records": len(incidents), "recent_incidents": len(incidents), "security_incidents": len(incidents), "security_solutions": 4, "hotel_recommendations": len(hotels)},
        "field_operations": {"facilities": epr_facilities, "markets": [], "top_facilities_by_incident_sample": [(str(facility_id), count) for facility_id, count in Counter(item["facility_id"] for item in incidents).most_common(12)]},
        "visit_planner": {"route_facilities": sorted(epr_facilities, key=lambda item: item["risk_score"], reverse=True), "nearby_facilities": [], "workflow": ["Select scoped stores", "Review risk and incident drivers", "Choose preferred hotel", "Export executive movement brief"]},
        "hotel_intelligence": {"workflow": {"source": "hotels.csv"}, "safety_scoring": {"weights": {"safety_score": 0.5, "preferred_brand": 0.2, "distance": 0.15, "amenities": 0.15}}, "recommendation_ranking": {"primary": "safety_score"}, "hotels": hotels},
        "incident_intelligence": {"stats": {"source_rows": len(inputs["incidents"])}, "recent_incident_sample": incidents[:40], "incident_type_counts": incident_type_counts, "severity_counts": severity_counts, "state_counts": state_counts},
        "security_mitigation": {"incidents": incidents, "solutions": build_solutions(), "incident_type_counts": incident_type_counts, "store_counts": [(str(facility_id), count) for facility_id, count in Counter(item["facility_id"] for item in incidents).most_common()], "cost_by_type": [(label, count * 12500) for label, count in incident_type_counts[:6]], "recommender_rules": ["High severity incident -> evaluate guard coverage", "Repeated threat pattern -> coordinate law enforcement", "Open technology tasks -> validate CCTV evidence path"], "roi_formula": {"prevention_value": "incident_count * estimated_loss_avoided"}},
        "tasks_governance": {"tasks": tasks, "remediations": remediations, "features": []},
        "source_inventory": [{"path": name, "bytes": (SOURCE_DATA / name).stat().st_size, "extension": ".csv"} for name in ["facilities.csv", "tasks.csv", "remediations.csv", "security_technology.csv", "hotels.csv", "region_75_incidents (2).csv"]],
    }


def build_solutions() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "Targeted Off-Duty Officer Detail", "solution_type": "law_enforcement_coordination", "upfront_cost": 5000, "annual_cost": 72000, "coverage_area": "High-risk stores and executive visit windows", "effectiveness_rating": 84, "prevents_incident_types": "Threat of Violence; Battery"},
        {"id": 2, "name": "CCTV Evidence Path Verification", "solution_type": "technical_control", "upfront_cost": 15000, "annual_cost": 18000, "coverage_area": "Camera/NVR exception stores", "effectiveness_rating": 78, "prevents_incident_types": "Evidence gaps; delayed investigations"},
        {"id": 3, "name": "Store Leadership Threat Brief", "solution_type": "governance", "upfront_cost": 2500, "annual_cost": 9000, "coverage_area": "Scoped market leadership", "effectiveness_rating": 70, "prevents_incident_types": "Escalation delays"},
        {"id": 4, "name": "Access Control / Panic Button Refresh", "solution_type": "physical_security", "upfront_cost": 42000, "annual_cost": 12000, "coverage_area": "Entrances, cash office, pharmacy", "effectiveness_rating": 81, "prevents_incident_types": "Unauthorized access; emergency response delay"},
    ]


def build_threat_risk(facilities: list[dict[str, Any]], master: dict[str, Any], fire: dict[str, Any], technology: dict[str, Any], epr: dict[str, Any]) -> dict[str, Any]:
    fire_sites = {site["id"]: site for site in fire["data"]["sites"]}
    tech_health = {store["siteAlias"]: store for store in technology["storeHealth"]}
    tasks_by_facility: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for task in master["tasks"]:
        tasks_by_facility[task["facility_id"]].append(task)

    incidents_by_facility: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for incident in epr["security_mitigation"]["incidents"]:
        incidents_by_facility[str(incident.get("facility_id"))].append(incident)

    signals: list[dict[str, Any]] = []
    risk_facilities: list[dict[str, Any]] = []

    for facility in facilities:
        facility_id = facility["facility_id"]
        facility_tasks = tasks_by_facility[facility_id]
        facility_incidents = incidents_by_facility[facility_id]
        fire_site = fire_sites.get(facility_id, {})
        tech_site = tech_health.get(facility_id, {})
        critical_tasks = [task for task in facility_tasks if task.get("priority") == "Critical"]
        high_tasks = [task for task in facility_tasks if task.get("priority") == "High"]
        severe_incidents = [incident for incident in facility_incidents if integer(incident.get("severity")) >= 3]
        technical_issues = integer(tech_site.get("issueCameraCount")) + integer(tech_site.get("misplacedSubnetCount")) + integer(tech_site.get("missingProfileCount"))
        fire_troubles = integer(fire_site.get("activeTroubles")) + integer(fire_site.get("openDeficiencies"))

        incident_score = min(25, len(facility_incidents) * 2 + len(severe_incidents) * 3)
        task_score = min(25, len(critical_tasks) * 7 + len(high_tasks) * 4)
        tech_score = min(20, technical_issues * 3 + integer(tech_site.get("offlineCameras")) * 0.7)
        fire_score = min(15, fire_troubles * 4)
        base_score = min(15, number(facility.get("risk_score")) * 0.15)
        score = round(min(100, base_score + incident_score + task_score + tech_score + fire_score), 1)
        tier = risk_tier(score)
        drivers = []
        if facility_incidents:
            drivers.append(f"{len(facility_incidents)} recent threat/security incidents")
        if severe_incidents:
            drivers.append(f"{len(severe_incidents)} high-severity incident signals")
        if critical_tasks:
            drivers.append(f"{len(critical_tasks)} open critical tasks")
        if technical_issues:
            drivers.append(f"{technical_issues} technical-control gaps")
        if fire_troubles:
            drivers.append(f"{fire_troubles} fire/life-safety assurance exceptions")
        if not drivers:
            drivers.append("Stable facility posture with normal monitoring cadence")

        recommended_action = "Escalate to FPI/AP leadership, validate evidence paths, and coordinate vendor/law-enforcement readiness." if tier == "Critical" else "Prioritize remediation and review local incident pattern." if tier == "High" else "Monitor under standard assurance cadence and close evidence gaps."
        risk_facilities.append({
            "facilityId": facility_id,
            "facilityName": facility["facility_name"],
            "market": facility["market"],
            "region": facility["region"],
            "city": facility["city"],
            "state": facility["state"],
            "riskScore": score,
            "riskTier": tier,
            "incidentCount": len(facility_incidents),
            "severeIncidentCount": len(severe_incidents),
            "openTaskCount": len([task for task in facility_tasks if task.get("status") != "Closed"]),
            "criticalTaskCount": len(critical_tasks),
            "highTaskCount": len(high_tasks),
            "technicalIssueCount": technical_issues,
            "fireTroubleCount": fire_troubles,
            "topDriver": drivers[0],
            "drivers": drivers,
            "recommendedAction": recommended_action,
        })

        for incident in facility_incidents[:4]:
            severity = "Critical" if integer(incident.get("severity")) >= 4 else "High" if integer(incident.get("severity")) >= 3 else "Medium"
            signals.append({
                "id": f"THR-INC-{incident['id']}",
                "facilityId": facility_id,
                "facilityName": facility["facility_name"],
                "city": facility["city"],
                "state": facility["state"],
                "category": "Violence" if "Threat" in incident.get("incident_type", "") or "Battery" in incident.get("incident_type", "") else "External Coordination",
                "signalType": incident.get("incident_type") or "Security incident",
                "severity": severity,
                "confidence": "Medium",
                "occurredAt": f"{incident.get('incident_date') or 'Unknown'} {incident.get('incident_time') or ''}".strip(),
                "summary": incident.get("description") or "Incident signal from Region 75 source file.",
                "riskContribution": 9 if severity == "Critical" else 6 if severity == "High" else 3,
                "sourceIds": ["incident-csv"],
                "recommendedAction": "Review incident details, preserve available evidence, and validate law enforcement coordination path.",
                "bestPracticeRefs": ["fbi-workplace-violence", "dhs-soft-targets"],
            })
        for task in critical_tasks[:2]:
            signals.append({
                "id": f"THR-TASK-{task['task_id']}",
                "facilityId": facility_id,
                "facilityName": facility["facility_name"],
                "city": facility["city"],
                "state": facility["state"],
                "category": "Technology Gap" if any(word in (task.get("title") or "").lower() for word in ["camera", "network", "dvr", "access"]) else "Fire/Life Safety",
                "signalType": task.get("title") or "Critical task",
                "severity": "Critical",
                "confidence": "High",
                "occurredAt": task.get("created_at") or "Unknown",
                "summary": task.get("description") or "Critical canonical task requires action.",
                "riskContribution": 8,
                "sourceIds": ["remediation-task-csv", "fpp-placeholder"],
                "recommendedAction": "Assign accountable owner, attach evidence, and verify closure before risk is downgraded.",
                "bestPracticeRefs": ["dhs-protective-measures", "internal-fpi-evidence-loop"],
            })

    risk_facilities.sort(key=lambda item: item["riskScore"], reverse=True)
    signals.sort(key=lambda item: item["riskContribution"], reverse=True)
    incident_type_counts = Counter(signal["signalType"] for signal in signals if "THR-INC" in signal["id"]).most_common(10)
    market_risk_counts = Counter(item["market"] for item in risk_facilities if item["riskTier"] in {"High", "Critical"}).most_common()
    average_risk = round(sum(item["riskScore"] for item in risk_facilities) / len(risk_facilities), 1) if risk_facilities else 0

    return {
        "metadata": {
            "generatedAt": NOW.isoformat(),
            "dataMode": "canonical_demo",
            "classification": "Walmart Internal / Synthetic Demo",
            "scopeKey": "facility_id",
            "sourceFiles": ["facilities.csv", "tasks.csv", "remediations.csv", "security_technology.csv", "region_75_incidents (2).csv"],
            "governanceNote": "Risk score supports prioritization and does not replace formal threat assessment, law enforcement guidance, or corporate security judgment.",
        },
        "summary": {
            "facilities": len(risk_facilities),
            "criticalFacilities": len([item for item in risk_facilities if item["riskTier"] == "Critical"]),
            "highFacilities": len([item for item in risk_facilities if item["riskTier"] == "High"]),
            "threatSignals": len(signals),
            "severeSignals": len([signal for signal in signals if signal["severity"] in {"High", "Critical"}]),
            "openThreatTasks": sum(item["criticalTaskCount"] + item["highTaskCount"] for item in risk_facilities),
            "averageRiskScore": average_risk,
        },
        "sources": build_threat_sources(len(signals)),
        "facilities": risk_facilities,
        "signals": signals,
        "incidentTypeCounts": incident_type_counts,
        "marketRiskCounts": market_risk_counts,
        "scoringModel": build_scoring_model(),
        "bestPractices": build_best_practices(),
    }


def build_threat_sources(signal_count: int) -> list[dict[str, Any]]:
    return [
        {"sourceId": "srm-placeholder", "sourceName": "SRM", "sourceType": "Internal System", "integrationStatus": "Adapter Planned", "freshnessStatus": "Unknown", "confidence": "Reference", "recordsLoaded": 0, "notes": "Reserved seam for security/risk/case management signals once approved access or exports exist."},
        {"sourceId": "fpp-placeholder", "sourceName": "FPP", "sourceType": "Walmart Program", "integrationStatus": "Adapter Planned", "freshnessStatus": "Unknown", "confidence": "Reference", "recordsLoaded": 0, "notes": "Reserved seam for facility protection profiles and control maturity scoring."},
        {"sourceId": "incident-csv", "sourceName": "Region 75 incident CSV", "sourceType": "Manual Upload", "integrationStatus": "Loaded", "freshnessStatus": "Current", "confidence": "Medium", "recordsLoaded": signal_count, "notes": "Used for threat signal and incident pattern detection in this demo."},
        {"sourceId": "canonical-technology", "sourceName": "Technology Health", "sourceType": "Internal System", "integrationStatus": "Loaded", "freshnessStatus": "Current", "confidence": "High", "recordsLoaded": 12, "notes": "Camera, NVR, access, network, and technical-control posture."},
        {"sourceId": "public-safety-guidance", "sourceName": "FBI / DHS-CISA / OSHA / NFPA references", "sourceType": "Public Safety Guidance", "integrationStatus": "Reference Only", "freshnessStatus": "Unknown", "confidence": "Reference", "recordsLoaded": 5, "notes": "Guidance library for recommended actions; not a live threat-intel feed."},
    ]


def build_scoring_model() -> list[dict[str, Any]]:
    return [
        {"factor": "Recent incident volume", "weight": 25, "description": "Counts security/threat signals associated with the facility."},
        {"factor": "Incident severity", "weight": 20, "description": "Elevates violence, weapon, threat, and high-impact incident patterns."},
        {"factor": "Open critical/high tasks", "weight": 20, "description": "Adds urgency for unresolved work that affects protection posture."},
        {"factor": "Technical-control weakness", "weight": 15, "description": "Considers camera/NVR, access-control, network, and evidence-path gaps."},
        {"factor": "Fire/life-safety assurance", "weight": 10, "description": "Includes active fire trouble, deficiencies, and assurance exceptions."},
        {"factor": "Base facility posture", "weight": 10, "description": "Uses canonical facility risk profile as the stabilizing baseline."},
    ]


def build_best_practices() -> list[dict[str, Any]]:
    return [
        {"id": "fbi-workplace-violence", "issuingBody": "FBI", "title": "Workplace violence / threat assessment reference", "appliesTo": ["Violence", "Threat of Violence", "Battery"], "guidanceSummary": "Use structured threat assessment, preserve evidence, document facts, and coordinate with security/law enforcement channels as appropriate.", "recommendedActions": ["Preserve CCTV/evidence path", "Escalate to corporate security/AP", "Document witnesses and timeline", "Validate local law enforcement contact path"], "evidenceNeeded": ["Incident narrative", "CCTV availability", "Witness notes", "Escalation owner"]},
        {"id": "dhs-soft-targets", "issuingBody": "DHS/CISA", "title": "Soft target and crowded places protective measures", "appliesTo": ["High-risk facility", "Executive visit", "Repeat incidents"], "guidanceSummary": "Review protective measures for public-facing facilities, including access, monitoring, emergency communications, and coordination planning.", "recommendedActions": ["Review entrances/exits", "Validate camera coverage", "Confirm emergency communication path", "Review event/visit posture"], "evidenceNeeded": ["Facility profile", "Camera health", "Emergency contacts", "Open remediation tasks"]},
        {"id": "dhs-protective-measures", "issuingBody": "DHS/CISA", "title": "Protective security planning", "appliesTo": ["Technology Gap", "Access Control", "External Coordination"], "guidanceSummary": "Align protective measures with current threat environment and control posture.", "recommendedActions": ["Prioritize high-impact gaps", "Coordinate vendor response", "Validate compensating controls"], "evidenceNeeded": ["Work order", "Vendor ETA", "Compensating control note"]},
        {"id": "osha-workplace-safety", "issuingBody": "OSHA", "title": "Workplace violence prevention reference", "appliesTo": ["Associate safety", "Threat of Violence", "Battery"], "guidanceSummary": "Use hazard recognition, reporting, prevention controls, and worker communication for workplace violence risk contexts.", "recommendedActions": ["Review associate safety response", "Confirm reporting path", "Document prevention actions"], "evidenceNeeded": ["Safety review", "Leadership sign-off", "Corrective action"]},
        {"id": "nfpa-fire-assurance", "issuingBody": "NFPA", "title": "Fire/life-safety inspection and retest posture", "appliesTo": ["Fire/Life Safety"], "guidanceSummary": "Fire-system deficiencies should be corrected, retested, and documented with appropriate evidence and AHJ awareness where required.", "recommendedActions": ["Dispatch qualified technician", "Retest affected devices", "Attach inspection evidence"], "evidenceNeeded": ["Inspection report", "Retest result", "Technician notes"]},
        {"id": "internal-fpi-evidence-loop", "issuingBody": "Internal FPI", "title": "Identify → Act → Verify evidence loop", "appliesTo": ["All risk signals"], "guidanceSummary": "Every material risk signal should result in an accountable action, owner, SLA, and evidence-backed closure state.", "recommendedActions": ["Assign owner", "Set SLA", "Capture evidence", "Verify closure"], "evidenceNeeded": ["Task ID", "Owner", "Evidence URL", "Verification timestamp"]},
    ]


def write_json(name: str, data: dict[str, Any]) -> None:
    path = PUBLIC_DATA / name
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"wrote {path.relative_to(PROJECT_ROOT)}")


def main() -> None:
    inputs = build_inputs()
    facilities = enrich_facilities(inputs)
    master = build_master(inputs, facilities)
    fire = build_fire(facilities, master)
    technology = build_technology(facilities, inputs, master)
    epr = build_epr(facilities, inputs, master)
    threat_risk = build_threat_risk(facilities, master, fire, technology, epr)

    write_json("fpi-canonical-master.json", master)
    write_json("fpi-canonical-fire-alarm.json", fire)
    write_json("fpi-canonical-technology-health.json", technology)
    write_json("fpi-canonical-epr.json", epr)
    write_json("fpi-canonical-threat-risk.json", threat_risk)


if __name__ == "__main__":
    main()
