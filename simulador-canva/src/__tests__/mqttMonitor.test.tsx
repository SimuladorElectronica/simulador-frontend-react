// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mqttStore } from '../stores/mqttStore';
import { mqttProxy } from '../services/mqttProxy';
import { MqttMonitor } from '../UIcomponents/MqttMonitor';

// El monitor se conecta solo al montar: espiar para no abrir un socket real.
const connectSpy = vi.spyOn(mqttProxy, 'connect').mockImplementation(() => undefined);
const disconnectSpy = vi.spyOn(mqttProxy, 'disconnect').mockImplementation(() => undefined);

/** Fija el valor de un input de React y dispara su evento nativo. */
function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(container: HTMLElement, label: string | RegExp): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        const text = button.textContent ?? '';
        return typeof label === 'string' ? text.includes(label) : label.test(text);
    });
}

describe('MqttMonitor', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        mqttStore.reset();
        connectSpy.mockClear();
        disconnectSpy.mockClear();
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    it('se conecta al montar y muestra el estado de conexión', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('[data-testid="mqtt-connection"]')!.textContent).toContain(
            'desconectado',
        );
        expect(container.querySelector('[data-testid="mqtt-output"]')!.textContent).toContain(
            '(sin mensajes)',
        );
    });

    it('muestra publicaciones TX del sketch con su tiempo virtual', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });
        await act(async () => {
            mqttStore.recordLocalPublish('esp32/led', 'ON', 42_000);
        });

        const output = container.querySelector('[data-testid="mqtt-output"]')!.textContent!;
        expect(output).toContain('[t=42000us] TX esp32/led: ON');
    });

    it('muestra mensajes RX del broker', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });
        await act(async () => {
            mqttStore.recordBrokerMessage('esp32/temp', '23.5', 1_700_000_000);
        });

        const output = container.querySelector('[data-testid="mqtt-output"]')!.textContent!;
        expect(output).toContain('RX esp32/temp: 23.5');
    });

    it('el filtro acota por tópico o por payload', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });
        await act(async () => {
            mqttStore.recordLocalPublish('esp32/led', 'ON', 100);
            mqttStore.recordLocalPublish('esp32/temp', '23.5', 200);
        });

        const filter = container.querySelector(
            'input[aria-label="Filtrar mensajes MQTT"]',
        ) as HTMLInputElement;
        await act(async () => setNativeValue(filter, 'temp'));

        const output = container.querySelector('[data-testid="mqtt-output"]')!.textContent!;
        expect(output).toContain('esp32/temp');
        expect(output).not.toContain('esp32/led');

        await act(async () => setNativeValue(filter, 'ON'));
        const filteredByPayload = container.querySelector('[data-testid="mqtt-output"]')!
            .textContent!;
        expect(filteredByPayload).toContain('ON');
        expect(filteredByPayload).not.toContain('23.5');
    });

    it('“Limpiar” vacía el buffer y “Copiar” no rompe sin mensajes', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window.navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });

        await act(async () => {
            root.render(<MqttMonitor />);
        });
        await act(async () => {
            mqttStore.recordLocalPublish('esp32/led', 'ON', 1);
        });

        await act(async () => findButton(container, 'Copiar')!.click());
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('esp32/led: ON'));

        await act(async () => findButton(container, 'Limpiar')!.click());
        expect(
            container.querySelector('[data-testid="mqtt-output"]')!.textContent,
        ).toContain('(sin mensajes)');
    });

    it('“Suscribir” agrega la suscripción al store y la muestra como chip', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });

        const input = container.querySelector(
            'input[aria-label="Tópico a suscribir"]',
        ) as HTMLInputElement;
        await act(async () => setNativeValue(input, 'esp32/led'));
        await act(async () => findButton(container, 'Suscribir')!.click());

        expect(mqttStore.getState().subscriptions).toEqual(['esp32/led']);
        expect(container.querySelector('[data-testid="mqtt-subscriptions"]')!.textContent).toContain(
            'esp32/led',
        );
        // El input queda listo para el siguiente tópico
        expect(input.value).toBe('');
    });

    it('el chip de suscripción permite desuscribirse', async () => {
        await act(async () => {
            root.render(<MqttMonitor />);
        });
        await act(async () => {
            mqttStore.addSubscription('esp32/led');
        });

        const unsubscribe = container.querySelector(
            'button[aria-label="Desuscribir esp32/led"]',
        ) as HTMLButtonElement;
        expect(unsubscribe).not.toBeNull();
        await act(async () => unsubscribe.click());
        expect(mqttStore.getState().subscriptions).toEqual([]);
    });
});
