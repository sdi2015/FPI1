from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIRE_PATH = PROJECT_ROOT / 'public' / 'data' / 'fpi-canonical-fire-alarm.json'
THREAT_PATH = PROJECT_ROOT / 'public' / 'data' / 'fpi-canonical-threat-risk.json'
OUTPUT_PATH = PROJECT_ROOT / 'public' / 'data' / 'fpi-external-coordination.json'
NOW = datetime.now(timezone.utc).replace(microsecond=0)

JURISDICTIONS: dict[tuple[str, str], dict[str, Any]] = {
    ('Dallas', 'TX'): {
        'county': 'Dallas County',
        'primaryAgency': {'name': 'Dallas Police Department Headquarters', 'type': 'Municipal Police', 'address': '1400 Botham Jean Blvd, Dallas, TX 75215', 'phone': '214-671-3001', 'website': 'https://dallaspolice.net'},
        'sheriffAgency': {'name': 'Dallas County Sheriff\'s Department', 'type': 'County Sheriff', 'address': '133 N Riverfront Blvd, Dallas, TX 75207', 'phone': '214-749-8641', 'website': 'https://www.dallascounty.org/departments/sheriff/'},
        'prosecutor': {'name': 'Dallas County District Attorney', 'type': 'District Attorney', 'address': '133 N Riverfront Blvd, Dallas, TX 75207', 'phone': '214-653-3600', 'website': 'https://www.dallascounty.org/government/district-attorney/'},
    },
    ('Houston', 'TX'): {
        'county': 'Harris County',
        'primaryAgency': {'name': 'Houston Police Department Headquarters', 'type': 'Municipal Police', 'address': '1200 Travis St, Houston, TX 77002', 'phone': '713-884-3131', 'website': 'https://www.houstontx.gov/police/'},
        'sheriffAgency': {'name': 'Harris County Sheriff\'s Office', 'type': 'County Sheriff', 'address': '1200 Baker St, Houston, TX 77002', 'phone': '713-221-6000', 'website': 'https://www.harriscountyso.org'},
        'prosecutor': {'name': 'Harris County District Attorney\'s Office', 'type': 'District Attorney', 'address': '1201 Franklin St, Houston, TX 77002', 'phone': '713-274-5800', 'website': 'https://app.dao.hctx.net'},
    },
    ('Phoenix', 'AZ'): {
        'county': 'Maricopa County',
        'primaryAgency': {'name': 'Phoenix Police Department Headquarters', 'type': 'Municipal Police', 'address': '620 W Washington St, Phoenix, AZ 85003', 'phone': '602-262-6151', 'website': 'https://www.phoenix.gov/police'},
        'sheriffAgency': {'name': 'Maricopa County Sheriff\'s Office', 'type': 'County Sheriff', 'address': '550 W Jackson St, Phoenix, AZ 85003', 'phone': '602-876-1000', 'website': 'https://www.mcso.org'},
        'prosecutor': {'name': 'Maricopa County Attorney\'s Office', 'type': 'County Attorney', 'address': '225 W Madison St, Phoenix, AZ 85003', 'phone': '602-506-3411', 'website': 'https://www.maricopacountyattorney.org'},
    },
    ('Atlanta', 'GA'): {
        'county': 'Fulton County',
        'primaryAgency': {'name': 'Atlanta Police Department Headquarters', 'type': 'Municipal Police', 'address': '226 Peachtree St SW, Atlanta, GA 30303', 'phone': '404-614-6544', 'website': 'https://www.atlantapd.org'},
        'sheriffAgency': {'name': 'Fulton County Sheriff\'s Office', 'type': 'County Sheriff', 'address': '185 Central Ave SW, Atlanta, GA 30303', 'phone': '404-612-5100', 'website': 'https://fultonsheriff.org'},
        'prosecutor': {'name': 'Fulton County District Attorney\'s Office', 'type': 'District Attorney', 'address': '136 Pryor St SW, Atlanta, GA 30303', 'phone': '404-612-4981', 'website': 'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/district-attorney'},
    },
    ('Denver', 'CO'): {
        'county': 'City and County of Denver',
        'primaryAgency': {'name': 'Denver Police Department Administration Building', 'type': 'Municipal Police', 'address': '1331 Cherokee St, Denver, CO 80204', 'phone': '720-913-2000', 'website': 'https://www.denvergov.org/police'},
        'sheriffAgency': {'name': 'Denver Sheriff Department', 'type': 'County Sheriff', 'address': '490 W Colfax Ave, Denver, CO 80204', 'phone': '720-913-3600', 'website': 'https://www.denvergov.org/sheriff'},
        'prosecutor': {'name': 'Denver District Attorney\'s Office', 'type': 'District Attorney', 'address': '201 W Colfax Ave, Denver, CO 80202', 'phone': '720-913-9000', 'website': 'https://www.denverda.org'},
    },
    ('Chicago', 'IL'): {
        'county': 'Cook County',
        'primaryAgency': {'name': 'Chicago Police Department Headquarters', 'type': 'Municipal Police', 'address': '3510 S Michigan Ave, Chicago, IL 60653', 'phone': '312-746-6000', 'website': 'https://home.chicagopolice.org'},
        'sheriffAgency': {'name': 'Cook County Sheriff\'s Office', 'type': 'County Sheriff', 'address': '50 W Washington St, Chicago, IL 60602', 'phone': '312-603-6444', 'website': 'https://www.cookcountysheriffil.gov'},
        'prosecutor': {'name': 'Cook County State\'s Attorney\'s Office', 'type': 'State\'s Attorney', 'address': '69 W Washington St, Suite 3200, Chicago, IL 60602', 'phone': '312-603-1880', 'website': 'https://www.cookcountystatesattorney.org'},
    },
}

SECURITY_VENDOR_PARTNERS = [
    {'partnerId': 'SEC-001', 'name': 'Current Guarding Provider', 'type': 'Security Vendor', 'coverage': 'Guarding / patrol escalation', 'coordinationUse': 'Temporary guard coverage, patrol surge, executive visit support', 'status': 'Current Provider / Verify locally'},
    {'partnerId': 'SEC-002', 'name': 'Technical Service Provider', 'type': 'Security Vendor', 'coverage': 'Camera, alarm, access-control service', 'coordinationUse': 'Evidence-path restoration and technical-control remediation', 'status': 'Current Provider / Verify locally'},
    {'partnerId': 'SEC-003', 'name': 'SENTRY Assessment Path', 'type': 'Vendor Intelligence', 'coverage': 'Prospective vendor review', 'coordinationUse': 'Request assessment for alternative providers or emerging capabilities', 'status': 'SENTRY Sponsored'},
]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def threat_lookup() -> dict[str, dict[str, Any]]:
    if not THREAT_PATH.exists():
        return {}
    threat = read_json(THREAT_PATH)
    return {facility['facilityId']: facility for facility in threat.get('facilities', [])}


def escalation_reason(site: dict[str, Any], threat: dict[str, Any] | None) -> str:
    if threat and threat.get('riskTier') in {'High', 'Critical'}:
        return f"{threat['riskTier']} facility risk: {threat.get('topDriver', 'threat-risk driver')}"
    if site.get('activeTroubles', 0) or site.get('openDeficiencies', 0):
        return 'Fire/life-safety or technical assurance exception may require partner coordination.'
    return 'Routine coordination readiness profile for store-level reference.'


def recommended_next_step(site: dict[str, Any], threat: dict[str, Any] | None) -> str:
    if threat and threat.get('riskTier') == 'Critical':
        return 'Validate law enforcement contact path, preserve evidence, brief AP/FPI leadership, and confirm prosecutor/evidence handoff expectations.'
    if threat and threat.get('severeIncidentCount', 0) > 0:
        return 'Review incident package, confirm local agency contact, and prepare escalation summary if repeat pattern continues.'
    return 'Keep contact card current and verify agency/prosecutor details before any operational use.'


def build_data() -> dict[str, Any]:
    fire = read_json(FIRE_PATH)
    sites = fire['data']['sites']
    threats = threat_lookup()
    facilities = []
    for site in sites:
        jurisdiction = JURISDICTIONS.get((site['city'], site['state']))
        if not jurisdiction:
            jurisdiction = {
                'county': 'Pending live lookup',
                'primaryAgency': {'name': f"{site['city']} Police Department", 'type': 'Municipal Police', 'address': 'Pending approved live lookup', 'phone': 'Pending approved live lookup', 'website': ''},
                'sheriffAgency': {'name': f"{site['state']} county sheriff lookup pending", 'type': 'County Sheriff', 'address': 'Pending approved live lookup', 'phone': 'Pending approved live lookup', 'website': ''},
                'prosecutor': {'name': 'District Attorney / Prosecutor lookup pending', 'type': 'Prosecutor', 'address': 'Pending approved live lookup', 'phone': 'Pending approved live lookup', 'website': ''},
            }
        threat = threats.get(site['id'])
        agencies = [jurisdiction['primaryAgency'], jurisdiction['sheriffAgency'], jurisdiction['prosecutor']]
        facilities.append({
            'facilityId': site['id'],
            'facilityName': site['name'],
            'city': site['city'],
            'state': site['state'],
            'region': site['region'],
            'county': jurisdiction['county'],
            'riskTier': threat.get('riskTier', 'Unknown') if threat else 'Unknown',
            'riskScore': threat.get('riskScore', site.get('riskScore', 0)) if threat else site.get('riskScore', 0),
            'coordinationReadiness': 'Escalated' if threat and threat.get('riskTier') == 'Critical' else 'Review' if threat and threat.get('severeIncidentCount', 0) > 0 else 'Ready',
            'escalationReason': escalation_reason(site, threat),
            'recommendedNextStep': recommended_next_step(site, threat),
            'agencies': agencies,
            'primaryAgency': jurisdiction['primaryAgency'],
            'sheriffAgency': jurisdiction['sheriffAgency'],
            'prosecutor': jurisdiction['prosecutor'],
            'securityVendorPartners': SECURITY_VENDOR_PARTNERS,
        })
    coordination_requests = [
        {
            'requestId': f'EC-{idx + 1:04d}',
            'facilityId': facility['facilityId'],
            'facilityName': facility['facilityName'],
            'type': 'Law Enforcement / DA Readiness Review',
            'status': 'View Only - Contact Verification Needed',
            'priority': 'High' if facility['coordinationReadiness'] == 'Escalated' else 'Medium',
            'summary': facility['escalationReason'],
            'nextStep': facility['recommendedNextStep'],
        }
        for idx, facility in enumerate(facilities[:8])
    ]
    return {
        'metadata': {
            'generatedAt': NOW.isoformat(),
            'dataMode': 'public-reference seed + live lookup adapter ready',
            'lookupStatus': 'No approved live lookup endpoint was found in the accessible FPI project files during generation.',
            'scopeKey': 'facility_id',
            'governanceNote': 'Law enforcement, sheriff, and prosecutor contact details must be verified against approved live sources before operational use. This shell is view-only for store users.',
            'desiredLiveAdapter': 'Code Puppy/internal approved geospatial public-safety lookup service',
        },
        'summary': {
            'facilities': len(facilities),
            'agencyContacts': sum(len(facility['agencies']) for facility in facilities),
            'prosecutorContacts': len(facilities),
            'securityVendorPartners': len(SECURITY_VENDOR_PARTNERS),
            'escalatedFacilities': len([facility for facility in facilities if facility['coordinationReadiness'] == 'Escalated']),
            'reviewFacilities': len([facility for facility in facilities if facility['coordinationReadiness'] == 'Review']),
        },
        'facilities': facilities,
        'coordinationRequests': coordination_requests,
        'playbooks': [
            {'id': 'threat-violence', 'title': 'Threat of Violence / Assault', 'recommendedPath': 'Local police contact → AP/FPI leadership → DA/prosecutor evidence package if charges or repeat pattern emerge.', 'evidenceNeeded': ['Incident narrative', 'CCTV availability', 'Witness notes', 'Case/report number if available']},
            {'id': 'repeat-incidents', 'title': 'Repeat Incident Pattern', 'recommendedPath': 'Police/sheriff liaison review → Market AP review → SENTRY/vendor support if controls or guarding need assessment.', 'evidenceNeeded': ['Incident trend', 'Store risk drivers', 'Open remediation tasks', 'Partner contact log']},
            {'id': 'executive-visit', 'title': 'Executive Visit / Elevated Profile', 'recommendedPath': 'Confirm jurisdiction contacts, local agency non-emergency path, nearby hospital/safe route context, and security vendor readiness.', 'evidenceNeeded': ['Visit itinerary', 'Facility profile', 'Hotel/route notes', 'Emergency contact card']},
            {'id': 'technical-evidence-gap', 'title': 'Evidence or Technical-Control Gap', 'recommendedPath': 'Technical vendor restoration → AP/FPI evidence review → agency/DA handoff only after evidence availability is confirmed.', 'evidenceNeeded': ['Camera health', 'Retention status', 'Work order', 'Remediation ETA']},
        ],
    }


def main() -> None:
    OUTPUT_PATH.write_text(json.dumps(build_data(), indent=2), encoding='utf-8')
    print(f'wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}')


if __name__ == '__main__':
    main()
