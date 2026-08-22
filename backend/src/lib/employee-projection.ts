export interface ProjectableEmployee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePictureUrl: string | null;
  personalEmail: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  bankAccountNo: string | null;
  bankName: string | null;
  ifscCode: string | null;
  pan: string | null;
  uan: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  joinDate: Date;
  department?: { id: string; name: string } | null;
  jobPosition?: { id: string; title: string } | null;
  salaryStructure?: {
    wagePaise: number;
    standardAllowancePaise: number;
  } | null;
}

export type Role = 'ADMIN' | 'EMPLOYEE';

export function projectEmployee(employee: ProjectableEmployee, role: Role, isSelf: boolean) {
  const general = {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone,
    profilePictureUrl: employee.profilePictureUrl,
    status: employee.status,
    department: employee.department ?? null,
    jobPosition: employee.jobPosition ?? null
  };

  if (role === 'EMPLOYEE' && !isSelf) {
    return general;
  }

  const extended = {
    ...general,
    personalEmail: employee.personalEmail,
    address: employee.address,
    dateOfBirth: employee.dateOfBirth,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    nationality: employee.nationality,
    bankAccountNo: employee.bankAccountNo,
    bankName: employee.bankName,
    ifscCode: employee.ifscCode,
    pan: employee.pan,
    uan: employee.uan,
    joinDate: employee.joinDate
  };

  if (role === 'ADMIN') {
    return { ...extended, salaryStructure: employee.salaryStructure ?? null };
  }

  return extended;
}
