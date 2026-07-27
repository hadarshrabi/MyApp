import type { Employee } from "../types/models";

export const payrollService = {
  calculate(employee: Employee, regularHours: number, overtimeHours: number) {
    return regularHours * employee.hourlyRate + overtimeHours * employee.hourlyRate * 1.25;
  },
};
