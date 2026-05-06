# Security Mitigation ↔ Vendor Intelligence Integration

This integration adds a safe, client-side bridge between the Security Mitigation Manager and Vendor Intelligence / SENTRY vendor catalog.

## What it does

- Builds a mitigation context from the selected store, incident history, and selected mitigation controls.
- Scores Vendor Intelligence entries against that context using:
  - capability tags
  - risk-domain alignment
  - current vendor assessment status
  - recommendation score
  - evidence quality
- Allows users to link candidate vendors to a mitigation context for review.

## What it does not do

- Does not create purchase orders.
- Does not contact vendors.
- Does not create production tickets.
- Does not mutate the canonical vendor dataset.
- Does not require a backend dependency.

## Persistence model

Candidate links are stored locally in browser localStorage under:

```txt
fpi.mitigation_vendor_candidates.v1
```

The stored link record keeps only the relationship snapshot:

- mitigation id
- vendor id
- match score/rationale
- capability/risk-domain matches
- assessment/recommendation snapshot
- candidate review status
- review owner and metadata

Vendor details are resolved from the existing Vendor Intelligence data at render time.

## Assumptions

- Vendor candidates are advisory and require human review.
- Existing Vendor Intelligence synthetic/demo data remains the source of truth for vendor rows.
- Local persistence is sufficient for the current sandbox workflow.

## Future backend table shape

If this is later moved to a backend, the local candidate link can map to a table like:

```sql
mitigation_vendor_candidates (
  id text primary key,
  mitigation_id text not null,
  vendor_id text not null,
  match_score numeric,
  match_rationale text,
  capability_match jsonb,
  risk_domain_match jsonb,
  assessment_status_at_link text,
  recommendation_score_at_link numeric,
  candidate_status text,
  review_owner text,
  notes text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
)
```
