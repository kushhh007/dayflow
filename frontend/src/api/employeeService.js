import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.

export async function listEmployees() {
  // Contract area: EMPLOYEES — Admin list of employee profiles (spec §7).
  return mockResponse([])
}

export async function getEmployee(employeeId) {
  // Contract area: EMPLOYEES — single profile, field access per spec §7.
  return mockResponse({ id: employeeId })
}

export async function createEmployee(payload) {
  // Contract area: EMPLOYEES — Admin creates an employee; backend generates
  // the Login ID + temporary password (shown once) per spec §2.
  return mockResponse({ id: null, ...payload })
}

export async function updateEmployee(employeeId, payload) {
  // Contract area: EMPLOYEES — profile edit; editable-field rules per spec §7.
  return mockResponse({ id: employeeId, ...payload })
}
