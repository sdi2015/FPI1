export type CameraWarrantyRecord = {
  cameraName: string;
  cameraModel: string;
  installDate: string;
  firmware: string;
  storeNumber: string;
  facilityId: string;
  facilityName: string;
  warrantyAgeYears: number | null;
  warrantyReplacementCandidate: string;
  warrantyNotes: string;
  assignmentSource: string;
};

export type CameraWarrantyStoreSummary = {
  storeNumber: string;
  facilityName: string;
  cameraCount: number;
  warrantyCandidateCount: number;
  missingInstallDateCount: number;
  oldestCameraAgeYears: number | null;
  oldestInstallDate: string;
};

export type CameraWarrantyData = {
  metadata: {
    datasetName: string;
    classification: string;
    dataMode: string;
    generatedAt: string;
    sourceCsv: string;
    sourceManifest: string;
    networkIdentifiersExcluded: boolean;
    warrantyThresholdYears: number;
    seed: number;
  };
  summary: {
    totalCameras: number;
    storeCount: number;
    warrantyCandidateCount: number;
    missingInstallDateCount: number;
    knownInstallDateCount: number;
    candidateCounts: Record<string, number>;
    modelCounts: Record<string, number>;
  };
  stores: CameraWarrantyStoreSummary[];
  records: CameraWarrantyRecord[];
};
