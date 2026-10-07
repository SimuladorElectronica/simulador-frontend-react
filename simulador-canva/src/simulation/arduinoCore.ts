export class ArduinoCoreMock {
    private pinModes: Record<number, 'INPUT' | 'OUTPUT'> = {};
    private pinStates: Record<number, number> = {}; // Digital: 0 (LOW) o 1 (HIGH), Analog: 0 - 4095
    private virtualTimeMs = 0;

    public pinMode(pin: number, mode: 'INPUT' | 'OUTPUT') {
        this.pinModes[pin] = mode;
    }

    public digitalWrite(pin: number, value: number) {
        this.pinStates[pin] = value > 0 ? 1 : 0;
    }

    public digitalRead(pin: number): number {
        return this.pinStates[pin] || 0;
    }

    public analogRead(pin: number): number {
        return this.pinStates[pin] || 0;
    }

    public analogWrite(pin: number, value: number) {
        this.pinStates[pin] = Math.max(0, Math.min(255, value));
    }

    // Delay no bloqueante dentro del loop del Worker
    public delay(ms: number) {
        const start = Date.now();
        while (Date.now() - start < ms) {
            // Loop intencional corto o yielding para simulación interna
        }
        this.virtualTimeMs += ms;
    }

    public getPinStates() {
        return this.pinStates;
    }
}