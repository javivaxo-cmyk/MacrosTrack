/**
 * db.js - Capa de persistencia en IndexedDB con soporte offline,
 * respaldo JSON completo y datos iniciales de demostración.
 */

const DB_NAME = 'MacrosTrackDB';
const DB_VERSION = 1;

let dbInstance = null;

export async function openDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Usuarios
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      // 2. Registro de alimentos diarios (logs)
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('userId', 'userId', { unique: false });
        logStore.createIndex('date', 'date', { unique: false });
        logStore.createIndex('user_date', ['userId', 'date'], { unique: false });
      }

      // 3. Recetas
      if (!db.objectStoreNames.contains('recipes')) {
        const recipeStore = db.createObjectStore('recipes', { keyPath: 'id' });
        recipeStore.createIndex('createdByUserId', 'createdByUserId', { unique: false });
        recipeStore.createIndex('isShared', 'isShared', { unique: false });
      }

      // 4. Alimentos personalizados
      if (!db.objectStoreNames.contains('customFoods')) {
        const foodStore = db.createObjectStore('customFoods', { keyPath: 'id' });
        foodStore.createIndex('createdByUserId', 'createdByUserId', { unique: false });
        foodStore.createIndex('isGlobal', 'isGlobal', { unique: false });
      }

      // 5. Estadísticas diarias (peso, agua, notas)
      if (!db.objectStoreNames.contains('dailyStats')) {
        // Clave compuesta: `${userId}_${date}`
        db.createObjectStore('dailyStats', { keyPath: 'id' });
      }

      // 6. Configuración / Estado de la app
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Operaciones genéricas de IndexedDB
 */
async function tx(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = callback(store);

    transaction.oncomplete = () => resolve(req?.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAll(storeName) {
  return tx(storeName, 'readonly', (store) => store.getAll());
}

export async function getById(storeName, id) {
  return tx(storeName, 'readonly', (store) => store.get(id));
}

export async function putItem(storeName, item) {
  return tx(storeName, 'readwrite', (store) => store.put(item));
}

export async function deleteItem(storeName, id) {
  return tx(storeName, 'readwrite', (store) => store.delete(id));
}

export async function clearStore(storeName) {
  return tx(storeName, 'readwrite', (store) => store.clear());
}

// ==========================================
// MÉTODOS ESPECÍFICOS DE LA APLICACIÓN
// ==========================================

// Configuración
export async function getSetting(key, defaultValue = null) {
  const res = await getById('settings', key);
  return res ? res.value : defaultValue;
}

export async function setSetting(key, value) {
  return putItem('settings', { key, value });
}

// Usuarios
export async function getAllUsers() {
  return getAll('users');
}

export async function saveUser(user) {
  if (!user.id) {
    user.id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  }
  user.updatedAt = new Date().toISOString();
  await putItem('users', user);
  return user;
}

export async function removeUser(userId) {
  // Elimina logs y estadísticas del usuario
  const allLogs = await getAll('logs');
  for (const log of allLogs) {
    if (log.userId === userId) {
      await deleteItem('logs', log.id);
    }
  }
  const allStats = await getAll('dailyStats');
  for (const st of allStats) {
    if (st.userId === userId) {
      await deleteItem('dailyStats', st.id);
    }
  }
  return deleteItem('users', userId);
}

// Logs diarios
export async function getLogsForUserAndDate(userId, dateStr) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logs', 'readonly');
    const store = transaction.objectStore('logs');
    const index = store.index('user_date');
    const request = index.getAll(IDBKeyRange.only([userId, dateStr]));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLogsForUser(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logs', 'readonly');
    const store = transaction.objectStore('logs');
    const index = store.index('userId');
    const request = index.getAll(IDBKeyRange.only(userId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMealLog(log) {
  if (!log.id) {
    log.id = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }
  log.createdAt = log.createdAt || new Date().toISOString();
  await putItem('logs', log);
  return log;
}

export async function removeMealLog(logId) {
  return deleteItem('logs', logId);
}

// Estadísticas del día (agua, peso, notas)
export async function getDailyStats(userId, dateStr) {
  const id = `${userId}_${dateStr}`;
  const stat = await getById('dailyStats', id);
  return stat || { id, userId, date: dateStr, waterMl: 0, weight: null, notes: '' };
}

export async function saveDailyStats(stats) {
  if (!stats.id) {
    stats.id = `${stats.userId}_${stats.date}`;
  }
  await putItem('dailyStats', stats);
  return stats;
}

export async function getAllStatsForUser(userId) {
  const all = await getAll('dailyStats');
  return all.filter((s) => s.userId === userId);
}

// Recetas
export async function getAllRecipes(currentUserId) {
  const all = await getAll('recipes');
  // Retorna recetas creadas por el usuario O compartidas
  return all.filter((r) => r.isShared || r.createdByUserId === currentUserId);
}

export async function saveRecipe(recipe) {
  if (!recipe.id) {
    recipe.id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }
  recipe.updatedAt = new Date().toISOString();
  await putItem('recipes', recipe);
  return recipe;
}

export async function removeRecipe(recipeId) {
  return deleteItem('recipes', recipeId);
}

// Alimentos personalizados
export async function getAllCustomFoods(currentUserId) {
  const all = await getAll('customFoods');
  return all.filter((f) => f.isGlobal || f.createdByUserId === currentUserId);
}

export async function saveCustomFood(food) {
  if (!food.id) {
    food.id = 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }
  food.updatedAt = new Date().toISOString();
  await putItem('customFoods', food);
  return food;
}

export async function removeCustomFood(foodId) {
  return deleteItem('customFoods', foodId);
}

// ==========================================
// EXPORTACIÓN / IMPORTACIÓN TOTAL
// ==========================================
export async function exportFullBackup() {
  const users = await getAll('users');
  const logs = await getAll('logs');
  const recipes = await getAll('recipes');
  const customFoods = await getAll('customFoods');
  const dailyStats = await getAll('dailyStats');
  const settings = await getAll('settings');

  const payload = {
    app: 'MacrosTrack',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      users,
      logs,
      recipes,
      customFoods,
      dailyStats,
      settings
    }
  };

  return JSON.stringify(payload, null, 2);
}

export async function importFullBackup(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.data || !parsed.app) {
    throw new Error('Archivo de respaldo no compatible con MacrosTrack.');
  }

  const { users, logs, recipes, customFoods, dailyStats, settings } = parsed.data;

  if (users) {
    await clearStore('users');
    for (const u of users) await putItem('users', u);
  }
  if (logs) {
    await clearStore('logs');
    for (const l of logs) await putItem('logs', l);
  }
  if (recipes) {
    await clearStore('recipes');
    for (const r of recipes) await putItem('recipes', r);
  }
  if (customFoods) {
    await clearStore('customFoods');
    for (const f of customFoods) await putItem('customFoods', f);
  }
  if (dailyStats) {
    await clearStore('dailyStats');
    for (const s of dailyStats) await putItem('dailyStats', s);
  }
  if (settings) {
    await clearStore('settings');
    for (const st of settings) await putItem('settings', st);
  }

  return true;
}

// ==========================================
// SEED INICIAL (Demostración al primer uso)
// ==========================================
export async function checkAndSeedData() {
  const users = await getAllUsers();
  if (users.length > 0) {
    return; // Ya hay datos iniciales
  }

  console.log('Sembrando datos iniciales en MacrosTrack...');

  // 1. Usuario 1: Carlos (Objetivo: Pérdida de Grasa / Déficit)
  const carlos = {
    id: 'usr_carlos',
    name: 'Carlos Mendoza',
    avatar: '🥑',
    color: '#10b981', // Verde esmeralda
    gender: 'male',
    age: 28,
    height: 178,
    currentWeight: 82.5,
    targetWeight: 76.0,
    activityLevel: 'moderate',
    goal: 'lose',
    targets: {
      kcal: 2150,
      protein: 165,
      carbs: 210,
      fat: 65,
      fiber: 30,
      water: 3000
    },
    createdAt: new Date().toISOString()
  };

  // 2. Usuario 2: Ana (Objetivo: Mantenimiento y Definición)
  const ana = {
    id: 'usr_ana',
    name: 'Ana García',
    avatar: '⚡',
    color: '#8b5cf6', // Violeta moderno
    gender: 'female',
    age: 26,
    height: 164,
    currentWeight: 58.2,
    targetWeight: 57.0,
    activityLevel: 'moderate',
    goal: 'maintain',
    targets: {
      kcal: 1850,
      protein: 130,
      carbs: 195,
      fat: 55,
      fiber: 28,
      water: 2500
    },
    createdAt: new Date().toISOString()
  };

  await putItem('users', carlos);
  await putItem('users', ana);
  await setSetting('activeUserId', carlos.id);

  // Recetas de demostración
  const receta1 = {
    id: 'rec_bowl_fit',
    createdByUserId: carlos.id,
    createdByName: 'Carlos Mendoza',
    isShared: true,
    name: 'Bowl Power de Pechuga y Arroz con Aguacate',
    description: 'Comida limpia, saciante y perfecta para post-entrenamiento.',
    servings: 2,
    ingredients: [
      {
        foodId: 1040,
        name: 'ARROZ, BLANCO, COCIDO',
        quantity: 1.5,
        unit: 'cup',
        grams: 360,
        macros: { kcal: 468, protein: 9.7, carbs: 101.5, fat: 1.1, fiber: 1.4 }
      },
      {
        foodId: 1720,
        name: 'POLLO, PECHUGA, SIN PIEL, COCIDA',
        quantity: 300,
        unit: 'g',
        grams: 300,
        macros: { kcal: 495, protein: 93, carbs: 0, fat: 10.8, fiber: 0 }
      },
      {
        foodId: 1009,
        name: 'AGUACATE',
        quantity: 1,
        unit: 'piece',
        grams: 120,
        macros: { kcal: 192, protein: 2.4, carbs: 10.2, fat: 17.6, fiber: 8 }
      }
    ],
    totalMacros: { kcal: 1155, protein: 105.1, carbs: 111.7, fat: 29.5, fiber: 9.4 },
    servingMacros: { kcal: 578, protein: 52.6, carbs: 55.9, fat: 14.8, fiber: 4.7 },
    updatedAt: new Date().toISOString()
  };

  const receta2 = {
    id: 'rec_smoothie_pro',
    createdByUserId: ana.id,
    createdByName: 'Ana García',
    isShared: true,
    name: 'Batido Proteico de Avena, Plátano y Canela',
    description: 'Desayuno rápido rico en fibra y proteína limpia.',
    servings: 1,
    ingredients: [
      {
        foodId: 1050,
        name: 'AVENA EN HOJUELAS',
        quantity: 0.5,
        unit: 'cup',
        grams: 40,
        macros: { kcal: 156, protein: 5.2, carbs: 26.8, fat: 2.8, fiber: 4 }
      },
      {
        foodId: 1715,
        name: 'PLATANO / BANANA',
        quantity: 1,
        unit: 'piece',
        grams: 110,
        macros: { kcal: 98, protein: 1.2, carbs: 25.1, fat: 0.3, fiber: 2.9 }
      },
      {
        foodId: 1420,
        name: 'LECHE DESCREMADA',
        quantity: 250,
        unit: 'ml',
        grams: 250,
        macros: { kcal: 85, protein: 8.5, carbs: 12.2, fat: 0.5, fiber: 0 }
      }
    ],
    totalMacros: { kcal: 339, protein: 14.9, carbs: 64.1, fat: 3.6, fiber: 6.9 },
    servingMacros: { kcal: 339, protein: 14.9, carbs: 64.1, fat: 3.6, fiber: 6.9 },
    updatedAt: new Date().toISOString()
  };

  await putItem('recipes', receta1);
  await putItem('recipes', receta2);

  // Registro de comidas de hoy y ayer para Carlos y Ana
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const dayBefore = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];

  // Logs para Carlos hoy
  await saveMealLog({
    userId: carlos.id,
    date: today,
    mealType: 'breakfast',
    foodName: 'HUEVO, ENTERO, REVUELTO',
    quantity: 3,
    unit: 'piece',
    grams: 150,
    macros: { kcal: 224, protein: 18.2, carbs: 1.2, fat: 16.5, fiber: 0 }
  });
  await saveMealLog({
    userId: carlos.id,
    date: today,
    mealType: 'breakfast',
    foodName: 'TORTILLA DE MAIZ',
    quantity: 2,
    unit: 'piece',
    grams: 60,
    macros: { kcal: 130, protein: 3.4, carbs: 27, fat: 1.4, fiber: 3.6 }
  });
  await saveMealLog({
    userId: carlos.id,
    date: today,
    mealType: 'lunch',
    foodName: 'Bowl Power de Pechuga y Arroz con Aguacate (1 porción)',
    isRecipe: true,
    recipeId: receta1.id,
    quantity: 1,
    unit: 'piece',
    grams: 390,
    macros: { kcal: 578, protein: 52.6, carbs: 55.9, fat: 14.8, fiber: 4.7 }
  });
  await saveMealLog({
    userId: carlos.id,
    date: today,
    mealType: 'snack',
    foodName: 'MANZANA, FRESCA',
    quantity: 1,
    unit: 'piece',
    grams: 160,
    macros: { kcal: 83, protein: 0.4, carbs: 22, fat: 0.3, fiber: 3.8 }
  });

  // Estadísticas diarias de Carlos hoy
  await saveDailyStats({
    userId: carlos.id,
    date: today,
    waterMl: 2250,
    weight: 82.2,
    notes: 'Entrenamiento de pierna completado y buena energía.'
  });

  // Estadísticas de Carlos ayer y antier (para racha y gráfica de peso)
  await saveDailyStats({
    userId: carlos.id,
    date: yesterday,
    waterMl: 3000,
    weight: 82.5,
    notes: 'Objetivo de agua alcanzado.'
  });
  await saveMealLog({
    userId: carlos.id,
    date: yesterday,
    mealType: 'lunch',
    foodName: 'POLLO, PECHUGA A LA PLANCHA',
    quantity: 250,
    unit: 'g',
    grams: 250,
    macros: { kcal: 412, protein: 77.5, carbs: 0, fat: 9, fiber: 0 }
  });
  await saveDailyStats({
    userId: carlos.id,
    date: dayBefore,
    waterMl: 2750,
    weight: 82.7,
    notes: 'Inicio de semana motivado.'
  });
  await saveMealLog({
    userId: carlos.id,
    date: dayBefore,
    mealType: 'lunch',
    foodName: 'SALMON, FILETE COCIDO',
    quantity: 200,
    unit: 'g',
    grams: 200,
    macros: { kcal: 412, protein: 44, carbs: 0, fat: 24, fiber: 0 }
  });

  // Datos para Ana
  await saveMealLog({
    userId: ana.id,
    date: today,
    mealType: 'breakfast',
    foodName: 'Batido Proteico de Avena, Plátano y Canela',
    isRecipe: true,
    recipeId: receta2.id,
    quantity: 1,
    unit: 'piece',
    grams: 400,
    macros: { kcal: 339, protein: 14.9, carbs: 64.1, fat: 3.6, fiber: 6.9 }
  });
  await saveMealLog({
    userId: ana.id,
    date: today,
    mealType: 'lunch',
    foodName: 'ATUN EN AGUA, DRENADO',
    quantity: 140,
    unit: 'g',
    grams: 140,
    macros: { kcal: 162, protein: 35.7, carbs: 0, fat: 1.1, fiber: 0 }
  });
  await saveDailyStats({
    userId: ana.id,
    date: today,
    waterMl: 2000,
    weight: 58.1,
    notes: 'Sesión de Pilates y 10k pasos.'
  });
  await saveDailyStats({
    userId: ana.id,
    date: yesterday,
    waterMl: 2500,
    weight: 58.3,
    notes: 'Descanso activo.'
  });
  await saveMealLog({
    userId: ana.id,
    date: yesterday,
    mealType: 'lunch',
    foodName: 'ENSALADA CON PECHUGA Y QUINOA',
    quantity: 350,
    unit: 'g',
    grams: 350,
    macros: { kcal: 420, protein: 38, carbs: 42, fat: 10, fiber: 7 }
  });

  console.log('Semilla completada exitosamente.');
}
