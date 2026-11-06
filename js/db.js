/**
 * ECOS DE SOPOCACHI - LOCAL PERSISTENCE (IndexedDB)
 * Gestión autónoma en el navegador para capturas fotográficas y progreso del juego.
 */

const DB_NAME = "EcosDeSopocachiDB";
const DB_VERSION = 1;
const STORE_CAPTURES = "captures";
const STORE_STATE = "gameState";

let dbInstance = null;

/**
 * Inicializa y abre la base de datos IndexedDB.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
        db.createObjectStore(STORE_CAPTURES, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("Error al abrir IndexedDB:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Guarda una captura fotográfica y sus metadatos.
 */
export async function saveCapture(captureData) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, "readwrite");
    const store = tx.objectStore(STORE_CAPTURES);
    const req = store.put(captureData);

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Obtiene todas las capturas registradas.
 */
export async function getAllCaptures() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, "readonly");
    const store = tx.objectStore(STORE_CAPTURES);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Obtiene una captura específica por ID.
 */
export async function getCapture(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, "readonly");
    const store = tx.objectStore(STORE_CAPTURES);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Guarda un valor en el estado del juego.
 */
export async function saveGameState(key, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, "readwrite");
    const store = tx.objectStore(STORE_STATE);
    const req = store.put({ key, value });

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Recupera un valor del estado del juego.
 */
export async function getGameState(key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, "readonly");
    const store = tx.objectStore(STORE_STATE);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Reinicia la base de datos (para pruebas o reset de partida).
 */
export async function clearAllGameData() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CAPTURES, STORE_STATE], "readwrite");
    tx.objectStore(STORE_CAPTURES).clear();
    tx.objectStore(STORE_STATE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}
