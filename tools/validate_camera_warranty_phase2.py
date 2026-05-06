from __future__ import annotations

import csv
import json
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
ACTIVE_BUILD_DIR = APP_DIR.parent
SOURCE_CSV = ACTIVE_BUILD_DIR / "camera_warranty_phase1_data" / "camera data - enriched.csv"
TARGET_JSON = APP_DIR / "public" / "data" / "camera-warranty.json"
CAMERA_VIEW = APP_DIR / "src" / "components" / "views" / "CameraTechnicalControlView.tsx"
TYPES_FILE = APP_DIR / "src" / "data" / "cameraWarrantyTypes.ts"
HOOK_FILE = APP_DIR / "src" / "data" / "useCameraWarrantyData.ts"

EXPECTED_RECORD_KEYS = {
    "cameraName",
    "cameraModel",
    "installDate",
    "firmware",
    "storeNumber",
    "facilityId",
    "facilityName",
    "warrantyAgeYears",
    "warrantyReplacementCandidate",
    "warrantyNotes",
    "assignmentSource",
}

FORBIDDEN_RECORD_KEYS = {
    "ip",
    "ipAddress",
    "mac",
    "macAddress",
    "IPAddress",
    "MACAddress",
    "subnet",
    "gateway",
}


def read_source_count() -> int:
    with SOURCE_CSV.open("r", encoding="utf-8-sig", errors="ignore", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    require(SOURCE_CSV.exists(), f"Missing source CSV: {SOURCE_CSV}")
    require(TARGET_JSON.exists(), f"Missing target JSON: {TARGET_JSON}")
    require(CAMERA_VIEW.exists(), f"Missing camera view: {CAMERA_VIEW}")
    require(TYPES_FILE.exists(), f"Missing types file: {TYPES_FILE}")
    require(HOOK_FILE.exists(), f"Missing hook file: {HOOK_FILE}")

    source_count = read_source_count()
    payload = json.loads(TARGET_JSON.read_text(encoding="utf-8"))
    records = payload.get("records", [])
    stores = payload.get("stores", [])
    metadata = payload.get("metadata", {})
    summary = payload.get("summary", {})

    require(source_count == 3343, f"Unexpected Phase 1 source count: {source_count}")
    require(len(records) == source_count, "JSON record count does not match Phase 1 source CSV")
    require(summary.get("totalCameras") == source_count, "Summary totalCameras mismatch")
    require(len(stores) == 12, f"Unexpected store count: {len(stores)}")
    require(summary.get("missingInstallDateCount") == 51, "Missing install date count mismatch")
    require(summary.get("warrantyCandidateCount") == 0, "Warranty candidate count mismatch")
    require(metadata.get("networkIdentifiersExcluded") is True, "Network identifier exclusion flag missing")
    require("C:" not in json.dumps(metadata), "Local Windows path leaked into metadata")

    first_keys = set(records[0].keys()) if records else set()
    require(first_keys == EXPECTED_RECORD_KEYS, f"Unexpected record keys: {sorted(first_keys)}")
    require(not (first_keys & FORBIDDEN_RECORD_KEYS), f"Forbidden keys present: {sorted(first_keys & FORBIDDEN_RECORD_KEYS)}")

    serialized_records = json.dumps(records[:25]).lower()
    require("ip address" not in serialized_records, "IP address label leaked into records")
    require("mac address" not in serialized_records, "MAC address label leaked into records")

    view_text = CAMERA_VIEW.read_text(encoding="utf-8")
    require("useCameraWarrantyData" in view_text, "Warranty hook is not used by camera view")
    require("id: 'warranty'" in view_text, "Warranty tab is not registered")
    require("WarrantyView" in view_text, "Warranty view component missing")
    require("NO RAW IP/MAC" in view_text, "Sanitization callout missing from UI")
    require(sum(1 for _ in CAMERA_VIEW.open(encoding="utf-8")) < 600, "Camera view exceeded 600 lines")

    print("phase2_validation=ok")
    print(f"source_rows={source_count}")
    print(f"json_records={len(records)}")
    print(f"stores={len(stores)}")
    print(f"missing_install_dates={summary.get('missingInstallDateCount')}")
    print(f"warranty_candidates={summary.get('warrantyCandidateCount')}")


if __name__ == "__main__":
    main()
