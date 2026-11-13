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

/** Valor que puede circular por el intérprete (números y strings). */
export type LibraryValue = number | string;

/** Evento de pantalla emitido por un adaptador de librería (p. ej. LCD I2C). */
export interface DisplayLibraryEvent {
    kind: 'display';
    /** Id de la librería en el catálogo (p. ej. `LiquidCrystal_I2C`). */
    library: string;
    /** Nombre del objeto declarado en el sketch (p. ej. `lcd`). */
    objectName: string;
    columns: number;
    rows: number;
    lines: string[];
    cursor: { column: number; row: number };
    backlight: boolean;
    displayOn: boolean;
}

/** Publicación MQTT solicitada por un sketch (PubSubClient). */
export interface MqttPublishLibraryEvent {
    kind: 'mqtt-publish';
    library: string;
    objectName: string;
    topic: string;
    payload: string;
}

/** Suscripción MQTT solicitada por un sketch (PubSubClient). */
export interface MqttSubscriptionLibraryEvent {
    kind: 'mqtt-subscription';
    /** `subscribe` o `unsubscribe` (PubSubClient). */
    action: 'subscribe' | 'unsubscribe';
    library: string;
    objectName: string;
    topic: string;
}

/** Cambio de estado de la conexión WiFi simulada. */
export interface WifiLibraryEvent {
    kind: 'wifi';
    connected: boolean;
    ip?: string;
}

export type LibraryEvent =
    | DisplayLibraryEvent
    | MqttPublishLibraryEvent
    | MqttSubscriptionLibraryEvent
    | WifiLibraryEvent;

export interface HostInterface {
    pinMode(gpio: number, mode: number): void;
    digitalWrite(gpio: number, level: number): void;
    digitalRead(gpio: number): number;
    analogRead(gpio: number): number;
    /** PWM 8 bits (0-255), ESP32 LEDC */
    analogWrite(gpio: number, duty: number): void;
    /** Suspende la ejecución virtual durante ms (no bloquea el reloj real) */
    delay(ms: number): void;
    delayMicroseconds(us: number): void;
    millis(): number;
    micros(): number;
    getTimeUs(): number;
    serialPrint(text: string): void;
    serialPrintln(text?: string): void;
    /**
     * Canal opcional para que los adaptadores de librerías avisen al Worker
     * (pantalla LCD, publicación MQTT, estado WiFi). Los hosts de test que no
     * lo implementan simplemente lo ignoran.
     */
    emitLibraryEvent?(event: LibraryEvent): void;
}