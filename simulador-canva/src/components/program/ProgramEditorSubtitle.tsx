import { subtitleStyle } from './programEditorStyles';

interface ProgramEditorSubtitleProps {
    hasMcu: boolean;
    mcuName: string;
    storedSource?: string;
}

/** Línea que indica el MCU objetivo y si ya tiene un sketch guardado. */
export function ProgramEditorSubtitle({ hasMcu, mcuName, storedSource }: ProgramEditorSubtitleProps) {
    if (!hasMcu) return <div style={subtitleStyle}>Sin MCU en el circuito</div>;

    return (
        <div style={subtitleStyle}>
            MCU seleccionado: <strong>{mcuName}</strong>
            {storedSource === undefined ? ' · sin programa guardado' : ''}
        </div>
    );
}
