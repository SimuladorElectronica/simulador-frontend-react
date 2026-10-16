import { describe, it, expect, vi } from 'vitest';
import { PhysicsEngine } from '@/simulation/physicsEngine';
import { LedDescriptor } from '@/core/manifests/led/led.descriptor';
import { Esp32Descriptor } from '@/core/manifests/esp32/esp32.descriptor';
import type { CircuitNetlist } from '@domain-types';

/**
 * Circuito mínimo: la placa ESP32 alimenta el LED a través de dos cables.
 * Los pines se generan con los propios descriptors (createDefaultPins) para que
 * las IDs coincidan siempre con el contrato único del descriptor.
 */
const buildNetlist = (railPin: 'VIN' | '3V3'): CircuitNetlist => ({
  components: [
    {
      id: 'esp32_1',
      type: 'ESP32',
      position: { x: 0, y: 0 },
      pins: Esp32Descriptor.createDefaultPins('esp32_1'),
      state: { ...Esp32Descriptor.defaultState },
    },
    {
      id: 'led_1',
      type: 'LED',
      position: { x: 220, y: 0 },
      pins: LedDescriptor.createDefaultPins('led_1'),
      state: { ...LedDescriptor.defaultState },
    },
  ],
  wires: [
    {
      id: 'wire_vcc',
      fromPinId: `esp32_1-${railPin}`,
      toPinId: 'led_1-anode',
      color: '#e74c3c',
    },
    {
      id: 'wire_gnd',
      fromPinId: 'esp32_1-GNDl',
      toPinId: 'led_1-cathode',
      color: '#2c3e50',
    },
  ],
});

describe('PhysicsEngine - Sobrecarga Térmica y Disipación', () => {
  it('debe emitir COMPONENT_BURNED si P > Pmax por más de 1.5 segundos (1500 ms)', () => {
    const engine = new PhysicsEngine();
    const emitEventMock = vi.fn();

    // VIN = 5V => P = V²/R = 25/220 ≈ 113 mW > Pmax (60 mW)
    engine.updateNetlist(buildNetlist('VIN'));

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

  it('no debe quemar el LED si la potencia se mantiene por debajo de Pmax', () => {
    const engine = new PhysicsEngine();
    const emitEventMock = vi.fn();

    // 3V3 => P = 3.3²/220 ≈ 49.5 mW < Pmax (60 mW)
    engine.updateNetlist(buildNetlist('3V3'));

    // Simular 5 segundos: el LED enciende pero nunca se destruye
    for (let i = 0; i < 500; i++) {
      engine.step(10, emitEventMock);
    }

    expect(emitEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COMPONENT_BURNED' })
    );
  });
});
