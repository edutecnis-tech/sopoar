/**
 * ECOS DE SOPOCACHI - THREE.JS AR SCENE MANAGER
 * Renderizado de entidades 3D procedurales, proyección espacial por rumbo (bearing)
 * y giroscopio móvil con fallback táctil/mouse para desktop.
 */

export class ARSceneManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.currentEntityGroup = null;
    this.particleSwarm = null;
    this.lightPulse = null;

    // Orientación y Rumbo
    this.deviceHeading = 0; // Rumbo del móvil (0° = Norte)
    this.targetBearing = 0; // Rumbo hacia el objetivo (0° = Norte)
    this.targetDistance = 15; // Metros
    this.activeTargetId = null;

    // Controles de fallback (touch / ratón para desktop)
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    // Giroscopio móvil
    this.gyroAlpha = null;
    this.gyroBeta = null;
    this.gyroGamma = null;
    this.hasGyro = false;

    // Estado de fijación (Lock-on)
    this.isTargetLocked = false;
    this.onLockChange = null; // Callback cuando entra/sale del visor

    // Animación
    this.clock = new THREE.Clock();
    this.animationFrameId = null;
    this.isRunning = false;

    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    // 1. Escena transparente
    this.scene = new THREE.Scene();

    // 2. Cámara con FOV estándar de cámara móvil (60°)
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 0);

    // 3. Renderer con fondo transparente (alpha: true)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true // Vital para combinar captura fotográfica
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (THREE.SRGBColorSpace) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }

    // 4. Luces ambientales y direccionales místicas
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.8);
    dirLight2.position.set(-5, -5, -5);
    this.scene.add(dirLight2);

    // Luz puntual para pulsos místicos del personaje
    this.lightPulse = new THREE.PointLight(0x06b6d4, 2, 20);
    this.scene.add(this.lightPulse);

    // 5. Escuchar eventos de redimensión y controles táctiles
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener("resize", () => this.onResize());

    // Giroscopio de dispositivo móvil
    window.addEventListener("deviceorientation", (e) => this.handleDeviceOrientation(e), false);

    // Fallback táctil y ratón para explorar 360° en cualquier dispositivo
    const parent = this.canvas.parentElement || window;

    const onPointerDown = (clientX, clientY) => {
      this.isDragging = true;
      this.lastPointerX = clientX;
      this.lastPointerY = clientY;
    };

    const onPointerMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const deltaX = clientX - this.lastPointerX;
      const deltaY = clientY - this.lastPointerY;
      this.lastPointerX = clientX;
      this.lastPointerY = clientY;

      // Sensibilidad de rotación manual (en radianes)
      this.manualYaw -= deltaX * 0.005;
      this.manualPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.manualPitch - deltaY * 0.005));
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    parent.addEventListener("mousedown", (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onPointerUp);

    parent.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchend", onPointerUp);
  }

  handleDeviceOrientation(event) {
    if (event.alpha !== null && event.alpha !== undefined) {
      this.hasGyro = true;
      this.gyroAlpha = event.alpha; // Z axis (0..360)
      this.gyroBeta = event.beta;   // X axis (-180..180)
      this.gyroGamma = event.gamma; // Y axis (-90..90)

      // Brújula nativa en iOS (webkitCompassHeading es 0=Norte en sentido horario)
      if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        this.deviceHeading = event.webkitCompassHeading;
      } else {
        // En Android, alpha suele estar invertido respecto a brújula real
        this.deviceHeading = (360 - event.alpha) % 360;
      }
    }
  }

  onResize() {
    if (!this.canvas) return;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Carga el modelo 3D correspondiente al objetivo activo.
   */
  loadCharacter(targetConfig) {
    this.activeTargetId = targetConfig.id;

    // Limpiar modelo previo
    if (this.currentEntityGroup) {
      this.scene.remove(this.currentEntityGroup);
      this.currentEntityGroup = null;
    }
    this.particleSwarm = null;

    const group = new THREE.Group();

    // Actualizar color de la luz mística
    if (this.lightPulse) {
      this.lightPulse.color.setHex(targetConfig.primaryColor);
    }

    switch (targetConfig.meshType) {
      case "octahedronRings":
        this.buildOctahedronRings(group, targetConfig);
        break;
      case "crystal":
        this.buildCrystal(group, targetConfig);
        break;
      case "torusKnot":
        this.buildTorusKnot(group, targetConfig);
        break;
      case "particleSphere":
        this.buildParticleSphere(group, targetConfig);
        break;
      case "goldenDodecahedron":
        this.buildGoldenDodecahedron(group, targetConfig);
        break;
      default:
        this.buildOctahedronRings(group, targetConfig);
    }

    this.currentEntityGroup = group;
    this.scene.add(group);
    this.updateTargetSpatialPosition();
  }

  /**
   * Personaje 0: Guardián del Umbral
   * Octaedro flotante con doble anillo giratorio y pulsación de luz.
   */
  buildOctahedronRings(group, config) {
    // 1. Núcleo: Octaedro flotante
    const octGeo = new THREE.OctahedronGeometry(1.2, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: config.primaryColor,
      roughness: 0.15,
      metalness: 0.85,
      emissive: config.glowColor,
      emissiveIntensity: 0.4
    });
    const octahedron = new THREE.Mesh(octGeo, octMat);
    octahedron.name = "core";
    group.add(octahedron);

    // 2. Anillo giratorio 1 (Torus exterior)
    const ring1Geo = new THREE.TorusGeometry(2.0, 0.08, 16, 64);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.9,
      emissive: config.primaryColor,
      emissiveIntensity: 0.5
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.name = "ring1";
    group.add(ring1);

    // 3. Anillo giratorio 2 (Torus inclinado)
    const ring2Geo = new THREE.TorusGeometry(1.6, 0.06, 16, 64);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      roughness: 0.2,
      metalness: 0.8
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.name = "ring2";
    ring2.rotation.x = Math.PI / 3;
    group.add(ring2);

    // 4. Pequeñas partículas satélite
    this.addOrbitingParticles(group, config.primaryColor, 30, 2.8);
  }

  /**
   * Personaje 1: Centinela de Abaroa
   * Prisma hexagonal / cristal animado con rotación y cambio de escala.
   */
  buildCrystal(group, config) {
    // Prisma hexagonal (Cilindro de 6 lados con extremos piramidales)
    const crystalGeo = new THREE.CylinderGeometry(0.8, 1.1, 2.4, 6);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: config.primaryColor,
      roughness: 0.2,
      metalness: 0.6,
      emissive: config.glowColor,
      emissiveIntensity: 0.35,
      flatShading: true
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.name = "core";
    group.add(crystal);

    // Casco de wireframe exterior
    const wireGeo = new THREE.CylinderGeometry(0.85, 1.15, 2.45, 6);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.name = "wire";
    group.add(wire);

    // Cristales satélite menores
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const subGeo = new THREE.CylinderGeometry(0.25, 0.4, 1.0, 6);
      const subMat = new THREE.MeshStandardMaterial({
        color: config.primaryColor,
        roughness: 0.2,
        metalness: 0.7,
        flatShading: true
      });
      const subCrystal = new THREE.Mesh(subGeo, subMat);
      subCrystal.position.set(Math.cos(angle) * 1.8, -0.4, Math.sin(angle) * 1.8);
      subCrystal.name = `subCrystal_${i}`;
      group.add(subCrystal);
    }
  }

  /**
   * Personaje 2: Espíritu de Sánchez Lima
   * Anillo toroidal entrelazado (TorusKnot) con material iridiscente y metálico.
   */
  buildTorusKnot(group, config) {
    const knotGeo = new THREE.TorusKnotGeometry(1.2, 0.35, 128, 16, 2, 3);
    const knotMat = new THREE.MeshStandardMaterial({
      color: config.primaryColor,
      roughness: 0.15,
      metalness: 0.95,
      emissive: config.glowColor,
      emissiveIntensity: 0.3
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.name = "core";
    group.add(knot);

    // Anillo exterior de resonancia
    const haloGeo = new THREE.RingGeometry(2.0, 2.15, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.name = "halo";
    group.add(halo);

    this.addOrbitingParticles(group, 0xf472b6, 40, 2.6);
  }

  /**
   * Personaje 3: Caminante de la Escalinata
   * Esfera con wireframe y enjambre de partículas flotantes orbitando a su alrededor.
   */
  buildParticleSphere(group, config) {
    // 1. Núcleo central resplandeciente
    const coreGeo = new THREE.IcosahedronGeometry(0.9, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: config.primaryColor,
      roughness: 0.3,
      metalness: 0.7,
      emissive: config.glowColor,
      emissiveIntensity: 0.6
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = "core";
    group.add(core);

    // 2. Capa wireframe esférica
    const wireGeo = new THREE.IcosahedronGeometry(1.4, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.name = "wire";
    group.add(wire);

    // 3. Enjambre denso de 80 partículas orbitales
    const particleCount = 80;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const pSpeeds = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.6 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      positions[i * 3] = radius * Math.cos(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi);
      positions[i * 3 + 2] = radius * Math.cos(phi) * Math.sin(theta);

      pSpeeds.push({
        radius,
        theta,
        phi,
        speedTheta: (0.4 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1),
        speedPhi: (0.2 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.9
    });

    const particles = new THREE.Points(pGeo, pMat);
    particles.name = "swarm";
    particles.userData = { speeds: pSpeeds };
    this.particleSwarm = particles;
    group.add(particles);
  }

  /**
   * Personaje 4: Protector del Montículo
   * Dodecaedro dorado brillante giratorio con efecto de resplandor.
   */
  buildGoldenDodecahedron(group, config) {
    // 1. Núcleo de Dodecaedro dorado
    const dodGeo = new THREE.DodecahedronGeometry(1.3, 0);
    const dodMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.1,
      metalness: 0.95,
      emissive: 0xd97706,
      emissiveIntensity: 0.4
    });
    const dodecahedron = new THREE.Mesh(dodGeo, dodMat);
    dodecahedron.name = "core";
    group.add(dodecahedron);

    // 2. Capa exterior de wireframe dorado
    const outerGeo = new THREE.DodecahedronGeometry(1.7, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.name = "outer";
    group.add(outer);

    // 3. Dos anillos planetarios dorados
    const ringGeo = new THREE.TorusGeometry(2.3, 0.05, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.9,
      roughness: 0.2
    });
    const ringA = new THREE.Mesh(ringGeo, ringMat);
    ringA.rotation.x = Math.PI / 4;
    ringA.name = "ringA";
    group.add(ringA);

    const ringB = new THREE.Mesh(ringGeo, ringMat);
    ringB.rotation.y = Math.PI / 3;
    ringB.name = "ringB";
    group.add(ringB);

    this.addOrbitingParticles(group, 0xfde047, 50, 3.2);
  }

  /**
   * Utilidad para añadir partículas flotantes alrededor de una entidad.
   */
  addOrbitingParticles(group, colorHex, count, maxRadius) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.2 + Math.random() * (maxRadius - 1.2);
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.1,
      transparent: true,
      opacity: 0.8
    });
    const pMesh = new THREE.Points(geo, mat);
    pMesh.name = "subParticles";
    group.add(pMesh);
  }

  /**
   * Actualiza el rumbo del objetivo y su distancia relativa.
   */
  setTargetSpatialInfo(bearingDeg, distanceMeters) {
    this.targetBearing = bearingDeg;
    this.targetDistance = distanceMeters;
    this.updateTargetSpatialPosition();
  }

  /**
   * Posiciona el grupo 3D en el espacio virtual según su rumbo respecto al Norte.
   * Norte = 0° (eje -Z)
   * Este = 90° (eje +X)
   * Sur = 180° (eje +Z)
   * Oeste = 270° (eje -X)
   */
  updateTargetSpatialPosition() {
    if (!this.currentEntityGroup) return;

    // Distancia visual cómoda para el visor AR (entre 4 y 7 unidades de Three.js)
    const visualDistance = 5.2;
    const bearingRad = (this.targetBearing * Math.PI) / 180;

    const x = visualDistance * Math.sin(bearingRad);
    const z = -visualDistance * Math.cos(bearingRad);
    const y = 0.2; // Altura ligeramente por encima de los ojos

    this.currentEntityGroup.position.set(x, y, z);
    if (this.lightPulse) {
      this.lightPulse.position.set(x, y + 1, z);
    }
  }

  /**
   * Inicia el bucle de renderizado.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  /**
   * Detiene el bucle de renderizado.
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Bucle de animación por fotograma.
   */
  animate() {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Actualizar orientación de la cámara
    this.updateCameraOrientation();

    // 2. Animar entidad 3D activa
    if (this.currentEntityGroup) {
      this.animateEntity(this.currentEntityGroup, elapsedTime, delta);
    }

    // 3. Comprobar si el objetivo está enfocado en la retícula central (Lock-on)
    this.checkTargetAlignment();

    // 4. Renderizar escena
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Sincroniza la cámara con el giroscopio del móvil o con los controles de arrastre manual.
   */
  updateCameraOrientation() {
    if (this.hasGyro && this.gyroAlpha !== null) {
      // Orientación giroscópica nativa
      const alphaRad = THREE.MathUtils.degToRad(this.gyroAlpha);
      const betaRad = THREE.MathUtils.degToRad(this.gyroBeta);
      const gammaRad = THREE.MathUtils.degToRad(this.gyroGamma);

      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.set(betaRad, alphaRad + this.manualYaw, -gammaRad);
      this.camera.quaternion.setFromEuler(euler);
    } else {
      // Fallback para desktop o sin sensor: usar manualYaw / manualPitch
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.set(this.manualPitch, this.manualYaw, 0);
      this.camera.quaternion.setFromEuler(euler);
    }
  }

  /**
   * Animaciones continuas de rotación, flotación, escala y partículas.
   */
  animateEntity(group, time, delta) {
    // Flotación senoidal suave
    group.position.y = 0.2 + Math.sin(time * 1.8) * 0.25;

    const core = group.getObjectByName("core");
    if (core) {
      core.rotation.y += delta * 0.8;
      core.rotation.x += delta * 0.3;
    }

    // Efectos específicos según el tipo
    const ring1 = group.getObjectByName("ring1");
    if (ring1) {
      ring1.rotation.x += delta * 1.2;
      ring1.rotation.y += delta * 0.6;
    }

    const ring2 = group.getObjectByName("ring2");
    if (ring2) {
      ring2.rotation.z += delta * 1.5;
      ring2.rotation.x -= delta * 0.8;
    }

    const wire = group.getObjectByName("wire");
    if (wire) {
      wire.rotation.y -= delta * 0.4;
      wire.rotation.z += delta * 0.2;
    }

    const halo = group.getObjectByName("halo");
    if (halo) {
      halo.rotation.z += delta * 0.5;
    }

    const outer = group.getObjectByName("outer");
    if (outer) {
      outer.rotation.y -= delta * 0.5;
      outer.rotation.x -= delta * 0.3;
    }

    const ringA = group.getObjectByName("ringA");
    if (ringA) ringA.rotation.z += delta * 0.9;
    const ringB = group.getObjectByName("ringB");
    if (ringB) ringB.rotation.z -= delta * 0.7;

    // Sub-cristales del Centinela
    for (let i = 0; i < 3; i++) {
      const sub = group.getObjectByName(`subCrystal_${i}`);
      if (sub) {
        sub.rotation.y += delta * 1.5;
        sub.position.y = -0.4 + Math.sin(time * 2.5 + i) * 0.15;
      }
    }

    // Enjambre de partículas del Caminante
    if (this.particleSwarm) {
      const positions = this.particleSwarm.geometry.attributes.position.array;
      const speeds = this.particleSwarm.userData.speeds;

      for (let i = 0; i < speeds.length; i++) {
        const p = speeds[i];
        p.theta += p.speedTheta * delta;
        p.phi += p.speedPhi * delta;

        positions[i * 3] = p.radius * Math.cos(p.phi) * Math.cos(p.theta);
        positions[i * 3 + 1] = p.radius * Math.sin(p.phi);
        positions[i * 3 + 2] = p.radius * Math.cos(p.phi) * Math.sin(p.theta);
      }
      this.particleSwarm.geometry.attributes.position.needsUpdate = true;
    }

    // Partículas orbitales generales
    const subParticles = group.getObjectByName("subParticles");
    if (subParticles) {
      subParticles.rotation.y += delta * 0.4;
    }

    // Pulso de luz mística
    if (this.lightPulse) {
      this.lightPulse.intensity = 1.8 + Math.sin(time * 3.5) * 0.8;
    }
  }

  /**
   * Comprueba si el objetivo 3D está dentro del campo de visión y proyecta
   * su posición en pantalla para guías visuales (flechas izquierda/derecha).
   */
  checkTargetAlignment() {
    if (!this.currentEntityGroup) {
      return { inView: false, isLocked: false, direction: 0 };
    }

    const targetPos = this.currentEntityGroup.position.clone();
    const projected = targetPos.project(this.camera);

    // Si z > 1, el objeto está detrás de la cámara
    const isBehind = projected.z > 1.0;
    const screenX = projected.x; // -1 (izq) a 1 (der)
    const screenY = projected.y; // -1 (abajo) a 1 (arriba)

    // Dentro de la pantalla si está frente a la cámara y dentro del marco [-1, 1]
    const inScreen = !isBehind && Math.abs(screenX) <= 1.1 && Math.abs(screenY) <= 1.1;

    // Centrado en la retícula central (Lock-on con tolerancia de 0.35)
    const isLocked = !isBehind && Math.sqrt(screenX * screenX + screenY * screenY) < 0.35;

    if (isLocked !== this.isTargetLocked) {
      this.isTargetLocked = isLocked;
      if (this.onLockChange) {
        this.onLockChange(isLocked);
      }
    }

    // Determinar dirección de ayuda (off-screen)
    let guideDirection = "center";
    if (isBehind) {
      // Si está detrás, determinar si girar a la izquierda o derecha
      guideDirection = screenX < 0 ? "right" : "left";
    } else if (screenX < -0.4) {
      guideDirection = "left";
    } else if (screenX > 0.4) {
      guideDirection = "right";
    }

    return {
      inScreen,
      isLocked,
      guideDirection,
      screenX,
      screenY
    };
  }
}
