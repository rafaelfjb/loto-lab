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
      <label class="filter-label" style="max-width:320px;margin-top:10px">Estratégia de geração
        <select id="statsRangePreset" class="field" aria-label="Estratégia de geração de jogos">
          <option value="random">Aleatório, sem filtros estatísticos</option>
          <option value="balanced">Equilibrado · perfil histórico</option>
          <option value="typical-sum">Soma típica · faixa histórica</option>
        </select>
      </label>
      <p id="statsRangePresetNote" class="game-set-note">Equilibrado aplica filtros de soma, pares, borda/centro e faixas verticais conforme o perfil histórico. Soma típica filtra apenas pela faixa histórica de soma. Jogos com mais de 15 dezenas têm as faixas ajustadas proporcionalmente.</p>
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
      card.querySelector('#statsRangePreset').disabled = true;
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
    const preset = card.querySelector('#statsRangePreset');
    preset.disabled = false;
    preset.value = savedPreset();
    refreshPresetNote();

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

  const PRESET_STORAGE_KEY = 'lotolab.stats-preset.v1';

  function savedPreset() {
    try {
      const preset = localStorage.getItem(PRESET_STORAGE_KEY);
      return preset === 'balanced' || preset === 'typical-sum' ? preset : 'random';
    } catch { return 'random'; }
  }

  function refreshPresetNote() {
    const note = document.querySelector('#statsRangePresetNote');
    const preset = document.querySelector('#statsRangePreset')?.value;
    if (!note) return;
    const text = preset === 'typical-sum'
      ? 'Soma típica aceita jogos cuja soma fique entre os percentis 5–95% das somas observadas no intervalo selecionado. Para jogos com mais de 15 dezenas, a faixa é ajustada proporcionalmente.'
      : preset === 'balanced'
        ? 'Equilibrado aplica filtros dos percentis 5–95% observados no intervalo para soma, pares, borda/centro e faixas verticais. Para jogos com mais de 15 dezenas, as faixas são ajustadas proporcionalmente.'
        : 'Aleatório não aplica filtros estatísticos. O intervalo será usado quando você selecionar um preset estatístico.';
    if (note.textContent !== text) note.textContent = text;
  }

  function selectedIntervalDraws() {
    if (!rangeState || !Array.isArray(data.draws)) return [];
    return data.draws
      .filter(draw => Number(draw.numero) >= rangeState.start && Number(draw.numero) <= rangeState.end)
      .filter(draw => Array.isArray(draw.dezenas) && draw.dezenas.length === rules.drawCount
        && new Set(draw.dezenas.map(Number)).size === rules.drawCount
        && draw.dezenas.every(n => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= rules.universe))
      .sort((a, b) => Number(a.numero) - Number(b.numero));
  }

  function quantile(values, proportion) {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * proportion;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function profileBounds(values, scale, minimum, maximum) {
    const low = quantile(values, 0.05) * scale;
    const high = quantile(values, 0.95) * scale;
    return { min: Math.max(minimum, Math.floor(low)), max: Math.min(maximum, Math.ceil(high)) };
  }

  function isBorderNumber(number) {
    return number <= 5 || number > 20 || (number - 1) % 5 === 0 || number % 5 === 0;
  }

  function balancedProfile(draws, pickCount) {
    const scale = pickCount / rules.drawCount;
    const sums = draws.map(draw => draw.dezenas.reduce((total, n) => total + Number(n), 0));
    const evens = draws.map(draw => draw.dezenas.filter(n => Number(n) % 2 === 0).length);
    const borders = draws.map(draw => draw.dezenas.filter(n => isBorderNumber(Number(n))).length);
    const vertical = Array.from({ length: 5 }, (_, column) => draws.map(draw =>
      draw.dezenas.filter(n => (Number(n) - 1) % 5 === column).length));
    return {
      sum: profileBounds(sums, scale, pickCount * (pickCount + 1) / 2, pickCount * (2 * rules.universe - pickCount + 1) / 2),
      even: profileBounds(evens, scale, 0, pickCount),
      border: profileBounds(borders, scale, 0, pickCount),
      vertical: vertical.map(values => profileBounds(values, scale, 0, Math.min(5, pickCount)))
    };
  }

  function matchesBalancedProfile(numbers, profile) {
    const sum = numbers.reduce((total, n) => total + n, 0);
    const evens = numbers.filter(n => n % 2 === 0).length;
    const borders = numbers.filter(isBorderNumber).length;
    const vertical = Array.from({ length: 5 }, (_, column) => numbers.filter(n => (n - 1) % 5 === column).length);
    const within = (value, bound) => value >= bound.min && value <= bound.max;
    return within(sum, profile.sum) && within(evens, profile.even) && within(borders, profile.border)
      && vertical.every((count, column) => within(count, profile.vertical[column]));
  }

  function generateBalancedSet() {
    const input = document.querySelector('#gameSetCount');
    const quantity = Number(input?.value);
    const size = Number(document.querySelector('#gameSetSize')?.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      toast('Informe uma quantidade inteira de jogos entre 1 e 100.');
      return;
    }
    if (!Number.isInteger(size) || size < rules.minPicks || size > rules.maxPicks) {
      toast(`Escolha de ${rules.minPicks} a ${rules.maxPicks} dezenas por jogo.`);
      return;
    }
    const draws = selectedIntervalDraws();
    if (!draws.length) {
      toast('Não há concursos válidos carregados neste intervalo para calcular o perfil.');
      return;
    }
    const profile = balancedProfile(draws, size);
    const used = new Set(data.games.filter(game => Array.isArray(game.dezenas) && game.dezenas.length === size)
      .map(game => game.dezenas.map(Number).sort((a, b) => a - b).join('-')));
    const generated = [];
    const batchName = `Conjunto equilibrado · ${new Date().toLocaleString('pt-BR')}`;
    const maxAttempts = Math.max(2000, Math.min(100000, quantity * 2000));
    let attempts = 0;
    while (generated.length < quantity && attempts < maxAttempts) {
      attempts++;
      const dezenas = randomGame(size);
      const key = dezenas.join('-');
      if (used.has(key) || !matchesBalancedProfile(dezenas, profile)) continue;
      used.add(key);
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: `Preset Equilibrado · concursos #${draws[0].numero}–#${draws.at(-1).numero} (${draws.length} registros) · percentis 5–95% para soma, pares, borda/centro e faixas verticais.`,
        dezenas,
        updatedAt: new Date().toISOString()
      });
    }
    if (!generated.length) {
      toast('Nenhum jogo atendeu ao perfil neste intervalo. Amplie o período ou use o modo aleatório sem filtros.');
      return;
    }
    const previous = data.games;
    data.games = [...data.games, ...generated];
    try { saveLocal(); }
    catch {
      data.games = previous;
      toast('Não foi possível salvar os jogos neste dispositivo. Libere espaço no navegador e tente novamente.');
      return;
    }
    render();
    toast(generated.length === quantity
      ? `${generated.length} jogos equilibrados de ${size} dezenas foram salvos individualmente.`
      : `${generated.length} de ${quantity} jogos equilibrados foram salvos; o limite de tentativas foi atingido sem completar o conjunto.`);
  }

  function generateTypicalSumSet() {
    const input = document.querySelector('#gameSetCount');
    const quantity = Number(input?.value);
    const size = Number(document.querySelector('#gameSetSize')?.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      toast('Informe uma quantidade inteira de jogos entre 1 e 100.');
      return;
    }
    if (!Number.isInteger(size) || size < rules.minPicks || size > rules.maxPicks) {
      toast(`Escolha de ${rules.minPicks} a ${rules.maxPicks} dezenas por jogo.`);
      return;
    }
    const draws = selectedIntervalDraws();
    if (!draws.length) {
      toast('Não há concursos válidos carregados neste intervalo para calcular a faixa de soma.');
      return;
    }
    const scale = size / rules.drawCount;
    const sums = draws.map(draw => draw.dezenas.reduce((total, n) => total + Number(n), 0));
    const sumBounds = profileBounds(sums, scale, size * (size + 1) / 2,
      size * (2 * rules.universe - size + 1) / 2);
    const used = new Set(data.games.filter(game => Array.isArray(game.dezenas) && game.dezenas.length === size)
      .map(game => game.dezenas.map(Number).sort((a, b) => a - b).join('-')));
    const generated = [];
    const batchName = `Conjunto soma típica · ${new Date().toLocaleString('pt-BR')}`;
    const maxAttempts = Math.max(2000, Math.min(100000, quantity * 2000));
    let attempts = 0;
    while (generated.length < quantity && attempts < maxAttempts) {
      attempts++;
      const dezenas = randomGame(size);
      const total = dezenas.reduce((sum, number) => sum + number, 0);
      const key = dezenas.join('-');
      if (used.has(key) || total < sumBounds.min || total > sumBounds.max) continue;
      used.add(key);
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: `Preset Soma típica · soma ${sumBounds.min}–${sumBounds.max} · concursos #${draws[0].numero}–#${draws.at(-1).numero} (${draws.length} registros) · percentis 5–95%.`,
        dezenas,
        updatedAt: new Date().toISOString()
      });
    }
    if (!generated.length) {
      toast('Nenhum jogo atendeu à faixa de soma típica neste intervalo. Amplie o período ou use o modo aleatório sem filtros.');
      return;
    }
    const previous = data.games;
    data.games = [...data.games, ...generated];
    try { saveLocal(); }
    catch {
      data.games = previous;
      toast('Não foi possível salvar os jogos neste dispositivo. Libere espaço no navegador e tente novamente.');
      return;
    }
    render();
    toast(generated.length === quantity
      ? `${generated.length} jogos de soma típica com ${size} dezenas foram salvos individualmente.`
      : `${generated.length} de ${quantity} jogos de soma típica foram salvos; o limite de tentativas foi atingido sem completar o conjunto.`);
  }

  function interceptStatisticalGeneration(event) {
    const button = event.target.closest('[data-action="generate-game-set"]');
    const preset = document.querySelector('#statsRangePreset')?.value;
    if (!button || !['balanced', 'typical-sum'].includes(preset)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (preset === 'balanced') generateBalancedSet();
    else generateTypicalSumSet();
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
    if (event.target.id === 'statsRangePreset') {
      const value = ['balanced', 'typical-sum'].includes(event.target.value) ? event.target.value : 'random';
      try { localStorage.setItem(PRESET_STORAGE_KEY, value); } catch {}
      refreshPresetNote();
    }
  });
  document.addEventListener('click', interceptStatisticalGeneration, true);

  const observer = new MutationObserver(refresh);
  const games = document.querySelector('#games');
  if (games) observer.observe(games, { childList: true, subtree: true });
  refresh();
})();
