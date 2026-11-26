(() => {
  'use strict';

  const STORAGE_KEY = 'lotolab.stats-range.v1';
  let rangeState = null;

  function availableDraws() {
    const select = document.querySelector('#games #drawSelect');
    if (!select) return [];
    return [...select.options]
      .map(option => Number(option.value))
      .filter(number => Number.isInteger(number) && number > 0)
      .filter((number, index, all) => all.indexOf(number) === index)
      .sort((a, b) => a - b);
  }

  function savedRange(min, max) {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Number.isInteger(value?.start) && Number.isInteger(value?.end)) {
        return {
          start: Math.min(max, Math.max(min, value.start)),
          end: Math.min(max, Math.max(min, value.end))
        };
      }
    } catch {}
    return { start: min, end: max };
  }

  function ensureCard() {
    const existing = document.querySelector('#statsRangeCard');
    if (existing) return existing;
    const randomCard = [...document.querySelectorAll('#games .gamegrid section.card')]
      .find(card => card.querySelector('h3')?.textContent.trim() === 'Gerar conjunto aleatório');
    if (!randomCard) return null;
    const card = document.createElement('section');
    card.className = 'card';
    card.id = 'statsRangeCard';
    card.innerHTML = `
      <div class="card-head">
        <h3>Intervalo de concursos para as estatísticas</h3>
        <span id="statsRangeCount">—</span>
      </div>
      <p class="muted" style="font-size:10px;margin:0">
        Defina o período histórico que será usado pelos filtros estatísticos da geração.
        O concurso final começa no último resultado disponível. Só entram no cálculo os concursos carregados dentro do intervalo.
      </p>
      <div class="game-set-controls" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <label class="filter-label">Concurso inicial
          <input id="statsRangeStart" class="field" type="number" inputmode="numeric" step="1" aria-label="Concurso inicial do intervalo estatístico">
        </label>
        <label class="filter-label">Concurso final
          <input id="statsRangeEnd" class="field" type="number" inputmode="numeric" step="1" aria-label="Concurso final do intervalo estatístico">
        </label>
      </div>
      <p id="statsRangeSummary" class="game-set-note" aria-live="polite"></p>`;
    randomCard.insertAdjacentElement('beforebegin', card);
    return card;
  }

  function refresh() {
    const card = ensureCard();
    if (!card) return;
    const startInput = card.querySelector('#statsRangeStart');
    const endInput = card.querySelector('#statsRangeEnd');
    const countLabel = card.querySelector('#statsRangeCount');
    const summary = card.querySelector('#statsRangeSummary');
    const draws = availableDraws();

    if (!draws.length) {
      startInput.disabled = true;
      endInput.disabled = true;
      startInput.value = '';
      endInput.value = '';
      startInput.removeAttribute('min');
      startInput.removeAttribute('max');
      endInput.removeAttribute('min');
      endInput.removeAttribute('max');
      if (countLabel.textContent !== '0 concursos') countLabel.textContent = '0 concursos';
      if (summary.textContent !== 'Carregue resultados para escolher um intervalo.') {
        summary.textContent = 'Carregue resultados para escolher um intervalo.';
      }
      return;
    }

    const min = draws[0];
    const max = draws.at(-1);
    startInput.min = endInput.min = String(min);
    startInput.max = endInput.max = String(max);
    startInput.disabled = endInput.disabled = false;

    if (!rangeState || rangeState.start < min || rangeState.start > max || rangeState.end < min || rangeState.end > max) {
      rangeState = savedRange(min, max);
    }
    if (rangeState.start > rangeState.end) rangeState = { start: min, end: max };
    startInput.value = String(rangeState.start);
    endInput.value = String(rangeState.end);

    const count = draws.filter(number => number >= rangeState.start && number <= rangeState.end).length;
    const label = `${count} ${count === 1 ? 'concurso disponível' : 'concursos disponíveis'}`;
    const text = `Intervalo selecionado: #${rangeState.start}–#${rangeState.end} · ${count} concursos carregados.`;
    if (countLabel.textContent !== label) countLabel.textContent = label;
    if (summary.textContent !== text) summary.textContent = text;
  }

  function setEndpoint(endpoint, rawValue) {
    const draws = availableDraws();
    if (!draws.length) return;
    const min = draws[0];
    const max = draws.at(-1);
    const value = Number(rawValue);
    if (!Number.isInteger(value)) {
      refresh();
      return;
    }
    if (!rangeState) rangeState = savedRange(min, max);
    const selected = Math.min(max, Math.max(min, value));
    if (endpoint === 'start') {
      rangeState.start = selected;
      if (selected > rangeState.end) rangeState.end = selected;
    } else {
      rangeState.end = selected;
      if (selected < rangeState.start) rangeState.start = selected;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rangeState)); } catch {}
    refresh();
    document.dispatchEvent(new CustomEvent('lotolab:stats-range-change', {
      detail: { start: rangeState.start, end: rangeState.end, drawCount: draws.filter(n => n >= rangeState.start && n <= rangeState.end).length }
    }));
  }

  document.addEventListener('change', event => {
    if (event.target.id === 'statsRangeStart') setEndpoint('start', event.target.value);
    if (event.target.id === 'statsRangeEnd') setEndpoint('end', event.target.value);
  });

  const observer = new MutationObserver(refresh);
  const games = document.querySelector('#games');
  if (games) observer.observe(games, { childList: true, subtree: true });
  refresh();
})();
