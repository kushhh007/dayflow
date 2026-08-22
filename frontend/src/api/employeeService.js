import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace the store operations with apiRequest() calls when it lands.
//
// This mock keeps employee mutations stateful so Admin and employee screens
// can exercise the same transitions a real API will own.

const DEPARTMENTS = [
  { id: 'dept-engineering', name: 'Engineering' },
  { id: 'dept-people', name: 'People Operations' },
  { id: 'dept-finance', name: 'Finance' },
  { id: 'dept-sales', name: 'Sales' },
]

const JOB_POSITIONS = [
  { id: 'job-software-engineer', name: 'Software Engineer' },
  { id: 'job-hr-manager', name: 'HR Manager' },
  { id: 'job-payroll-specialist', name: 'Payroll Specialist' },
  { id: 'job-account-executive', name: 'Account Executive' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,19}$/

let employeeSequence = 1
const serialByYear = { 2026: 3 }

const store = {
  employees: [
    {
      id: 'emp-demo',
      userId: 'emp-demo',
      loginId: 'demo.employee',
      name: 'Demo Employee',
      phone: '+91 98765 43210',
      personalEmail: 'employee@example.com',
      residingAddress: '12 Demo Street, Bengaluru',
      profilePicture: '',
      departmentId: 'dept-engineering',
      department: 'Engineering',
      jobPositionId: 'job-software-engineer',
      jobPosition: 'Software Engineer',
      manager: 'Demo Admin',
      joinDate: '2026-01-15',
      status: 'ACTIVE',
      employmentEndDate: null,
      dateOfBirth: '1994-07-12',
      gender: 'Not specified',
      maritalStatus: 'Not specified',
      nationality: 'Indian',
      bankDetails: 'Account ending 4821',
      pan: 'ABCDE****F',
      uan: '1000******',
    },
    {
      id: 'adm-demo',
      userId: 'adm-demo',
      loginId: 'demo.admin',
      name: 'Demo Admin',
      phone: '+91 98765 43211',
      personalEmail: 'admin@example.com',
      residingAddress: '12 Demo Street, Bengaluru',
      profilePicture: '',
      departmentId: 'dept-people',
      department: 'People Operations',
      jobPositionId: 'job-hr-manager',
      jobPosition: 'HR Manager',
      manager: null,
      joinDate: '2025-06-01',
      status: 'ACTIVE',
      employmentEndDate: null,
      dateOfBirth: '1988-03-22',
      gender: 'Not specified',
      maritalStatus: 'Not specified',
      nationality: 'Indian',
      bankDetails: 'Account ending 7310',
      pan: 'FGHIJ****K',
      uan: '2000******',
    },
    {
      id: 'emp-first',
      userId: 'emp-first',
      loginId: 'demo.firstlogin',
      name: 'First Login Employee',
      phone: '',
      personalEmail: '',
      residingAddress: '',
      profilePicture: '',
      departmentId: 'dept-engineering',
      department: 'Engineering',
      jobPositionId: 'job-software-engineer',
      jobPosition: 'Software Engineer',
      manager: 'Demo Admin',
      joinDate: '2026-02-01',
      status: 'ACTIVE',
      employmentEndDate: null,
      dateOfBirth: null,
      gender: null,
      maritalStatus: null,
      nationality: null,
      bankDetails: null,
      pan: null,
      uan: null,
    },
  ],
}

function publicEmployee(employee) {
  const { temporaryPassword, ...payload } = employee
  void temporaryPassword
  return { ...payload }
}

function findEmployee(employeeId) {
  return store.employees.find((employee) => employee.id === employeeId || employee.userId === employeeId)
}

function requireEmployee(employeeId) {
  const employee = findEmployee(employeeId)
  if (!employee) throw new Error('Employee not found.')
  return employee
}

function requireDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new Error(`${label} is required.`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} is invalid.`)
  }
}

function validateContactFields(payload) {
  if (payload.phone && !PHONE_PATTERN.test(payload.phone.trim())) {
    throw new Error('Enter a valid phone number.')
  }
  if (payload.personalEmail && !EMAIL_PATTERN.test(payload.personalEmail.trim())) {
    throw new Error('Enter a valid personal email address.')
  }
}

function departmentFor(id) {
  const department = DEPARTMENTS.find((entry) => entry.id === id)
  if (!department) throw new Error('Select a valid department.')
  return department
}

function jobPositionFor(id) {
  const position = JOB_POSITIONS.find((entry) => entry.id === id)
  if (!position) throw new Error('Select a valid job position.')
  return position
}

function namePart(value, fallback) {
  const letters = String(value ?? '').replace(/[^a-z]/gi, '').toUpperCase()
  return (letters.slice(0, 2) || fallback).padEnd(2, 'X')
}

function createLoginId(name, joinDate) {
  const parts = name.trim().split(/\s+/)
  const first = namePart(parts[0], 'X')
  const last = namePart(parts.length > 1 ? parts[parts.length - 1] : '', 'X')
  const year = joinDate.slice(0, 4)
  let serial = serialByYear[year] ?? 1
  let loginId

  do {
    loginId = `DF${first}${last}${year}${String(serial).padStart(4, '0')}`
    serial += 1
  } while (store.employees.some((employee) => employee.loginId === loginId))

  serialByYear[year] = serial
  return { loginId, serial: serial - 1 }
}

export async function listDepartments() {
  // Contract area: EMPLOYEES — fixed seeded Department selections; no CRUD.
  return mockResponse(DEPARTMENTS.map((department) => ({ ...department })))
}

export async function listJobPositions() {
  // Contract area: EMPLOYEES — fixed seeded JobPosition selections; no CRUD.
  return mockResponse(JOB_POSITIONS.map((position) => ({ ...position })))
}

export async function listEmployees() {
  // Contract area: EMPLOYEES — Admin directory. Temporary credentials are
  // never part of this response and can only be returned by createEmployee.
  const employees = [...store.employees]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(publicEmployee)
  return mockResponse(employees)
}

export async function getEmployee(employeeId) {
  // Contract area: EMPLOYEES — one profile with field access enforced by the
  // eventual API. This mock exposes the linked employee for the current demo.
  return mockResponse(publicEmployee(requireEmployee(employeeId)))
}

export async function createEmployee(payload = {}) {
  // Contract area: EMPLOYEES — Admin creates an employee; the backend
  // generates the Login ID and temporary password and returns the password once.
  const name = String(payload.name ?? '').trim()
  const joinDate = String(payload.joinDate ?? '')
  if (!name) throw new Error('Employee name is required.')
  requireDate(joinDate, 'Join date')
  const department = departmentFor(payload.departmentId)
  const jobPosition = jobPositionFor(payload.jobPositionId)
  validateContactFields(payload)

  const { loginId, serial } = createLoginId(name, joinDate)
  const employee = {
    id: `emp-${employeeSequence++}`,
    userId: `emp-${employeeSequence - 1}`,
    loginId,
    name,
    phone: String(payload.phone ?? '').trim(),
    personalEmail: String(payload.personalEmail ?? '').trim(),
    residingAddress: String(payload.residingAddress ?? '').trim(),
    profilePicture: String(payload.profilePicture ?? '').trim(),
    departmentId: department.id,
    department: department.name,
    jobPositionId: jobPosition.id,
    jobPosition: jobPosition.name,
    manager: String(payload.manager ?? '').trim() || null,
    joinDate,
    status: 'ACTIVE',
    employmentEndDate: null,
    dateOfBirth: String(payload.dateOfBirth ?? '').trim() || null,
    gender: String(payload.gender ?? '').trim() || null,
    maritalStatus: String(payload.maritalStatus ?? '').trim() || null,
    nationality: String(payload.nationality ?? '').trim() || null,
    bankDetails: null,
    pan: null,
    uan: null,
  }

  store.employees.push(employee)
  return mockResponse({
    ...publicEmployee(employee),
    temporaryPassword: `Dayflow#${joinDate.slice(0, 4)}${String(serial).padStart(4, '0')}`,
  })
}

const ADMIN_EDITABLE_FIELDS = new Set([
  'name',
  'phone',
  'personalEmail',
  'residingAddress',
  'profilePicture',
  'departmentId',
  'jobPositionId',
  'manager',
  'joinDate',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'nationality',
])

export async function updateEmployee(employeeId, payload = {}) {
  // Contract area: EMPLOYEES — Admin-editable profile fields only. Status is
  // changed through guarded deactivate/reactivate operations below.
  const employee = requireEmployee(employeeId)
  const unknownField = Object.keys(payload).find((field) => !ADMIN_EDITABLE_FIELDS.has(field))
  if (unknownField) throw new Error(`Field ${unknownField} cannot be edited here.`)
  if ('name' in payload && !String(payload.name).trim()) throw new Error('Employee name is required.')
  if ('joinDate' in payload) requireDate(payload.joinDate, 'Join date')
  if ('joinDate' in payload && employee.employmentEndDate && payload.joinDate > employee.employmentEndDate) {
    throw new Error('Join date cannot follow the employment end date.')
  }
  validateContactFields(payload)

  const updates = { ...payload }
  if ('departmentId' in payload) {
    const department = departmentFor(payload.departmentId)
    updates.department = department.name
  }
  if ('jobPositionId' in payload) {
    const jobPosition = jobPositionFor(payload.jobPositionId)
    updates.jobPosition = jobPosition.name
  }
  Object.assign(employee, updates)
  return mockResponse(publicEmployee(employee))
}

const OWN_PROFILE_FIELDS = new Set(['phone', 'personalEmail', 'residingAddress', 'profilePicture'])

export async function updateOwnProfile(employeeId, payload = {}) {
  // Contract area: EMPLOYEES — employee self-edit is restricted to the four
  // enumerated fields in spec §7. The API must enforce this again server-side.
  const employee = requireEmployee(employeeId)
  const unknownField = Object.keys(payload).find((field) => !OWN_PROFILE_FIELDS.has(field))
  if (unknownField) throw new Error(`Field ${unknownField} cannot be edited from your profile.`)
  validateContactFields(payload)
  Object.assign(employee, payload)
  return mockResponse(publicEmployee(employee))
}

export async function deactivateEmployee(employeeId, employmentEndDate) {
  // Contract area: EMPLOYEES — guarded ACTIVE → INACTIVE transition. The
  // service requires an end date; the real transaction also closes employment
  // history and writes an audit record.
  const employee = requireEmployee(employeeId)
  if (employee.status !== 'ACTIVE') throw new Error('Only active employees can be deactivated.')
  requireDate(employmentEndDate, 'Employment end date')
  if (employmentEndDate < employee.joinDate) {
    throw new Error('Employment end date cannot precede the join date.')
  }
  employee.status = 'INACTIVE'
  employee.employmentEndDate = employmentEndDate
  return mockResponse(publicEmployee(employee))
}

export async function reactivateEmployee(employeeId) {
  // Contract area: EMPLOYEES — guarded INACTIVE → ACTIVE transition. The real
  // transaction clears the current end date and opens a new employment period.
  const employee = requireEmployee(employeeId)
  if (employee.status !== 'INACTIVE') throw new Error('Only inactive employees can be reactivated.')
  employee.status = 'ACTIVE'
  employee.employmentEndDate = null
  return mockResponse(publicEmployee(employee))
}
