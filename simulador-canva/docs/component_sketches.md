# Sketches y Guías de Conexión - Catálogo de 15 Componentes

## Resumen del Catálogo

El siguiente documento detalla los 15 componentes del catálogo con sus esquemas de conexión y comportamiento. Cada componente incluye:
- Identificador del componente
- Pines disponibles
- Conexiones típicas
- Comportamiento visual (si aplica)
- Observables relevantes

## 1. ESP32 (core/esp32@1)

**Pines:**
- `3v3` (VCC) - 3.3V
- `gnd1` / `gnd2` - Tierra
- `vin` - Entrada USB
- `en` - Enable

**Conexiones típicas:**
- Fuente de alimentación (5V) → `vin`
- Tierra → `gnd1` / `gnd2`
- Salida 3.3V → `3v3`

**Comportamiento:**
- `isPowered` = true si hay voltaje > 0.1V
- `voltage` = voltaje real en la fuente

## 2. Breadboard (core/breadboard@1)

**Pines:**
- Columnas A (1-30) → pines 1-30
- Columnas B (1-30) → pines 1-30
- Rows (1-20) → pines 1-20

**Conexiones típicas:**
- Conexión de componentes entre sí mediante cables
- Carga a la fuente de alimentación

## 3. Fuente DC (core/powerSupply@1)

**Pines:**
- `vplus` (VCC) - 5V
- `gnd` - Tierra

**Conexiones típicas:**
- `vplus` → fuente de 5V externa
- `gnd` → tierra común

## 4. Resistencia (core/resistor@1)

**Pines:**
- `a` (anodo) - entrada
- `b` (borde) - salida

**Parámetros:**
- `resistance` (Ω) - 1 a 100,000,000
- Valor por defecto: 220 Ω

**Comportamiento:**
- `resistance` controla la corriente según la Ley de Ohm
- `voltage` = resistencia × corriente

## 5. LED (core/led@1)

**Pines:**
- `anode` (A) - entrada
- `cathode` (C) - salida

**Parámetros:**
- `color` - color del LED (enum: #e74c3c, #ff9800, #f1c40f, #2ecc71, #3498db, #9b59b6, #ecf0f1)
- `brightness` - opacidad del halo (0-0.6)
- `burned` - estado quemado
- `on` - estado encendido

**Observables:**
- `brightness` - opacidad del halo de luz
- `burned` - flag de daño
- `on` - estado encendido

## 6. LDR (core/ldr@1)

**Pines:**
- `a` (anodo) - entrada
- `wiper` (wiper) - salida (posicion)

**Parámetros:**
- `resistance` (Ω) - 1 a 1,000,000
- `light` - posición del wiper (0-100%)
- `resistance` (Ω) - resistencia de la lámpara

**Observables:**
- `light` - nivel de iluminación (0-100%)
- `resistance` - resistencia medida

## 7. DHT11 (core/dht11@1)

**Pines:**
- `vcc` - VCC (3.3V)
- `data` - entrada de datos
- `gnd` - tierra

**Parámetros:**
- `temperature` - temperatura (°C)
- `humidity` - humedad (%) 

**Observables:**
- `temperature` - temperatura medida
- `humidity` - humedad medida

## 8. HC-SR04 (core/hcsr04@1)

**Pines:**
- `vcc` - VCC (5V)
- `trig` - disparo (trigger)
- `echo` - recepción (echo)
- `gnd` - tierra

**Parámetros:**
- `distance` - distancia medida (cm)

**Observables:**
- `distance` - distancia al objeto

## 9. LDR (core/ldr@1) - Segundo LDR

**Pines:**
- `a` (anodo) - entrada
- `wiper` (wiper) - salida (posicion)

**Parámetros:**
- `resistance` (Ω) - 1 a 1,000,000
- `light` - posición del wiper (0-100%)
- `resistance` (Ω) - resistencia de la lámpara

**Observables:**
- `light` - nivel de iluminación (0-100%)
- `resistance` - resistencia medida

## 10. Potenciómetro (core/potentiometer@1)

**Pines:**
- `a` (anodo) - entrada
- `b` (wiper) - salida (posición)

**Parámetros:**
- `position` - posición del wiper (0-1)
- `resistance` (Ω) - resistencia del potenciómetro (10000Ω por defecto)

**Observables:**
- `position` - posición del wiper (0-1)
- `resistance` - resistencia total

## 11. Pushbutton (core/pushbutton@1)

**Pines:**
- `a` (entrada) - entrada
- `b` (salida) - salida

**Parámetros:**
- `closed` - estado cerrado (press)

**Observables:**
- `closed` - estado del botón (true = presionado)

## 12. Relé (core/relay@1)

**Pines:**
- `coil+` - entrada de coil (alimentación)
- `coil-` - entrada de coil (alimentación)
- `com` - contacto común
- `no` - contacto no (NC)
- `nc` - contacto normal (NC)

**Parámetros:**
- `coil` - resistencia de la bobina (400Ω)
- `energized` - estado energizado (true = coil activado)

**Observables:**
- `energized` - estado del relé
- `on` - estado encendido

## 13. Buzzer (core/buzzer@1)

**Pines:**
- `vcc` - VCC (5V)
- `gnd` - tierra

**Parámetros:**
- `on` - estado del buzzer (true = sonido)

**Observables:**
- `on` - estado activo

## 14. LCD 16x2 (core/lcd16x2@1)

**Pines:**
- `vcc` - VCC (5V)
- `gnd` - tierra
- `sda` - datos línea 1
- `scl` - datos línea 2
- `backlight` - retroiluminación

**Parámetros:**
- `line1` - línea 1 de texto
- `line2` - línea 2 de texto
- `brightness` - opacidad del brillo

**Observables:**
- `line1` - texto de la línea 1
- `line2` - texto de la línea 2
- `brightness` - opacidad del brillo

## 15. OLED SSD1306 (core/oledSsd1306@1)

**Pines:**
- `vcc` - VCC (5V)
- `gnd` - tierra
- `sda` - datos línea 1
- `scl` - datos línea 2
- `i2c` - bus I2C

**Parámetros:**
- `line1` - línea 1 de texto
- `line2` - línea 2 de texto
- `brightness` - opacidad del brillo

**Observables:**
- `line1` - texto de la línea 1
- `line2` - texto de la línea 2
- `brightness` - opacidad del brillo

## Conexiones Típicas

### Circuito LED con Resistencia
```
VCC (5V) → Resistencia (220Ω) → LED (anode) → GND
```

### Circuito LDR con Resistencia en Serie
```
VCC → Resistencia (10000Ω) → LDR (wiper) → Resistencia (100Ω) → GND
```

### Circuito LDR con PWM (Luz)
```
VCC → Resistencia (10000Ω) → LDR (wiper) → Resistencia (100Ω) → GND
```

### Circuito DHT11
```
VCC → DHT11 (VCC)
GND → DHT11 (GND)
DHT11 (data) → Arduino pin (ej. D2)
```

### Circuito HC-SR04
```
VCC → HC-SR04 (VCC)
GND → HC-SR04 (GND)
Trig → Arduino pin (ej. D2)
Echo → Arduino pin (ej. D3)
```

### Circuito Relé
```
VCC → Relé (coil+)
GND → Relé (coil-)
COM → Arduino pin (ej. D5)
NC → Arduino pin (ej. D6)
```

### Circuito Buzzer
```
VCC → Buzzer (VCC)
GND → Buzzer (GND)
Arduino pin → Buzzer (in) (ej. D8)
```

### Circuito LCD 16x2
```
VCC → LCD (VCC)
GND → LCD (GND)
SDA → LCD (SDA)
SCL → LCD (SCL)
Backlight → LCD (backlight)
```

### Circuito OLED SSD1306
```
VCC → OLED (VCC)
GND → OLED (GND)
SDA → OLED (SDA)
SCL → OLED (SCL)
I2C → OLED (I2C)
```

### Circuito LED + LDR (Iluminación por Luz)
```
VCC → Resistencia (220Ω) → LED (anode)
LED (cathode) → LDR (wiper) → Resistencia (100Ω) → GND
LDR (wiper) → Arduino pin (ej. D2)
```

## Comportamiento por Componente

| Componente | Estado | Observables | Comportamiento |
|------------|--------|-------------|----------------|
| ESP32 | `isPowered`, `voltage` | - | Fuente de poder |
| Breadboard | - | - | Plataforma de conexión |
| Power Supply | `voltage` | - | Alimentación externa |
| Resistor | `resistance`, `voltage` | - | Limita corriente |
| LED | `brightness`, `on`, `burned` | - | Emite luz |
| LDR | `light`, `resistance` | - | Mide luz ambiental |
| DHT11 | `temperature`, `humidity` | - | Sensores ambientales |
| HC-SR04 | `distance` | - | Medir distancia |
| LDR | `light`, `resistance` | - | Mide iluminación |
| Potentiometer | `position`, `resistance` | - | Posición rotativa |
| Pushbutton | `closed` | - | Entrada de presión |
| Relay | `energized`, `on` | - | Conmutación de carga |
| Buzzer | `on` | - | Emite sonido |
| LCD 16x2 | `line1`, `line2`, `brightness` | - | Pantalla de texto |
| OLED SSD1306 | `line1`, `line2`, `brightness` | - | Pantalla de texto |

## Notas de Implementación

1. **Resistencias de seguridad**: Toda la corriente debe pasar por una resistencia en serie (≥1kΩ) para evitar sobrecalentamiento.

2. **PWM**: El relé y el LED pueden controlarse con PWM para dimming suave.

3. **LDR**: La resistencia de la lámpara debe ser ≥10kΩ para evitar cortocircuitos.

4. **DHT11**: Requiere un pull-up en el pin de datos (5kΩ).

5. **HC-SR04**: El pin Trig debe tener un pull-up interno (ya configurado).

6. **Relé**: La bobina de 400Ω requiere ~2A de corriente; usar un driver de relé si es necesario.

7. **OLED SSD1306**: Requiere I2C (SDA/SCL) y una fuente de 3.3V-5V.

8. **LCD 16x2**: Requiere I2C (SDA/SCL) y una fuente de 5V.

## Diagramas de Conexión

### 1. LED + Resistencia
```
    +5V ──[220Ω]───[LED]─── GND
```

### 2. LDR con Resistencia en Serie
```
    +5V ──[10kΩ]───[LDR]───[100Ω]─── GND
```

### 3. DHT11
```
    +5V ──[DHT11 VCC]───┬─── DHT11 (data) ── Arduino D2
                         └─── GND
```

### 4. HC-SR04
```
    +5V ──[HC-SR04 VCC]───┬─── Trig (Arduino D2)
                           └─── Echo (Arduino D3)
```

### 5. Relé
```
    +5V ──[Coil+]─── Relé (coil+)
    GND ──[Coil-]─── Relé (coil-)
    COM ── Arduino D5
    NC ── Arduino D6
```

### 6. Buzzer
```
    +5V ──[Buzzer VCC]─── GND
    Arduino D8 ── Buzzer (in)
```

### 7. LCD 16x2
```
    +5V ──[LCD VCC]─── GND
    Arduino D2 ── SDA
    Arduino D3 ── SCL
    Backlight ── GND
```

### 8. OLED SSD1306
```
    +5V ──[OLED VCC]─── GND
    Arduino D9 ── SDA
    Arduino D10 ── SCL
    I2C ── GND
```

### 9. Potenciómetro
```
    +5V ──[Resistencia 10k]─── LDR (anode)
    LDR (wiper) ── Arduino D2
    LDR (borde) ── GND
```

### 10. Pushbutton
```
    +5V ──[Pushbutton]─── Arduino D2
    Arduino D2 ── GND
```

## Instrucciones de Uso

1. **Conectar la fuente de 5V** a la fuente de la ESP32 y a la fuente de alimentación externa.
2. **Conectar la tierra** de todas las fuentes a los pines `gnd` de los componentes.
3. **Conectar los LEDs** con su resistencia en serie.
4. **Conectar los LDR** con una resistencia de 10kΩ en serie.
5. **Conectar los sensores** (DHT11, HC-SR04, OLED, LCD) a los pines designados.
6. **Conectar el relé** con su bobina a la fuente de 5V y sus contactos a pines Arduino.
7. **Conectar el buzzer** a la fuente de 5V y GND.
8. **Conectar el potenciómetro** con su anodo a 5V y su wiper a Arduino.

## Referencias

- `componentStates.ts` - Manejo de estados de los componentes
- `electricalSolver.ts` - Cálculo de voltajes y corrientes
- `circuitWorker.ts` - Lógica de simulación y tick
- `componentInspector.tsx` - Interfaz de inspección de componentes

## Archivos Generados

Los siguientes archivos han sido creados:
- `docs/component_sketches.md` - Guía completa de los 15 componentes
- `docs/wiring_diagrams.md` - Diagramas de conexión detallados
- `docs/component_behavior.md` - Comportamiento de cada componente

Estos archivos pueden ser utilizados como base para crear los sketches visuales y los circuitos de conexión en el canvas de simulación.