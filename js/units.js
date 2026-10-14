/**
 * units.js - Sistema integral de conversión y medición de alimentos
 */

export const UNITS = {
  g: {
    key: 'g',
    label: 'Gramos (g)',
    short: 'g',
    toGrams: 1,
    type: 'weight',
    step: 5,
    defaultQty: 100
  },
  cup: {
    key: 'cup',
    label: 'Taza (cup ~240g)',
    short: 'taza',
    toGrams: 240,
    type: 'volume',
    step: 0.25,
    defaultQty: 1
  },
  half_cup: {
    key: 'half_cup',
    label: '1/2 Taza (~120g)',
    short: '1/2 taza',
    toGrams: 120,
    type: 'volume',
    step: 0.5,
    defaultQty: 1
  },
  tbsp: {
    key: 'tbsp',
    label: 'Cucharada (tbsp ~15g)',
    short: 'cda',
    toGrams: 15,
    type: 'volume',
    step: 1,
    defaultQty: 1
  },
  tsp: {
    key: 'tsp',
    label: 'Cucharadita (tsp ~5g)',
    short: 'cdita',
    toGrams: 5,
    type: 'volume',
    step: 1,
    defaultQty: 1
  },
  oz: {
    key: 'oz',
    label: 'Onzas (oz ~28.3g)',
    short: 'oz',
    toGrams: 28.3495,
    type: 'weight',
    step: 0.5,
    defaultQty: 3
  },
  lb: {
    key: 'lb',
    label: 'Libras (lb ~453.6g)',
    short: 'lb',
    toGrams: 453.592,
    type: 'weight',
    step: 0.25,
    defaultQty: 0.5
  },
  kg: {
    key: 'kg',
    label: 'Kilogramos (kg)',
    short: 'kg',
    toGrams: 1000,
    type: 'weight',
    step: 0.1,
    defaultQty: 0.2
  },
  ml: {
    key: 'ml',
    label: 'Mililitros (ml)',
    short: 'ml',
    toGrams: 1,
    type: 'volume',
    step: 25,
    defaultQty: 200
  },
  piece: {
    key: 'piece',
    label: 'Pieza / Porción',
    short: 'pz',
    toGrams: null, // Dinámico según customPieceGrams o 100g
    type: 'serving',
    step: 1,
    defaultQty: 1
  }
};

/**
 * Convierte cantidad y unidad a gramos
 * @param {number} quantity - Cantidad indicada por el usuario
 * @param {string} unitKey - Clave de la unidad (ej. 'g', 'cup', 'piece')
 * @param {number} customPieceGrams - Peso en gramos si es porción/pieza (opcional)
 * @returns {number} gramos totales
 */
export function convertToGrams(quantity, unitKey, customPieceGrams = 100) {
  const qty = parseFloat(quantity) || 0;
  if (qty <= 0) return 0;

  if (unitKey === 'piece') {
    const pieceWeight = parseFloat(customPieceGrams) || 100;
    return qty * pieceWeight;
  }

  const unitDef = UNITS[unitKey] || UNITS.g;
  return qty * (unitDef.toGrams || 1);
}

/**
 * Calcula macros escalados a partir de los datos base por 100g
 * @param {object} baseMacros100g - { kcal, protein, carbs, fat, fiber }
 * @param {number} quantity - Cantidad
 * @param {string} unitKey - Clave de unidad
 * @param {number} customPieceGrams - Peso por pieza si aplica
 * @returns {object} { grams, macros: { kcal, protein, carbs, fat, fiber } }
 */
export function calculateItemMacros(baseMacros100g, quantity, unitKey, customPieceGrams = 100) {
  const grams = convertToGrams(quantity, unitKey, customPieceGrams);
  const factor = grams / 100;

  const rawKcal = (baseMacros100g?.kcal ?? 0) * factor;
  const rawProtein = (baseMacros100g?.protein ?? 0) * factor;
  const rawCarbs = (baseMacros100g?.carbs ?? 0) * factor;
  const rawFat = (baseMacros100g?.fat ?? 0) * factor;
  const rawFiber = (baseMacros100g?.fiber ?? 0) * factor;

  return {
    grams: Math.round(grams * 10) / 10,
    macros: {
      kcal: Math.round(rawKcal * 10) / 10,
      protein: Math.round(rawProtein * 10) / 10,
      carbs: Math.round(rawCarbs * 10) / 10,
      fat: Math.round(rawFat * 10) / 10,
      fiber: Math.round(rawFiber * 10) / 10
    }
  };
}

/**
 * Formatea texto legible para cantidad y unidad
 * Ej: "1.5 tazas (360g)" o "150g"
 */
export function formatAmount(quantity, unitKey, grams) {
  const unit = UNITS[unitKey] || UNITS.g;
  const qtyStr = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  if (unitKey === 'g') {
    return `${qtyStr} g`;
  }
  const gramsStr = grams ? ` (${Math.round(grams)}g)` : '';
  return `${qtyStr} ${unit.short}${gramsStr}`;
}
