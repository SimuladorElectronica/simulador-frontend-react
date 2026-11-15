import { useSidebarTab } from './hooks/useSidebarTab';
import { sidebarStore } from '../stores/sidebarStore';
import type { SidebarTab } from '../stores/sidebarStore';
import { ProgramEditor } from './ProgramEditor';
import { Palette } from './Palette';

export type { SidebarTab };

interface SidebarProps {
    /** Doble clic en un componente de la paleta: el canvas lo coloca en el centro */
    onAddComponent: (type: string) => void;
}

interface TabButtonProps {
    id: SidebarTab;
    label: string;
    active: boolean;
    onSelect: (id: SidebarTab) => void;
}

function TabButton({ id, label, active, onSelect }: TabButtonProps) {
    return (
        <button
            type="button"
            role="tab"
            id={`sidebar-tab-${id}`}
            aria-selected={active}
            aria-controls={`sidebar-panel-${id}`}
            onClick={() => onSelect(id)}
            style={{
                flex: 1,
                padding: '9px 10px',
                border: 'none',
                borderBottom: active ? '2px solid #1565c0' : '2px solid transparent',
                background: active ? '#ffffff' : '#eceff1',
                color: active ? '#1565c0' : '#546e7a',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );
}

/**
 * Columna izquierda con dos pestañas: editor de código y paleta de
 * componentes. El selector queda arriba y la pestaña activa ocupa todo
 * el espacio restante de la columna.
 *
 * Ambos paneles se mantienen montados (solo se oculta uno con
 * `display: none`) para no perder el sketch ni el estado del editor al
 * cambiar de pestaña.
 */
export function Sidebar({ onAddComponent }: SidebarProps) {
    // La pestaña vive en un store: el canvas puede forzar "Código" al
    // seleccionar un ESP32 desde su handler de selección.
    const tab = useSidebarTab();
    const setTab = (next: SidebarTab) => sidebarStore.setTab(next);

    return (
        <aside
            style={{
                width: 300,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                background: '#ffffff',
                borderRight: '1px solid #cfd8dc',
            }}
        >
            <div
                role="tablist"
                aria-label="Editor de código y componentes"
                style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #cfd8dc' }}
            >
                <TabButton id="code" label="Código" active={tab === 'code'} onSelect={setTab} />
                <TabButton
                    id="components"
                    label="Componentes"
                    active={tab === 'components'}
                    onSelect={setTab}
                />
            </div>

            <div
                role="tabpanel"
                id="sidebar-panel-code"
                aria-labelledby="sidebar-tab-code"
                style={{
                    display: tab === 'code' ? 'flex' : 'none',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                }}
            >
                <ProgramEditor />
            </div>

            <div
                role="tabpanel"
                id="sidebar-panel-components"
                aria-labelledby="sidebar-tab-components"
                style={{
                    display: tab === 'components' ? 'flex' : 'none',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                }}
            >
                <Palette onAdd={onAddComponent} />
            </div>
        </aside>
    );
}
