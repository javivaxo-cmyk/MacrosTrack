/**
 * app.js - Orquestador principal de la PWA MacrosTrack
 * Enrutamiento de vistas, gestión de estado activo y Service Worker.
 */

import { openDB, checkAndSeedData, getAllUsers, getSetting, setSetting } from './db.js';
import { initFoodService } from './food-service.js';
import { renderDiaryView } from './views/diary-view.js';
import { renderSharedView } from './views/shared-view.js';
import { renderRecipesView } from './views/recipes-view.js';
import { renderMetricsView } from './views/metrics-view.js';
import { renderProfileView, openUserModal } from './views/profile-view.js';
import { openModal } from './components/modal.js';
import { showToast } from './components/toast.js';

// Estado global de la aplicación
const state = {
  currentView: 'diary',
  activeUser: null,
  selectedDate: new Date().toISOString().split('T')[0],
  allUsers: []
};

/**
 * Inicialización al cargar la página
 */
async function initApp() {
  try {
    // 1. Abrir DB y verificar datos de demostración
    await openDB();
    await checkAndSeedData();

    // 2. Cargar usuarios
    state.allUsers = await getAllUsers();

    // 3. Obtener usuario activo guardado
    const activeId = await getSetting('activeUserId');
    state.activeUser = state.allUsers.find((u) => u.id === activeId) || state.allUsers[0] || null;

    // 4. Inicializar motor de búsqueda de alimentos
    await initFoodService(state.activeUser?.id);

    // 5. Vincular navegación y eventos globales
    setupNavigation();
    setupGlobalHeader();

    // 6. Registrar Service Worker para PWA offline
    registerServiceWorker();

    // 7. Renderizar vista inicial
    renderCurrentView();
  } catch (err) {
    console.error('Error durante la inicialización de MacrosTrack:', err);
    showToast('Error al iniciar la aplicación: ' + err.message, 'error');
  }
}

/**
 * Configuración de botones de navegación (Bottom Bar en móvil / Sidebar en Landscape)
 */
function setupNavigation() {
  const navButtons = document.querySelectorAll('[data-view-target]');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const targetView = e.currentTarget.dataset.viewTarget;
      navigateToView(targetView);
    });
  });
}

/**
 * Cambia la vista actual y actualiza clases activas en navegación
 */
export function navigateToView(viewName) {
  state.currentView = viewName;

  // Actualizar botones de navegación activos
  document.querySelectorAll('[data-view-target]').forEach((btn) => {
    if (btn.dataset.viewTarget === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Configuración de la cabecera global
 */
function setupGlobalHeader() {
  const userBtn = document.getElementById('globalUserBtn');
  if (userBtn) {
    userBtn.addEventListener('click', () => openQuickUserSwitcher());
  }

  updateHeaderUserDisplay();
}

/**
 * Actualiza el avatar y nombre del usuario en el header
 */
function updateHeaderUserDisplay() {
  const avatarEl = document.getElementById('globalUserAvatar');
  const nameEl = document.getElementById('globalUserName');

  if (state.activeUser) {
    if (avatarEl) {
      avatarEl.textContent = state.activeUser.avatar || '👤';
      avatarEl.style.backgroundColor = state.activeUser.color || '#10b981';
    }
    if (nameEl) nameEl.textContent = state.activeUser.name;
  }
}

/**
 * Selector rápido de usuario desde cualquier pantalla
 */
function openQuickUserSwitcher() {
  const modalHtml = `
    <div class="quick-user-modal">
      <div class="user-select-list">
        ${state.allUsers
          .map((u) => {
            const isSel = u.id === state.activeUser?.id;
            return `
            <div class="quick-user-item ${isSel ? 'selected' : ''}" data-uid="${u.id}">
              <span class="qui-avatar" style="background-color: ${u.color || '#10b981'};">${u.avatar || '👤'}</span>
              <div class="qui-info">
                <span class="qui-name">${u.name}</span>
                <span class="qui-meta">${u.targets?.kcal || 2000} kcal • ${u.goal === 'lose' ? 'Déficit' : u.goal === 'gain' ? 'Superávit' : 'Mantenimiento'}</span>
              </div>
              ${isSel ? `<span class="qui-check">✓</span>` : ''}
            </div>
          `;
          })
          .join('')}
      </div>

      <div class="quick-user-actions mt-3">
        <button type="button" class="btn btn-outline btn-block" id="btnQuickCreateUser">
          + Crear Nuevo Perfil
        </button>
      </div>
    </div>
  `;

  openModal({
    title: 'Seleccionar Usuario Activo',
    subtitle: 'Elige con qué perfil registrar y visualizar datos',
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      sheet.querySelectorAll('.quick-user-item').forEach((item) => {
        item.addEventListener('click', async (e) => {
          const uId = e.currentTarget.dataset.uid;
          await switchActiveUser(uId);
          close();
        });
      });

      sheet.querySelector('#btnQuickCreateUser').addEventListener('click', () => {
        close();
        openUserModal({
          user: null,
          onSaved: async (newId) => {
            state.allUsers = await getAllUsers();
            if (newId) await switchActiveUser(newId);
          }
        });
      });
    }
  });
}

/**
 * Cambia el usuario activo y refresca la vista
 */
async function switchActiveUser(userId) {
  state.allUsers = await getAllUsers();
  state.activeUser = state.allUsers.find((u) => u.id === userId) || state.allUsers[0];
  await setSetting('activeUserId', state.activeUser.id);

  updateHeaderUserDisplay();
  showToast(`Cambiado a ${state.activeUser.name}`, 'info');

  renderCurrentView();
}

/**
 * Renderiza la vista activa en el contenedor principal
 */
async function renderCurrentView() {
  const container = document.getElementById('appMainContent');
  if (!container) return;

  switch (state.currentView) {
    case 'diary':
      await renderDiaryView(
        container,
        state.activeUser,
        state.selectedDate,
        (newDate) => {
          state.selectedDate = newDate;
          renderCurrentView();
        },
        () => openQuickUserSwitcher()
      );
      break;

    case 'shared':
      await renderSharedView(container, state.activeUser, async (newUserId) => {
        await switchActiveUser(newUserId);
      });
      break;

    case 'recipes':
      await renderRecipesView(container, state.activeUser, (targetDate) => {
        state.selectedDate = targetDate;
        navigateToView('diary');
      });
      break;

    case 'metrics':
      await renderMetricsView(container, state.activeUser, () => {
        navigateToView('diary');
      });
      break;

    case 'profile':
      await renderProfileView(container, state.activeUser, async (newId) => {
        state.allUsers = await getAllUsers();
        if (newId) await switchActiveUser(newId);
        else renderCurrentView();
      });
      break;

    default:
      navigateToView('diary');
  }
}

/**
 * Registro de Service Worker para PWA
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('MacrosTrack PWA Service Worker registrado con éxito:', reg.scope);
        })
        .catch((err) => {
          console.log('Error o entorno no compatible con Service Worker:', err);
        });
    });
  }
}

// Iniciar app al cargar el DOM
document.addEventListener('DOMContentLoaded', initApp);
