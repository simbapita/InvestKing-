var CFG = {
  TILE: 32,
  WORLD_W: 70,
  WORLD_H: 70,
  SPEED: 160,

  DRAIN: {
    FOOD_WALK: 0.12,
    FOOD_IDLE: 0.03,
    HEALTH_EMPTY: 0.07,
  },

  CHARS: [
    { body: '#e74c3c', outline: '#922b21', name: 'Red' },
    { body: '#3498db', outline: '#1a5276', name: 'Blue' },
    { body: '#2ecc71', outline: '#1a7a4a', name: 'Green' },
    { body: '#f39c12', outline: '#9a6007', name: 'Gold' },
    { body: '#9b59b6', outline: '#6c3483', name: 'Purple' },
    { body: '#e67e22', outline: '#935116', name: 'Orange' },
    { body: '#ec407a', outline: '#880e4f', name: 'Pink' },
    { body: '#00bcd4', outline: '#006064', name: 'Cyan' },
  ],

  SPECS: [
    { id: 'TECH',         name: 'Technology',   icon: '💻', color: '#3498db' },
    { id: 'MEDICAL',      name: 'Medical',       icon: '🏥', color: '#e74c3c' },
    { id: 'FOOD_SERVICE', name: 'Food Service',  icon: '🍕', color: '#f39c12' },
    { id: 'TRADES',       name: 'Trades',        icon: '🔨', color: '#95a5a6' },
    { id: 'BUSINESS',     name: 'Business',      icon: '💼', color: '#2ecc71' },
    { id: 'ARTS',         name: 'Arts',          icon: '🎨', color: '#9b59b6' },
  ],

  // Tile IDs
  T: {
    ROAD: 0, SIDEWALK: 1, GRASS: 2, BUILDING: 3,
    TREE: 4, PARK_PATH: 5,
    JOB_TECH: 6, JOB_MEDICAL: 7, JOB_FOOD: 8,
    JOB_TRADES: 9, JOB_BUSINESS: 10, JOB_ARTS: 11,
    HOUSE: 12, SHOP: 13,
  },

  WALKABLE: new Set([0, 1, 2, 5]),

  // Colors for drawing tiles
  TILE_COLORS: {
    0:  '#3a3a4a',  // road
    1:  '#6e6e7e',  // sidewalk
    2:  '#2d5a27',  // grass
    3:  '#1a1a2e',  // building (dark)
    4:  '#1a3d1a',  // tree (darker green)
    5:  '#4a7a44',  // park path
    6:  '#1a237e',  // tech building
    7:  '#b71c1c',  // medical building
    8:  '#e65100',  // food building
    9:  '#4e342e',  // trades building
    10: '#1b5e20',  // business building
    11: '#4a148c',  // arts building
    12: '#5d4037',  // house
    13: '#00695c',  // shop
  },
};
