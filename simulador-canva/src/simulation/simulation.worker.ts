import type { UICommand, WorkerEvent, CircuitNetlist } from '@domain-types';
import { PhysicsEngine } from './physicsEngine';
import { ArduinoCoreMock } from './arduinoCore';

const physicsEngine = new PhysicsEngine();
const arduinoCore = new ArduinoCoreMock();

let isRunning = false;
let tickInterval: any = null;
const TICK_RATE_MS = 10; // 100 Hz de simulación en segundo plano

const emitEvent = (event: WorkerEvent) => {
    self.postMessage(event);
};

// Bucle principal de ejecución
function runTick() {
    if (!isRunning) return;

    // 1. Avanzar la simulación eléctrica
    physicsEngine.step(TICK_RATE_MS, emitEvent);

    // 2. Notificar actualización de estado a la UI
    emitEvent({
        type: 'TICK_UPDATE',
        payload: {
            componentStates: {},
            pinVoltages: physicsEngine.getNodeVoltages(),
        },
    });
}

// Receptor de comandos del Hilo Principal (UI)
self.onmessage = (e: MessageEvent<UICommand>) => {
    const command = e.data;

    switch (command.type) {
        case 'INIT':
        case 'UPDATE_NETLIST':
            physicsEngine.updateNetlist(command.payload);
            break;
        case 'START':
            if (!isRunning) {
                isRunning = true;
                tickInterval = setInterval(runTick, TICK_RATE_MS);
            }
            break;
        case 'PAUSE':
            isRunning = false;
            if (tickInterval) clearInterval(tickInterval);
            break;
        case 'RESET':
            isRunning = false;
            if (tickInterval) clearInterval(tickInterval);
            physicsEngine.updateNetlist({ components: [], wires: [] });
            break;
        case 'LOAD_USER_CODE':
            // Preparado para evaluación de WASM / C++ transpilado
            emitEvent({ type: 'LOG_OUTPUT', payload: { message: 'Código C++ cargado en el entorno aislado.' } });
            break;
    }
};