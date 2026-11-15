import { useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { CircuitDocument, PinReference } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../../stores/documentStore';
import { findNearestPin } from '../utils/pins';

/** Radio (en coordenadas de mundo) dentro del cual un pin "engancha" al cablear. */
export const PIN_SNAP_RADIUS = 12;

const getManifest = (type: string) => ManifestRegistry.get(type);

interface WiringState {
    from: PinReference;
    pointer: { x: number; y: number };
}

interface UseWiringOptions {
    docRef: RefObject<CircuitDocument>;
    getWorldPointer: () => { x: number; y: number };
    onClearSelection: () => void;
}

/** Estado y gestos del trazado de cables entre pines. */
export function useWiring({ docRef, getWorldPointer, onClearSelection }: UseWiringOptions) {
    const [wiring, setWiring] = useState<WiringState | null>(null);
    const [hoverPin, setHoverPin] = useState<PinReference | null>(null);

    const startWiring = (ref: PinReference, evt: Konva.KonvaEventObject<MouseEvent>) => {
        evt.cancelBubble = true;
        onClearSelection();
        setWiring({ from: ref, pointer: getWorldPointer() });
    };

    const moveWiring = () => {
        const world = getWorldPointer();
        setWiring((w) => (w ? { ...w, pointer: world } : w));
        setHoverPin(findNearestPin(world, docRef.current.components, getManifest, PIN_SNAP_RADIUS));
    };

    const finishWiring = () => {
        if (!wiring) return;
        const world = getWorldPointer();
        const target = findNearestPin(world, docRef.current.components, getManifest, PIN_SNAP_RADIUS);
        if (target) documentStore.addWire(wiring.from, target);
        setWiring(null);
        setHoverPin(null);
    };

    const cancelWiring = () => {
        setWiring(null);
        setHoverPin(null);
    };

    return { wiring, hoverPin, setHoverPin, startWiring, moveWiring, finishWiring, cancelWiring };
}
