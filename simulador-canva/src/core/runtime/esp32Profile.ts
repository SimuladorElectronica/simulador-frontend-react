import type { ComponentManifest, ComponentPinManifest } from '@types';

/**
 * Perfil eléctrico/físico del ESP32 (Arduino core).
 * La lista de pines y capacidades NO se hardcodea: se lee del manifiesto
 * `core/esp32@1` (fuente de verdad). Aquí solo van constantes del chip.
 */
export const ESP32_PROFILE = {
    platform: 'esp32@1',
    /** Tensión lógica de alimentación (V) */
    logicVoltage: 3.3,
    /** ADC de 12 bits */
    adcBits: 12,
    adcMax: 4095,
    /** DAC de 8 bits (pines 25/26) */
    dacBits: 8,
    dacMax: 255,
    /** PWM LEDC de 8 bits */
    pwmBits: 8,
    pwmMax: 255,
    /** Umbrales digitales (según manifiesto: inputLow/inputHigh del elemento gpio) */
    inputLow: 0.8,
    inputHigh: 2.0,
    /** Resistencia de salida del driver GPIO (~40 Ω) */
    outputResistance: 40,
    pullUpResistance: 45000,
    pullDownResistance: 45000,
} as const;

/** Constantes estilo Arduino */
export const ARDUINO = {
    LOW: 0,
    HIGH: 1,
    INPUT: 0,
    OUTPUT: 1,
    INPUT_PULLUP: 2,
    INPUT_PULLDOWN: 3,
} as const;

export function pinByGpio(manifest: ComponentManifest, gpio: number): ComponentPinManifest | undefined {
    return manifest.pins.find((p) => p.gpio?.number === gpio);
}

export function hasCapability(pin: ComponentPinManifest | undefined, cap: string): boolean {
    return !!pin?.gpio?.capabilities.includes(cap as never);
}
