import { describe, expect, it } from 'vitest';
import { projectEmployee } from '../src/lib/employee-projection.js';

const record = {
  id: 'e1',
  firstName: 'John',
  lastName: 'Doe',
  phone: '9876543210',
  profilePictureUrl: null,
  personalEmail: 'john@dayflow.test',
  address: 'MG Road, Bangalore',
  dateOfBirth: new Date('1990-01-01'),
  gender: 'MALE',
  maritalStatus: 'SINGLE',
  nationality: 'IN',
  bankAccountNo: '1234567890',
  bankName: 'HDFC',
  ifscCode: 'HDFC0000001',
  pan: 'ABCDE1234F',
  uan: '101010101010',
  status: 'ACTIVE' as const,
  joinDate: new Date('2026-01-05'),
  department: { id: 'd1', name: 'Engineering' },
  jobPosition: { id: 'j1', title: 'Developer' },
  salaryStructure: { wagePaise: 5000000, standardAllowancePaise: 416700 }
};

describe('projectEmployee', () => {
  it('hides private fields from other employees', () => {
    const view = projectEmployee(record, 'EMPLOYEE', false);
    expect(view).not.toHaveProperty('pan');
    expect(view).not.toHaveProperty('bankAccountNo');
    expect(view).not.toHaveProperty('dateOfBirth');
    expect(view).not.toHaveProperty('salaryStructure');
    expect(view).toHaveProperty('department');
    expect(view).toHaveProperty('phone');
  });

  it('shows private info but never salary structure to self', () => {
    const view = projectEmployee(record, 'EMPLOYEE', true);
    expect(view).toHaveProperty('pan');
    expect(view).toHaveProperty('bankName');
    expect(view).not.toHaveProperty('salaryStructure');
  });

  it('shows everything including salary structure to admin', () => {
    const view = projectEmployee(record, 'ADMIN', false);
    expect(view).toHaveProperty('salaryStructure');
    expect(view).toHaveProperty('uan');
    expect((view as { salaryStructure?: unknown }).salaryStructure).toEqual(
      record.salaryStructure
    );
  });
});
