// @vitest-environment jsdom
/**
 * Prueba de integración de la tubería React → store → WireNode.
 *
 * Mockea react-konva para capturar los props de cada nodo (sin necesidad de
 * canvas real) y verifica que el `data` del Path del cable se recalcula cuando
 * el store cambia. Esto reproduce exactamente el bug reportado: "los cables no
 * se mueven con el componente".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

// --- Mock de react-konva: cada nodo deja su tag y props en `renderedNodes` ---
interface CapturedNode {
    tag: string;
    props: Record<string, unknown>;
}

const renderedNodes: CapturedNode[] = [];

vi.mock('react-konva', () => {
    // Cada nodo captura sus props Y renderiza sus children (como hace React de
    // verdad): si no, los descendientes nunca se montarían y el test mentiría.
    const make = (tag: string) =>
        function MockNode(props: Record<string, unknown>) {
            renderedNodes.push({ tag, props });
            return (props.children as unknown) ?? null;
        };
    return { Stage: make('Stage'), Layer: make('Layer'), Group: make('Group'), Rect: make('Rect'), Circle: make('Circle'), Text: make('Text'), Path: make('Path'), Image: make('Image') };
});

vi.mock('use-image', () => ({ default: () => [null, 'loaded'] }));

// jsdom no implementa ResizeObserver (solo lo necesita el contenedor del canvas)
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;

import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { SimulatorCanvas } from '../UIcomponents/SimulatorCanvas';
import { createRoot, type Root } from 'react-dom/client';

describe('Integración: el Path del cable debe seguir al componente', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        renderedNodes.length = 0;
        ManifestRegistry.init();
        // DocumentStore es un singleton: limpiar el documento entre tests
        documentStore.getDocument().components.length = 0;
        documentStore.getDocument().wires.length = 0;
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    const getPathData = (): string[] =>
        renderedNodes.filter((n) => n.tag === 'Path').map((n) => String(n.props.data));

    it('al mover un componente, el data del Path del cable cambia (cable sigue al componente)', async () => {
        // 1. Montar el canvas
        await act(async () => {
            root.render(<SimulatorCanvas />);
        });

        // 2. Añadir LED y protoboard + cable anode → a1
        await act(async () => {
            documentStore.addComponent('core/led@1', { x: 100, y: 100 });
            documentStore.addComponent('core/breadboard@1', { x: 300, y: 100 });
        });
        const doc = documentStore.getDocument();
        const ledId = doc.components.find((c) => c.type === 'core/led@1')!.id;
        const bbId = doc.components.find((c) => c.type === 'core/breadboard@1')!.id;

        await act(async () => {
            documentStore.addWire({ componentId: ledId, pinId: 'anode' }, { componentId: bbId, pinId: 'a1' });
        });

        renderedNodes.length = 0; // medir solo el render del estado ya establecido
        await act(async () => {
            documentStore.updateComponentPosition(ledId, 100, 100); // sin cambio real
        });
        const before = getPathData();
        expect(before.length).toBe(1); // un cable → un Path

        // 3. Mover el LED 250px a la derecha (simula drag)
        renderedNodes.length = 0; // medir solo el render posterior al cambio
        await act(async () => {
            documentStore.updateComponentPosition(ledId, 350, 100);
        });

        const after = getPathData();
        expect(after.length).toBe(1);
        // El path debe haber cambiado: el endpoint inicial lo fija el pin del LED
        expect(after[0]).not.toBe(before[0]);
        // y debe reflejar la nueva posición (anode está a +10 en x dentro del LED)
        expect(after[0]).toContain('360'); // 350 + 10 (offset del pin anode)

        await act(async () => root.unmount());
    });

    it('al añadir un cable, aparece inmediatamente su Path (sin esperar a otro render)', async () => {
        await act(async () => {
            root.render(<SimulatorCanvas />);
        });
        await act(async () => {
            documentStore.addComponent('core/led@1', { x: 0, y: 0 });
            documentStore.addComponent('core/breadboard@1', { x: 200, y: 0 });
        });
        const comps = documentStore.getDocument().components;
        const ledId = comps.find((c) => c.type === 'core/led@1')!.id;
        const bbId = comps.find((c) => c.type === 'core/breadboard@1')!.id;

        renderedNodes.length = 0;
        let wireId: string | undefined;
        await act(async () => {
            wireId = documentStore.addWire({ componentId: ledId, pinId: 'cathode' }, { componentId: bbId, pinId: 'a1' })?.id;
        });

        // Diagnóstico: ¿el cable llegó al store?
        expect(wireId).toBeDefined();
        expect(documentStore.getDocument().wires.length).toBe(1);
        expect(documentStore.getSnapshot().wires.length).toBe(1);

        expect(getPathData().length).toBe(1);

        await act(async () => root.unmount());
    });
});
