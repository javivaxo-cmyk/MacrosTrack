# MacrosTrack - PWA de Seguimiento de Macros y Nutrición

**MacrosTrack** es una Progressive Web App (PWA) moderna, autocontenida, ultra ligera y diseñada específicamente con enfoque *mobile-first* (optimizada para smartphones) y adaptación completa a pantallas *landscape* y escritorio.

![MacrosTrack Icon](./icons/icon.svg)

---

## 🚀 Características Principales

1. **Gestión Multiusuario Flexible**:
   - Creación y edición ilimitada de perfiles de usuario.
   - Datos biométricos: Sexo, Edad, Altura, Peso actual y Peso meta.
   - Calculadora inteligente de TDEE y macronutrientes basada en la fórmula *Mifflin-St Jeor* según el objetivo (Pérdida de grasa / Déficit, Mantenimiento, Ganancia muscular / Superávit).
   - Ajuste manual fino de calorías, proteínas, carbohidratos, grasas, fibra y meta de hidratación en mililitros.
   - Cambio instantáneo de usuario activo con 1 toque desde la cabecera.

2. **Múltiples Formas de Medición**:
   - Soporte para:
     - Gramos (`g`)
     - Kilogramos (`kg`)
     - Onzas (`oz`)
     - Libras (`lb`)
     - Taza métrica (`cup` ~240g)
     - 1/2 Taza (`half_cup` ~120g)
     - Cucharada (`tbsp` ~15g)
     - Cucharadita (`tsp` ~5g)
     - Mililitros (`ml`)
     - Piezas / Porciones (`piece` con peso configurable)
   - Conversión automática y precisa contra la base de datos nutricional de 100g.
   - Cálculo en vivo de calorías y macros en tiempo real conforme se escribe la cantidad.

3. **Búsqueda Instantánea en Base de Datos de Alimentos**:
   - Integración nativa con la base de datos BAM con más de **2,048 alimentos**.
   - Motor de búsqueda fuzzy sin acentos, mayúsculas ni caracteres especiales.
   - Filtros rápidos por categorías: Carnes, Pescados, Huevos, Lácteos, Cereales, Frutas, Verduras, Grasas.

4. **Alimentos Personalizados**:
   - Crea cualquier alimento o producto que no se encuentre en la BD oficial.
   - Especifica calorías, proteínas, carbos, grasas, fibra y porción de referencia.
   - Opción para compartir el alimento personalizado con todos los usuarios de la app.

5. **Vistas Integradas**:
   - **Vista de Seguimiento (Diario)**: Navegación de fechas (Hoy, Ayer, selector), anillo circular SVG de calorías consumidas vs meta vs restantes, barras de progreso de macros, mini-tracker de hidratación con botones rápidos (+250ml, +500ml), registro de peso del día y desglose por comidas (Desayuno, Comida/Almuerzo, Cena, Snacks).
   - **Vista Compartida (Comunidad y Comparativa)**: Comparación sin restricciones entre todos los perfiles de la app, podio de líderes (oro, plata, bronce), racha activa de días consecutivos, porcentaje de adherencia a calorías y proteínas, y gráfico de barras comparativo.
   - **Vista de Recetas y Platillos**: Creación de platillos propios con múltiples ingredientes de la BD o personalizados, cálculo automático de macros totales y por porción, opción de compartir recetas entre usuarios, y botón de *"Registrar en mi Diario"* en 1 clic.
   - **Vista de Resumen y Métricas**: Historial y gráfica SVG interactiva de la evolución del peso en el tiempo, racha activa, promedio calórico semanal, tasa de adherencia y gráfico de distribución de energía (% Proteína, % Carbos, % Grasas).
   - **Vista de Perfiles y Respaldo**: Administrador de usuarios, exportación de respaldo completo en formato JSON e importación para portabilidad total entre dispositivos.

6. **PWA Offline y Autocontenida**:
   - Service Worker (`sw.js`) con estrategia de caché offline.
   - Web App Manifest (`manifest.webmanifest`) instalable en iOS, Android y Windows/Mac/Linux.
   - Sin dependencias de frameworks externos pesados: 100% JavaScript moderno (ES Modules), CSS nativo y gráficos SVG ultrarrápidos.

---

## 🛠️ Cómo Ejecutar Localmente

### Opción 1: Con Node.js (Servidor incluido)
```bash
# Iniciar el servidor local
npm start
# O directamente:
node server.js
```
Abre en tu navegador: `http://localhost:3000`

### Opción 2: Con Python
```bash
python -m http.server 3000
```
Abre en tu navegador: `http://localhost:3000`

### Opción 3: Cualquier servidor estático (o GitHub Pages)
La app es 100% estática y puede desplegarse directamente en GitHub Pages, Vercel, Netlify o cualquier hosting sin configuración adicional.

---

## 📱 Instalación como App en tu Teléfono

1. Conecta tu teléfono a la misma red Wi-Fi que tu computadora o despliega el repositorio en GitHub Pages.
2. Abre la URL en Chrome (Android) o Safari (iOS).
3. **Android**: Toca en los tres puntos del menú del navegador y selecciona **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
4. **iOS / Safari**: Toca el botón de Compartir y selecciona **"Agregar al inicio"** (Add to Home Screen).

---

## 📂 Estructura del Proyecto

```
├── index.html                   # Entrada principal de la PWA
├── manifest.webmanifest         # Manifiesto PWA para instalación
├── sw.js                        # Service Worker para funcionamiento offline
├── server.js                    # Servidor HTTP ligero sin dependencias
├── package.json                 # Scripts de inicio
├── css/
│   ├── main.css                 # Variables, tema Dark Glass y diseño responsivo
│   ├── components.css           # Botones, modales, bottom sheets, form controls
│   └── views.css                # Estilos de cada una de las 5 vistas
├── js/
│   ├── app.js                   # Orquestador principal y enrutador
│   ├── db.js                    # Persistencia IndexedDB, respaldo JSON y datos demo
│   ├── food-service.js          # Motor de búsqueda y 2048 alimentos BAM
│   ├── units.js                 # Sistema de conversión de unidades y macros
│   ├── components/
│   │   ├── modal.js             # Bottom sheet con animaciones fluidas
│   │   ├── charts.js            # Gráficos interactivos SVG (anillos, líneas, barras)
│   │   └── toast.js             # Notificaciones toast
│   └── views/
│       ├── diary-view.js        # Vista de diario y consumo diario
│       ├── shared-view.js       # Vista comparativa comunitaria
│       ├── recipes-view.js      # Vista de recetas y platillos
│       ├── metrics-view.js      # Vista de métricas, evolución y peso
│       └── profile-view.js      # Vista de perfiles y cálculo TDEE
├── icons/                       # Iconos y logotipos de la PWA
│   ├── icon.svg
│   ├── favicon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── bam_foods_json/              # Base de datos nutricional de alimentos
    ├── bam_foods.min.json
    └── bam_foods.json
```