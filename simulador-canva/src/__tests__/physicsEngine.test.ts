import { describe, it, expect, vi } from 'vitest';
import { PhysicsEngine } from '@/simulation/physicsEngine';

describe('PhysicsEngine - Sobrecarga Térmica y Disipación', () => {
  it('debe emitir COMPONENT_BURNED si P > Pmax por más de 1.5 segundos (1500 ms)', () => {
    const engine = new PhysicsEngine();
    const emitEventMock = vi.fn();

    // Circuito: Un LED alimentado con un voltaje excesivo que supera sus 60mW
    engine.updateNetlist({
      components: [
        {
          id: 'led_1',
          type: 'LED',
          position: { x: 0, y: 0 },
          pins: [
            { id: 'pin_a', name: '3V3', relativePos: { x: 0, y: 0 } },
            { id: 'pin_k', name: 'GND', relativePos: { x: 0, y: 0 } },
          ],
          state: {},
        },
      ],
      wires: [],
    });

    // Simular 1400 ms (Aún NO debe quemarse)
    for (let i = 0; i < 140; i++) {
      engine.step(10, emitEventMock);
    }
    expect(emitEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMPONENT_BURNED' })
    );

    // Avanzar 200 ms adicionales (Total = 1600 ms > 1500 ms)
    for (let i = 0; i < 20; i++) {
      engine.step(10, emitEventMock);
    }

    // Verificar que se emitió el evento COMPONENT_BURNED en menos de 100 ms tras sobrepasar la ventana
    expect(emitEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMPONENT_BURNED',
        payload: expect.objectContaining({ componentId: 'led_1' }),
      })
    );
  });
});