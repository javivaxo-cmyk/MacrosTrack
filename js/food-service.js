/**
 * food-service.js - Motor de búsqueda ultrarrápido y gestión de alimentos
 * Carga 2,048 alimentos de la base de datos BAM + alimentos personalizados.
 */

import { getAllCustomFoods, saveCustomFood, removeCustomFood } from './db.js';

let officialFoods = [];
let customFoods = [];
let isLoaded = false;
let loadPromise = null;

/**
 * Normaliza texto eliminando acentos, caracteres especiales y mayúsculas
 */
export function normalizeText(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clasifica automáticamente un alimento por su nombre o macros
 */
function inferCategory(name, macros) {
  const norm = normalizeText(name);
  if (norm.includes('aceite') || norm.includes('mantequilla') || norm.includes('grasa') || norm.includes('mayonesa') || norm.includes('manteca')) {
    return { id: 'fats', name: 'Grasas y Aceites', icon: '🫒' };
  }
  if (norm.includes('pollo') || norm.includes('res') || norm.includes('carne') || norm.includes('cerdo') || norm.includes('pavo') || norm.includes('jamon') || norm.includes('tocino')) {
    return { id: 'meats', name: 'Carnes y Aves', icon: '🥩' };
  }
  if (norm.includes('pescado') || norm.includes('atun') || norm.includes('salmon') || norm.includes('camaron') || norm.includes('sardina') || norm.includes('marisco')) {
    return { id: 'fish', name: 'Pescados y Mariscos', icon: '🐟' };
  }
  if (norm.includes('huevo') || norm.includes('clara')) {
    return { id: 'eggs', name: 'Huevos', icon: '🥚' };
  }
  if (norm.includes('leche') || norm.includes('queso') || norm.includes('yogur') || norm.includes('crema') || norm.includes('requeson')) {
    return { id: 'dairy', name: 'Lácteos y Quesos', icon: '🧀' };
  }
  if (norm.includes('arroz') || norm.includes('avena') || norm.includes('pan') || norm.includes('tortilla') || norm.includes('pasta') || norm.includes('harina') || norm.includes('cereal') || norm.includes('papa')) {
    return { id: 'grains', name: 'Cereales y Granos', icon: '🌾' };
  }
  if (norm.includes('manzana') || norm.includes('platano') || norm.includes('naranja') || norm.includes('fresa') || norm.includes('mango') || norm.includes('uvas') || norm.includes('fruta') || norm.includes('pina')) {
    return { id: 'fruits', name: 'Frutas', icon: '🍎' };
  }
  if (norm.includes('lechuga') || norm.includes('espinaca') || norm.includes('tomate') || norm.includes('jitomate') || norm.includes('cebolla') || norm.includes('zanahoria') || norm.includes('brocoli') || norm.includes('calabaza') || norm.includes('verdura')) {
    return { id: 'vegetables', name: 'Verduras', icon: '🥦' };
  }
  if (norm.includes('frijol') || norm.includes('lenteja') || norm.includes('garbanzo') || norm.includes('soya')) {
    return { id: 'legumes', name: 'Leguminosas', icon: '🫘' };
  }
  if (norm.includes('nuez') || norm.includes('almendra') || norm.includes('cacahuate') || norm.includes('semilla')) {
    return { id: 'nuts', name: 'Frutos Secos', icon: '🥜' };
  }
  return { id: 'other', name: 'Otros Alimentos', icon: '🍽️' };
}

/**
 * Inicializa y carga la base de datos de alimentos
 */
export async function initFoodService(currentUserId) {
  if (isLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // 1. Cargar archivo local de BAM Foods
      let response;
      try {
        response = await fetch('./bam_foods_json/bam_foods.min.json');
        if (!response.ok) throw new Error('Falló min.json, intentando bam_foods.json');
      } catch (e) {
        response = await fetch('./bam_foods_json/bam_foods.json');
      }

      const rawData = await response.json();
      officialFoods = rawData.map((item) => {
        const normName = normalizeText(item.name);
        const category = inferCategory(item.name, item.macros);
        return {
          id: item.id,
          name: item.name,
          normName,
          category,
          macros: {
            kcal: item.macros?.kcal ?? 0,
            protein: item.macros?.protein ?? 0,
            carbs: item.macros?.carbs ?? 0,
            fat: item.macros?.fat ?? 0,
            fiber: item.macros?.fiber ?? 0
          },
          isCustom: false
        };
      });

      // 2. Cargar alimentos personalizados de IndexedDB
      if (currentUserId) {
        await reloadCustomFoods(currentUserId);
      }

      isLoaded = true;
      console.log(`FoodService inicializado: ${officialFoods.length} alimentos oficiales y ${customFoods.length} personalizados.`);
    } catch (err) {
      console.error('Error al inicializar FoodService:', err);
    }
  })();

  return loadPromise;
}

/**
 * Recarga los alimentos personalizados para el usuario
 */
export async function reloadCustomFoods(currentUserId) {
  const list = await getAllCustomFoods(currentUserId);
  customFoods = list.map((f) => ({
    ...f,
    normName: normalizeText(f.name),
    category: f.category || { id: 'custom', name: 'Personalizado', icon: '⭐' },
    isCustom: true
  }));
}

/**
 * Búsqueda instantánea multi-término
 * @param {string} query - Término de búsqueda
 * @param {object} options - { categoryId, limit, customOnly }
 */
export function searchFoods(query, options = {}) {
  const { categoryId = 'all', limit = 40, customOnly = false } = options;
  const trimmed = (query || '').trim();
  const normQuery = normalizeText(trimmed);
  const queryTokens = normQuery ? normQuery.split(' ').filter(Boolean) : [];

  let pool = [];
  if (customOnly) {
    pool = customFoods;
  } else {
    // Los personalizados primero para que aparezcan arriba si coinciden
    pool = [...customFoods, ...officialFoods];
  }

  // Filtrado por categoría si no es 'all'
  if (categoryId !== 'all') {
    pool = pool.filter((f) => f.category?.id === categoryId);
  }

  if (queryTokens.length === 0) {
    // Si no hay query, retornar los primeros según el límite
    return pool.slice(0, limit);
  }

  const results = [];

  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    const name = item.normName;

    // Verificar si todos los tokens del query están presentes
    let matches = true;
    let score = 0;

    for (let t = 0; t < queryTokens.length; t++) {
      const token = queryTokens[t];
      const idx = name.indexOf(token);
      if (idx === -1) {
        matches = false;
        break;
      }
      if (idx === 0) score += 50; // Comienza con la palabra
      else score += 10;
    }

    if (matches) {
      if (name === normQuery) score += 100;
      if (item.isCustom) score += 30; // Prioridad a alimentos personalizados
      results.push({ item, score });
    }
  }

  // Ordenar por score descendente
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map((r) => r.item);
}

/**
 * Obtiene un alimento por ID (oficial o personalizado)
 */
export function getFoodById(id) {
  // Primero busca en personalizados
  const custom = customFoods.find((f) => f.id === id);
  if (custom) return custom;
  // Luego en oficiales
  return officialFoods.find((f) => f.id === id || f.id === Number(id));
}

/**
 * Agrega un nuevo alimento personalizado y lo guarda en BD
 */
export async function createAndSaveCustomFood(customData, currentUserId) {
  const newFood = {
    id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    createdByUserId: currentUserId,
    isGlobal: customData.isGlobal ?? true,
    name: customData.name.trim(),
    brand: (customData.brand || '').trim(),
    category: customData.category || inferCategory(customData.name, customData.macros),
    servingUnitName: customData.servingUnitName || 'Porción',
    servingSizeGrams: parseFloat(customData.servingSizeGrams) || 100,
    macros: {
      kcal: parseFloat(customData.macros.kcal) || 0,
      protein: parseFloat(customData.macros.protein) || 0,
      carbs: parseFloat(customData.macros.carbs) || 0,
      fat: parseFloat(customData.macros.fat) || 0,
      fiber: parseFloat(customData.macros.fiber) || 0
    }
  };

  await saveCustomFood(newFood);
  await reloadCustomFoods(currentUserId);
  return newFood;
}

/**
 * Elimina un alimento personalizado
 */
export async function deleteCustomFood(foodId, currentUserId) {
  await removeCustomFood(foodId);
  await reloadCustomFoods(currentUserId);
}
