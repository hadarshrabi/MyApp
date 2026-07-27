import { employees } from "../data/mockData";
import type { Employee } from "../types/models";

export const employeeService = {
  async list(): Promise<Employee[]> { return structuredClone(employees); },
  async get(id: string): Promise<Employee | undefined> { return employees.find(item => item.id === id); },
};
