import type { ComponentManifest, ComponentPinManifest } from '@types';
// Generador de pines y redes internas para protoboard estándar de 400 puntos
function generateBreadboardPinsAndNets() {
  const pins: ComponentPinManifest[] = [];
  const internalGroups: string[][] = [];

  // Pista central: Columnas 1 a 30 (Filas A, B, C, D, E)
  for (let col = 1; col <= 30; col++) {
    const groupTop: string[] = [];
    const rows = ['a', 'b', 'c', 'd', 'e'];
    rows.forEach((row, i) => {
      const pinId = `${row}${col}`;
      pins.push({
        id: pinId,
        label: pinId.toUpperCase(),
        position: { x: 20 + col * 10, y: 40 + i * 10 },
        kind: 'passive' as const,
      });
      groupTop.push(pinId);
    });
    internalGroups.push(groupTop); // Los 5 orificios están unidos internamente
  }

  return { pins, internalGroups };
}

const { pins, internalGroups } = generateBreadboardPinsAndNets();

export const BreadboardManifest: ComponentManifest = {
  id: 'core/breadboard@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Protoboard 400 Puntos',
  category: 'Infraestructura',
  size: { width: 340, height: 180 },
  art: `<svg viewBox="0 0 340 180"><rect width="340" height="180" fill="#f8f9fa" rx="8"/></svg>`,
  pins,
  internalGroups,
  elements: [], // Sin elementos eléctricos activos
};