/**
 * recipes-view.js - Vista de recetas y platillos propios por usuario
 * Creación, cálculo automático por porción, ingredientes dinámicos,
 * opción de compartir entre usuarios y registro directo al diario.
 */

import { getAllRecipes, saveRecipe, removeRecipe, saveMealLog } from '../db.js';
import { searchFoods, getFoodById } from '../food-service.js';
import { UNITS, calculateItemMacros, formatAmount } from '../units.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderRecipesView(container, activeUser, onGoToDiary) {
  if (!activeUser) {
    container.innerHTML = `<div class="empty-state"><h2>Inicia sesión con un usuario</h2></div>`;
    return;
  }

  const recipes = await getAllRecipes(activeUser.id);

  container.innerHTML = `
    <div class="recipes-view-layout">
      <!-- Encabezado de Recetas -->
      <section class="recipes-header card-glass">
        <div class="recipes-title-group">
          <div class="icon-circle">🍲</div>
          <div>
            <h2 class="view-title">Recetas y Platillos</h2>
            <p class="view-subtitle">Crea preparaciones compuestas, calcula porciones y compártelas con tu grupo</p>
          </div>
        </div>

        <button class="btn btn-primary" id="btnCreateRecipe">
          + Nueva Receta
        </button>
      </section>

      <!-- Filtros de Recetas -->
      <div class="recipe-filters-bar">
        <button class="tab-pill active" data-filter="all">Todas (${recipes.length})</button>
        <button class="tab-pill" data-filter="mine">Mis Recetas</button>
        <button class="tab-pill" data-filter="shared">Compartidas 🌐</button>
      </div>

      <!-- Lista de Recetas -->
      <section class="recipes-grid" id="recipesGridContainer">
        ${
          recipes.length === 0
            ? `
          <div class="empty-state card-glass">
            <span class="empty-icon">🍳</span>
            <h3>No hay recetas aún</h3>
            <p>Crea tu primera receta casera para registrar tus platillos en un solo toque.</p>
            <button class="btn btn-primary mt-2" id="btnEmptyCreateRecipe">+ Crear Receta</button>
          </div>
        `
            : ''
        }
      </section>
    </div>
  `;

  // Renderizar tarjetas de recetas según filtro
  function renderRecipeCards(filter = 'all') {
    const grid = container.querySelector('#recipesGridContainer');
    let filtered = recipes;
    if (filter === 'mine') {
      filtered = recipes.filter((r) => r.createdByUserId === activeUser.id);
    } else if (filter === 'shared') {
      filtered = recipes.filter((r) => r.isShared);
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state card-glass">
          <p>No se encontraron recetas con este filtro.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map((rec) => {
        const isMine = rec.createdByUserId === activeUser.id;
        const perServ = rec.servingMacros || { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

        return `
        <div class="recipe-card card-glass" data-id="${rec.id}">
          <div class="recipe-card-top">
            <div>
              <div class="recipe-badges-row">
                ${rec.isShared ? `<span class="badge-tag badge-shared">🌐 Compartida</span>` : `<span class="badge-tag">🔒 Privada</span>`}
                <span class="badge-tag badge-servings">${rec.servings} ${rec.servings === 1 ? 'porción' : 'porciones'}</span>
              </div>
              <h3 class="recipe-card-title">${rec.name}</h3>
              <p class="recipe-card-author">Por <strong>${rec.createdByName || 'Usuario'}</strong></p>
            </div>
            ${
              isMine
                ? `
              <div class="recipe-card-menu">
                <button class="btn-icon btn-edit-recipe" data-id="${rec.id}" title="Editar receta">✏️</button>
                <button class="btn-icon btn-icon-danger btn-delete-recipe" data-id="${rec.id}" title="Eliminar receta">&times;</button>
              </div>
            `
                : ''
            }
          </div>

          ${rec.description ? `<p class="recipe-card-desc">${rec.description}</p>` : ''}

          <!-- Macros por Porción -->
          <div class="recipe-macros-box">
            <span class="recipe-macros-title">Por porción (${Math.round(perServ.kcal)} kcal):</span>
            <div class="recipe-macros-pills">
              <span class="macro-pill p-prot">P: ${perServ.protein}g</span>
              <span class="macro-pill p-carb">C: ${perServ.carbs}g</span>
              <span class="macro-pill p-fat">G: ${perServ.fat}g</span>
              <span class="macro-pill p-fib">Fib: ${perServ.fiber || 0}g</span>
            </div>
          </div>

          <!-- Acordeón de Ingredientes -->
          <details class="recipe-ingredients-dropdown">
            <summary class="ingredients-summary">
              Ver ${rec.ingredients?.length || 0} ingredientes
            </summary>
            <ul class="ingredients-list">
              ${(rec.ingredients || [])
                .map(
                  (ing) => `
                <li>
                  <span class="ing-name">• ${ing.name}</span>
                  <span class="ing-qty">${formatAmount(ing.quantity, ing.unit, ing.grams)}</span>
                </li>
              `
                )
                .join('')}
            </ul>
          </details>

          <!-- Acciones de la Receta -->
          <div class="recipe-card-footer">
            <button class="btn btn-primary btn-block btn-log-recipe" data-id="${rec.id}">
              🍽️ Registrar en mi Diario
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Evento registrar receta en el diario
    grid.querySelectorAll('.btn-log-recipe').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const recId = e.currentTarget.dataset.id;
        const recipe = recipes.find((r) => r.id === recId);
        if (recipe) {
          openLogRecipeToDiaryModal(recipe, activeUser, onGoToDiary);
        }
      });
    });

    // Evento editar receta
    grid.querySelectorAll('.btn-edit-recipe').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const recId = e.currentTarget.dataset.id;
        const recipe = recipes.find((r) => r.id === recId);
        if (recipe) {
          openRecipeEditorModal({
            recipe,
            activeUser,
            onSaved: () => renderRecipesView(container, activeUser, onGoToDiary)
          });
        }
      });
    });

    // Evento eliminar receta
    grid.querySelectorAll('.btn-delete-recipe').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const recId = e.currentTarget.dataset.id;
        if (confirm('¿Deseas eliminar esta receta?')) {
          await removeRecipe(recId);
          showToast('Receta eliminada', 'info');
          renderRecipesView(container, activeUser, onGoToDiary);
        }
      });
    });
  }

  // Vincular tabs de filtro
  container.querySelectorAll('.tab-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.tab-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      renderRecipeCards(pill.dataset.filter);
    });
  });

  // Botón nueva receta
  const bindCreateBtn = (selector) => {
    const btn = container.querySelector(selector);
    if (btn) {
      btn.addEventListener('click', () => {
        openRecipeEditorModal({
          activeUser,
          onSaved: () => renderRecipesView(container, activeUser, onGoToDiary)
        });
      });
    }
  };

  bindCreateBtn('#btnCreateRecipe');
  bindCreateBtn('#btnEmptyCreateRecipe');

  renderRecipeCards('all');
}

/**
 * Modal para registrar una receta al diario
 */
function openLogRecipeToDiaryModal(recipe, activeUser, onGoToDiary) {
  const todayStr = new Date().toISOString().split('T')[0];

  const modalHtml = `
    <div class="log-recipe-modal">
      <div class="log-recipe-preview card-glass">
        <h4>${recipe.name}</h4>
        <p>Macros por porción: <strong>${Math.round(recipe.servingMacros.kcal)} kcal</strong> (P: ${recipe.servingMacros.protein}g, C: ${recipe.servingMacros.carbs}g, G: ${recipe.servingMacros.fat}g)</p>
      </div>

      <div class="form-group mt-3">
        <label class="form-label">¿A qué comida del día?</label>
        <select id="logRecMealType" class="form-select form-input-lg">
          <option value="lunch" selected>🥗 Comida / Almuerzo</option>
          <option value="breakfast">🌅 Desayuno</option>
          <option value="dinner">🌙 Cena</option>
          <option value="snack">🍎 Snack / Colación</option>
        </select>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Porciones consumidas</label>
          <input type="number" id="logRecServings" class="form-input form-input-lg" value="1" min="0.25" step="0.25" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" id="logRecDate" class="form-input form-input-lg" value="${todayStr}" />
        </div>
      </div>

      <div class="live-macros-preview mt-3">
        <div class="preview-kcal">
          <span class="preview-val" id="logRecPreviewKcal">${Math.round(recipe.servingMacros.kcal)}</span>
          <span class="preview-lbl">kcal a registrar</span>
        </div>
      </div>

      <div class="form-actions mt-4">
        <button type="button" class="btn btn-primary btn-block" id="btnConfirmLogRecipe">
          Registrar en Diario
        </button>
      </div>
    </div>
  `;

  openModal({
    title: 'Registrar Platillo en Diario',
    subtitle: recipe.name,
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const servingsInput = sheet.querySelector('#logRecServings');
      const previewKcal = sheet.querySelector('#logRecPreviewKcal');
      const mealSelect = sheet.querySelector('#logRecMealType');
      const dateInput = sheet.querySelector('#logRecDate');

      servingsInput.addEventListener('input', () => {
        const serv = parseFloat(servingsInput.value) || 0;
        previewKcal.textContent = Math.round(recipe.servingMacros.kcal * serv);
      });

      sheet.querySelector('#btnConfirmLogRecipe').addEventListener('click', async () => {
        const serv = parseFloat(servingsInput.value) || 1;
        if (serv <= 0) {
          showToast('Introduce un número válido de porciones', 'error');
          return;
        }

        const meal = mealSelect.value;
        const targetDate = dateInput.value || todayStr;

        const scaledMacros = {
          kcal: Math.round(recipe.servingMacros.kcal * serv * 10) / 10,
          protein: Math.round(recipe.servingMacros.protein * serv * 10) / 10,
          carbs: Math.round(recipe.servingMacros.carbs * serv * 10) / 10,
          fat: Math.round(recipe.servingMacros.fat * serv * 10) / 10,
          fiber: Math.round((recipe.servingMacros.fiber || 0) * serv * 10) / 10
        };

        await saveMealLog({
          userId: activeUser.id,
          date: targetDate,
          mealType: meal,
          foodName: `${recipe.name} (${serv} porc)`,
          isRecipe: true,
          recipeId: recipe.id,
          quantity: serv,
          unit: 'piece',
          grams: Math.round(150 * serv),
          macros: scaledMacros
        });

        showToast(`Platillo registrado en tu diario`, 'success');
        close();
        if (typeof onGoToDiary === 'function') onGoToDiary(targetDate);
      });
    }
  });
}

/**
 * Editor / Creador interactivo de recetas
 */
export function openRecipeEditorModal({ recipe = null, activeUser, onSaved }) {
  const isEditing = !!recipe;
  let currentIngredients = recipe ? JSON.parse(JSON.stringify(recipe.ingredients || [])) : [];

  const modalHtml = `
    <div class="recipe-editor-wrap">
      <div class="form-group">
        <label class="form-label">Nombre del Platillo o Receta *</label>
        <input type="text" id="recipeNameInput" class="form-input form-input-lg" placeholder="Ej. Pollo Teriyaki con Brócoli y Arroz" value="${recipe?.name || ''}" required />
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Porciones totales de la preparación</label>
          <input type="number" id="recipeServingsInput" class="form-input" min="1" step="1" value="${recipe?.servings || 2}" />
        </div>
        <div class="form-group">
          <label class="form-label">Visibilidad</label>
          <label class="checkbox-label mt-2">
            <input type="checkbox" id="recipeIsShared" ${recipe?.isShared !== false ? 'checked' : ''} />
            <span>Compartir con todos los perfiles 🌐</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Instrucciones o notas de preparación (opcional)</label>
        <textarea id="recipeDescInput" class="form-input" rows="2" placeholder="Ej. Cocinar pechuga en sartén, agregar salsa y servir con arroz...">${recipe?.description || ''}</textarea>
      </div>

      <!-- Gestor de Ingredientes -->
      <div class="recipe-ingredients-manager card-glass">
        <div class="rim-header">
          <h4 class="rim-title">Ingredientes de la Receta</h4>
          <button type="button" class="btn-xs btn-primary" id="btnOpenAddIngredient">+ Agregar Ingrediente</button>
        </div>

        <div class="rim-list" id="recipeIngredientsList">
          <!-- Ingredientes actuales -->
        </div>

        <!-- Calculadora de Totales y Porción -->
        <div class="rim-totals" id="recipeTotalsBox">
          <!-- Totales calculados en vivo -->
        </div>
      </div>

      <div class="form-actions mt-4">
        <button type="button" class="btn btn-secondary" id="btnCancelRecipe">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btnSaveRecipe">
          ${isEditing ? 'Guardar Cambios' : 'Crear Receta'}
        </button>
      </div>
    </div>
  `;

  openModal({
    title: isEditing ? 'Editar Receta' : 'Crear Nueva Receta',
    subtitle: `Creada por ${activeUser.name}`,
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const nameInput = sheet.querySelector('#recipeNameInput');
      const servingsInput = sheet.querySelector('#recipeServingsInput');
      const isSharedInput = sheet.querySelector('#recipeIsShared');
      const descInput = sheet.querySelector('#recipeDescInput');
      const ingListEl = sheet.querySelector('#recipeIngredientsList');
      const totalsBoxEl = sheet.querySelector('#recipeTotalsBox');
      const addIngBtn = sheet.querySelector('#btnOpenAddIngredient');
      const saveBtn = sheet.querySelector('#btnSaveRecipe');
      const cancelBtn = sheet.querySelector('#btnCancelRecipe');

      // Actualiza lista y cálculos en vivo
      const refreshIngredientsUI = () => {
        const servings = Math.max(1, parseInt(servingsInput.value) || 1);

        if (currentIngredients.length === 0) {
          ingListEl.innerHTML = `<div class="empty-hint">Agrega al menos un ingrediente para calcular los macros.</div>`;
          totalsBoxEl.innerHTML = '';
          return;
        }

        // Renderizar items
        ingListEl.innerHTML = currentIngredients
          .map((ing, idx) => {
            return `
            <div class="rim-item-row">
              <div class="rim-item-info">
                <span class="rim-item-name">${ing.name}</span>
                <span class="rim-item-sub">${formatAmount(ing.quantity, ing.unit, ing.grams)} • ${Math.round(ing.macros.kcal)} kcal (P: ${ing.macros.protein}g, C: ${ing.macros.carbs}g, G: ${ing.macros.fat}g)</span>
              </div>
              <button type="button" class="btn-icon btn-icon-danger btn-remove-ing" data-idx="${idx}">&times;</button>
            </div>
          `;
          })
          .join('');

        // Clic para eliminar ingrediente
        ingListEl.querySelectorAll('.btn-remove-ing').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            currentIngredients.splice(idx, 1);
            refreshIngredientsUI();
          });
        });

        // Totales de la receta
        const total = currentIngredients.reduce(
          (acc, cur) => {
            acc.kcal += cur.macros.kcal;
            acc.protein += cur.macros.protein;
            acc.carbs += cur.macros.carbs;
            acc.fat += cur.macros.fat;
            acc.fiber += cur.macros.fiber || 0;
            return acc;
          },
          { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        );

        const perServ = {
          kcal: Math.round((total.kcal / servings) * 10) / 10,
          protein: Math.round((total.protein / servings) * 10) / 10,
          carbs: Math.round((total.carbs / servings) * 10) / 10,
          fat: Math.round((total.fat / servings) * 10) / 10,
          fiber: Math.round((total.fiber / servings) * 10) / 10
        };

        totalsBoxEl.innerHTML = `
          <div class="totals-row">
            <div>
              <span class="totals-title">Total de la Receta (${currentIngredients.length} ing):</span>
              <span class="totals-data"><strong>${Math.round(total.kcal)} kcal</strong> | P: ${Math.round(total.protein)}g | C: ${Math.round(total.carbs)}g | G: ${Math.round(total.fat)}g</span>
            </div>
            <div class="totals-serving-badge">
              <span class="tsb-title">Por Porción (${servings} porc):</span>
              <span class="tsb-kcal">${Math.round(perServ.kcal)} kcal</span>
              <span class="tsb-sub">P: ${perServ.protein}g • C: ${perServ.carbs}g • G: ${perServ.fat}g</span>
            </div>
          </div>
        `;
      };

      refreshIngredientsUI();
      servingsInput.addEventListener('input', refreshIngredientsUI);

      // Abrir selector de ingredientes
      addIngBtn.addEventListener('click', () => {
        openIngredientPickerModal((selectedIng) => {
          currentIngredients.push(selectedIng);
          refreshIngredientsUI();
        });
      });

      // Cancelar
      cancelBtn.addEventListener('click', () => close());

      // Guardar receta
      saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
          showToast('Escribe un nombre para la receta', 'error');
          return;
        }
        if (currentIngredients.length === 0) {
          showToast('Agrega al menos un ingrediente a la receta', 'error');
          return;
        }

        const servings = Math.max(1, parseInt(servingsInput.value) || 1);
        const isShared = isSharedInput.checked;
        const description = descInput.value.trim();

        const totalMacros = currentIngredients.reduce(
          (acc, cur) => {
            acc.kcal += cur.macros.kcal;
            acc.protein += cur.macros.protein;
            acc.carbs += cur.macros.carbs;
            acc.fat += cur.macros.fat;
            acc.fiber += cur.macros.fiber || 0;
            return acc;
          },
          { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        );

        const servingMacros = {
          kcal: Math.round((totalMacros.kcal / servings) * 10) / 10,
          protein: Math.round((totalMacros.protein / servings) * 10) / 10,
          carbs: Math.round((totalMacros.carbs / servings) * 10) / 10,
          fat: Math.round((totalMacros.fat / servings) * 10) / 10,
          fiber: Math.round((totalMacros.fiber / servings) * 10) / 10
        };

        const recData = {
          ...(recipe || {}),
          name,
          description,
          servings,
          isShared,
          createdByUserId: recipe?.createdByUserId || activeUser.id,
          createdByName: recipe?.createdByName || activeUser.name,
          ingredients: currentIngredients,
          totalMacros,
          servingMacros
        };

        await saveRecipe(recData);
        showToast(isEditing ? 'Receta actualizada' : 'Receta creada exitosamente', 'success');
        close();
        if (typeof onSaved === 'function') onSaved();
      });
    }
  });
}

/**
 * Submodal para buscar y agregar un ingrediente a la receta
 */
function openIngredientPickerModal(onIngredientSelected) {
  const modalHtml = `
    <div class="ing-picker-modal">
      <div class="search-bar-wrap">
        <span class="search-bar-icon">🔍</span>
        <input type="text" id="ingSearchInput" class="form-input" placeholder="Buscar ingrediente (ej. arroz, pollo, sal, aceite)..." autofocus />
      </div>

      <div class="food-results-container mt-2" id="ingSearchResults" style="max-height: 200px;"></div>

      <div class="ing-measure-row mt-3" id="ingMeasureRow" style="display: none;">
        <h5 id="selectedIngTitle" class="selected-ing-title mb-2"></h5>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Cantidad</label>
            <input type="number" id="inputIngQty" class="form-input" value="100" min="0.1" step="any" />
          </div>
          <div class="form-group">
            <label class="form-label">Unidad</label>
            <select id="selectIngUnit" class="form-select">
              ${Object.values(UNITS).map((u) => `<option value="${u.key}">${u.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-block mt-3" id="btnConfirmAddIng">+ Añadir a la receta</button>
      </div>
    </div>
  `;

  openModal({
    title: 'Añadir Ingrediente',
    subtitle: 'Selecciona de la BD oficial o personalizados',
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const searchInput = sheet.querySelector('#ingSearchInput');
      const resultsContainer = sheet.querySelector('#ingSearchResults');
      const measureRow = sheet.querySelector('#ingMeasureRow');
      const titleEl = sheet.querySelector('#selectedIngTitle');
      const qtyInput = sheet.querySelector('#inputIngQty');
      const unitSelect = sheet.querySelector('#selectIngUnit');
      const confirmBtn = sheet.querySelector('#btnConfirmAddIng');

      let pickedFood = null;

      const runSearch = (q) => {
        const results = searchFoods(q, { limit: 20 });
        if (results.length === 0) {
          resultsContainer.innerHTML = `<div class="empty-hint">Sin resultados</div>`;
          return;
        }

        resultsContainer.innerHTML = results
          .map(
            (item) => `
          <div class="food-result-card" data-id="${item.id}">
            <div class="food-result-main">
              <span class="food-result-name">${item.name}</span>
              <span class="food-result-macros">${Math.round(item.macros.kcal)} kcal • P: ${item.macros.protein}g por 100g</span>
            </div>
          </div>
        `
          )
          .join('');

        resultsContainer.querySelectorAll('.food-result-card').forEach((card) => {
          card.addEventListener('click', () => {
            pickedFood = getFoodById(card.dataset.id);
            if (pickedFood) {
              titleEl.textContent = pickedFood.name;
              measureRow.style.display = 'block';
              resultsContainer.style.display = 'none';
              searchInput.style.display = 'none';
            }
          });
        });
      };

      runSearch('');
      searchInput.addEventListener('input', (e) => runSearch(e.target.value));

      confirmBtn.addEventListener('click', () => {
        if (!pickedFood) return;
        const qty = parseFloat(qtyInput.value) || 0;
        if (qty <= 0) {
          showToast('Ingresa una cantidad válida', 'error');
          return;
        }

        const unitKey = unitSelect.value;
        const calculated = calculateItemMacros(pickedFood.macros, qty, unitKey, 100);

        onIngredientSelected({
          foodId: pickedFood.id,
          name: pickedFood.name,
          quantity: qty,
          unit: unitKey,
          grams: calculated.grams,
          macros: calculated.macros
        });

        close();
      });
    }
  });
}
