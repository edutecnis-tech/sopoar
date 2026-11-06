/**
 * ECOS DE SOPOCACHI - TARGETS DEFINITION
 * Configuración de objetivos y generador del spawn dinámico inicial.
 */

export const FIXED_TARGETS = [
  {
    id: 1,
    name: "Centinela de Abaroa",
    lat: -16.51268,
    lng: -68.12788,
    locationName: "Plaza Abaroa",
    clue: "Búscalo cerca del monumento central y los jardines de la plaza.",
    lore: "Guardián de la memoria de Eduardo Abaroa. Canaliza la energía cívica y floral del corazón de Sopocachi.",
    meshType: "crystal",
    primaryColor: 0x10b981, // Verde esmeralda
    glowColor: 0x34d399,
    accentHex: "#10b981",
    audioScale: [440, 554.37, 659.25, 830.61] // Escala mística en La
  },
  {
    id: 2,
    name: "Espíritu de Sánchez Lima",
    lat: -16.51460,
    lng: -68.12640,
    locationName: "Sánchez Lima esq. Rosendo Gutiérrez",
    clue: "Atento a los árboles y las casonas tradicionales de la esquina.",
    lore: "Una entidad bohemia que habita entre la arquitectura patrimonial y la sombra de los eucaliptos centenarios.",
    meshType: "torusKnot",
    primaryColor: 0xec4899, // Magenta iridiscente
    glowColor: 0xf472b6,
    accentHex: "#ec4899",
    audioScale: [392, 493.88, 587.33, 739.99] // Sol místico
  },
  {
    id: 3,
    name: "Caminante de la Escalinata",
    lat: -16.51655,
    lng: -68.12450,
    locationName: "Escalinatas hacia El Montículo",
    clue: "Asciende por las escalinatas de piedra hacia el mirador.",
    lore: "Entidad enjambre que custodia el ascenso de los enamorados y peregrinos por los peldaños tallados en roca.",
    meshType: "particleSphere",
    primaryColor: 0x8b5cf6, // Violeta estelar
    glowColor: 0xa78bfa,
    accentHex: "#8b5cf6",
    audioScale: [329.63, 415.30, 493.88, 622.25] // Mi místico
  },
  {
    id: 4,
    name: "Protector del Montículo",
    lat: -16.51810,
    lng: -68.12320,
    locationName: "Mirador de El Montículo / Capilla",
    clue: "En lo alto del mirador, contemplando la vista panorámica de la ciudad y el Illimani.",
    lore: "El ser supremo de la colina sagrada. Su corazón de oro puro resuena con los vientos andinos del valle.",
    meshType: "goldenDodecahedron",
    primaryColor: 0xf59e0b, // Oro solar
    glowColor: 0xfbbf24,
    accentHex: "#f59e0b",
    audioScale: [523.25, 659.25, 783.99, 987.77] // Do brillante
  }
];

/**
 * Plantilla del Personaje 0 (Spawn Inmediato Dinámico)
 */
export const INITIAL_SPAWN_TEMPLATE = {
  id: 0,
  name: "Guardián del Umbral",
  locationName: "Manifestación Inmediata",
  clue: "Un ser de bienvenida se ha manifestado justo a tu alrededor. ¡Gira sobre tu propio eje para encontrarlo!",
  lore: "Primera manifestación del éter sopocacheño. Se sintoniza con el explorador en el instante de su llegada.",
  meshType: "octahedronRings",
  primaryColor: 0x06b6d4, // Cyan radiante
  glowColor: 0x22d3ee,
  accentHex: "#06b6d4",
  audioScale: [523.25, 587.33, 659.25, 783.99],
  isDynamic: true
};
