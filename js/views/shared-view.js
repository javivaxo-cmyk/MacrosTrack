/**
 * shared-view.js - Vista compartida / Social de comparativa multiusuario
 * Acceso libre y sin restricciones para todos los usuarios.
 * Comparación de adherencia calórica, macros, rachas y evolución de peso.
 */

import { getAllUsers, getAllLogsForUser, getAllStatsForUser, setSetting } from '../db.js';
import { renderComparisonChart } from '../components/charts.js';
import { showToast } from '../components/toast.js';

export async function renderSharedView(container, activeUser, onSwitchUser) {
  const users = await getAllUsers();

  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <h2>No hay usuarios creados</h2>
        <p>Crea perfiles en la sección de Perfil para ver la comparativa aquí.</p>
      </div>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="shared-view-layout">
      <!-- Encabezado con selector de período -->
      <section class="shared-header card-glass">
        <div class="shared-title-wrap">
          <div class="icon-circle">🏆</div>
          <div>
            <h2 class="view-title">Comparativa de la Comunidad</h2>
            <p class="view-subtitle">Rendimiento, adherencia a macros y motivación mutua entre todos los perfiles</p>
          </div>
        </div>

        <div class="period-tabs-wrap">
          <button class="tab-pill active" data-period="today">Hoy</button>
          <button class="tab-pill" data-period="week">Últimos 7 días</button>
          <button class="tab-pill" data-period="all">Histórico</button>
        </div>
      </section>

      <!-- Podio de Líderes / Destacados -->
      <section class="podium-section" id="podiumSection">
        <div class="loading-spinner">Calculando estadísticas comunitarias...</div>
      </section>

      <!-- Gráfico Comparativo Dinámico -->
      <section class="shared-chart-section card-glass">
        <h3 class="section-card-title">Distribución y Adherencia</h3>
        <div id="sharedComparisonChart"></div>
      </section>

      <!-- Lista de Tarjetas Detalladas por Usuario -->
      <section class="user-cards-section">
        <h3 class="section-card-title">Métricas Individuales</h3>
        <div class="user-grid-cards" id="userComparisonCardsList"></div>
      </section>
    </div>
  `;

  // Calcular métricas para cada usuario según el período seleccionado
  async function computeAndRenderData(period = 'today') {
    const podiumContainer = container.querySelector('#podiumSection');
    const chartContainer = container.querySelector('#sharedComparisonChart');
    const cardsContainer = container.querySelector('#userComparisonCardsList');

    const usersData = [];

    for (const user of users) {
      const logs = await getAllLogsForUser(user.id);
      const stats = await getAllStatsForUser(user.id);

      // Filtrar logs según el período
      let filteredLogs = [];
      const now = new Date();

      if (period === 'today') {
        filteredLogs = logs.filter((l) => l.date === todayStr);
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
        filteredLogs = logs.filter((l) => l.date >= weekAgo && l.date <= todayStr);
      } else {
        filteredLogs = logs;
      }

      // Calcular totales
      const totalKcal = filteredLogs.reduce((acc, l) => acc + (l.macros?.kcal || 0), 0);
      const totalProtein = filteredLogs.reduce((acc, l) => acc + (l.macros?.protein || 0), 0);
      const totalCarbs = filteredLogs.reduce((acc, l) => acc + (l.macros?.carbs || 0), 0);
      const totalFat = filteredLogs.reduce((acc, l) => acc + (l.macros?.fat || 0), 0);

      const daysCount = period === 'today' ? 1 : period === 'week' ? 7 : Math.max(1, new Set(logs.map((l) => l.date)).size);

      const avgKcal = totalKcal / daysCount;
      const avgProtein = totalProtein / daysCount;
      const avgCarbs = totalCarbs / daysCount;
      const avgFat = totalFat / daysCount;

      // Calcular racha actual
      const uniqueLoggedDates = Array.from(new Set(logs.map((l) => l.date))).sort().reverse();
      let streak = 0;
      let checkDate = new Date();
      // Si hoy no ha registrado todavía, verificar si ayer registró
      const todayLogged = uniqueLoggedDates.includes(todayStr);
      if (!todayLogged) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (uniqueLoggedDates.includes(dStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Adherencia calórica (% de cercanía al objetivo)
      const tgtKcal = user.targets?.kcal || 2000;
      const calAdherencePct = Math.round((avgKcal / tgtKcal) * 100);

      // Adherencia de proteína (% de cumplimiento de meta)
      const tgtProt = user.targets?.protein || 140;
      const protAdherencePct = Math.round((avgProtein / tgtProt) * 100);

      // Último peso registrado
      const sortedStats = [...stats].filter((s) => s.weight).sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestWeight = sortedStats[0]?.weight || user.currentWeight || null;

      usersData.push({
        user,
        streak,
        kcalConsumed: avgKcal,
        kcalTarget: tgtKcal,
        calAdherencePct,
        proteinConsumed: avgProtein,
        proteinTarget: tgtProt,
        protAdherencePct,
        carbsConsumed: avgCarbs,
        carbsTarget: user.targets?.carbs || 200,
        fatConsumed: avgFat,
        fatTarget: user.targets?.fat || 60,
        latestWeight,
        weightGoal: user.targetWeight,
        isCurrentActive: user.id === activeUser?.id
      });
    }

    // 1. Podio de Líderes
    // Ordenar por adherencia proteica y racha
    const sortedLeaderboard = [...usersData].sort((a, b) => {
      // Priorizar racha y porcentaje de proteína
      const scoreA = a.streak * 20 + Math.min(a.protAdherencePct, 100);
      const scoreB = b.streak * 20 + Math.min(b.protAdherencePct, 100);
      return scoreB - scoreA;
    });

    podiumContainer.innerHTML = `
      <div class="podium-grid">
        ${sortedLeaderboard
          .map((item, index) => {
            const rankEmoji = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
            const badgeClass = index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : 'rank-bronze';

            return `
            <div class="podium-card card-glass ${badgeClass}">
              <div class="podium-rank-badge">${rankEmoji} #${index + 1}</div>
              <div class="podium-avatar" style="background-color: ${item.user.color || '#10b981'};">
                ${item.user.avatar || '👤'}
              </div>
              <h4 class="podium-user-name">${item.user.name}</h4>
              <div class="podium-stats">
                <span class="podium-pill">🔥 ${item.streak} días racha</span>
                <span class="podium-pill">🥩 ${item.protAdherencePct}% Proteína</span>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // 2. Gráfico comparativo de barras
    renderComparisonChart(chartContainer, usersData);

    // 3. Tarjetas individuales interactivas
    cardsContainer.innerHTML = usersData
      .map((item) => {
        return `
        <div class="shared-user-card card-glass ${item.isCurrentActive ? 'card-active-user' : ''}">
          <div class="shared-card-header">
            <div class="shared-avatar-col">
              <span class="comp-user-avatar" style="background-color: ${item.user.color || '#3b82f6'};">
                ${item.user.avatar || '👤'}
              </span>
              <div>
                <h4 class="shared-card-name">${item.user.name} ${item.isCurrentActive ? '<span class="badge-you">(Tú)</span>' : ''}</h4>
                <span class="shared-card-sub">Objetivo: ${item.user.goal === 'lose' ? '📉 Déficit' : item.user.goal === 'gain' ? '📈 Superávit' : '⚖️ Mantener'}</span>
              </div>
            </div>

            ${
              !item.isCurrentActive
                ? `<button class="btn-xs btn-outline btn-switch-to-user" data-uid="${item.user.id}">Cambiar a este perfil</button>`
                : `<span class="badge-tag badge-current">Activo</span>`
            }
          </div>

          <div class="shared-stats-grid">
            <div class="shared-stat-box">
              <span class="stat-box-val">${Math.round(item.kcalConsumed)} <small>/ ${item.kcalTarget}</small></span>
              <span class="stat-box-label">Calorías (${item.calAdherencePct}%)</span>
            </div>
            <div class="shared-stat-box">
              <span class="stat-box-val">${Math.round(item.proteinConsumed)}g <small>/ ${item.proteinTarget}g</small></span>
              <span class="stat-box-label">Proteína (${item.protAdherencePct}%)</span>
            </div>
            <div class="shared-stat-box">
              <span class="stat-box-val">${item.streak} <small>días</small></span>
              <span class="stat-box-label">Racha Activa 🔥</span>
            </div>
            <div class="shared-stat-box">
              <span class="stat-box-val">${item.latestWeight ? `${item.latestWeight} kg` : '--'}</span>
              <span class="stat-box-label">Peso Actual</span>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Eventos para cambiar de perfil directamente
    cardsContainer.querySelectorAll('.btn-switch-to-user').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const uId = e.currentTarget.dataset.uid;
        await setSetting('activeUserId', uId);
        showToast('Perfil cambiado exitosamente', 'success');
        if (typeof onSwitchUser === 'function') onSwitchUser(uId);
      });
    });
  }

  // Vincular tabs de período
  container.querySelectorAll('.tab-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.tab-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      computeAndRenderData(pill.dataset.period);
    });
  });

  // Ejecución inicial
  computeAndRenderData('today');
}
