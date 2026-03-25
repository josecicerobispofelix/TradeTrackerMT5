const whatsappNumber = '5599999999999';

function buildWhatsAppUrl(text) {
  const base = `https://wa.me/${whatsappNumber}`;
  const msg = encodeURIComponent(text);
  return `${base}?text=${msg}`;
}

function openWhatsApp(text) {
  const url = buildWhatsAppUrl(text);
  window.location.href = url;
}

function defaultMessage() {
  return [
    'Olá! Quero meu cardápio digital pronto.',
    '',
    'Pode me ajudar com a criação e publicação?'
  ].join('\n');
}

function wireCtas() {
  const buttons = document.querySelectorAll('[data-whatsapp-cta]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      openWhatsApp(defaultMessage());
    });
  });
}

function wireForm() {
  const form = document.getElementById('leadForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const nome = String(data.get('nome') || '').trim();
    const estabelecimento = String(data.get('estabelecimento') || '').trim();
    const cidade = String(data.get('cidade') || '').trim();
    const whatsapp = String(data.get('whatsapp') || '').trim();

    const text = [
      'Olá! Quero meu cardápio digital pronto.',
      '',
      `Nome: ${nome}`,
      `Estabelecimento: ${estabelecimento}`,
      `Cidade/UF: ${cidade}`,
      `Meu WhatsApp: ${whatsapp}`,
      '',
      'Quero receber o link e o QR Code prontos, com até 30 itens cadastrados.'
    ].join('\n');

    openWhatsApp(text);
  });
}

function enhanceFaq() {
  const items = Array.from(document.querySelectorAll('.faq-item'));
  items.forEach((el) => {
    el.addEventListener('toggle', () => {
      if (!el.open) return;
      items.forEach((other) => {
        if (other !== el) other.open = false;
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireCtas();
  wireForm();
  enhanceFaq();
  initInspector();
});

function initInspector() {
  const toggleBtn = document.querySelector('[data-inspector-toggle]');
  const panel = document.querySelector('[data-inspector-panel]');
  const closeBtn = document.querySelector('[data-inspector-close]');
  const copyBtn = document.querySelector('[data-inspector-copy]');
  const keepBtn = document.querySelector('[data-inspector-keep]');
  const sectionEl = document.querySelector('[data-inspector-section]');
  const selectorEl = document.querySelector('[data-inspector-selector]');
  const textEl = document.querySelector('[data-inspector-text]');

  if (!toggleBtn || !panel || !closeBtn || !copyBtn || !keepBtn || !sectionEl || !selectorEl || !textEl) {
    return;
  }

  let isOn = false;
  let highlighted = null;
  let lastPayload = null;

  function setOn(next) {
    isOn = next;
    document.body.classList.toggle('inspector-on', isOn);
    toggleBtn.classList.toggle('is-on', isOn);
    toggleBtn.textContent = `Modo de ajustes: ${isOn ? 'ON' : 'OFF'}`;
    if (!isOn) {
      panel.setAttribute('aria-hidden', 'true');
      clearHighlight();
    }
  }

  function clearHighlight() {
    if (highlighted) highlighted.classList.remove('inspector-highlight');
    highlighted = null;
  }

  function shouldIgnoreTarget(target) {
    return Boolean(
      target.closest('[data-inspector-panel]') ||
        target.closest('[data-inspector-toggle]') ||
        target.closest('[data-inspector-close]') ||
        target.closest('[data-inspector-copy]') ||
        target.closest('[data-inspector-keep]')
    );
  }

  function getSectionName(target) {
    const section = target.closest('[data-section]');
    return section ? section.getAttribute('data-section') : '-';
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return '-';
    const parts = [];
    let curr = el;

    while (curr && curr.nodeType === 1 && parts.length < 4) {
      let part = curr.tagName.toLowerCase();
      if (curr.id) {
        part += `#${curr.id}`;
        parts.unshift(part);
        break;
      }

      const cls = (curr.className || '')
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
      if (cls.length) part += `.${cls.join('.')}`;
      parts.unshift(part);
      curr = curr.parentElement;
    }

    return parts.join(' > ');
  }

  function extractText(el) {
    if (!el) return '-';
    const raw = (el.innerText || el.textContent || '').toString();
    const clean = raw.replace(/\s+/g, ' ').trim();
    return clean.length ? clean.slice(0, 180) : '-';
  }

  function openPanel(payload) {
    lastPayload = payload;
    sectionEl.textContent = payload.section;
    selectorEl.textContent = payload.selector;
    textEl.textContent = payload.text;
    panel.setAttribute('aria-hidden', 'false');
  }

  async function copyPayload() {
    if (!lastPayload) return;
    const text = [
      `Seção: ${lastPayload.section}`,
      `Elemento: ${lastPayload.selector}`,
      `Texto: ${lastPayload.text}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copiado!';
      window.setTimeout(() => (copyBtn.textContent = 'Copiar'), 900);
    } catch {
      // Fallback simples
      window.prompt('Copie o texto abaixo:', text);
    }
  }

  function findBestTarget(target) {
    if (!target || target === document.body || target === document.documentElement) return null;

    const interactive = target.closest('button, a, input, textarea, summary, label');
    if (interactive) return interactive;

    const texty = target.closest('h1, h2, h3, p, li, span, strong');
    if (texty) return texty;

    return target;
  }

  toggleBtn.addEventListener('click', () => setOn(!isOn));

  closeBtn.addEventListener('click', () => {
    panel.setAttribute('aria-hidden', 'true');
    clearHighlight();
  });

  copyBtn.addEventListener('click', copyPayload);

  keepBtn.addEventListener('click', () => {
    // Mantém o destaque atual (não faz nada) — útil quando você quer apontar visualmente
    // para um elemento e ir ajustando CSS.
  });

  document.addEventListener('click', (e) => {
    if (!isOn) return;
    const target = e.target;
    if (!target) return;
    if (shouldIgnoreTarget(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const best = findBestTarget(target);
    if (!best) return;

    clearHighlight();
    highlighted = best;
    highlighted.classList.add('inspector-highlight');

    openPanel({
      section: getSectionName(best),
      selector: buildSelector(best),
      text: extractText(best)
    });
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      panel.setAttribute('aria-hidden', 'true');
      clearHighlight();
      setOn(false);
    }
  });
}
