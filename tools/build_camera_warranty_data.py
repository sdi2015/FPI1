from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parents[1]
ACTIVE_BUILD_DIR = APP_DIR.parent
SOURCE_CSV = ACTIVE_BUILD_DIR / "camera_warranty_phase1_data" / "camera data - enriched.csv"
SOURCE_MANIFEST = ACTIVE_BUILD_DIR / "camera_warranty_phase1_data" / "camera_warranty_enrichment_manifest.json"
TARGET_JSON = APP_DIR / "public" / "data" / "camera-warranty.json"


def number(value: str) -> float | None:
    value = str(value or "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def read_rows() -> list[dict[str, str]]:
    with SOURCE_CSV.open("r", encoding="utf-8-sig", errors="ignore", newline="") as handle:
        return list(csv.DictReader(handle))


def build_payload(rows: list[dict[str, str]]) -> dict[str, Any]:
    by_store: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_store[row.get("Store Number", "Unknown")].append(row)

    model_counts = Counter(row.get("Camera Model", "Unknown") or "Unknown" for row in rows)
    candidate_counts = Counter(row.get("Warranty Replacement Candidate", "Unknown") or "Unknown" for row in rows)
    missing_install = sum(1 for row in rows if not (row.get("Install Date") or "").strip())
    candidates = sum(1 for row in rows if row.get("Warranty Replacement Candidate") == "Yes")

    records = []
    for row in rows:
        age = number(row.get("Warranty Age Years", ""))
        records.append({
            "cameraName": row.get("Camera Name", ""),
            "cameraModel": row.get("Camera Model", ""),
            "installDate": row.get("Install Date", ""),
            "firmware": row.get("Firmware", ""),
            "storeNumber": row.get("Store Number", ""),
            "facilityId": row.get("Facility ID", ""),
            "facilityName": row.get("Facility Name", ""),
            "warrantyAgeYears": age,
            "warrantyReplacementCandidate": row.get("Warranty Replacement Candidate", ""),
            "warrantyNotes": row.get("Warranty Notes", ""),
            "assignmentSource": row.get("Camera Assignment Source", ""),
        })

    stores = []
    for store, store_rows in sorted(by_store.items()):
        ages = [number(row.get("Warranty Age Years", "")) for row in store_rows]
        known_ages = [age for age in ages if age is not None]
        stores.append({
            "storeNumber": store,
            "facilityName": store_rows[0].get("Facility Name", f"Store #{store}"),
            "cameraCount": len(store_rows),
            "warrantyCandidateCount": sum(1 for row in store_rows if row.get("Warranty Replacement Candidate") == "Yes"),
            "missingInstallDateCount": sum(1 for row in store_rows if not (row.get("Install Date") or "").strip()),
            "oldestCameraAgeYears": max(known_ages) if known_ages else None,
            "oldestInstallDate": min((row.get("Install Date") for row in store_rows if row.get("Install Date")), default=""),
        })

    manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8")) if SOURCE_MANIFEST.exists() else {}
    return {
        "metadata": {
            "datasetName": "camera-warranty",
            "classification": "Walmart Internal / Need-to-Know - Draft",
            "dataMode": "phase_2_sanitized_from_enriched_camera_csv",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceCsv": "camera_warranty_phase1_data/camera data - enriched.csv",
            "sourceManifest": "camera_warranty_phase1_data/camera_warranty_enrichment_manifest.json",
            "networkIdentifiersExcluded": True,
            "warrantyThresholdYears": manifest.get("warranty_threshold_years", 5),
            "seed": manifest.get("seed", 20260504),
        },
        "summary": {
            "totalCameras": len(rows),
            "storeCount": len(by_store),
            "warrantyCandidateCount": candidates,
            "missingInstallDateCount": missing_install,
            "knownInstallDateCount": len(rows) - missing_install,
            "candidateCounts": dict(candidate_counts),
            "modelCounts": dict(model_counts.most_common(12)),
        },
        "stores": stores,
        "records": records,
    }


def main() -> None:
    if not SOURCE_CSV.exists():
        raise FileNotFoundError(SOURCE_CSV)
    payload = build_payload(read_rows())
    TARGET_JSON.parent.mkdir(parents=True, exist_ok=True)
    TARGET_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote={TARGET_JSON}")
    print(f"records={len(payload['records'])}")
    print(f"stores={len(payload['stores'])}")


if __name__ == "__main__":
    main()
