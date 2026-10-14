/**
 * profile-view.js - Vista de gestión de usuarios, cálculo de TDEE y respaldo de datos
 * Crear, editar, cambiar entre usuarios, fijar metas de macros y exportar/importar JSON.
 */

import { getAllUsers, saveUser, removeUser, setSetting, exportFullBackup, importFullBackup, checkAndSeedData } from '../db.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const AVATAR_OPTIONS = ['🥑', '💪', '⚡', '🥗', '🔥', '🏋️‍♂️', '🏃‍♀️', '🥊', '🎯', '🚴‍♂️', '🧘‍♀️', '🧗‍♂️'];
const COLOR_OPTIONS = ['#10b981', '#38bdf8', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444'];

export async function renderProfileView(container, activeUser, onUserChanged) {
  const users = await getAllUsers();

  container.innerHTML = `
    <div class="profile-view-layout">
      <!-- Encabezado de Perfiles -->
      <section class="profile-header card-glass">
        <div class="profile-title-group">
          <div class="icon-circle">👤</div>
          <div>
            <h2 class="view-title">Perfiles y Configuración</h2>
            <p class="view-subtitle">Gestiona usuarios, objetivos de macronutrientes y respaldos de la app</p>
          </div>
        </div>

        <button class="btn btn-primary" id="btnCreateNewUser">
          + Nuevo Perfil
        </button>
      </section>

      <!-- Selector de Perfil Activo -->
      <section class="users-list-section card-glass">
        <h3 class="section-card-title">Perfiles Registrados</h3>
        <p class="section-card-sub">Selecciona un perfil para cambiar el usuario activo de la app</p>

        <div class="user-profiles-grid mt-3">
          ${users
            .map((u) => {
              const isActive = u.id === activeUser?.id;
              return `
              <div class="profile-select-card card-glass ${isActive ? 'card-active-profile' : ''}" data-uid="${u.id}">
                <div class="psc-avatar" style="background-color: ${u.color || '#10b981'};">
                  ${u.avatar || '👤'}
                </div>
                <div class="psc-info">
                  <h4 class="psc-name">${u.name}</h4>
                  <span class="psc-meta">${u.targets?.kcal || 2000} kcal • Meta: ${u.targetWeight || u.currentWeight || '--'} kg</span>
                </div>
                <div class="psc-badge-col">
                  ${isActive ? `<span class="badge-tag badge-current">En Uso</span>` : `<button class="btn-xs btn-outline btn-activate-u" data-uid="${u.id}">Activar</button>`}
                  <button class="btn-icon btn-edit-user" data-uid="${u.id}" title="Editar perfil">⚙️</button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>

      <!-- Detalle del Perfil Activo y Objetivos -->
      ${
        activeUser
          ? `
        <section class="active-user-details card-glass">
          <div class="aud-header">
            <div>
              <h3 class="section-card-title">Metas de ${activeUser.name}</h3>
              <p class="section-card-sub">Objetivo actual: ${activeUser.goal === 'lose' ? '📉 Pérdida de Grasa (Déficit)' : activeUser.goal === 'gain' ? '📈 Ganancia Muscular (Superávit)' : '⚖️ Mantenimiento'}</p>
            </div>
            <button class="btn btn-sm btn-outline" id="btnEditActiveUser">Editar Datos y Metas</button>
          </div>

          <div class="aud-targets-grid mt-3">
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.kcal || 2000}</span>
              <span class="atp-lbl">Calorías (kcal)</span>
            </div>
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.protein || 140}g</span>
              <span class="atp-lbl">Proteína</span>
            </div>
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.carbs || 200}g</span>
              <span class="atp-lbl">Carbohidratos</span>
            </div>
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.fat || 60}g</span>
              <span class="atp-lbl">Grasas</span>
            </div>
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.fiber || 25}g</span>
              <span class="atp-lbl">Fibra Mínima</span>
            </div>
            <div class="aud-target-pill">
              <span class="atp-val">${activeUser.targets?.water || 2500}ml</span>
              <span class="atp-lbl">Agua Diaria</span>
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- Respaldo y Restauración de Datos -->
      <section class="backup-section card-glass">
        <h3 class="section-card-title">Respaldo y Portabilidad de Datos</h3>
        <p class="section-card-sub">Exporta todos los datos (usuarios, logs, recetas, alimentos) para no perder nada o migrar de dispositivo.</p>

        <div class="backup-actions-row mt-3">
          <button class="btn btn-outline" id="btnExportBackup">
            💾 Exportar Respaldo (JSON)
          </button>
          <label class="btn btn-outline cursor-pointer" for="fileImportBackup">
            📥 Importar Respaldo (JSON)
          </label>
          <input type="file" id="fileImportBackup" accept=".json" style="display: none;" />
          <button class="btn btn-subtle" id="btnResetDemoData">
            🔄 Cargar Datos de Demostración
          </button>
        </div>
      </section>
    </div>
  `;

  // Cambiar usuario activo
  container.querySelectorAll('.btn-activate-u').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const uId = e.currentTarget.dataset.uid;
      await setSetting('activeUserId', uId);
      showToast('Usuario activo cambiado', 'success');
      if (typeof onUserChanged === 'function') onUserChanged(uId);
    });
  });

  // Editar usuario
  container.querySelectorAll('.btn-edit-user').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const uId = e.currentTarget.dataset.uid;
      const u = users.find((user) => user.id === uId);
      if (u) {
        openUserModal({
          user: u,
          onSaved: () => renderProfileView(container, activeUser, onUserChanged)
        });
      }
    });
  });

  const editActiveBtn = container.querySelector('#btnEditActiveUser');
  if (editActiveBtn) {
    editActiveBtn.addEventListener('click', () => {
      openUserModal({
        user: activeUser,
        onSaved: () => renderProfileView(container, activeUser, onUserChanged)
      });
    });
  }

  // Crear nuevo usuario
  container.querySelector('#btnCreateNewUser').addEventListener('click', () => {
    openUserModal({
      user: null,
      onSaved: () => renderProfileView(container, activeUser, onUserChanged)
    });
  });

  // Exportar respaldo
  container.querySelector('#btnExportBackup').addEventListener('click', async () => {
    try {
      const json = await exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `macrostrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Respaldo descargado exitosamente', 'success');
    } catch (e) {
      showToast('Error al exportar respaldo', 'error');
    }
  });

  // Importar respaldo
  container.querySelector('#fileImportBackup').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importFullBackup(text);
      showToast('Respaldo importado correctamente. Recargando...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showToast('Error al importar archivo de respaldo: ' + err.message, 'error');
    }
  });

  // Resetear demostración
  container.querySelector('#btnResetDemoData').addEventListener('click', async () => {
    if (confirm('¿Cargar datos de demostración para Carlos y Ana?')) {
      await checkAndSeedData();
      showToast('Datos de demo cargados', 'success');
      if (typeof onUserChanged === 'function') onUserChanged();
    }
  });
}

/**
 * Modal para crear o editar un usuario con calculadora de TDEE y Macros
 */
export function openUserModal({ user = null, onSaved }) {
  const isEditing = !!user;

  let currentAvatar = user?.avatar || '🥑';
  let currentColor = user?.color || '#10b981';

  const modalHtml = `
    <form id="userForm" class="user-editor-form">
      <div class="form-group">
        <label class="form-label">Nombre del Usuario *</label>
        <input type="text" id="uName" class="form-input form-input-lg" value="${user?.name || ''}" placeholder="Ej. Javier Gómez" required />
      </div>

      <!-- Selector de Avatar y Color -->
      <div class="form-group">
        <label class="form-label">Avatar y Color de Perfil</label>
        <div class="avatar-picker-row">
          <div class="avatar-preview-badge" id="avatarPreviewBadge" style="background-color: ${currentColor};">
            ${currentAvatar}
          </div>
          <div class="avatar-options-grid">
            ${AVATAR_OPTIONS.map((av) => `<button type="button" class="avatar-opt-btn ${av === currentAvatar ? 'selected' : ''}" data-av="${av}">${av}</button>`).join('')}
          </div>
        </div>
        <div class="color-options-row mt-2">
          ${COLOR_OPTIONS.map((c) => `<button type="button" class="color-opt-btn ${c === currentColor ? 'selected' : ''}" data-color="${c}" style="background-color: ${c};"></button>`).join('')}
        </div>
      </div>

      <!-- Datos Físicos -->
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Sexo</label>
          <select id="uGender" class="form-select">
            <option value="male" ${user?.gender === 'male' ? 'selected' : ''}>Hombre</option>
            <option value="female" ${user?.gender === 'female' ? 'selected' : ''}>Mujer</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Edad</label>
          <input type="number" id="uAge" class="form-input" value="${user?.age || 28}" min="10" max="110" />
        </div>
        <div class="form-group">
          <label class="form-label">Altura (cm)</label>
          <input type="number" id="uHeight" class="form-input" value="${user?.height || 175}" min="100" max="250" />
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Peso Actual (kg) *</label>
          <input type="number" id="uWeight" class="form-input" value="${user?.currentWeight || 75}" step="0.1" min="30" max="300" required />
        </div>
        <div class="form-group">
          <label class="form-label">Peso Meta (kg)</label>
          <input type="number" id="uTargetWeight" class="form-input" value="${user?.targetWeight || user?.currentWeight || 72}" step="0.1" min="30" max="300" />
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Actividad Física</label>
          <select id="uActivity" class="form-select">
            <option value="sedentary" ${user?.activityLevel === 'sedentary' ? 'selected' : ''}>Sedentario (poco o nada)</option>
            <option value="light" ${user?.activityLevel === 'light' ? 'selected' : ''}>Ligero (1-3 días/sem)</option>
            <option value="moderate" ${user?.activityLevel === 'moderate' || !user ? 'selected' : ''}>Moderado (3-5 días/sem)</option>
            <option value="very_active" ${user?.activityLevel === 'very_active' ? 'selected' : ''}>Muy Activo (6-7 días/sem)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Objetivo Fitness</label>
          <select id="uGoal" class="form-select">
            <option value="lose" ${user?.goal === 'lose' ? 'selected' : ''}>📉 Perder Grasa (Déficit)</option>
            <option value="maintain" ${user?.goal === 'maintain' || !user ? 'selected' : ''}>⚖️ Mantener Peso</option>
            <option value="gain" ${user?.goal === 'gain' ? 'selected' : ''}>📈 Ganar Músculo (Superávit)</option>
          </select>
        </div>
      </div>

      <button type="button" class="btn btn-sm btn-subtle btn-block mt-2" id="btnAutoCalcMacros">
        ⚡ Calcular Macros Recomendados Automáticamente
      </button>

      <!-- Metas de Macronutrientes -->
      <div class="macros-input-box mt-3">
        <h5 class="macros-input-title">Objetivos Diarios</h5>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Calorías (kcal)</label>
            <input type="number" id="uKcal" class="form-input form-input-lg font-bold" value="${user?.targets?.kcal || 2000}" required min="500" max="10000" />
          </div>
          <div class="form-group">
            <label class="form-label">Proteína (g)</label>
            <input type="number" id="uProtein" class="form-input form-input-lg font-bold" value="${user?.targets?.protein || 140}" required min="20" max="500" />
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Carbos (g)</label>
            <input type="number" id="uCarbs" class="form-input" value="${user?.targets?.carbs || 200}" required min="0" max="1000" />
          </div>
          <div class="form-group">
            <label class="form-label">Grasas (g)</label>
            <input type="number" id="uFat" class="form-input" value="${user?.targets?.fat || 60}" required min="10" max="400" />
          </div>
          <div class="form-group">
            <label class="form-label">Fibra (g)</label>
            <input type="number" id="uFiber" class="form-input" value="${user?.targets?.fiber || 25}" min="0" max="100" />
          </div>
        </div>

        <div class="form-group mt-2">
          <label class="form-label">Agua Diaria (ml)</label>
          <input type="number" id="uWater" class="form-input" value="${user?.targets?.water || 2500}" step="250" min="500" max="10000" />
        </div>
      </div>

      <div class="form-actions mt-4">
        ${isEditing ? `<button type="button" class="btn btn-outline-danger" id="btnDeleteUser">Eliminar Perfil</button>` : ''}
        <button type="submit" class="btn btn-primary btn-block">${isEditing ? 'Guardar Cambios' : 'Crear Perfil'}</button>
      </div>
    </form>
  `;

  openModal({
    title: isEditing ? `Editar a ${user.name}` : 'Nuevo Perfil de Usuario',
    subtitle: 'Configura tus datos biométricos y metas nutricionales',
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      const previewBadge = sheet.querySelector('#avatarPreviewBadge');

      // Selección de emoji
      sheet.querySelectorAll('.avatar-opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          sheet.querySelectorAll('.avatar-opt-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          currentAvatar = btn.dataset.av;
          previewBadge.textContent = currentAvatar;
        });
      });

      // Selección de color
      sheet.querySelectorAll('.color-opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          sheet.querySelectorAll('.color-opt-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          currentColor = btn.dataset.color;
          previewBadge.style.backgroundColor = currentColor;
        });
      });

      // Calculadora automática de macros (Mifflin-St Jeor)
      const calculateRecommendedMacros = () => {
        const gender = sheet.querySelector('#uGender').value;
        const age = parseFloat(sheet.querySelector('#uAge').value) || 28;
        const height = parseFloat(sheet.querySelector('#uHeight').value) || 175;
        const weight = parseFloat(sheet.querySelector('#uWeight').value) || 75;
        const activity = sheet.querySelector('#uActivity').value;
        const goal = sheet.querySelector('#uGoal').value;

        // BMR (Mifflin-St Jeor)
        let bmr = 10 * weight + 6.25 * height - 5 * age;
        if (gender === 'male') bmr += 5;
        else bmr -= 161;

        // Factor de actividad
        const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725 };
        const tdee = bmr * (mults[activity] || 1.4);

        // Ajuste según objetivo
        let targetKcal = tdee;
        if (goal === 'lose') targetKcal -= 450;
        else if (goal === 'gain') targetKcal += 350;

        targetKcal = Math.round(targetKcal);

        // Proteína: 2.0g/kg si déficit, 1.8g/kg si mantener o superávit
        const protGrams = Math.round(weight * (goal === 'lose' ? 2.1 : 1.8));
        // Grasa: ~25% de calorías
        const fatGrams = Math.round((targetKcal * 0.25) / 9);
        // Carbohidratos: el resto
        const carbGrams = Math.max(50, Math.round((targetKcal - protGrams * 4 - fatGrams * 9) / 4));
        const waterMl = Math.round(weight * 35);

        sheet.querySelector('#uKcal').value = targetKcal;
        sheet.querySelector('#uProtein').value = protGrams;
        sheet.querySelector('#uFat').value = fatGrams;
        sheet.querySelector('#uCarbs').value = carbGrams;
        sheet.querySelector('#uWater').value = Math.max(2000, waterMl);

        showToast('Metas calculadas con base en tu perfil metabólico', 'info');
      };

      sheet.querySelector('#btnAutoCalcMacros').addEventListener('click', calculateRecommendedMacros);

      // Eliminar usuario
      const delBtn = sheet.querySelector('#btnDeleteUser');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (confirm(`¿Estás seguro de eliminar el perfil de ${user.name}? Se borrarán también sus registros.`)) {
            await removeUser(user.id);
            showToast('Perfil eliminado', 'info');
            close();
            if (typeof onSaved === 'function') onSaved();
          }
        });
      }

      // Guardar usuario
      sheet.querySelector('#userForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = sheet.querySelector('#uName').value.trim();
        const gender = sheet.querySelector('#uGender').value;
        const age = parseInt(sheet.querySelector('#uAge').value) || 28;
        const height = parseFloat(sheet.querySelector('#uHeight').value) || 175;
        const currentWeight = parseFloat(sheet.querySelector('#uWeight').value) || 75;
        const targetWeight = parseFloat(sheet.querySelector('#uTargetWeight').value) || currentWeight;
        const activityLevel = sheet.querySelector('#uActivity').value;
        const goal = sheet.querySelector('#uGoal').value;

        const targets = {
          kcal: parseInt(sheet.querySelector('#uKcal').value) || 2000,
          protein: parseInt(sheet.querySelector('#uProtein').value) || 140,
          carbs: parseInt(sheet.querySelector('#uCarbs').value) || 200,
          fat: parseInt(sheet.querySelector('#uFat').value) || 60,
          fiber: parseInt(sheet.querySelector('#uFiber').value) || 25,
          water: parseInt(sheet.querySelector('#uWater').value) || 2500
        };

        const userData = {
          ...(user || {}),
          name,
          avatar: currentAvatar,
          color: currentColor,
          gender,
          age,
          height,
          currentWeight,
          targetWeight,
          activityLevel,
          goal,
          targets
        };

        const saved = await saveUser(userData);
        if (!user) {
          // Si era nuevo, marcarlo como activo
          await setSetting('activeUserId', saved.id);
        }

        showToast(`Perfil de ${saved.name} guardado`, 'success');
        close();
        if (typeof onSaved === 'function') onSaved(saved.id);
      });
    }
  });
}
