export type Pillar = {
  id: string;
  title: string;
  description: string;
  signal: string;
  progress: number;
};

export type Capability = {
  id: string;
  title: string;
  navLabel?: string;
  eyebrow: string;
  description: string;
  status: 'Ready' | 'Watching' | 'Buildout';
  metric: string;
  owner: string;
};

export type Kpi = {
  label: string;
  value: string;
  trend: string;
  tone: 'blue' | 'yellow' | 'sky' | 'white';
};

export const pillars: Pillar[] = [
  {
    id: 'ingestion',
    title: 'Data Ingestion & Normalization',
    description:
      'Unifies facility, device, vendor, monitoring, and readiness signals into a clean program view.',
    signal: 'Signal intake',
    progress: 86,
  },
  {
    id: 'profiling',
    title: 'Facility Protection Profiling',
    description:
      'Creates explainable protection profiles by facility type, exposure, critical systems, and operational readiness.',
    signal: 'Profile depth',
    progress: 74,
  },
  {
    id: 'governance',
    title: 'Verification, Dashboarding & Governance',
    description:
      'Surfaces audit-ready evidence, leader-ready dashboards, remediation ownership, and governance cadence.',
    signal: 'Governance confidence',
    progress: 91,
  },
];

export const capabilities: Capability[] = [
  {
    id: 'executive-readiness',
    title: 'Executive Protection Readiness',
    eyebrow: 'Readiness',
    description: 'Executive protection readiness workspace reserved for the dedicated EPR data package.',
    status: 'Buildout',
    metric: 'Data pending',
    owner: 'FPI Leadership',
  },
  {
    id: 'command-center',
    title: 'Command Center',
    eyebrow: 'Operations',
    description: 'Data-backed operating dashboard for facility protection posture, active risk, exceptions, and work queues.',
    status: 'Ready',
    metric: 'Live dashboard',
    owner: 'FPI Operations',
  },
  {
    id: 'fire-system-monitoring',
    title: 'Fire-System Monitoring & Assurance',
    navLabel: 'Fire & Life Safety',
    eyebrow: 'Life safety',
    description: 'Assurance view for fire panels, suppression coverage, inspection cadence, and exceptions.',
    status: 'Watching',
    metric: '18 exceptions',
    owner: 'Safety Operations',
  },
  {
    id: 'camera-technical-control',
    title: 'Camera & Technical Control Monitoring',
    navLabel: 'Camera / Technical Controls',
    eyebrow: 'Technical controls',
    description: 'Monitors camera coverage, technical-control health, outage posture, AP-14 evidence readiness, and simulated service impact.',
    status: 'Ready',
    metric: '96.3% online',
    owner: 'Technical Controls',
  },
  {
    id: 'network-device-posture',
    title: 'Network & Security Device Posture',
    navLabel: 'Device Posture',
    eyebrow: 'Device posture',
    description: 'Summarizes security-device hygiene, adapter freshness, network dependencies, lifecycle risk, and control gaps.',
    status: 'Ready',
    metric: '4 normalized issues',
    owner: 'Security Engineering',
  },
  {
    id: 'threat-risk-scoring',
    title: 'Risk Intelligence',
    navLabel: 'Risk Intelligence',
    eyebrow: 'Risk intelligence',
    description: 'Prioritizes facilities using explainable FPI intelligence across incidents, protection signals, confidence, and business impact.',
    status: 'Ready',
    metric: '812 score',
    owner: 'FPI Analytics',
  },
  {
    id: 'remediation-orchestration',
    title: 'Remediation Orchestration',
    eyebrow: 'Actioning',
    description: 'Turns findings into accountable work queues with priority, owner, SLA, and verification loops.',
    status: 'Ready',
    metric: '63 actions',
    owner: 'Program Ops',
  },
  {
    id: 'vendor-intelligence',
    title: 'Vendor Intelligence & Recommendations',
    navLabel: 'Vendor Intelligence',
    eyebrow: 'Vendor insights',
    description: 'SENTRY-sponsored vendor intelligence for provider reporting, assessment requests, and issue-to-vendor recommendations.',
    status: 'Ready',
    metric: 'SENTRY',
    owner: 'Vendor Mgmt',
  },
  {
    id: 'external-coordination',
    title: 'Law Enforcement / Security Vendor Analysis / External Coordination',
    navLabel: 'External Coordination',
    eyebrow: 'Coordination',
    description: 'Store-level law enforcement, DA/prosecutor, security vendor, and external coordination readiness for selected facilities.',
    status: 'Ready',
    metric: 'LE / DA',
    owner: 'External Affairs',
  },
];

export const kpis: Kpi[] = [
  { label: 'Facilities profiled', value: '1,284', trend: '+128 this cycle', tone: 'blue' },
  { label: 'Critical exceptions', value: '37', trend: '-11 week over week', tone: 'yellow' },
  { label: 'Monitoring uptime', value: '98.6%', trend: '+0.8 points', tone: 'sky' },
  { label: 'Remediation SLAs', value: '91%', trend: 'on-track', tone: 'white' },
];

export const activity = [
  'Normalized 43 new facility protection records into the demo signal lake.',
  'Elevated fire-system assurance exceptions for regional review.',
  'Drafted remediation playbooks for camera outage clusters.',
  'Prepared executive readiness brief with top-risk facility cohorts.',
];
