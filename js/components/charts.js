/**
 * charts.js - Componentes gráficos ligeros y fluidos en SVG puro (sin dependencias externas)
 */

/**
 * Renderiza el anillo circular de calorías y calorías restantes
 */
export function renderMacroRing(container, { consumed = 0, target = 2000 }) {
  if (!container) return;

  const validTarget = Math.max(target, 1);
  const percent = Math.min(Math.round((consumed / validTarget) * 100), 150);
  const remaining = target - consumed;

  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(consumed, target) / validTarget) * circumference;

  let ringColor = '#10b981'; // Verde por defecto
  if (percent > 105) ringColor = '#f59e0b'; // Advertencia / Superávit
  if (percent > 115) ringColor = '#ef4444'; // Exceso

  container.innerHTML = `
    <div class="ring-chart-wrapper" style="position: relative; width: ${size}px; height: ${size}px; margin: 0 auto;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring-svg">
        <circle
          cx="${size / 2}" cy="${size / 2}" r="${radius}"
          fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${strokeWidth}"
        />
        <circle
          cx="${size / 2}" cy="${size / 2}" r="${radius}"
          fill="none" stroke="${ringColor}" stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
          style="transition: stroke-dashoffset 0.8s ease-out, stroke 0.4s ease;"
        />
      </svg>
      <div class="ring-content" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <span class="ring-calories-val" style="font-size: 1.65rem; font-weight: 800; line-height: 1.1; color: #fff;">${Math.round(consumed)}</span>
        <span class="ring-calories-label" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">de ${target} kcal</span>
        <span class="ring-calories-sub" style="font-size: 0.72rem; margin-top: 4px; font-weight: 600; color: ${remaining >= 0 ? '#10b981' : '#f43f5e'};">
          ${remaining >= 0 ? `${Math.round(remaining)} restantes` : `${Math.abs(Math.round(remaining))} de más`}
        </span>
      </div>
    </div>
  `;
}

/**
 * Renderiza barras de progreso para Proteínas, Carbohidratos, Grasas y Fibra
 */
export function renderMacroBars(container, { macros, targets }) {
  if (!container) return;

  const items = [
    {
      label: 'Proteína',
      short: 'P',
      cur: macros?.protein || 0,
      tgt: targets?.protein || 140,
      color: '#38bdf8', // Azul cielo
      bg: 'rgba(56, 189, 248, 0.15)'
    },
    {
      label: 'Carbos',
      short: 'C',
      cur: macros?.carbs || 0,
      tgt: targets?.carbs || 200,
      color: '#fbbf24', // Ámbar
      bg: 'rgba(251, 191, 36, 0.15)'
    },
    {
      label: 'Grasas',
      short: 'G',
      cur: macros?.fat || 0,
      tgt: targets?.fat || 60,
      color: '#f43f5e', // Rosa/Rojo
      bg: 'rgba(244, 63, 94, 0.15)'
    },
    {
      label: 'Fibra',
      short: 'Fib',
      cur: macros?.fiber || 0,
      tgt: targets?.fiber || 25,
      color: '#10b981', // Verde
      bg: 'rgba(16, 185, 129, 0.15)'
    }
  ];

  const html = items
    .map((item) => {
      const pct = Math.min(Math.round((item.cur / (item.tgt || 1)) * 100), 100);
      const isExceeded = item.cur > item.tgt;
      return `
      <div class="macro-bar-row">
        <div class="macro-bar-header">
          <span class="macro-badge" style="background: ${item.bg}; color: ${item.color};">${item.short}</span>
          <span class="macro-name">${item.label}</span>
          <span class="macro-values">
            <strong>${Math.round(item.cur)}</strong> / ${item.tgt}g
            <span class="macro-pct ${isExceeded ? 'pct-warn' : ''}">(${pct}%)</span>
          </span>
        </div>
        <div class="macro-track">
          <div class="macro-fill" style="width: ${pct}%; background-color: ${item.color};"></div>
        </div>
      </div>
    `;
    })
    .join('');

  container.innerHTML = `<div class="macro-bars-list">${html}</div>`;
}

/**
 * Renderiza gráfico interactivo de evolución de peso (SVG)
 */
export function renderWeightChart(container, weightRecords, targetWeight) {
  if (!container) return;

  if (!weightRecords || weightRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-chart-notice">
        <p>No hay registros de peso aún.</p>
        <small>Registra tu peso en el diario para ver tu progreso aquí.</small>
      </div>
    `;
    return;
  }

  // Ordenar por fecha cronológica ascendente
  const sorted = [...weightRecords].sort((a, b) => new Date(a.date) - new Date(b.date));

  const weights = sorted.map((r) => r.weight);
  if (targetWeight) weights.push(targetWeight);

  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);
  const rangeW = maxW - minW || 1;

  const width = 500;
  const height = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = (index) => {
    if (sorted.length === 1) return padLeft + chartW / 2;
    return padLeft + (index / (sorted.length - 1)) * chartW;
  };

  const getY = (val) => {
    return padTop + chartH - ((val - minW) / rangeW) * chartH;
  };

  // Coordenadas de los puntos
  const points = sorted.map((r, i) => ({
    x: getX(i),
    y: getY(r.weight),
    weight: r.weight,
    date: r.date
  }));

  // Crear trazo SVG suave
  let pathD = '';
  if (points.length === 1) {
    pathD = `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`;
  } else {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const cx1 = prev.x + (cur.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (cur.x - prev.x) / 2;
      const cy2 = cur.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur.x} ${cur.y}`;
    }
  }

  // Área con gradiente debajo de la curva
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

  // Línea de meta de peso si está definida
  let targetLineSvg = '';
  if (targetWeight && targetWeight >= minW && targetWeight <= maxW) {
    const targetY = getY(targetWeight);
    targetLineSvg = `
      <line x1="${padLeft}" y1="${targetY}" x2="${width - padRight}" y2="${targetY}"
        stroke="#10b981" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="${width - padRight + 4}" y="${targetY + 4}" fill="#10b981" font-size="10" font-weight="600">Meta: ${targetWeight}kg</text>
    `;
  }

  // Puntos interactivos
  const circlesSvg = points
    .map(
      (p) => `
      <g class="chart-point" tabindex="0">
        <circle cx="${p.x}" cy="${p.y}" r="6" fill="#38bdf8" stroke="#0f172a" stroke-width="2.5" />
        <title>${p.date}: ${p.weight} kg</title>
      </g>
    `
    )
    .join('');

  // Eje horizontal de fechas (mostrar algunas fechas)
  const dateLabelsSvg = points
    .filter((_, i) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2))
    .map(
      (p) => `
      <text x="${p.x}" y="${height - 10}" text-anchor="middle" fill="#94a3b8" font-size="10">
        ${p.date.slice(5)}
      </text>
    `
    )
    .join('');

  // Eje vertical (min, medio, max)
  const yLabelsSvg = [minW, Math.round((minW + maxW) / 2), maxW]
    .map((val) => {
      const yPos = getY(val);
      return `
        <line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="rgba(255,255,255,0.06)" />
        <text x="${padLeft - 8}" y="${yPos + 4}" text-anchor="end" fill="#94a3b8" font-size="10">${val}kg</text>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="weight-chart-container">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="chart-svg">
        <defs>
          <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Grid -->
        ${yLabelsSvg}
        ${targetLineSvg}

        <!-- Gráfico -->
        <path d="${areaD}" fill="url(#weightAreaGrad)" />
        <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" />

        <!-- Puntos -->
        ${circlesSvg}

        <!-- Etiquetas de fechas -->
        ${dateLabelsSvg}
      </svg>
    </div>
  `;
}

/**
 * Renderiza barras comparativas entre múltiples usuarios
 */
export function renderComparisonChart(container, usersComparisonData) {
  if (!container || !usersComparisonData || usersComparisonData.length === 0) return;

  const html = usersComparisonData
    .map((item) => {
      const calPct = Math.min(Math.round((item.kcalConsumed / (item.kcalTarget || 1)) * 100), 130);
      const protPct = Math.min(Math.round((item.proteinConsumed / (item.proteinTarget || 1)) * 100), 130);

      return `
      <div class="comp-user-card">
        <div class="comp-user-header">
          <div class="comp-user-avatar" style="background-color: ${item.user.color || '#3b82f6'};">
            ${item.user.avatar || '👤'}
          </div>
          <div class="comp-user-info">
            <span class="comp-user-name">${item.user.name}</span>
            <span class="comp-user-sub">${item.streak || 0} días en racha 🔥</span>
          </div>
          <div class="comp-user-adherence">
            <span class="comp-badge-pill ${calPct >= 95 && calPct <= 105 ? 'pill-success' : 'pill-neutral'}">
              ${calPct}% Cal
            </span>
          </div>
        </div>

        <div class="comp-metric-row">
          <div class="comp-metric-label">
            <span>Calorías: <strong>${Math.round(item.kcalConsumed)}</strong> / ${item.kcalTarget} kcal</span>
            <span>${calPct}%</span>
          </div>
          <div class="macro-track">
            <div class="macro-fill" style="width: ${Math.min(calPct, 100)}%; background-color: #10b981;"></div>
          </div>
        </div>

        <div class="comp-metric-row">
          <div class="comp-metric-label">
            <span>Proteína: <strong>${Math.round(item.proteinConsumed)}</strong> / ${item.proteinTarget}g</span>
            <span>${protPct}%</span>
          </div>
          <div class="macro-track">
            <div class="macro-fill" style="width: ${Math.min(protPct, 100)}%; background-color: #38bdf8;"></div>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  container.innerHTML = `<div class="comp-cards-grid">${html}</div>`;
}
