export const SIGNS = [
  "Áries",
  "Touro",
  "Gêmeos",
  "Câncer",
  "Leão",
  "Virgem",
  "Libra",
  "Escorpião",
  "Sagitário",
  "Capricórnio",
  "Aquário",
  "Peixes"
];

export const HOUSES = Array.from({ length: 12 }, (_, i) => i + 1);

export const PLANETS = [
  { id: "sun", label: "Sol" },
  { id: "moon", label: "Lua" },
  { id: "mercury", label: "Mercúrio" },
  { id: "venus", label: "Vênus" },
  { id: "mars", label: "Marte" },
  { id: "jupiter", label: "Júpiter" },
  { id: "saturn", label: "Saturno" },
  { id: "uranus", label: "Urano" },
  { id: "neptune", label: "Netuno" },
  { id: "pluto", label: "Plutão" },
  { id: "chiron", label: "Quíron" },
  { id: "lilith", label: "Lilith" },
  { id: "northNode", label: "Nodo Norte" },
  { id: "southNode", label: "Nodo Sul" }
] as const;

export const ASPECT_TYPES = [
  "Conjunção",
  "Oposição",
  "Trígono",
  "Quadratura",
  "Sextil",
  "Quincúncio",
  "Semissextil",
  "Semiquadratura",
  "Sesquiquadratura"
];
