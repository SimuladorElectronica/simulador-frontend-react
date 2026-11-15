import type Konva from 'konva';
import { Circle } from 'react-konva';
import type { ComponentPinManifest, PinReference } from '@types';
import { PIN_COLORS } from '../utils/pins';

interface ComponentPinProps {
    pin: ComponentPinManifest;
    componentId: string;
    isOrigin: boolean;
    isHover: boolean;
    onStartWiring: (ref: PinReference, evt: Konva.KonvaEventObject<MouseEvent>) => void;
    onPinHover: (ref: PinReference | null) => void;
}

/** Pin dibujado sobre el componente; el mousedown inicia el trazado de un cable. */
export function ComponentPin({
    pin,
    componentId,
    isOrigin,
    isHover,
    onStartWiring,
    onPinHover,
}: ComponentPinProps) {
    const ref: PinReference = { componentId, pinId: pin.id };
    return (
        <Circle
            x={pin.position.x}
            y={pin.position.y}
            radius={isOrigin || isHover ? 6 : 4}
            fill={isOrigin ? '#1565c0' : PIN_COLORS[pin.kind]}
            stroke={isHover ? '#2e7d32' : '#ffffff'}
            strokeWidth={isHover ? 3 : 1.5}
            onMouseDown={(e) => onStartWiring(ref, e)}
            onMouseEnter={() => onPinHover(ref)}
            onMouseLeave={() => onPinHover(null)}
        />
    );
}
