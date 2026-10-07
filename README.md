# Perímetro del Proyecto: MVP Simulador ESP32

## Límites del Sistema

| Dentro del Sistema (In-Scope) | Fuera del Sistema (Out-of-Scope) |
| :--- | :--- |
| Simulación exclusiva de **ESP32 DevKit v1** (30 pines). | Otras placas (Arduino UNO, Raspberry Pi, STM32). |
| Soporte único para **C++ (Arduino Core)**. | Programación por bloques / Scratch o MicroPython. |
| Catálogo cerrado de **15 componentes esenciales**. | Componentes industriales avanzados o sensores fuera de lista. |
| Motor de simulación por **API Mocking** en Web Worker. | Emulación de registros Xtensa a bajo nivel (QEMU). |
| Motor eléctrico con disipación y caída de voltaje. | Simulación de componentes a nivel atómico o térmico continuo. |
| Gestor manual de **librerías C++ curadas**. | Compilación arbitraria de repositorios externos de GitHub. |
| Módulo Wi-Fi y Broker MQTT **simulado en pantalla**. | Conexión directa a hardware físico vía WebUSB o WebSerial. |
| Acceso anónimo e instantáneo mediante URL compartible. | Módulos de pago, pasarelas de cobro o suscripciones. |

---

## Alcance del Sistema

### Alcance Funcional
* **Canvas Interactivo (React):** Lienzo 2D *Drag & Drop* con cables dinámicos, protoboard y componentes con estados visuales activos (LEDs, servomotores, pantallas LCD/OLED).
* **Editor Monaco:** Edición en C++ con resaltado de sintaxis, autocompletado de funciones de Arduino Core y consola serial interactiva.
* **Simulador de Física Activa:** Cálculo en tiempo real de potencia disipada (animación de humo/ruptura) y detección de *Brownout Reset* por bajo voltaje.
* **Gestor de Librerías:** Modal UI para búsqueda e inclusión manual de directivas `#include`.
* **Dashboard Educativo (Vue):** Panel docente para gestionar plantillas de circuitos, tareas y guías prácticas.

### Alcance No Funcional
* **Rendimiento:** Ejecución fluida a **60 FPS** en la interfaz gráfica y bucle lógico desacoplado en un hilo secundario (*Web Worker*).
* **Portabilidad:** Compatibilidad total en navegadores modernos sin necesidad de plugins, apto para Chromebooks y computadoras escolares de bajos recursos.
* **Escalabilidad:** Arquitectura de componentes desacoplada mediante archivos JSON/JS para permitir futuras expansiones del catálogo.

---

## Objetivos Específicos, Métricas y Criterios de Aceptación

* **Velocidad de Carga de la App:** Cargar completamente en **menos de 2 segundos** sobre conexiones de 10 Mbps.
  * *Criterio de aceptación:* El peso total del *bundle* inicial de recursos estáticos no debe superar los 3 MB.
* **Fluidez del Lienzo:** Mantener una tasa de **60 FPS constantes** con el lienzo completo (15 componentes activos y cableados).
  * *Criterio de aceptación:* El uso de CPU en el cliente no debe exceder el 30% en un procesador de gama baja de netbook escolar.
* **Respuesta del Motor Físico:** Disparar efectos visuales por sobrepotencia ($P > P_{\\max}$) en **menos de 100 ms** tras la ocurrencia del evento en el código C++.
  * *Criterio de aceptación:* Una resistencia sin limitación debe destruirse y cortar el circuito visiblemente antes de los 1.5 segundos de ejecución sustained.
* **Fricción de Uso en Aula:** Permitir la generación y apertura de un proyecto compartido en **menos de 1 segundo**.
  * *Criterio de aceptación:* Cualquier usuario que reciba el enlace debe poder visualizar el circuito y ejecutar la simulación sin necesidad de iniciar sesión.
