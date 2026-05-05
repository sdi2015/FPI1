import type { FpiProgramData } from './fpiTypes';

export type FacilityScopeMode = 'all' | 'selected';

export type FacilityScopeState = {
  mode: FacilityScopeMode;
  selectedFacilityIds: string[];
};

export function createAllFacilitiesScope(): FacilityScopeState {
  return { mode: 'all', selectedFacilityIds: [] };
}

export function createSelectedFacilitiesScope(facilityIds: string[]): FacilityScopeState {
  return { mode: 'selected', selectedFacilityIds: uniqueFacilityIds(facilityIds) };
}

export function isFacilityInScope(facilityId: string, scope: FacilityScopeState): boolean {
  if (scope.mode === 'all') return true;
  return scope.selectedFacilityIds.includes(facilityId);
}

export function hasEmptySelectedScope(scope: FacilityScopeState): boolean {
  return scope.mode === 'selected' && scope.selectedFacilityIds.length === 0;
}

export function getFacilityScopeSummary(scope: FacilityScopeState, totalFacilities: number): string {
  if (scope.mode === 'all') return `All ${formatNumber(totalFacilities)} facilities included`;
  if (scope.selectedFacilityIds.length === 0) return 'No facilities selected';
  return `${formatNumber(scope.selectedFacilityIds.length)} of ${formatNumber(totalFacilities)} facilities selected`;
}

export function applyFacilityScope(programData: FpiProgramData, scope: FacilityScopeState): FpiProgramData {
  if (scope.mode === 'all') {
    return {
      ...programData,
      facilities: safeArray(programData.facilities),
      tasks: safeArray(programData.tasks),
      remediations: safeArray(programData.remediations),
      alarmSignals: safeArray(programData.alarmSignals),
      cameraIssues: safeArray(programData.cameraIssues),
      panelInventory: safeArray(programData.panelInventory),
    };
  }

  const selectedIds = new Set(scope.selectedFacilityIds);

  if (selectedIds.size === 0) {
    return createEmptyScopedProgramData(programData);
  }

  const facilities = safeArray(programData.facilities).filter((facility) => selectedIds.has(facility.facilityId));
  const scopedFacilityIds = new Set(facilities.map((facility) => facility.facilityId));
  const tasks = safeArray(programData.tasks).filter((task) => scopedFacilityIds.has(task.facilityId));
  const taskIds = new Set(tasks.map((task) => task.id));

  return {
    ...programData,
    facilities,
    tasks,
    remediations: safeArray(programData.remediations).filter((remediation) => taskIds.has(remediation.taskId)),
    alarmSignals: safeArray(programData.alarmSignals).filter((signal) => scopedFacilityIds.has(signal.facilityId)),
    cameraIssues: safeArray(programData.cameraIssues).filter((issue) => scopedFacilityIds.has(issue.facilityId)),
    panelInventory: safeArray(programData.panelInventory).filter((panel) => scopedFacilityIds.has(panel.facilityId)),
  };
}

function createEmptyScopedProgramData(programData: FpiProgramData): FpiProgramData {
  return {
    ...programData,
    facilities: [],
    tasks: [],
    remediations: [],
    alarmSignals: [],
    cameraIssues: [],
    panelInventory: [],
  };
}

function uniqueFacilityIds(facilityIds: string[]): string[] {
  return Array.from(new Set(safeArray(facilityIds).filter(Boolean)));
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
