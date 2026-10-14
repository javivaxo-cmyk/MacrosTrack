/**
 * diary-view.js - Vista de seguimiento diario por usuario
 * Resumen de macros, desglose por comidas, hidratación, peso y agregado rápido de alimentos.
 */

import { getLogsForUserAndDate, saveMealLog, removeMealLog, getDailyStats, saveDailyStats } from '../db.js';
import { searchFoods, getFoodById, createAndSaveCustomFood } from '../food-service.js';
import { UNITS, convertToGrams, calculateItemMacros, formatAmount } from '../units.js';
import { renderMacroRing, renderMacroBars } from '../components/charts.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const MEAL_TYPES = [
  { id: 'breakfast', name: 'Desayuno', icon: '🌅' },
  { id: 'lunch', name: 'Comida / Almuerzo', icon: '🥗' },
  { id: 'dinner', name: 'Cena', icon: '🌙' },
  { id: 'snack', name: 'Snacks y Colaciones', icon: '🍎' }
];

export async function renderDiaryView(container, activeUser, selectedDateStr, onDateChange, onUserChange) {
  if (!activeUser) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👤</span>
        <h2>No hay usuario seleccionado</h2>
        <p>Crea o selecciona un perfil para ver su diario.</p>
      </div>
    `;
    return;
  }

  // Cargar logs y estadísticas del día
  const logs = await getLogsForUserAndDate(activeUser.id, selectedDateStr);
  const dailyStats = await getDailyStats(activeUser.id, selectedDateStr);

  // Calcular totales del día
  const dailyTotals = logs.reduce(
    (acc, log) => {
      acc.kcal += log.macros?.kcal || 0;
      acc.protein += log.macros?.protein || 0;
      acc.carbs += log.macros?.carbs || 0;
      acc.fat += log.macros?.fat || 0;
      acc.fiber += log.macros?.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  // Formato legible de fecha
  const isToday = selectedDateStr === new Date().toISOString().split('T')[0];
  const dateObj = new Date(selectedDateStr + 'T00:00:00');
  const dateFormatted = dateObj.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  container.innerHTML = `
    <div class="diary-view-layout">
      <!-- Barra superior: Selector de Fecha y Usuario Activo -->
      <section class="date-user-bar card-glass">
        <div class="user-pill-tag" id="diaryUserSwitcher" title="Cambiar usuario">
          <span class="user-pill-avatar" style="background-color: ${activeUser.color || '#10b981'};">${activeUser.avatar || '👤'}</span>
          <span class="user-pill-name">${activeUser.name}</span>
          <span class="user-pill-chevron">▾</span>
        </div>

        <div class="date-navigator">
          <button class="btn-icon" id="btnPrevDay" title="Día anterior">‹</button>
          <div class="date-picker-wrap">
            <span class="date-display-text">${isToday ? 'Hoy, ' : ''}${dateFormatted}</span>
            <input type="date" id="diaryDatePicker" value="${selectedDateStr}" class="hidden-date-input" />
          </div>
          <button class="btn-icon" id="btnNextDay" title="Día siguiente">›</button>
          ${!isToday ? `<button class="btn-sm btn-subtle" id="btnGoToday">Hoy</button>` : ''}
        </div>
      </section>

      <!-- Resumen Principal de Macros y Calorías -->
      <section class="macros-summary-card card-glass">
        <div class="summary-grid">
          <div class="summary-ring-col" id="macroRingContainer">
            <!-- Anillo SVG -->
          </div>
          <div class="summary-bars-col" id="macroBarsContainer">
            <!-- Barras de Proteína, Carbos, Grasas, Fibra -->
          </div>
        </div>
      </section>

      <!-- Mini Trackers: Agua y Peso del Día -->
      <section class="quick-trackers-grid">
        <!-- Tracker de Agua -->
        <div class="tracker-card card-glass">
          <div class="tracker-header">
            <span class="tracker-icon">💧</span>
            <span class="tracker-title">Agua</span>
            <span class="tracker-val" id="waterValDisplay">${dailyStats.waterMl || 0} / ${activeUser.targets?.water || 2500} ml</span>
          </div>
          <div class="macro-track">
            <div class="macro-fill" id="waterProgressFill" style="background-color: #06b6d4; width: ${Math.min(100, Math.round(((dailyStats.waterMl || 0) / (activeUser.targets?.water || 2500)) * 100))}%;"></div>
          </div>
          <div class="tracker-actions">
            <button class="btn-xs btn-outline" id="btnAddWater250">+250ml</button>
            <button class="btn-xs btn-outline" id="btnAddWater500">+500ml</button>
            <button class="btn-xs btn-subtle" id="btnResetWater" title="Restar 250ml">-250ml</button>
          </div>
        </div>

        <!-- Tracker de Peso del Día -->
        <div class="tracker-card card-glass">
          <div class="tracker-header">
            <span class="tracker-icon">⚖️</span>
            <span class="tracker-title">Peso Hoy</span>
            <span class="tracker-val">${dailyStats.weight ? `${dailyStats.weight} kg` : 'Sin registrar'}</span>
          </div>
          <div class="weight-input-row">
            <input type="number" step="0.1" id="inputDailyWeight" placeholder="${activeUser.currentWeight || 70}" value="${dailyStats.weight || ''}" class="form-input form-input-sm" />
            <button class="btn-xs btn-primary" id="btnSaveDailyWeight">Guardar</button>
          </div>
        </div>
      </section>

      <!-- Desglose por Comidas -->
      <section class="meals-list">
        ${MEAL_TYPES.map((meal) => {
          const mealLogs = logs.filter((l) => l.mealType === meal.id);
          const mealKcal = mealLogs.reduce((acc, l) => acc + (l.macros?.kcal || 0), 0);
          const mealProt = mealLogs.reduce((acc, l) => acc + (l.macros?.protein || 0), 0);
          const mealCarb = mealLogs.reduce((acc, l) => acc + (l.macros?.carbs || 0), 0);
          const mealFat = mealLogs.reduce((acc, l) => acc + (l.macros?.fat || 0), 0);

          return `
            <div class="meal-card card-glass" data-meal="${meal.id}">
              <div class="meal-card-header">
                <div class="meal-title-group">
                  <span class="meal-icon">${meal.icon}</span>
                  <div>
                    <h3 class="meal-name">${meal.name}</h3>
                    <span class="meal-macros-sub">
                      <strong>${Math.round(mealKcal)} kcal</strong> • P: ${Math.round(mealProt)}g • C: ${Math.round(mealCarb)}g • G: ${Math.round(mealFat)}g
                    </span>
                  </div>
                </div>
                <button class="btn-sm btn-primary btn-add-food" data-meal="${meal.id}">
                  + Agregar
                </button>
              </div>

              <!-- Lista de Alimentos de esta Comida -->
              <div class="meal-items-list">
                ${
                  mealLogs.length === 0
                    ? `<div class="empty-meal-hint">No hay alimentos registrados en esta comida.</div>`
                    : mealLogs
                        .map(
                          (item) => `
                    <div class="meal-food-item" data-id="${item.id}">
                      <div class="food-item-info">
                        <div class="food-item-name-row">
                          <span class="food-item-name">${item.foodName}</span>
                          ${item.isRecipe ? `<span class="badge-tag badge-recipe">Receta</span>` : ''}
                          ${item.isCustom ? `<span class="badge-tag badge-custom">Personalizado</span>` : ''}
                        </div>
                        <div class="food-item-meta">
                          <span class="food-amount">${formatAmount(item.quantity, item.unit, item.grams)}</span>
                          <span class="food-dots">•</span>
                          <span class="food-macros">
                            <strong>${Math.round(item.macros.kcal)} kcal</strong> (P: ${Math.round(item.macros.protein)}g, C: ${Math.round(item.macros.carbs)}g, G: ${Math.round(item.macros.fat)}g)
                          </span>
                        </div>
                      </div>
                      <div class="food-item-actions">
                        <button class="btn-icon btn-icon-danger btn-delete-food" data-id="${item.id}" title="Eliminar">&times;</button>
                      </div>
                    </div>
                  `
                        )
                        .join('')
                }
              </div>
            </div>
          `;
        }).join('')}
      </section>
    </div>
  `;

  // Renderizar gráficos en sus contenedores
  renderMacroRing(container.querySelector('#macroRingContainer'), {
    consumed: dailyTotals.kcal,
    target: activeUser.targets?.kcal || 2000
  });

  renderMacroBars(container.querySelector('#macroBarsContainer'), {
    macros: dailyTotals,
    targets: activeUser.targets || { protein: 140, carbs: 200, fat: 60, fiber: 25 }
  });

  // Vincular eventos de fecha
  container.querySelector('#btnPrevDay').addEventListener('click', () => {
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    onDateChange(prevDate.toISOString().split('T')[0]);
  });

  container.querySelector('#btnNextDay').addEventListener('click', () => {
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    onDateChange(nextDate.toISOString().split('T')[0]);
  });

  const goTodayBtn = container.querySelector('#btnGoToday');
  if (goTodayBtn) {
    goTodayBtn.addEventListener('click', () => {
      onDateChange(new Date().toISOString().split('T')[0]);
    });
  }

  const dateInput = container.querySelector('#diaryDatePicker');
  dateInput.addEventListener('change', (e) => {
    if (e.target.value) onDateChange(e.target.value);
  });

  // Evento para cambiar de usuario al hacer clic en el pill
  container.querySelector('#diaryUserSwitcher').addEventListener('click', () => {
    if (typeof onUserChange === 'function') onUserChange();
  });

  // Eventos de agua
  const updateWater = async (delta) => {
    const newWater = Math.max(0, (dailyStats.waterMl || 0) + delta);
    dailyStats.waterMl = newWater;
    await saveDailyStats(dailyStats);
    // Actualizar UI
    const targetW = activeUser.targets?.water || 2500;
    container.querySelector('#waterValDisplay').textContent = `${newWater} / ${targetW} ml`;
    container.querySelector('#waterProgressFill').style.width = `${Math.min(100, Math.round((newWater / targetW) * 100))}%`;
    showToast(`Agua actualizada: ${newWater} ml`, 'info', 1500);
  };

  container.querySelector('#btnAddWater250').addEventListener('click', () => updateWater(250));
  container.querySelector('#btnAddWater500').addEventListener('click', () => updateWater(500));
  container.querySelector('#btnResetWater').addEventListener('click', () => updateWater(-250));

  // Evento guardar peso
  container.querySelector('#btnSaveDailyWeight').addEventListener('click', async () => {
    const weightVal = parseFloat(container.querySelector('#inputDailyWeight').value);
    if (!weightVal || weightVal <= 20 || weightVal > 300) {
      showToast('Por favor introduce un peso válido en kg.', 'error');
      return;
    }
    dailyStats.weight = weightVal;
    await saveDailyStats(dailyStats);
    showToast(`Peso del día guardado: ${weightVal} kg`, 'success');
  });

  // Eliminar alimento registrado
  container.querySelectorAll('.btn-delete-food').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const logId = e.currentTarget.dataset.id;
      await removeMealLog(logId);
      showToast('Alimento eliminado', 'info');
      renderDiaryView(container, activeUser, selectedDateStr, onDateChange, onUserChange);
    });
  });

  // Botones para agregar alimento a cada comida
  container.querySelectorAll('.btn-add-food').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const mealType = e.currentTarget.dataset.meal;
      openAddFoodModal({
        mealType,
        activeUser,
        dateStr: selectedDateStr,
        onFoodAdded: () => {
          renderDiaryView(container, activeUser, selectedDateStr, onDateChange, onUserChange);
        }
      });
    });
  });
}

/**
 * Modal interactivo para buscar, medir y agregar alimentos
 */
export function openAddFoodModal({ mealType, activeUser, dateStr, onFoodAdded }) {
  const mealObj = MEAL_TYPES.find((m) => m.id === mealType) || MEAL_TYPES[0];

  const modalHtml = `
    <div class="add-food-sheet-content">
      <!-- Buscador -->
      <div class="search-bar-wrap">
        <span class="search-bar-icon">🔍</span>
        <input type="text" id="foodSearchInput" class="form-input search-input" placeholder="Buscar alimento (ej. pollo, arroz, huevo, avena)..." autofocus autocomplete="off" />
        <button type="button" id="btnClearSearch" class="btn-clear-input" style="display:none;">&times;</button>
      </div>

      <!-- Filtros rápidos por Categorías -->
      <div class="category-chips-scroll" id="catChipsContainer">
        <button class="chip active" data-cat="all">Todos</button>
        <button class="chip" data-cat="custom">Mis Alimentos</button>
        <button class="chip" data-cat="meats">🥩 Carnes</button>
        <button class="chip" data-cat="fish">🐟 Pescados</button>
        <button class="chip" data-cat="eggs">🥚 Huevos</button>
        <button class="chip" data-cat="dairy">🧀 Lácteos</button>
        <button class="chip" data-cat="grains">🌾 Cereales</button>
        <button class="chip" data-cat="fruits">🍎 Frutas</button>
        <button class="chip" data-cat="vegetables">🥦 Verduras</button>
        <button class="chip" data-cat="fats">🫒 Grasas</button>
      </div>

      <!-- Botón para crear alimento nuevo si no está en BD -->
      <div class="create-custom-prompt">
        <span>¿No encuentras el alimento?</span>
        <button type="button" class="btn-link" id="btnOpenCreateCustom">+ Crear alimento nuevo</button>
      </div>

      <!-- Resultados de búsqueda -->
      <div class="food-results-container" id="foodResultsList">
        <div class="loading-spinner">Cargando base de datos...</div>
      </div>

      <!-- Panel de Selección y Medición (Oculto hasta seleccionar un alimento) -->
      <div class="food-measure-panel" id="foodMeasurePanel" style="display: none;">
        <div class="selected-food-header">
          <div class="selected-title-group">
            <h4 id="selectedFoodName" class="selected-food-title"></h4>
            <span class="badge-tag" id="selectedFoodBadge">BD</span>
          </div>
          <button type="button" class="btn-xs btn-subtle" id="btnBackToResults">Cambiar</button>
        </div>

        <div class="measure-form-grid">
          <div class="form-group">
            <label class="form-label">Cantidad</label>
            <div class="stepper-wrap">
              <button type="button" class="stepper-btn" id="btnStepMinus">-</button>
              <input type="number" step="any" min="0.1" id="inputQuantity" class="form-input form-input-lg" value="100" />
              <button type="button" class="stepper-btn" id="btnStepPlus">+</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Unidad de Medida</label>
            <select id="selectUnit" class="form-select form-input-lg">
              ${Object.values(UNITS).map((u) => `<option value="${u.key}">${u.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Si la unidad es 'piece', permitir peso estimado por pieza -->
        <div class="form-group" id="pieceWeightRow" style="display: none;">
          <label class="form-label">Peso por pieza / porción (gramos)</label>
          <input type="number" id="inputPieceWeight" class="form-input" value="100" min="1" />
        </div>

        <!-- Cálculo en vivo de macros -->
        <div class="live-macros-preview" id="liveMacrosPreview">
          <div class="preview-kcal">
            <span class="preview-val" id="prevKcal">0</span>
            <span class="preview-lbl">kcal</span>
          </div>
          <div class="preview-macros-row">
            <div class="prev-m-item"><span class="prev-m-val" id="prevProt">0g</span><span class="prev-m-name">Proteína</span></div>
            <div class="prev-m-item"><span class="prev-m-val" id="prevCarb">0g</span><span class="prev-m-name">Carbos</span></div>
            <div class="prev-m-item"><span class="prev-m-val" id="prevFat">0g</span><span class="prev-m-name">Grasa</span></div>
            <div class="prev-m-item"><span class="prev-m-val" id="prevFiber">0g</span><span class="prev-m-name">Fibra</span></div>
          </div>
        </div>

        <div class="measure-actions">
          <button type="button" class="btn btn-secondary" id="btnCancelMeasure">Cancelar</button>
          <button type="button" class="btn btn-primary btn-block" id="btnConfirmAddFood">
            Agregar a ${mealObj.name}
          </button>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: `Agregar a ${mealObj.name}`,
    subtitle: `Registra alimento para el ${dateStr}`,
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const searchInput = sheet.querySelector('#foodSearchInput');
      const clearSearchBtn = sheet.querySelector('#btnClearSearch');
      const resultsList = sheet.querySelector('#foodResultsList');
      const catChips = sheet.querySelectorAll('.chip');
      const measurePanel = sheet.querySelector('#foodMeasurePanel');
      const createCustomBtn = sheet.querySelector('#btnOpenCreateCustom');

      let currentCategory = 'all';
      let selectedFood = null;

      // Renderizar resultados de búsqueda
      const updateResults = (query = searchInput.value) => {
        const isCustomOnly = currentCategory === 'custom';
        const catFilter = isCustomOnly ? 'all' : currentCategory;
        const results = searchFoods(query, { categoryId: catFilter, customOnly: isCustomOnly, limit: 35 });

        if (results.length === 0) {
          resultsList.innerHTML = `
            <div class="no-results-box">
              <p>No se encontraron alimentos con "<strong>${query}</strong>".</p>
              <button type="button" class="btn btn-sm btn-outline mt-2" id="btnQuickCreateFood">+ Crear este alimento ahora</button>
            </div>
          `;
          const quickBtn = resultsList.querySelector('#btnQuickCreateFood');
          if (quickBtn) {
            quickBtn.addEventListener('click', () => {
              openCreateCustomFoodModal({
                initialName: query,
                activeUser,
                onCreated: (newFood) => {
                  chooseFood(newFood);
                }
              });
            });
          }
          return;
        }

        resultsList.innerHTML = results
          .map((item) => {
            return `
            <div class="food-result-card" data-id="${item.id}">
              <div class="food-result-main">
                <span class="food-result-name">${item.name}</span>
                <div class="food-result-macros">
                  <strong>${Math.round(item.macros.kcal)} kcal</strong> • P: ${item.macros.protein}g • C: ${item.macros.carbs}g • G: ${item.macros.fat}g (por 100g)
                </div>
              </div>
              <div class="food-result-badge-wrap">
                ${item.isCustom ? `<span class="badge-tag badge-custom">Personalizado</span>` : `<span class="badge-tag">${item.category?.icon || '🍽️'}</span>`}
              </div>
            </div>
          `;
          })
          .join('');

        // Clic en un resultado
        resultsList.querySelectorAll('.food-result-card').forEach((card) => {
          card.addEventListener('click', () => {
            const foodId = card.dataset.id;
            const item = getFoodById(foodId);
            if (item) chooseFood(item);
          });
        });
      };

      // Inicializar lista
      updateResults('');

      // Input de búsqueda en vivo
      searchInput.addEventListener('input', (e) => {
        clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
        updateResults(e.target.value);
      });

      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        updateResults('');
      });

      // Filtros por chips
      catChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          catChips.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          currentCategory = chip.dataset.cat;
          updateResults(searchInput.value);
        });
      });

      // Crear alimento personalizado
      createCustomBtn.addEventListener('click', () => {
        openCreateCustomFoodModal({
          initialName: searchInput.value,
          activeUser,
          onCreated: (newFood) => {
            chooseFood(newFood);
          }
        });
      });

      // Seleccionar alimento y abrir panel de medición
      const chooseFood = (food) => {
        selectedFood = food;
        sheet.querySelector('.search-bar-wrap').style.display = 'none';
        sheet.querySelector('#catChipsContainer').style.display = 'none';
        sheet.querySelector('.create-custom-prompt').style.display = 'none';
        resultsList.style.display = 'none';
        measurePanel.style.display = 'block';

        sheet.querySelector('#selectedFoodName').textContent = food.name;
        sheet.querySelector('#selectedFoodBadge').textContent = food.isCustom ? 'Personalizado' : (food.category?.name || 'BD');

        const unitSelect = sheet.querySelector('#selectUnit');
        const qtyInput = sheet.querySelector('#inputQuantity');
        const pieceWeightRow = sheet.querySelector('#pieceWeightRow');
        const pieceWeightInput = sheet.querySelector('#inputPieceWeight');

        // Valores sugeridos por defecto
        if (food.servingSizeGrams && food.servingUnitName) {
          unitSelect.value = 'piece';
          pieceWeightInput.value = food.servingSizeGrams;
          qtyInput.value = 1;
        } else {
          unitSelect.value = 'g';
          qtyInput.value = 100;
        }

        pieceWeightRow.style.display = unitSelect.value === 'piece' ? 'block' : 'none';

        // Actualizar macros en tiempo real
        const refreshLiveMacros = () => {
          const qty = parseFloat(qtyInput.value) || 0;
          const uKey = unitSelect.value;
          const pieceG = parseFloat(pieceWeightInput.value) || 100;

          const calculated = calculateItemMacros(selectedFood.macros, qty, uKey, pieceG);

          sheet.querySelector('#prevKcal').textContent = Math.round(calculated.macros.kcal);
          sheet.querySelector('#prevProt').textContent = `${calculated.macros.protein}g`;
          sheet.querySelector('#prevCarb').textContent = `${calculated.macros.carbs}g`;
          sheet.querySelector('#prevFat').textContent = `${calculated.macros.fat}g`;
          sheet.querySelector('#prevFiber').textContent = `${calculated.macros.fiber}g`;
        };

        refreshLiveMacros();

        qtyInput.oninput = refreshLiveMacros;
        unitSelect.onchange = () => {
          const uDef = UNITS[unitSelect.value];
          qtyInput.value = uDef?.defaultQty || 1;
          pieceWeightRow.style.display = unitSelect.value === 'piece' ? 'block' : 'none';
          refreshLiveMacros();
        };
        pieceWeightInput.oninput = refreshLiveMacros;

        sheet.querySelector('#btnStepMinus').onclick = () => {
          const uDef = UNITS[unitSelect.value];
          const step = uDef?.step || 1;
          const cur = parseFloat(qtyInput.value) || 0;
          qtyInput.value = Math.max(step, Math.round((cur - step) * 10) / 10);
          refreshLiveMacros();
        };

        sheet.querySelector('#btnStepPlus').onclick = () => {
          const uDef = UNITS[unitSelect.value];
          const step = uDef?.step || 1;
          const cur = parseFloat(qtyInput.value) || 0;
          qtyInput.value = Math.round((cur + step) * 10) / 10;
          refreshLiveMacros();
        };

        // Confirmar agregar alimento
        sheet.querySelector('#btnConfirmAddFood').onclick = async () => {
          const qty = parseFloat(qtyInput.value) || 0;
          if (qty <= 0) {
            showToast('Ingresa una cantidad mayor a cero', 'error');
            return;
          }

          const uKey = unitSelect.value;
          const pieceG = parseFloat(pieceWeightInput.value) || 100;
          const calculated = calculateItemMacros(selectedFood.macros, qty, uKey, pieceG);

          await saveMealLog({
            userId: activeUser.id,
            date: dateStr,
            mealType,
            foodId: selectedFood.id,
            foodName: selectedFood.name,
            isCustom: selectedFood.isCustom || false,
            quantity: qty,
            unit: uKey,
            grams: calculated.grams,
            macros: calculated.macros
          });

          showToast(`${selectedFood.name} agregado a ${mealObj.name}`, 'success');
          close();
          if (typeof onFoodAdded === 'function') onFoodAdded();
        };

        // Volver a resultados
        sheet.querySelector('#btnBackToResults').onclick = () => {
          measurePanel.style.display = 'none';
          sheet.querySelector('.search-bar-wrap').style.display = 'flex';
          sheet.querySelector('#catChipsContainer').style.display = 'flex';
          sheet.querySelector('.create-custom-prompt').style.display = 'flex';
          resultsList.style.display = 'block';
        };

        sheet.querySelector('#btnCancelMeasure').onclick = () => {
          sheet.querySelector('#btnBackToResults').click();
        };
      };
    }
  });
}

/**
 * Modal para crear un nuevo alimento personalizado
 */
export function openCreateCustomFoodModal({ initialName = '', activeUser, onCreated }) {
  const modalHtml = `
    <form id="createCustomFoodForm" class="custom-food-form">
      <div class="form-group">
        <label class="form-label">Nombre del Alimento *</label>
        <input type="text" id="custFoodName" class="form-input" required value="${initialName}" placeholder="Ej. Barrita de Proteína, Galleta de Avena Casera..." />
      </div>

      <div class="form-group">
        <label class="form-label">Marca o Detalle (opcional)</label>
        <input type="text" id="custFoodBrand" class="form-input" placeholder="Ej. Kirkland, Casero, Bimbo..." />
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Porción de referencia (g)</label>
          <input type="number" id="custServingSize" class="form-input" value="100" min="1" step="any" />
          <small class="form-hint">Escribe los macros para esta cantidad</small>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre de la porción</label>
          <input type="text" id="custServingName" class="form-input" value="1 porción" placeholder="Ej. 1 pieza, 1 scoop..." />
        </div>
      </div>

      <div class="macros-input-box">
        <h5 class="macros-input-title">Información Nutricional (por porción indicada)</h5>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Calorías (kcal) *</label>
            <input type="number" id="custKcal" class="form-input" required min="0" step="any" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Proteína (g) *</label>
            <input type="number" id="custProt" class="form-input" required min="0" step="any" placeholder="0" />
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Carbohidratos (g) *</label>
            <input type="number" id="custCarb" class="form-input" required min="0" step="any" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Grasas (g) *</label>
            <input type="number" id="custFat" class="form-input" required min="0" step="any" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Fibra (g)</label>
            <input type="number" id="custFiber" class="form-input" min="0" step="any" placeholder="0" />
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="custIsGlobal" checked />
          <span>Disponible para todos los usuarios de la app</span>
        </label>
      </div>

      <div class="form-actions mt-3">
        <button type="submit" class="btn btn-primary btn-block">Guardar Alimento</button>
      </div>
    </form>
  `;

  openModal({
    title: 'Crear Alimento Nuevo',
    subtitle: 'Agrega un alimento que no se encuentre en la BD oficial',
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const form = sheet.querySelector('#createCustomFoodForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = sheet.querySelector('#custFoodName').value.trim();
        const brand = sheet.querySelector('#custFoodBrand').value.trim();
        const servingSize = parseFloat(sheet.querySelector('#custServingSize').value) || 100;
        const servingName = sheet.querySelector('#custServingName').value.trim() || '1 porción';
        const isGlobal = sheet.querySelector('#custIsGlobal').checked;

        const rawKcal = parseFloat(sheet.querySelector('#custKcal').value) || 0;
        const rawProt = parseFloat(sheet.querySelector('#custProt').value) || 0;
        const rawCarb = parseFloat(sheet.querySelector('#custCarb').value) || 0;
        const rawFat = parseFloat(sheet.querySelector('#custFat').value) || 0;
        const rawFiber = parseFloat(sheet.querySelector('#custFiber').value) || 0;

        // Convertir macros a base 100g para estandarización interna
        const ratio100 = 100 / servingSize;
        const baseMacros = {
          kcal: Math.round(rawKcal * ratio100 * 10) / 10,
          protein: Math.round(rawProt * ratio100 * 10) / 10,
          carbs: Math.round(rawCarb * ratio100 * 10) / 10,
          fat: Math.round(rawFat * ratio100 * 10) / 10,
          fiber: Math.round(rawFiber * ratio100 * 10) / 10
        };

        const newFood = await createAndSaveCustomFood(
          {
            name: brand ? `${name} (${brand})` : name,
            brand,
            isGlobal,
            servingSizeGrams: servingSize,
            servingUnitName: servingName,
            macros: baseMacros
          },
          activeUser.id
        );

        showToast(`Alimento "${newFood.name}" guardado exitosamente`, 'success');
        close();
        if (typeof onCreated === 'function') onCreated(newFood);
      });
    }
  });
}
