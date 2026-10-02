import React from 'react';
import type { ComponentViewProps } from './componentViewProps'
import type { Pin, Vector2D } from '../../types/simulator';

// Lógica de simulación para el Web Worker
export interface SimulationContext {
  inputs: Record<string, number>; // Voltajes/corrientes en sus pines
  state: Record<string, any>;     // Estado actual
}

export interface SimulationStepResult {
  nextState: Record<string, any>;
  outputs: Record<string, number>;
}

// Descriptor global del componente
export interface ComponentDescriptor<TState = any> {
  type: string;
  label: string;
  defaultSize: { width: number; height: number };
  
  // Metadatos: Generador de pines por defecto para una nueva instancia
  createDefaultPins: (instanceId: string) => Pin[];
  
  // Estado inicial
  defaultState: TState;

  // 1. CAPA VISUAL (Utilizada por React / Konva en el Canvas)
  View: React.FC<ComponentViewProps<TState>>;

  // 2. CAPA DE SIMULACIÓN (Utilizada por el Web Worker a 100 Hz)
  stepSimulation: (ctx: SimulationContext) => SimulationStepResult;
}