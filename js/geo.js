/**
 * ECOS DE SOPOCACHI - GEOLOCATION UTILITIES
 * Fórmulas puras de Haversine, cálculo de rumbo (Bearing),
 * destino geodésico y utilidades de brújula.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Convierte grados a radianes.
 */
export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convierte radianes a grados.
 */
export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Fórmula pura de Haversine para calcular distancia ortodrómica en metros entre 2 puntos GPS.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distancia en metros
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calcula el Rumbo (Initial Bearing / Azimuth) en grados (0° - 360°) desde el punto 1 al punto 2.
 * 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste.
 */
export function getBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const degrees = toDeg(theta);
  return (degrees + 360) % 360;
}

/**
 * Calcula un nuevo punto geográfico (lat/lng) dada una coordenada de origen,
 * una distancia en metros y un rumbo en grados.
 */
export function getDestinationPoint(lat, lon, distanceMeters, bearingDegrees) {
  const delta = distanceMeters / EARTH_RADIUS_METERS;
  const theta = toRad(bearingDegrees);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return {
    lat: toDeg(phi2),
    lng: ((toDeg(lambda2) + 540) % 360) - 180
  };
}

/**
 * Genera el Spawn Inmediato del Guardián del Umbral a una distancia de entre 10 y 18 metros
 * en una dirección aleatoria (0° a 360°) respecto al usuario.
 */
export function generateInitialSpawn(userLat, userLng) {
  const minDistance = 11;
  const maxDistance = 17;
  const distance = minDistance + Math.random() * (maxDistance - minDistance);
  const bearing = Math.random() * 360;
  const coords = getDestinationPoint(userLat, userLng, distance, bearing);
  return {
    ...coords,
    spawnDistance: Math.round(distance),
    spawnBearing: Math.round(bearing)
  };
}

/**
 * Calcula la diferencia angular más corta (-180° a 180°) entre el rumbo del objetivo
 * y la dirección actual a la que apunta el dispositivo.
 * Retorna negativo si el objetivo está a la izquierda, positivo si está a la derecha.
 */
export function getRelativeAngle(targetBearing, currentHeading) {
  let diff = targetBearing - currentHeading;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
}
