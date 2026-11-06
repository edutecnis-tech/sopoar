# 🔮 Ecos de Sopocachi - AR Geo-Hunt

Una Web App interactiva estilo **"búsqueda de personajes en Realidad Aumentada / Geo-hunting"** (similar a Pokémon GO) optimizada para navegadores móviles modernos (Chrome / Safari en iOS y Android), sin frameworks pesados ni backend en servidor. Toda la persistencia de datos y capturas fotográficas se almacena localmente en el dispositivo mediante **IndexedDB**.

---

## 🚀 Características Principales

### 1. Sistema Dinámico de Spawn Inicial ("Guardián del Umbral")
- **Onboarding Inmediato (< 60 segundos):** Apenas se concede permiso de geolocalización, la aplicación genera dinámicamente el primer objetivo a **10–18 metros** en una dirección aleatoria relativa al usuario.
- **Alerta Inmediata:** El jugador recibe una notificación de *"¡Personaje detectado a pocos pasos!"*, permitiéndole probar el modo AR, la síntesis de audio y la captura fotográfica al instante.
- **Desbloqueo de la Ruta:** Al atrapar al Guardián del Umbral, se disipa la niebla del mapa y se desbloquean los 4 santuarios fijos del recorrido patrimonial de Sopocachi.

### 2. Recorrido Patrimonial en Sopocachi (La Paz - Bolivia)
Configurado con 5 objetivos en total:
1. **0. Guardián del Umbral (Spawn Dinámico Inmediato):** ~15 m del usuario. *Octaedro flotante con doble anillo toroidal giratorio y luz pulsante.*
2. **1. Centinela de Abaroa:** Plaza Abaroa (`-16.51268, -68.12788`). *Prisma hexagonal / cristal animado con rotación y escala variable.*
3. **2. Espíritu de Sánchez Lima:** Calle Sánchez Lima esq. Rosendo Gutiérrez (`-16.51460, -68.12640`). *TorusKnot entrelazado con material metálico iridiscente.*
4. **3. Caminante de la Escalinata:** Graderías hacia El Montículo (`-16.51655, -68.12450`). *Esfera wireframe con enjambre de 80 partículas orbitales.*
5. **4. Protector del Montículo:** Mirador de El Montículo / Capilla (`-16.51810, -68.12320`). *Dodecaedro dorado brillante con anillos planetarios y aura solar.*

---

## 🛠️ Modos y Vistas

### 🗺️ Modo Mapa & Radar
- Mapa 2D con **Leaflet.js** y cartografía de alto contraste.
- Baliza del jugador con pulso y orientación en tiempo real (`watchPosition`).
- **Niebla de distancia:**
  - Ocultos / atenuados si están a más de 100 m.
  - Revelados con pista y nombre entre 15 y 40 m.
  - Alerta visual *"¡Personaje en rango!"* y botón pulsante para entrar en modo AR a menos de 15 m.
- Mini brújula con aguja de rumbo relativo hacia el objetivo activo.

### 📷 Modo Cámara / Visor AR
- Transmisión en tiempo real de la cámara trasera (`facingMode: 'environment'`).
- Superposición de `<canvas>` WebGL transparente con **Three.js** (`alpha: true`).
- Proyección espacial 3D orientada mediante `DeviceOrientationEvent` (giroscopio/brújula) y fallback táctil/mouse para probar 360° en cualquier dispositivo.
- **Audio Sintetizado con Web Audio API:** Al enfocar al personaje en la mira se reproducen arpegios y acordes armónicos místicos generados proceduralmente en código (sin archivos MP3 externos).
- **Botón de Captura Fotográfica:** Combina el fotograma de la cámara real (`<video>`) y la entidad 3D (`<canvas>`), estampa una marca de agua estilo HUD cibernético con fecha, hora, coordenadas y ubicación, y guarda el archivo JPEG en **IndexedDB**.

### 📜 Modo Álbum / Registro de Colección
- Cuadrícula con las 5 tarjetas de los personajes.
- Estado interactivo: siluetas misteriosas / bloqueadas o fotos capturadas en AR con fecha y hora.
- Modal de vista previa en alta resolución con botón nativo de descarga (`<a download>`).
- Barra de progreso interactiva: `[ X / 5 Capturados ]`.

### 🏆 Pantalla de Logro Final ("Explorador de Sopocachi")
- Al completar los 5 personajes, se desata una lluvia festiva de confeti en canvas HTML5 puro y una fanfarria triunfal de victoria, otorgando la insignia dorada de *Explorador de Sopocachi*.

### 📍 Herramienta de Simulación / Pruebas
- Incluye un cajón de herramientas flotante (`📍 Simular GPS`) que permite teletransportarse a menos de 10 m de cualquiera de los personajes para probar el radar, el visor AR, el sonido y la captura desde cualquier computadora o habitación sin desplazarse físicamente.
- Botón de reinicio completo para probar el onboarding de cero.

---

## 📂 Estructura del Proyecto

```
juego personajes/
├── index.html          # Interfaz principal, HUDs, modales y carga de librerías
├── manifest.json       # Manifiesto PWA para instalación móvil
├── icon.svg            # Ícono vectorial de la aplicación
├── README.md           # Documentación técnica
├── css/
│   └── style.css       # Estilos Mobile-First, Sci-Fi Glassmorphism y animaciones
└── js/
    ├── targets.js      # Definición de personajes, coordenadas de Sopocachi y lore
    ├── geo.js          # Fórmulas de Haversine, rumbo (bearing) y spawn inicial
    ├── db.js           # Capa de persistencia local en IndexedDB
    ├── audio.js        # Motor de síntesis procedural con Web Audio API
    ├── three-scene.js  # Escena Three.js, geometrías 3D, luces y orientación AR
    ├── confetti.js     # Motor ligero de confeti para la celebración final
    └── app.js          # Orquestador central de la aplicación y flujo de eventos
```

---

## 💻 Cómo Ejecutar Localmente

Dado que la app hace uso de ES Modules y APIs del navegador como Cámara (`getUserMedia`) y Geolocalización, debe servirse a través de un servidor HTTP local (o HTTPS para dispositivos móviles):

### Opción 1: Con Node.js (npx serve)
```bash
npx serve -l 8080 .
```
Abre en tu navegador: `http://localhost:8080`

### Opción 2: Con Python
```bash
python -m http.server 8080
```
Abre en tu navegador: `http://localhost:8080`

### Opción 3: En el móvil (Cámara y Sensores reales)
Sube la carpeta a cualquier servicio estático gratuito con HTTPS (como **GitHub Pages**, **Vercel** o **Netlify**) o utiliza una herramienta como **ngrok** / **localtunnel** para exponer el puerto local a tu celular vía HTTPS.
