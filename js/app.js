/**
 * ECOS DE SOPOCACHI - MAIN APPLICATION CONTROLLER
 * Orquestador central de estado, geolocalización, mapa Leaflet,
 * visor de Realidad Aumentada, captura fotográfica y álbum.
 */

import { FIXED_TARGETS, INITIAL_SPAWN_TEMPLATE } from "./targets.js";
import {
  getDistanceMeters,
  getBearing,
  getRelativeAngle,
  generateInitialSpawn
} from "./geo.js";
import {
  initDB,
  saveCapture,
  getAllCaptures,
  getCapture,
  saveGameState,
  getGameState,
  clearAllGameData
} from "./db.js";
import {
  initAudio,
  playCharacterArpeggio,
  playLockOnSound,
  playRadarPing,
  playShutterSound,
  playCaptureVictory,
  playFinalCelebration,
  toggleMute,
  getMuteState
} from "./audio.js";
import { ARSceneManager } from "./three-scene.js";
import { triggerConfetti } from "./confetti.js";

class SopocachiApp {
  constructor() {
    // Estado del usuario y GPS
    this.userLat = null;
    this.userLng = null;
    this.userHeading = 0;
    this.isGPSActive = false;
    this.watchId = null;
    this.isSimulated = false;

    // Estado de los objetivos
    this.targets = [];
    this.initialSpawn = null;
    this.unlockedRoutes = false;
    this.capturesMap = new Map(); // id -> captureData
    this.activeTarget = null;

    // Módulos
    this.map = null;
    this.userMarker = null;
    this.targetMarkers = new Map();
    this.arManager = null;
    this.cameraStream = null;

    // Interfaz
    this.currentTab = "map"; // 'map', 'ar', 'album'
    this.lastArpeggioTime = 0;
    this.radarPingInterval = null;

    // Referencias al DOM
    this.dom = {};
  }

  async init() {
    this.cacheDom();
    this.bindEvents();

    // Inicializar base de datos local
    await initDB();
    await this.loadStoredState();
  }

  cacheDom() {
    this.dom = {
      // Pantalla de inicio
      splashScreen: document.getElementById("splash-screen"),
      btnStartAdventure: document.getElementById("btn-start-adventure"),

      // HUD Principal y Navegación
      mainNav: document.getElementById("main-nav"),
      navMapBtn: document.getElementById("nav-map"),
      navArBtn: document.getElementById("nav-ar"),
      navAlbumBtn: document.getElementById("nav-album"),
      albumBadge: document.getElementById("album-badge"),
      btnMute: document.getElementById("btn-mute"),

      // Vistas
      viewMap: document.getElementById("view-map"),
      viewAr: document.getElementById("view-ar"),
      viewAlbum: document.getElementById("view-album"),

      // Controles del Mapa
      mapElement: document.getElementById("map"),
      radarHud: document.getElementById("radar-hud"),
      radarDistance: document.getElementById("radar-distance"),
      radarTargetName: document.getElementById("radar-target-name"),
      radarClue: document.getElementById("radar-clue"),
      radarCompassNeedle: document.getElementById("radar-compass-needle"),
      btnEnterArFromMap: document.getElementById("btn-enter-ar-from-map"),

      // Visor AR
      cameraVideo: document.getElementById("camera-video"),
      arCanvas: document.getElementById("ar-canvas"),
      arReticle: document.getElementById("ar-reticle"),
      arGuideLeft: document.getElementById("ar-guide-left"),
      arGuideRight: document.getElementById("ar-guide-right"),
      arTargetLabel: document.getElementById("ar-target-label"),
      arDistanceLabel: document.getElementById("ar-distance-label"),
      arLockStatus: document.getElementById("ar-lock-status"),
      btnCapturePhoto: document.getElementById("btn-capture-photo"),
      btnExitAr: document.getElementById("btn-exit-ar"),
      cameraFlash: document.getElementById("camera-flash"),

      // Álbum
      albumGrid: document.getElementById("album-grid"),
      albumCounter: document.getElementById("album-counter"),
      albumProgressBar: document.getElementById("album-progress-bar"),

      // Modales y Notificaciones
      notificationToast: document.getElementById("notification-toast"),
      toastTitle: document.getElementById("toast-title"),
      toastMessage: document.getElementById("toast-message"),

      photoModal: document.getElementById("photo-modal"),
      modalPhotoImg: document.getElementById("modal-photo-img"),
      modalPhotoTitle: document.getElementById("modal-photo-title"),
      modalPhotoLocation: document.getElementById("modal-photo-location"),
      modalPhotoDate: document.getElementById("modal-photo-date"),
      modalPhotoDownload: document.getElementById("modal-photo-download"),
      modalPhotoClose: document.getElementById("modal-photo-close"),

      // Modal de Victoria / Captura
      captureSuccessModal: document.getElementById("capture-success-modal"),
      captureSuccessName: document.getElementById("capture-success-name"),
      captureSuccessImg: document.getElementById("capture-success-img"),
      captureSuccessMsg: document.getElementById("capture-success-msg"),
      btnContinueHunting: document.getElementById("btn-continue-hunting"),
      btnViewInAlbum: document.getElementById("btn-view-in-album"),

      // Pantalla de Logro Final
      achievementModal: document.getElementById("achievement-modal"),
      confettiCanvas: document.getElementById("confetti-canvas"),
      btnCloseAchievement: document.getElementById("btn-close-achievement"),

      // Drawer de Simulación / Debug
      debugToggleBtn: document.getElementById("debug-toggle-btn"),
      debugDrawer: document.getElementById("debug-drawer"),
      debugCloseBtn: document.getElementById("debug-close-btn"),
      debugResetBtn: document.getElementById("debug-reset-btn"),
      debugTeleportButtons: document.querySelectorAll("[data-teleport]")
    };
  }

  bindEvents() {
    // 1. Iniciar aventura y pedir permisos
    this.dom.btnStartAdventure.addEventListener("click", () => this.handleStartAdventure());

    // 2. Navegación por pestañas
    this.dom.navMapBtn.addEventListener("click", () => this.switchTab("map"));
    this.dom.navArBtn.addEventListener("click", () => this.switchTab("ar"));
    this.dom.navAlbumBtn.addEventListener("click", () => this.switchTab("album"));

    // 3. Botones de acción directa
    this.dom.btnEnterArFromMap.addEventListener("click", () => this.switchTab("ar"));
    this.dom.btnExitAr.addEventListener("click", () => this.switchTab("map"));
    this.dom.btnCapturePhoto.addEventListener("click", () => this.handleCapturePhoto());

    // 4. Sonido
    this.dom.btnMute.addEventListener("click", () => {
      const muted = toggleMute();
      this.dom.btnMute.textContent = muted ? "🔇" : "🔊";
      this.dom.btnMute.classList.toggle("muted", muted);
    });

    // 5. Cierre de modales
    this.dom.modalPhotoClose.addEventListener("click", () => {
      this.dom.photoModal.classList.add("hidden");
    });

    this.dom.btnContinueHunting.addEventListener("click", () => {
      this.dom.captureSuccessModal.classList.add("hidden");
      this.switchTab("map");
    });

    this.dom.btnViewInAlbum.addEventListener("click", () => {
      this.dom.captureSuccessModal.classList.add("hidden");
      this.switchTab("album");
    });

    this.dom.btnCloseAchievement.addEventListener("click", () => {
      this.dom.achievementModal.classList.add("hidden");
    });

    // 6. Drawer de Simulación / Pruebas
    this.dom.debugToggleBtn.addEventListener("click", () => {
      this.dom.debugDrawer.classList.toggle("open");
    });

    this.dom.debugCloseBtn.addEventListener("click", () => {
      this.dom.debugDrawer.classList.remove("open");
    });

    this.dom.debugTeleportButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const targetId = parseInt(e.currentTarget.getAttribute("data-teleport"), 10);
        this.teleportToTarget(targetId);
      });
    });

    this.dom.debugResetBtn.addEventListener("click", async () => {
      if (confirm("¿Estás seguro de reiniciar todo el progreso y las capturas?")) {
        await clearAllGameData();
        window.location.reload();
      }
    });

    // Escuchar orientación de brújula nativa para actualizar la aguja del radar
    window.addEventListener("deviceorientation", (e) => {
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        this.userHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        this.userHeading = (360 - e.alpha) % 360;
      }
      this.updateRadarHud();
    });
  }

  async loadStoredState() {
    // 1. Cargar capturas previas
    const storedCaptures = await getAllCaptures();
    storedCaptures.forEach((cap) => {
      this.capturesMap.set(cap.id, cap);
    });

    // 2. Comprobar si las rutas a los 4 puntos fijos ya están desbloqueadas
    this.unlockedRoutes = (await getGameState("unlockedRoutes")) || false;

    // 3. Comprobar spawn dinámico inicial del personaje 0
    this.initialSpawn = await getGameState("initialSpawn");

    // Construir lista de objetivos
    this.rebuildTargetList();
    this.updateAlbumUI();
  }

  rebuildTargetList() {
    this.targets = [];

    // Objetivo 0: Dinámico
    if (this.initialSpawn) {
      this.targets.push({
        ...INITIAL_SPAWN_TEMPLATE,
        lat: this.initialSpawn.lat,
        lng: this.initialSpawn.lng,
        spawnDistance: this.initialSpawn.spawnDistance
      });
    }

    // Objetivos 1..4: Fijos de Sopocachi
    this.targets.push(...FIXED_TARGETS);
  }

  /**
   * Pantalla inicial de bienvenida y solicitud unificada de permisos
   */
  async handleStartAdventure() {
    // 1. Desbloquear Web Audio API
    initAudio();

    // 2. Pedir permiso de giroscopio en iOS 13+
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const orientationPermission = await DeviceOrientationEvent.requestPermission();
        if (orientationPermission !== "granted") {
          console.warn("Permiso de orientación denegado por el usuario.");
        }
      } catch (err) {
        console.warn("Error al solicitar orientación en iOS:", err);
      }
    }

    // 3. Ocultar pantalla de bienvenida
    this.dom.splashScreen.classList.add("fade-out");
    setTimeout(() => {
      this.dom.splashScreen.classList.add("hidden");
    }, 600);

    // 4. Iniciar mapa Leaflet
    this.initMap();

    // 5. Iniciar cámara y escena Three.js
    await this.initARView();

    // 6. Iniciar seguimiento GPS
    this.startGeolocationTracking();
  }

  /**
   * Configura el mapa interactivo con Leaflet.js
   */
  initMap() {
    // Centro inicial por defecto: Plaza Abaroa, Sopocachi
    const defaultCenter = [-16.51460, -68.12640];

    this.map = L.map("map", {
      zoomControl: false,
      attributionControl: false
    }).setView(defaultCenter, 16);

    // Tiles oficiales y 100% libres de OpenStreetMap (sin API Key)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Marcador del Jugador con pulso azul
    const playerIcon = L.divIcon({
      className: "player-beacon-icon",
      html: `
        <div class="player-beacon">
          <div class="beacon-pulse"></div>
          <div class="beacon-dot"></div>
          <div class="beacon-arrow" id="beacon-arrow"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.userMarker = L.marker(defaultCenter, { icon: playerIcon, zIndexOffset: 1000 }).addTo(this.map);

    // Renderizar marcadores de objetivos
    this.renderMapMarkers();
  }

  renderMapMarkers() {
    // Limpiar marcadores antiguos
    this.targetMarkers.forEach((marker) => marker.remove());
    this.targetMarkers.clear();

    this.targets.forEach((target) => {
      const isCaught = this.capturesMap.has(target.id);
      const isLocked = target.id !== 0 && !this.unlockedRoutes && !isCaught;

      let iconHtml = "";
      if (isCaught) {
        iconHtml = `<div class="target-marker-badge caught" style="--accent: ${target.accentHex}">✓</div>`;
      } else if (isLocked) {
        iconHtml = `<div class="target-marker-badge locked">🔒</div>`;
      } else if (target.id === 0) {
        iconHtml = `<div class="target-marker-badge spawn-initial" style="--accent: ${target.accentHex}">✨</div>`;
      } else {
        iconHtml = `<div class="target-marker-badge active" style="--accent: ${target.accentHex}">${target.id}</div>`;
      }

      const customIcon = L.divIcon({
        className: "custom-target-marker",
        html: iconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = L.marker([target.lat, target.lng], { icon: customIcon }).addTo(this.map);

      // Popup informativo al pulsar el marcador
      marker.on("click", () => {
        this.selectActiveTarget(target);
      });

      this.targetMarkers.set(target.id, marker);
    });
  }

  /**
   * Inicializa la vista de cámara y la escena Three.js
   */
  async initARView() {
    try {
      this.arManager = new ARSceneManager(this.dom.arCanvas);

      // Callback cuando el objetivo se alinea con la retícula
      this.arManager.onLockChange = (isLocked) => {
        if (isLocked) {
          this.dom.arReticle.classList.add("locked");
          this.dom.arLockStatus.textContent = "¡OBJETIVO FIJADO!";
          this.dom.arLockStatus.classList.add("active");
          playLockOnSound();

          // Reproducir arpegio característico si ha pasado un intervalo
          const now = Date.now();
          if (now - this.lastArpeggioTime > 2500 && this.activeTarget) {
            playCharacterArpeggio(this.activeTarget.audioScale);
            this.lastArpeggioTime = now;
          }
        } else {
          this.dom.arReticle.classList.remove("locked");
          this.dom.arLockStatus.textContent = "ENFOCA AL OBJETIVO";
          this.dom.arLockStatus.classList.remove("active");
        }
      };

      // Iniciar cámara trasera en segundo plano
      await this.startCamera();
    } catch (err) {
      console.warn("Aviso al inicializar AR / Cámara:", err);
    }
  }

  async startCamera() {
    if (this.cameraStream) return;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.dom.cameraVideo.setAttribute("playsinline", "true");
      this.dom.cameraVideo.setAttribute("webkit-playsinline", "true");
      this.dom.cameraVideo.muted = true;
      this.dom.cameraVideo.srcObject = this.cameraStream;
      await this.dom.cameraVideo.play();
    } catch (err) {
      console.warn("No se pudo acceder a la cámara trasera. Probando cámara por defecto:", err);
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.dom.cameraVideo.setAttribute("playsinline", "true");
        this.dom.cameraVideo.setAttribute("webkit-playsinline", "true");
        this.dom.cameraVideo.muted = true;
        this.dom.cameraVideo.srcObject = this.cameraStream;
        await this.dom.cameraVideo.play();
      } catch (err2) {
        this.showToast("Cámara no disponible", "Puedes usar el modo simulación y visualización 3D sobre fondo neutro.", 5000);
      }
    }
  }

  /**
   * Seguimiento continuo de geolocalización en tiempo real
   */
  startGeolocationTracking() {
    if (!navigator.geolocation) {
      this.showToast("GPS no disponible", "Activando modo simulación para explorar Sopocachi.", 4000);
      this.enableSimulationMode();
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handleGPSUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.heading),
      (err) => {
        console.warn("Aviso de GPS:", err.message);
        if (!this.userLat) {
          // Si falla la primera lectura en interiores o desktop, sugerir simulación o fallback
          this.showToast("Buscando señal GPS...", "Asegúrate de tener ubicación habilitada o usa el panel de simulación.", 4000);
          this.enableSimulationMode();
        }
      },
      options
    );
  }

  /**
   * Procesa cada lectura GPS del usuario
   */
  async handleGPSUpdate(lat, lng, heading = null) {
    this.userLat = lat;
    this.userLng = lng;
    this.isGPSActive = true;

    if (heading !== null && !isNaN(heading)) {
      this.userHeading = heading;
    }

    // 1. LÓGICA DE SPAWN DINÁMICO INICIAL ("Guardián del Umbral")
    if (!this.initialSpawn) {
      await this.createInitialSpawn(lat, lng);
    }

    // 2. Actualizar marcador del jugador en Leaflet
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
      const arrow = document.getElementById("beacon-arrow");
      if (arrow) {
        arrow.style.transform = `rotate(${this.userHeading}deg)`;
      }
    }

    // Centrar mapa si es la primera lectura
    if (!this.hasCenteredMap) {
      this.map.setView([lat, lng], 17);
      this.hasCenteredMap = true;
    }

    // 3. Evaluar distancias a todos los personajes
    this.evaluateDistances();
  }

  /**
   * Genera el Guardián del Umbral a 10-18m de la posición física del usuario
   */
  async createInitialSpawn(userLat, userLng) {
    const spawnData = generateInitialSpawn(userLat, userLng);
    this.initialSpawn = spawnData;

    // Guardar en persistencia local
    await saveGameState("initialSpawn", spawnData);

    // Reconstruir lista de objetivos y marcadores
    this.rebuildTargetList();
    this.renderMapMarkers();

    // Seleccionar de inmediato al personaje 0 como objetivo activo
    const target0 = this.targets.find((t) => t.id === 0);
    if (target0) {
      this.selectActiveTarget(target0);
    }

    // Alerta visual de onboarding inmediato (< 60 segundos)
    this.showToast(
      "¡SER DETECTADO A POCOS PASOS!",
      `El Guardián del Umbral se ha manifestado a solo ${spawnData.spawnDistance} metros. ¡Entra en Modo AR para capturarlo!`,
      7000
    );
  }

  /**
   * Calcula distancias de Haversine y actualiza el estado de cada objetivo
   */
  evaluateDistances() {
    if (!this.userLat || !this.userLng) return;

    let closestTarget = null;
    let minDistance = Infinity;

    this.targets.forEach((target) => {
      const dist = getDistanceMeters(this.userLat, this.userLng, target.lat, target.lng);
      target.currentDistance = dist;
      target.bearing = getBearing(this.userLat, this.userLng, target.lat, target.lng);

      const isCaught = this.capturesMap.has(target.id);
      const isLocked = target.id !== 0 && !this.unlockedRoutes && !isCaught;

      // El más cercano no capturado y no bloqueado
      if (!isCaught && !isLocked && dist < minDistance) {
        minDistance = dist;
        closestTarget = target;
      }

      // Actualizar estilo visual del marcador en Leaflet
      this.updateMarkerVisual(target, dist, isCaught, isLocked);
    });

    // Si no hay un objetivo activo seleccionado manualmente, enfocar el más cercano
    if (closestTarget && (!this.activeTarget || this.capturesMap.has(this.activeTarget.id))) {
      this.selectActiveTarget(closestTarget);
    } else {
      this.updateRadarHud();
    }

    // Actualizar información espacial si estamos en modo AR
    if (this.currentTab === "ar" && this.activeTarget && this.arManager) {
      this.arManager.setTargetSpatialInfo(this.activeTarget.bearing, this.activeTarget.currentDistance);
    }
  }

  updateMarkerVisual(target, distance, isCaught, isLocked) {
    const marker = this.targetMarkers.get(target.id);
    if (!marker) return;

    const el = marker.getElement();
    if (!el) return;

    const badge = el.querySelector(".target-marker-badge");
    if (!badge) return;

    // Manejo de niebla o proximidad
    if (isCaught) {
      badge.className = "target-marker-badge caught";
    } else if (isLocked) {
      badge.className = "target-marker-badge locked";
    } else if (distance < 15) {
      badge.className = "target-marker-badge in-range pulse-ring";
    } else if (distance < 40) {
      badge.className = "target-marker-badge nearby";
    } else if (distance > 100) {
      badge.className = "target-marker-badge distant-fog";
    } else {
      badge.className = "target-marker-badge active";
    }
  }

  /**
   * Selecciona un objetivo activo para el radar y el visor AR
   */
  selectActiveTarget(target) {
    this.activeTarget = target;

    // Cargar modelo 3D en Three.js
    if (this.arManager) {
      this.arManager.loadCharacter(target);
      if (target.bearing !== undefined && target.currentDistance !== undefined) {
        this.arManager.setTargetSpatialInfo(target.bearing, target.currentDistance);
      }
    }

    this.updateRadarHud();
  }

  /**
   * Actualiza el HUD del radar (distancia, brújula, pistas, botón AR)
   */
  updateRadarHud() {
    if (!this.activeTarget) return;

    const dist = this.activeTarget.currentDistance !== undefined
      ? Math.round(this.activeTarget.currentDistance)
      : "--";

    this.dom.radarTargetName.textContent = this.activeTarget.name;
    this.dom.radarDistance.textContent = `${dist} m`;

    const isCaught = this.capturesMap.has(this.activeTarget.id);
    const isLocked = this.activeTarget.id !== 0 && !this.unlockedRoutes && !isCaught;

    // Mostrar u ocultar pista según distancia / estado
    if (isCaught) {
      this.dom.radarClue.textContent = `✓ Ya has capturado esta entidad en tu colección.`;
    } else if (isLocked) {
      this.dom.radarClue.textContent = `🔒 Bloqueado: Sintoniza primero al Guardián del Umbral para revelar la senda.`;
    } else if (dist > 100) {
      this.dom.radarClue.textContent = `Entidad oculta en la niebla (>100 m). Acércate a la zona para sintonizarla.`;
    } else {
      this.dom.radarClue.textContent = `💡 Pista: "${this.activeTarget.clue}"`;
    }

    // Orientar aguja de la brújula hacia el objetivo
    if (this.activeTarget.bearing !== undefined) {
      const relAngle = getRelativeAngle(this.activeTarget.bearing, this.userHeading);
      this.dom.radarCompassNeedle.style.transform = `rotate(${relAngle}deg)`;
    }

    // Habilitar botón AR si la distancia es menor a 15 metros o si ya está en rango
    const inRange = typeof dist === "number" && dist <= 15 && !isLocked;
    if (inRange) {
      this.dom.btnEnterArFromMap.classList.remove("hidden");
      this.dom.btnEnterArFromMap.classList.add("pulse-bounce");
    } else {
      this.dom.btnEnterArFromMap.classList.add("hidden");
      this.dom.btnEnterArFromMap.classList.remove("pulse-bounce");
    }

    // Actualizar etiquetas en HUD de AR
    if (this.currentTab === "ar") {
      this.dom.arTargetLabel.textContent = this.activeTarget.name;
      this.dom.arDistanceLabel.textContent = `${dist} m`;

      // Guiar hacia izquierda o derecha si el objeto está fuera de pantalla
      if (this.arManager) {
        const align = this.arManager.checkTargetAlignment();
        this.dom.arGuideLeft.classList.toggle("visible", align.guideDirection === "left");
        this.dom.arGuideRight.classList.toggle("visible", align.guideDirection === "right");
      }
    }
  }

  /**
   * Cambia de vista / pestaña
   */
  switchTab(tabName) {
    if (this.currentTab === tabName) return;
    this.currentTab = tabName;

    // Actualizar botones de navegación
    this.dom.navMapBtn.classList.toggle("active", tabName === "map");
    this.dom.navArBtn.classList.toggle("active", tabName === "ar");
    this.dom.navAlbumBtn.classList.toggle("active", tabName === "album");

    // Ocultar todas las vistas
    this.dom.viewMap.classList.add("hidden");
    this.dom.viewAr.classList.add("hidden");
    this.dom.viewAlbum.classList.add("hidden");

    if (tabName === "map") {
      this.dom.viewMap.classList.remove("hidden");
      if (this.arManager) this.arManager.stop();
      if (this.map) {
        setTimeout(() => this.map.invalidateSize(), 200);
      }
    } else if (tabName === "ar") {
      this.dom.viewAr.classList.remove("hidden");
      if (this.arManager) {
        this.arManager.onResize();
        this.arManager.start();
        if (this.activeTarget) {
          this.arManager.loadCharacter(this.activeTarget);
        }
      }
      this.updateRadarHud();
    } else if (tabName === "album") {
      this.dom.viewAlbum.classList.remove("hidden");
      if (this.arManager) this.arManager.stop();
      this.renderAlbumGrid();
    }
  }

  /**
   * Captura fotográfica combinada: <video> de cámara + <canvas> Three.js + Watermark AR
   */
  async handleCapturePhoto() {
    if (!this.activeTarget) return;

    // 1. Efecto sonoro de obturador y destello blanco
    playShutterSound();
    this.dom.cameraFlash.classList.add("flash-active");
    setTimeout(() => {
      this.dom.cameraFlash.classList.remove("flash-active");
    }, 280);

    // Vibración háptica en móviles si está soportada
    if ("vibrate" in navigator) {
      navigator.vibrate([80, 40, 80]);
    }

    // 2. Crear canvas de composición offscreen
    const offCanvas = document.createElement("canvas");
    const video = this.dom.cameraVideo;
    const arCanvas = this.dom.arCanvas;

    const width = video.videoWidth || arCanvas.width || 1280;
    const height = video.videoHeight || arCanvas.height || 720;
    offCanvas.width = width;
    offCanvas.height = height;

    const ctx = offCanvas.getContext("2d");

    // 3. Dibujar fotograma de la cámara real
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height);
    } else {
      // Fondo cósmico si no hay stream de video activo
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 4. Dibujar canvas de Three.js (entidad 3D con canal alfa)
    ctx.drawImage(arCanvas, 0, 0, width, height);

    // 5. Dibujar marca de agua y HUD estilizado de expedición
    this.drawPhotoWatermark(ctx, width, height, this.activeTarget);

    // 6. Generar imagen JPEG
    const photoDataUrl = offCanvas.toDataURL("image/jpeg", 0.92);

    // 7. Persistir en IndexedDB
    const captureData = {
      id: this.activeTarget.id,
      name: this.activeTarget.name,
      locationName: this.activeTarget.locationName,
      timestamp: new Date().toISOString(),
      photoDataUrl: photoDataUrl,
      lat: this.activeTarget.lat,
      lng: this.activeTarget.lng
    };

    await saveCapture(captureData);
    this.capturesMap.set(this.activeTarget.id, captureData);

    // 8. Efectos de victoria y desbloqueo
    playCaptureVictory();

    // Si se capturó al Guardián del Umbral (ID 0), desbloquear rutas a los 4 puntos fijos
    if (this.activeTarget.id === 0 && !this.unlockedRoutes) {
      this.unlockedRoutes = true;
      await saveGameState("unlockedRoutes", true);
      this.renderMapMarkers();
    }

    // Actualizar marcadores y álbum
    this.renderMapMarkers();
    this.updateAlbumUI();

    // 9. Mostrar modal de captura exitosa
    this.showCaptureSuccessModal(captureData);

    // 10. Comprobar si se completaron los 5 personajes
    if (this.capturesMap.size >= 5) {
      setTimeout(() => {
        this.triggerFinalAchievement();
      }, 1800);
    }
  }

  drawPhotoWatermark(ctx, w, h, target) {
    ctx.save();

    // Marco exterior con esquinas cibernéticas
    ctx.strokeStyle = target.accentHex || "#06b6d4";
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Franja inferior traslúcida
    ctx.fillStyle = "rgba(10, 15, 29, 0.75)";
    ctx.fillRect(16, h - 90, w - 32, 74);

    // Texto de ubicación y nombre
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(target.name.toUpperCase(), 36, h - 52);

    ctx.fillStyle = target.accentHex || "#06b6d4";
    ctx.font = "16px sans-serif";
    const dateStr = new Date().toLocaleString("es-BO");
    ctx.fillText(`📍 ${target.locationName} | ⏰ ${dateStr}`, 36, h - 28);

    // Insignia Ecos de Sopocachi
    ctx.textAlign = "right";
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("ECOS DE SOPOCACHI", w - 36, h - 52);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px monospace";
    ctx.fillText("AR GEO-HUNT CERTIFIED", w - 36, h - 28);

    ctx.restore();
  }

  showCaptureSuccessModal(captureData) {
    this.dom.captureSuccessName.textContent = captureData.name;
    this.dom.captureSuccessImg.src = captureData.photoDataUrl;

    if (captureData.id === 0) {
      this.dom.captureSuccessMsg.textContent =
        "¡Has capturado al Guardián del Umbral! La niebla sobre Sopocachi se ha disipado: ahora puedes rastrear los 4 santuarios de la ruta Plaza Abaroa a El Montículo.";
    } else {
      this.dom.captureSuccessMsg.textContent =
        `¡Entidad registrada con éxito en tu códice local! Llevas ${this.capturesMap.size} de 5 personajes.`;
    }

    this.dom.captureSuccessModal.classList.remove("hidden");
  }

  triggerFinalAchievement() {
    this.dom.achievementModal.classList.remove("hidden");
    playFinalCelebration();
    triggerConfetti(this.dom.confettiCanvas);
  }

  /**
   * Actualiza el contador del álbum en el HUD y barra de navegación
   */
  updateAlbumUI() {
    const total = 5;
    const caught = this.capturesMap.size;
    const percentage = Math.round((caught / total) * 100);

    this.dom.albumBadge.textContent = caught;
    this.dom.albumCounter.textContent = `${caught} / ${total} Capturados`;
    this.dom.albumProgressBar.style.width = `${percentage}%`;
  }

  /**
   * Renderiza las 5 tarjetas del álbum
   */
  renderAlbumGrid() {
    this.dom.albumGrid.innerHTML = "";

    const allTargets = [
      this.initialSpawn
        ? { ...INITIAL_SPAWN_TEMPLATE, ...this.initialSpawn }
        : { ...INITIAL_SPAWN_TEMPLATE, lat: -16.513, lng: -68.127 },
      ...FIXED_TARGETS
    ];

    allTargets.forEach((target) => {
      const capture = this.capturesMap.get(target.id);
      const isCaught = !!capture;
      const isLocked = target.id !== 0 && !this.unlockedRoutes && !isCaught;

      const card = document.createElement("div");
      card.className = `album-card ${isCaught ? "caught" : isLocked ? "locked" : "active"}`;

      if (isCaught) {
        const formattedDate = new Date(capture.timestamp).toLocaleString("es-BO", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        });

        card.innerHTML = `
          <div class="card-thumb-wrapper">
            <img src="${capture.photoDataUrl}" alt="${target.name}" class="card-thumb" />
            <span class="card-badge-caught">CAPTURADO</span>
          </div>
          <div class="card-info">
            <h4 class="card-name">${target.name}</h4>
            <p class="card-location">📍 ${target.locationName}</p>
            <p class="card-date">🕒 ${formattedDate}</p>
            <button class="btn-card-view" data-view-id="${target.id}">🔍 Ver / Descargar</button>
          </div>
        `;

        card.querySelector(".btn-card-view").addEventListener("click", () => {
          this.openPhotoModal(capture);
        });
      } else {
        card.innerHTML = `
          <div class="card-thumb-wrapper silhouette">
            <div class="card-silhouette-icon">${isLocked ? "🔒" : "❓"}</div>
          </div>
          <div class="card-info">
            <h4 class="card-name">${isLocked ? "Entidad Bloqueada" : target.name}</h4>
            <p class="card-location">📍 ${isLocked ? "Niebla de Sopocachi" : target.locationName}</p>
            <p class="card-clue">${isLocked ? "Sintoniza al Guardián para desbloquear." : `"${target.clue}"`}</p>
          </div>
        `;
      }

      this.dom.albumGrid.appendChild(card);
    });
  }

  openPhotoModal(capture) {
    this.dom.modalPhotoImg.src = capture.photoDataUrl;
    this.dom.modalPhotoTitle.textContent = capture.name;
    this.dom.modalPhotoLocation.textContent = `📍 ${capture.locationName}`;
    this.dom.modalPhotoDate.textContent = `Fecha: ${new Date(capture.timestamp).toLocaleString("es-BO")}`;

    this.dom.modalPhotoDownload.href = capture.photoDataUrl;
    this.dom.modalPhotoDownload.download = `Sopocachi_${capture.name.replace(/\s+/g, "_")}.jpg`;

    this.dom.photoModal.classList.remove("hidden");
  }

  showToast(title, message, duration = 4000) {
    this.dom.toastTitle.textContent = title;
    this.dom.toastMessage.textContent = message;
    this.dom.notificationToast.classList.remove("hidden");
    this.dom.notificationToast.classList.add("show");

    setTimeout(() => {
      this.dom.notificationToast.classList.remove("show");
      setTimeout(() => {
        this.dom.notificationToast.classList.add("hidden");
      }, 400);
    }, duration);
  }

  /**
   * MODO SIMULACIÓN / TELETRANSPORTE
   * Permite probar de inmediato todos los personajes desde cualquier navegador / PC
   */
  enableSimulationMode() {
    this.isSimulated = true;
    // Si no hay lectura previa, simular posición inicial en Plaza Abaroa
    const simLat = -16.51268;
    const simLng = -68.12788;
    this.handleGPSUpdate(simLat, simLng, 0);
  }

  teleportToTarget(targetId) {
    const target = this.targets.find((t) => t.id === targetId);
    if (!target) return;

    // Teletransportar a 6 metros del objetivo para entrar de lleno en rango (<15m)
    const offsetLat = target.lat + 0.00005;
    const offsetLng = target.lng + 0.00005;

    this.handleGPSUpdate(offsetLat, offsetLng, 0);
    this.selectActiveTarget(target);
    this.dom.debugDrawer.classList.remove("open");
    this.showToast("📍 Ubicación Simulada", `Te has desplazado a pasos de "${target.name}".`, 3500);
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", () => {
  const app = new SopocachiApp();
  app.init();
});
