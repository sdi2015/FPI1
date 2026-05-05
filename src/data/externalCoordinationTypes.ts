export type ExternalAgencyContact = {
  name: string;
  type: string;
  address: string;
  phone: string;
  website: string;
};

export type SecurityVendorPartner = {
  partnerId: string;
  name: string;
  type: string;
  coverage: string;
  coordinationUse: string;
  status: string;
};

export type ExternalCoordinationFacility = {
  facilityId: string;
  facilityName: string;
  city: string;
  state: string;
  region: string;
  county: string;
  riskTier: string;
  riskScore: number;
  coordinationReadiness: 'Ready' | 'Review' | 'Escalated';
  escalationReason: string;
  recommendedNextStep: string;
  agencies: ExternalAgencyContact[];
  primaryAgency: ExternalAgencyContact;
  sheriffAgency: ExternalAgencyContact;
  prosecutor: ExternalAgencyContact;
  securityVendorPartners: SecurityVendorPartner[];
};

export type CoordinationRequest = {
  requestId: string;
  facilityId: string;
  facilityName: string;
  type: string;
  status: string;
  priority: 'High' | 'Medium' | 'Low';
  summary: string;
  nextStep: string;
};

export type ExternalCoordinationPlaybook = {
  id: string;
  title: string;
  recommendedPath: string;
  evidenceNeeded: string[];
};

export type ExternalCoordinationData = {
  metadata: {
    generatedAt: string;
    dataMode: string;
    lookupStatus: string;
    scopeKey: 'facility_id';
    governanceNote: string;
    desiredLiveAdapter: string;
  };
  summary: {
    facilities: number;
    agencyContacts: number;
    prosecutorContacts: number;
    securityVendorPartners: number;
    escalatedFacilities: number;
    reviewFacilities: number;
  };
  facilities: ExternalCoordinationFacility[];
  coordinationRequests: CoordinationRequest[];
  playbooks: ExternalCoordinationPlaybook[];
};
