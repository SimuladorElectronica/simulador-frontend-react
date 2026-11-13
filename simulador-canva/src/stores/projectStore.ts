import { useSyncExternalStore } from 'react';

/**
 * Referencia al proyecto guardado en el backend (perfil propio). Permite que
 * "Exportar" edite el MISMO proyecto en lugar de crear uno nuevo cada vez.
 * Se persiste en localStorage para que sobreviva a recargas; se limpia al
 * pulsar "Nuevo circuito" y al abrir un enlace compartido (/p/:slug) o una
 * plantilla (/plantillas/:slug), que siempre se tratan como COPIA.
 */

export interface CurrentProject {
  id: string;
  shareSlug: string;
}

const STORAGE_KEY = 'simulador.project';

function load(): CurrentProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrentProject>;
    if (typeof parsed.id === 'string' && typeof parsed.shareSlug === 'string') {
      return { id: parsed.id, shareSlug: parsed.shareSlug };
    }
    return null;
  } catch {
    return null;
  }
}

class ProjectStore {
  private current: CurrentProject | null = load();
  private listeners = new Set<() => void>();

  /** Referencia estable (useSyncExternalStore). */
  public get(): CurrentProject | null {
    return this.current;
  }

  public set(project: CurrentProject) {
    this.current = { ...project };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // sin storage: solo memoria
    }
    this.emit();
  }

  public clear() {
    if (this.current === null) return;
    this.current = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
    this.emit();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const projectStore = new ProjectStore();

export function useCurrentProject(): CurrentProject | null {
  return useSyncExternalStore(
    (onChange) => projectStore.subscribe(onChange),
    () => projectStore.get(),
  );
}
