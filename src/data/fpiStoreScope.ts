import type { FireAlarmSite } from './fireAlarmTypes';
import type { FpiProgramData } from './fpiTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';

export function applyStoreScopeToFpiProgram(programData: FpiProgramData, fireSites: FireAlarmSite[], scope: StoreScopeState): FpiProgramData {
  if (scope.mode === 'all') return programData;
  if (hasEmptyStoreScope(scope)) return emptyProgramData(programData);

  const scopedStoreIds = new Set(getScopedStoreIds(fireSites, scope));
  const facilities = programData.facilities.filter((facility) => scopedStoreIds.has(facility.facilityId));
  const facilityIds = new Set(facilities.map((facility) => facility.facilityId));
  const tasks = programData.tasks.filter((task) => facilityIds.has(task.facilityId));
  const taskIds = new Set(tasks.map((task) => task.id));

  return {
    ...programData,
    facilities,
    tasks,
    remediations: programData.remediations.filter((remediation) => taskIds.has(remediation.taskId)),
    alarmSignals: programData.alarmSignals.filter((signal) => facilityIds.has(signal.facilityId)),
    cameraIssues: programData.cameraIssues.filter((issue) => facilityIds.has(issue.facilityId)),
    panelInventory: programData.panelInventory.filter((panel) => facilityIds.has(panel.facilityId)),
  };
}

function emptyProgramData(programData: FpiProgramData): FpiProgramData {
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
