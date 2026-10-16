export interface CodeDiagnostic {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}

export type ExecutionResult =
    | { type: 'sleeping'; wakeUpTimeUs: number }
    | { type: 'preempted'; currentTimeUs: number }
    | { type: 'reset'; currentTimeUs: number }
    | { type: 'faulted'; diagnostic: CodeDiagnostic };

export interface LanguageBackend {
    compile(source: string, platformProfile: string): { program?: unknown; diagnostics: CodeDiagnostic[] };
    createInstance(program: unknown, hostContext: HostInterface): unknown;
    resume(instance: unknown, limitTimeUs: number): ExecutionResult;
    reset(instance: unknown): void;
    dispose(instance: unknown): void;
}

export interface HostInterface {
    pinMode(gpio: number, mode: number): void;
    digitalWrite(gpio: number, level: number): void;
    digitalRead(gpio: number): number;
    analogRead(gpio: number): number;
    getTimeUs(): number;
    serialPrint(text: string): void;
}