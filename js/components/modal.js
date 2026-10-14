/**
 * modal.js - Sistema de modales y Bottom Sheets con gestos para móvil
 */

let activeModal = null;

export function openModal({ title, subtitle, contentHtml, onRender, onClose }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet';

  sheet.innerHTML = `
    <div class="sheet-drag-handle"></div>
    <div class="sheet-header">
      <div class="sheet-titles">
        <h3 class="sheet-title">${title || ''}</h3>
        ${subtitle ? `<p class="sheet-subtitle">${subtitle}</p>` : ''}
      </div>
      <button class="sheet-close-btn" aria-label="Cerrar">&times;</button>
    </div>
    <div class="sheet-body">
      ${contentHtml || ''}
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const closeBtn = sheet.querySelector('.sheet-close-btn');
  closeBtn.addEventListener('click', () => closeModal());

  // Click fuera del sheet para cerrar
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Tecla ESC para cerrar
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  window.addEventListener('keydown', handleKeyDown);

  activeModal = {
    overlay,
    sheet,
    onClose,
    cleanup: () => window.removeEventListener('keydown', handleKeyDown)
  };

  // Entrada animada
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('open');
  });

  if (typeof onRender === 'function') {
    onRender(sheet, closeModal);
  }

  return closeModal;
}

export function closeModal() {
  if (!activeModal) return;

  const { overlay, sheet, onClose, cleanup } = activeModal;
  cleanup();

  sheet.classList.remove('open');
  overlay.classList.remove('visible');

  setTimeout(() => {
    overlay.remove();
    document.body.classList.remove('modal-open');
    if (typeof onClose === 'function') onClose();
  }, 260);

  activeModal = null;
}
