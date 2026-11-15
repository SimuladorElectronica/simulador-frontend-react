/**
 * Tipos del catálogo curado de librerías C++.
 *
 * El catálogo es data pura: no importa Monaco ni el runtime. Lo consumen
 * el modal del editor, el autocompletado y el intérprete del Worker.
 *
 * Regla del MVP: no se descargan librerías de repositorios externos. Cada
 * entrada declara explícitamente qué headers instala y qué adaptador de
 * runtime la hace funcionar en el Web Worker.
 */

export type LibraryCategory =
    | 'Pantallas'
    | 'Conectividad'
    | 'Sensores'
    | 'Actuadores';

/** Adaptador del runtime que interpreta las llamadas de la librería. */
export type LibraryAdapterId = 'lcd-i2c' | 'wifi' | 'mqtt';

/** Tipo de retorno declarado para autocompletado y documentación. */
export type LibraryReturnType = 'void' | 'number' | 'string';

export interface LibraryMethodDefinition {
    /** Nombre del método tal como se escribe en C++ (p. ej. `print`). */
    name: string;
    /** Firma visible en el modal y en el autocompletado. */
    signature: string;
    /** Documentación breve para el usuario. */
    documentation: string;
    returns?: LibraryReturnType;
}

export interface LibraryDefinition {
    /** Identificador estable (también se usa en `ComponentManifest.libraries`). */
    id: string;
    displayName: string;
    description: string;
    category: LibraryCategory;
    /** Headers que inserta el modal, en orden. */
    headers: readonly string[];
    /**
     * Clase del objeto que declara el usuario, si la librería se usa con una
     * instancia global (p. ej. `LiquidCrystal_I2C lcd(...)`).
     */
    className?: string;
    /** `true` para APIs de namespace/objeto global como `WiFi.begin(...)`. */
    static?: boolean;
    /** Palabras clave adicionales para la búsqueda. */
    keywords: readonly string[];
    adapter: LibraryAdapterId;
    /** Manifiestos de componentes compatibles con el runtime. */
    compatibleManifests?: readonly string[];
    /** Firma del constructor (solo documentación). */
    constructorSignature?: string;
    /** Declaración sugerida para el autocompletado. */
    declarationTemplate?: string;
    methods: readonly LibraryMethodDefinition[];
    /** Ejemplo completo que el modal muestra y permite copiar. */
    example: string;
}
