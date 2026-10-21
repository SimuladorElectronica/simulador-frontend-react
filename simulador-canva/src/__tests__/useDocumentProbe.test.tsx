// @vitest-environment jsdom
/** Aísla si `useDocument` (useSyncExternalStore) re-renderiza al cambiar el store */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { useDocument } from '../UIcomponents/hooks/useDocument';

let renders = 0;
let lastWiresLen = -1;

function Probe() {
    const doc = useDocument();
    renders++;
    lastWiresLen = doc.wires.length;
    return null;
}

describe('useDocument re-renderiza con el store', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        renders = 0;
        lastWiresLen = -1;
        ManifestRegistry.init();
        documentStore.getDocument().components.length = 0;
        documentStore.getDocument().wires.length = 0;
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    it('addWire provoca un re-render con el cable visible', async () => {
        await act(async () => { root.render(<Probe />); });
        const afterMount = renders;

        await act(async () => {
            documentStore.addComponent('core/led@1', { x: 0, y: 0 });
            documentStore.addComponent('core/breadboard@1', { x: 200, y: 0 });
        });
        const comps = documentStore.getDocument().components;

        await act(async () => {
            documentStore.addWire(
                { componentId: comps[0].id, pinId: 'anode' },
                { componentId: comps[1].id, pinId: 'a1' },
            );
        });

        expect(renders).toBeGreaterThan(afterMount); // hubo re-render
        expect(lastWiresLen).toBe(1);                // y vio el cable

        await act(async () => root.unmount());
    });
});
