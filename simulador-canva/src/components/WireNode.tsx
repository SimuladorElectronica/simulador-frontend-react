import { Path } from 'react-konva';

interface WireNodeProps {
    /** Path bézier ya resuelto (prop primitiva: cambia de valor, no de referencia) */
    d: string;
    color: string;
    selected: boolean;
    onSelect: (id: string) => void;
    wireId: string;
}

/**
 * Cable entre dos pines. Es un componente puramente presentacional: el path se
 * calcula fuera (en `SimulatorCanvas`, con `resolveWirePath`) a partir del
 * snapshot y se le pasa como prop `d`.
 *
 * Esto es deliberado: si este componente leyera el store de forma imperativa,
 * React Compiler trataría ese import de módulo como valor no reactivo, concluiría
 * que sus props no cambian y omitiría el re-render, dejando los cables en el
 * aire al arrastrar un componente.
 *
 * Se dibuja en la capa superior, por encima de los componentes.
 */
export function WireNode({ d, color, selected, onSelect, wireId }: WireNodeProps) {
    return (
        <Path
            data={d}
            stroke={selected ? '#1565c0' : color}
            strokeWidth={selected ? 4 : 2.5}
            hitStrokeWidth={14}
            lineCap="round"
            lineJoin="round"
            onClick={() => onSelect(wireId)}
            onTap={() => onSelect(wireId)}
        />
    );
}

/** Línea guía temporal mientras se traza un cable desde un pin */
export function WireGuide({ d }: { d: string }) {
    return <Path data={d} stroke="#1565c0" strokeWidth={2} dash={[6, 4]} listening={false} />;
}
