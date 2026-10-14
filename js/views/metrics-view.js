/**
 * metrics-view.js - Vista de resumen y métricas de progreso
 * Evolución del peso en el tiempo, rachas de registro, adherencia calórica y de macros.
 */

import { getAllLogsForUser, getAllStatsForUser, saveDailyStats } from '../db.js';
import { renderWeightChart } from '../components/charts.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderMetricsView(container, activeUser, onGoToDiary) {
  if (!activeUser) {
    container.innerHTML = `<div class="empty-state"><h2>No hay usuario seleccionado</h2></div>`;
    return;
  }

  const logs = await getAllLogsForUser(activeUser.id);
  const stats = await getAllStatsForUser(activeUser.id);

  // Ordenar estadísticas de peso
  const weightRecords = stats
    .filter((s) => s.weight && s.weight > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Último peso registrado o inicial
  const latestWeight = weightRecords.length > 0 ? weightRecords[weightRecords.length - 1].weight : activeUser.currentWeight;
  const initialWeight = weightRecords.length > 0 ? weightRecords[0].weight : activeUser.currentWeight;
  const targetWeight = activeUser.targetWeight || 75;

  const weightChange = latestWeight && initialWeight ? Math.round((latestWeight - initialWeight) * 10) / 10 : 0;

  // Calcular racha
  const todayStr = new Date().toISOString().split('T')[0];
  const uniqueLoggedDates = Array.from(new Set(logs.map((l) => l.date))).sort().reverse();

  let currentStreak = 0;
  let checkDate = new Date();
  if (!uniqueLoggedDates.includes(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    if (uniqueLoggedDates.includes(dStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Métricas de los últimos 7 días
  const now = new Date();
  const past7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    past7Days.push(d.toISOString().split('T')[0]);
  }

  let total7Kcal = 0;
  let daysMetGoal = 0;
  const targetKcal = activeUser.targets?.kcal || 2000;

  past7Days.forEach((dateStr) => {
    const dayLogs = logs.filter((l) => l.date === dateStr);
    const dayKcal = dayLogs.reduce((acc, l) => acc + (l.macros?.kcal || 0), 0);
    total7Kcal += dayKcal;
    if (dayKcal >= targetKcal * 0.9 && dayKcal <= targetKcal * 1.1) {
      daysMetGoal++;
    }
  });

  const avg7Kcal = Math.round(total7Kcal / 7);
  const adherenceRate = Math.round((daysMetGoal / 7) * 100);

  // Desglose total de macros
  const totalMacros = logs.reduce(
    (acc, l) => {
      acc.protein += l.macros?.protein || 0;
      acc.carbs += l.macros?.carbs || 0;
      acc.fat += l.macros?.fat || 0;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0 }
  );

  const kcalFromProtein = totalMacros.protein * 4;
  const kcalFromCarbs = totalMacros.carbs * 4;
  const kcalFromFat = totalMacros.fat * 9;
  const totalMacroKcal = kcalFromProtein + kcalFromCarbs + kcalFromFat || 1;

  const pctProt = Math.round((kcalFromProtein / totalMacroKcal) * 100);
  const pctCarb = Math.round((kcalFromCarbs / totalMacroKcal) * 100);
  const pctFat = Math.round((kcalFromFat / totalMacroKcal) * 100);

  container.innerHTML = `
    <div class="metrics-view-layout">
      <!-- Encabezado de Métricas -->
      <section class="metrics-header card-glass">
        <div class="metrics-title-group">
          <div class="icon-circle">📈</div>
          <div>
            <h2 class="view-title">Métricas y Resumen</h2>
            <p class="view-subtitle">Análisis de evolución física, constancia y cumplimiento para ${activeUser.name}</p>
          </div>
        </div>

        <button class="btn btn-primary" id="btnOpenAddWeight">
          + Registrar Peso
        </button>
      </section>

      <!-- Tarjetas de Estadísticas Clave -->
      <section class="stats-overview-grid">
        <!-- Racha Activa -->
        <div class="stat-card card-glass">
          <span class="stat-icon">🔥</span>
          <div class="stat-data">
            <span class="stat-big-val">${currentStreak} <small>días</small></span>
            <span class="stat-meta">Racha activa de registro</span>
          </div>
        </div>

        <!-- Peso Actual y Cambio -->
        <div class="stat-card card-glass">
          <span class="stat-icon">⚖️</span>
          <div class="stat-data">
            <span class="stat-big-val">${latestWeight || '--'} <small>kg</small></span>
            <span class="stat-meta">
              ${weightChange > 0 ? `+${weightChange} kg` : `${weightChange} kg`} desde inicio • Meta: ${targetWeight} kg
            </span>
          </div>
        </div>

        <!-- Promedio Calórico 7d -->
        <div class="stat-card card-glass">
          <span class="stat-icon">🥗</span>
          <div class="stat-data">
            <span class="stat-big-val">${avg7Kcal} <small>kcal/día</small></span>
            <span class="stat-meta">Objetivo: ${targetKcal} kcal</span>
          </div>
        </div>

        <!-- Tasa de Adherencia -->
        <div class="stat-card card-glass">
          <span class="stat-icon">🎯</span>
          <div class="stat-data">
            <span class="stat-big-val">${adherenceRate}%</span>
            <span class="stat-meta">Días en meta esta semana</span>
          </div>
        </div>
      </section>

      <!-- Gráfico de Evolución de Peso -->
      <section class="chart-section card-glass">
        <div class="section-header-row">
          <div>
            <h3 class="section-card-title">Evolución del Peso</h3>
            <p class="section-card-sub">Historial cronológico vs Meta de ${targetWeight} kg</p>
          </div>
        </div>
        <div id="weightChartContainer" class="chart-wrap"></div>
      </section>

      <!-- Distribución Real de Macronutrientes -->
      <section class="chart-section card-glass">
        <h3 class="section-card-title">Distribución Calórica Real</h3>
        <p class="section-card-sub">Porcentaje de energía proveniente de cada macronutriente</p>

        <div class="macro-dist-bar-wrap mt-3">
          <div class="macro-dist-bar">
            <div class="dist-fill d-prot" style="width: ${pctProt}%;" title="Proteína: ${pctProt}%"></div>
            <div class="dist-fill d-carb" style="width: ${pctCarb}%;" title="Carbohidratos: ${pctCarb}%"></div>
            <div class="dist-fill d-fat" style="width: ${pctFat}%;" title="Grasas: ${pctFat}%"></div>
          </div>
          <div class="macro-dist-legend mt-2">
            <span class="dist-leg-item"><span class="leg-color d-prot-bg"></span> Proteína: <strong>${pctProt}%</strong></span>
            <span class="dist-leg-item"><span class="leg-color d-carb-bg"></span> Carbohidratos: <strong>${pctCarb}%</strong></span>
            <span class="dist-leg-item"><span class="leg-color d-fat-bg"></span> Grasas: <strong>${pctFat}%</strong></span>
          </div>
        </div>
      </section>

      <!-- Historial de Pesajes Recientes -->
      <section class="weight-history-section card-glass">
        <h3 class="section-card-title">Historial de Pesajes</h3>
        <div class="weight-records-list">
          ${
            weightRecords.length === 0
              ? `<div class="empty-hint">Aún no has registrado pesajes. Haz clic en "+ Registrar Peso".</div>`
              : weightRecords
                  .slice()
                  .reverse()
                  .map(
                    (rec) => `
                <div class="weight-record-row">
                  <div>
                    <span class="wrec-date">${rec.date}</span>
                    ${rec.notes ? `<span class="wrec-note">${rec.notes}</span>` : ''}
                  </div>
                  <span class="wrec-weight">${rec.weight} kg</span>
                </div>
              `
                  )
                  .join('')
          }
        </div>
      </section>
    </div>
  `;

  // Renderizar gráfico de peso SVG
  renderWeightChart(container.querySelector('#weightChartContainer'), weightRecords, targetWeight);

  // Botón para registrar nuevo peso
  container.querySelector('#btnOpenAddWeight').addEventListener('click', () => {
    openAddWeightModal(activeUser, () => {
      renderMetricsView(container, activeUser, onGoToDiary);
    });
  });
}

/**
 * Modal para registrar peso
 */
function openAddWeightModal(activeUser, onSaved) {
  const todayStr = new Date().toISOString().split('T')[0];

  const modalHtml = `
    <form id="addWeightForm" class="add-weight-form">
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Fecha del pesaje *</label>
          <input type="date" id="inputWeightDate" class="form-input form-input-lg" value="${todayStr}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Peso (kg) *</label>
          <input type="number" id="inputWeightValue" class="form-input form-input-lg" step="0.1" min="20" max="350" placeholder="${activeUser.currentWeight || 75}" required />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Notas u observaciones (opcional)</label>
        <input type="text" id="inputWeightNotes" class="form-input" placeholder="Ej. En ayunas, después de cardio..." />
      </div>

      <div class="form-actions mt-4">
        <button type="submit" class="btn btn-primary btn-block">Guardar Pesaje</button>
      </div>
    </form>
  `;

  openModal({
    title: 'Registrar Peso Corporal',
    subtitle: `Seguimiento de peso para ${activeUser.name}`,
    contentHtml: modalHtml,
    onRender: (sheet, close) => {
      sheet.querySelector('#addWeightForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateStr = sheet.querySelector('#inputWeightDate').value;
        const weightVal = parseFloat(sheet.querySelector('#inputWeightValue').value);
        const notes = sheet.querySelector('#inputWeightNotes').value.trim();

        if (!weightVal || weightVal <= 0) {
          showToast('Ingresa un peso válido', 'error');
          return;
        }

        await saveDailyStats({
          id: `${activeUser.id}_${dateStr}`,
          userId: activeUser.id,
          date: dateStr,
          weight: weightVal,
          notes
        });

        showToast(`Pesaje de ${weightVal} kg guardado`, 'success');
        close();
        if (typeof onSaved === 'function') onSaved();
      });
    }
  });
}
