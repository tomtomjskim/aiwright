/**
 * aiwright 표준 에러 클래스
 * 형식: Error [E00X]: 메시지
 */

export class AiwrightError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'AiwrightError';
  }

  format(): string {
    let out = `Error [${this.code}]: ${this.message}`;
    if (this.suggestion) {
      out += `\n  Suggestion: ${this.suggestion}`;
    }
    return out;
  }
}

// E001 — Fragment not found
export class FragmentNotFoundError extends AiwrightError {
  constructor(name: string, suggestion?: string) {
    super(
      'E001',
      `Fragment "${name}" not found`,
      suggestion ?? `Run "aiwright list" to see available fragments`,
    );
    this.name = 'FragmentNotFoundError';
  }
}

// E002 — Recipe not found
export class RecipeNotFoundError extends AiwrightError {
  constructor(name: string) {
    super(
      'E002',
      `Recipe "${name}" not found in aiwright.config.yaml`,
      `Run "aiwright list" to see available recipes`,
    );
    this.name = 'RecipeNotFoundError';
  }
}

// E003 — Config not found
export class ConfigNotFoundError extends AiwrightError {
  constructor(projectDir: string) {
    super(
      'E003',
      `aiwright.config.yaml not found in ${projectDir}`,
      `Run "aiwright init" to initialize the project`,
    );
    this.name = 'ConfigNotFoundError';
  }
}

// E004 — Validation error (의도적으로 SchemaValidationError, CommandError(exitCode=2)와 공유.
//   모두 "입력 유효성 검증 실패"를 나타내며 CLI에서 exit code 2로 처리됨)
export class ValidationError extends AiwrightError {
  constructor(message: string, suggestion?: string) {
    super('E004', message, suggestion);
    this.name = 'ValidationError';
  }
}

// E005 — File I/O error
export class FileIOError extends AiwrightError {
  constructor(filePath: string, cause?: string) {
    super(
      'E005',
      `File I/O error: ${filePath}${cause ? ` — ${cause}` : ''}`,
    );
    this.name = 'FileIOError';
  }
}

// E006 — Cyclic dependency
export class CyclicDependencyError extends AiwrightError {
  constructor(cycle: string[]) {
    super(
      'E006',
      `Cyclic dependency detected: ${cycle.join(' → ')}`,
      `Remove the circular depends_on reference`,
    );
    this.name = 'CyclicDependencyError';
  }
}

// E007 — Fragment conflict
export class FragmentConflictError extends AiwrightError {
  constructor(a: string, b: string) {
    super(
      'E007',
      `Fragment "${a}" conflicts with "${b}"`,
      `Remove one of the conflicting fragments from the recipe`,
    );
    this.name = 'FragmentConflictError';
  }
}

// E008 — Invalid Fragment file
export class InvalidFragmentError extends AiwrightError {
  constructor(filePath: string, details: string) {
    super(
      'E008',
      `Invalid fragment file "${filePath}": ${details}`,
      `Check the YAML frontmatter matches the Fragment schema`,
    );
    this.name = 'InvalidFragmentError';
  }
}

// E009 — Adapter error
export class AdapterError extends AiwrightError {
  constructor(adapterName: string, details: string) {
    super(
      'E009',
      `Adapter "${adapterName}" error: ${details}`,
    );
    this.name = 'AdapterError';
  }
}

// E010 — Cases file error (bench)
export class CasesFileError extends AiwrightError {
  constructor(filePath: string, details: string) {
    super(
      'E010',
      `Cases file "${filePath}" error: ${details}`,
      `Ensure the file exists and contains a valid YAML "cases" array`,
    );
    this.name = 'CasesFileError';
  }
}

// ---- Aliases and additional error classes (TDD contract) ----

// SchemaValidationError — Zod schema validation failure
export class SchemaValidationError extends AiwrightError {
  constructor(message: string, suggestion?: string) {
    super('E004', message, suggestion);
    this.name = 'SchemaValidationError';
  }
}

// E011 — Adapter not found
export class AdapterNotFoundError extends AiwrightError {
  constructor(message: string, suggestion?: string) {
    super('E011', message, suggestion);
    this.name = 'AdapterNotFoundError';
  }
}

// E012 — Required Mustache variable not supplied
export class VariableMissingError extends AiwrightError {
  constructor(varName: string, fragmentName?: string) {
    super(
      'E012',
      fragmentName
        ? `Required variable "${varName}" is missing in fragment "${fragmentName}"`
        : `Required variable "${varName}" is missing`,
      `Provide the variable via --var ${varName}=<value> or in the recipe vars`,
    );
    this.name = 'VariableMissingError';
  }
}

// E013 — Adapter apply operation failed
export class ApplyFailedError extends AiwrightError {
  constructor(message: string, suggestion?: string) {
    super('E013', message, suggestion);
    this.name = 'ApplyFailedError';
  }
}

// ConflictDetectedError — explicit alias matching TDD contract code E007
export { FragmentConflictError as ConflictDetectedError };

// CommandError — non-zero exit from a CLI command (exitCode: 1 → E014, exitCode: 2 → E004 validation failure)
export class CommandError extends AiwrightError {
  constructor(
    message: string,
    public readonly exitCode: 1 | 2 = 1,
    suggestion?: string,
  ) {
    super(exitCode === 2 ? 'E004' : 'E014', message, suggestion);
    this.name = 'CommandError';
  }
}
