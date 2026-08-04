import type { Program, ProgramIndex } from '../program/Program';

export interface ProgramRepository {
  getProgram(): Readonly<Program> | null;
  getIndex(): ProgramIndex | null;
}
