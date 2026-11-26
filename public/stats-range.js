(() => {
  'use strict';

  const STORAGE_KEY = 'lotolab.stats-range.v1';
  let rangeState = null;
  let sumFilterState = null;

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
          <option value="overdue">Atrasadas · maior tempo sem sair</option>
        </select>
      </label>
      <p id="statsRangePresetNote" class="game-set-note">Equilibrado aplica filtros de soma, pares, borda/centro e faixas verticais conforme o perfil histórico. Soma típica filtra apenas pela faixa histórica de soma. Jogos com mais de 15 dezenas têm as faixas ajustadas proporcionalmente.</p>
      <div class="game-set-controls" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px">
        <label class="filter-label" style="grid-column:1/-1">Filtro de soma adicional
          <select id="statsSumFilterMode" class="field" aria-label="Modo do filtro de soma">
            <option value="off">Desativado</option>
            <option value="typical">Faixa típica do período · percentis 5–95%</option>
            <option value="manual">Faixa manual</option>
          </select>
        </label>
        <div id="statsSumManualFields" style="display:none;grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
          <label class="filter-label">Soma mínima
            <input id="statsSumMin" class="field" type="number" step="1" inputmode="numeric" aria-label="Soma mínima permitida">
          </label>
          <label class="filter-label">Soma máxima
            <input id="statsSumMax" class="field" type="number" step="1" inputmode="numeric" aria-label="Soma máxima permitida">
          </label>
        </div>
      </div>
      <p id="statsSumFilterSummary" class="game-set-note" aria-live="polite">O filtro adicional pode ser combinado com qualquer estratégia.</p>
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
      refreshSumFilter();
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
    refreshSumFilter();
  }

  const PRESET_STORAGE_KEY = 'lotolab.stats-preset.v1';

  const SUM_FILTER_STORAGE_KEY = 'lotolab.stats-sum-filter.v1';

  function savedSumFilter() {
    try {
      const value = JSON.parse(localStorage.getItem(SUM_FILTER_STORAGE_KEY) || 'null');
      const mode = ['typical', 'manual'].includes(value?.mode) ? value.mode : 'off';
      return {
        mode,
        min: Number.isInteger(value?.min) ? value.min : null,
        max: Number.isInteger(value?.max) ? value.max : null
      };
    } catch { return { mode: 'off', min: null, max: null }; }
  }

  function sumFilterSettings() {
    if (!sumFilterState) sumFilterState = savedSumFilter();
    return sumFilterState;
  }

  function sumBoundsForSize(size) {
    return {
      min: size * (size + 1) / 2,
      max: size * (2 * rules.universe - size + 1) / 2
    };
  }

  function refreshSumFilter() {
    const modeInput = document.querySelector('#statsSumFilterMode');
    const minInput = document.querySelector('#statsSumMin');
    const maxInput = document.querySelector('#statsSumMax');
    const fields = document.querySelector('#statsSumManualFields');
    const summary = document.querySelector('#statsSumFilterSummary');
    if (!modeInput || !summary) return;
    const settings = sumFilterSettings();
    const size = Number(document.querySelector('#gameSetSize')?.value) || rules.drawCount;
    const possible = sumBoundsForSize(size);
    modeInput.value = settings.mode;
    if (fields) fields.style.display = settings.mode === 'manual' ? 'grid' : 'none';
    if (minInput && maxInput) {
      minInput.min = maxInput.min = String(possible.min);
      minInput.max = maxInput.max = String(possible.max);
      const min = Math.min(possible.max, Math.max(possible.min, settings.min ?? possible.min));
      const max = Math.min(possible.max, Math.max(possible.min, settings.max ?? possible.max));
      minInput.value = String(min);
      maxInput.value = String(Math.max(min, max));
    }
    let text;
    if (settings.mode === 'manual') {
      const minimum = minInput?.value || possible.min;
      const maximum = maxInput?.value || possible.max;
      text = `Faixa manual: soma ${minimum}–${maximum}. Para ${size} dezenas, os limites possíveis são ${possible.min}–${possible.max}.`;
    } else if (settings.mode === 'typical') {
      const draws = selectedIntervalDraws();
      if (!draws.length) text = 'Selecione um intervalo com concursos carregados para calcular a faixa típica de soma.';
      else {
        const scale = size / rules.drawCount;
        const sums = draws.map(draw => draw.dezenas.reduce((total, n) => total + Number(n), 0));
        const bounds = profileBounds(sums, scale, possible.min, possible.max);
        text = `Faixa típica aplicada: soma ${bounds.min}–${bounds.max} (percentis 5–95% dos concursos #${draws[0].numero}–#${draws.at(-1).numero}).`;
      }
    } else {
      text = 'Filtro adicional desativado. Presets estatísticos ainda aplicam seus próprios critérios.';
    }
    if (summary.textContent !== text) summary.textContent = text;
  }

  function resolveSumFilter(draws, size) {
    const mode = sumFilterSettings().mode;
    if (mode === 'off') return { valid: true, mode, bounds: null };
    const possible = sumBoundsForSize(size);
    if (mode === 'manual') {
      const minInput = document.querySelector('#statsSumMin');
      const maxInput = document.querySelector('#statsSumMax');
      const minText = minInput ? minInput.value : sumFilterSettings().min;
      const maxText = maxInput ? maxInput.value : sumFilterSettings().max;
      const min = minText === '' || minText == null ? NaN : Number(minText);
      const max = maxText === '' || maxText == null ? NaN : Number(maxText);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < possible.min || max > possible.max || min > max) {
        return { valid: false, error: `Informe uma faixa de soma inteira entre ${possible.min} e ${possible.max}, com mínimo menor ou igual ao máximo.` };
      }
      return { valid: true, mode, bounds: { min, max } };
    }
    if (!draws.length) return { valid: false, error: 'Não há concursos válidos carregados no intervalo para calcular a faixa típica de soma.' };
    const scale = size / rules.drawCount;
    const sums = draws.map(draw => draw.dezenas.reduce((total, n) => total + Number(n), 0));
    return { valid: true, mode, bounds: profileBounds(sums, scale, possible.min, possible.max) };
  }

  function sumFilterMatches(total, filter) {
    return !filter?.bounds || (total >= filter.bounds.min && total <= filter.bounds.max);
  }

  function sumFilterAnnotation(filter) {
    if (!filter || filter.mode === 'off' || !filter.bounds) return '';
    const label = filter.mode === 'manual' ? 'manual' : 'típica do período (percentis 5–95%)';
    return `Filtro adicional de soma ${label}: ${filter.bounds.min}–${filter.bounds.max}.`;
  }

  function appendSumFilterAnnotation(observation, filter) {
    const annotation = sumFilterAnnotation(filter);
    return annotation ? `${observation} ${annotation}` : observation;
  }

  function saveSumFilterFromInputs() {
    const mode = document.querySelector('#statsSumFilterMode')?.value;
    const minText = document.querySelector('#statsSumMin')?.value;
    const maxText = document.querySelector('#statsSumMax')?.value;
    sumFilterState = {
      mode: ['typical', 'manual'].includes(mode) ? mode : 'off',
      min: minText !== '' && Number.isInteger(Number(minText)) ? Number(minText) : null,
      max: maxText !== '' && Number.isInteger(Number(maxText)) ? Number(maxText) : null
    };
    try { localStorage.setItem(SUM_FILTER_STORAGE_KEY, JSON.stringify(sumFilterState)); } catch {}
    refreshSumFilter();
  }

  function savedPreset() {
    try {
      const preset = localStorage.getItem(PRESET_STORAGE_KEY);
      return ['balanced', 'typical-sum', 'overdue'].includes(preset) ? preset : 'random';
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
        : preset === 'overdue'
          ? 'Atrasadas dá maior peso às dezenas há mais concursos sem sair no intervalo selecionado (peso = 1 + atraso). Isso não prevê resultados nem aumenta a probabilidade de acerto.'
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
    const sumFilter = resolveSumFilter(draws, size);
    if (!sumFilter.valid) { toast(sumFilter.error); return; }
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
      const total = dezenas.reduce((sum, number) => sum + number, 0);
      if (used.has(key) || !matchesBalancedProfile(dezenas, profile) || !sumFilterMatches(total, sumFilter)) continue;
      used.add(key);
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: appendSumFilterAnnotation(`Preset Equilibrado · concursos #${draws[0].numero}–#${draws.at(-1).numero} (${draws.length} registros) · percentis 5–95% para soma, pares, borda/centro e faixas verticais.`, sumFilter),
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
    const sumFilter = resolveSumFilter(draws, size);
    if (!sumFilter.valid) { toast(sumFilter.error); return; }
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
      if (used.has(key) || total < sumBounds.min || total > sumBounds.max || !sumFilterMatches(total, sumFilter)) continue;
      used.add(key);
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: appendSumFilterAnnotation(`Preset Soma típica · soma ${sumBounds.min}–${sumBounds.max} · concursos #${draws[0].numero}–#${draws.at(-1).numero} (${draws.length} registros) · percentis 5–95%.`, sumFilter),
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

  function delaysInInterval(draws) {
    const delayByNumber = new Array(rules.universe + 1).fill(draws.length);
    const found = new Set();
    for (let index = draws.length - 1; index >= 0; index--) {
      for (const rawNumber of draws[index].dezenas) {
        const number = Number(rawNumber);
        if (!found.has(number)) {
          delayByNumber[number] = draws.length - 1 - index;
          found.add(number);
        }
      }
    }
    return delayByNumber;
  }

  function weightedGame(size, delayByNumber) {
    const pool = Array.from({ length: rules.universe }, (_, index) => index + 1);
    const chosen = [];
    while (chosen.length < size && pool.length) {
      const totalWeight = pool.reduce((total, number) => total + 1 + delayByNumber[number], 0);
      let ticket = Math.random() * totalWeight;
      let selectedIndex = pool.length - 1;
      for (let index = 0; index < pool.length; index++) {
        ticket -= 1 + delayByNumber[pool[index]];
        if (ticket < 0) {
          selectedIndex = index;
          break;
        }
      }
      chosen.push(pool.splice(selectedIndex, 1)[0]);
    }
    return chosen.sort((a, b) => a - b);
  }

  function generateOverdueSet() {
    const quantity = Number(document.querySelector('#gameSetCount')?.value);
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
      toast('Não há concursos válidos carregados neste intervalo para calcular os atrasos.');
      return;
    }
    const delayByNumber = delaysInInterval(draws);
    const sumFilter = resolveSumFilter(draws, size);
    if (!sumFilter.valid) { toast(sumFilter.error); return; }
    const used = new Set(data.games.filter(game => Array.isArray(game.dezenas) && game.dezenas.length === size)
      .map(game => game.dezenas.map(Number).sort((a, b) => a - b).join('-')));
    const generated = [];
    const batchName = `Conjunto atrasadas · ${new Date().toLocaleString('pt-BR')}`;
    const maxAttempts = Math.max(2000, Math.min(100000, quantity * 2000));
    let attempts = 0;
    while (generated.length < quantity && attempts < maxAttempts) {
      attempts++;
      const dezenas = weightedGame(size, delayByNumber);
      const key = dezenas.join('-');
      const total = dezenas.reduce((sum, number) => sum + number, 0);
      if (used.has(key) || !sumFilterMatches(total, sumFilter)) continue;
      used.add(key);
      const averageDelay = dezenas.reduce((total, number) => total + delayByNumber[number], 0) / size;
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: appendSumFilterAnnotation(`Preset Atrasadas · atraso médio das dezenas: ${averageDelay.toFixed(1)} concursos · peso 1 + atraso · concursos #${draws[0].numero}–#${draws.at(-1).numero} (${draws.length} registros). Atrasos não preveem resultados nem aumentam a probabilidade de acerto.`, sumFilter),
        dezenas,
        updatedAt: new Date().toISOString()
      });
    }
    if (!generated.length) {
      toast('Não foi possível gerar combinações inéditas neste intervalo. Amplie o período ou use outro preset.');
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
      ? `${generated.length} jogos Atrasadas de ${size} dezenas foram salvos individualmente.`
      : `${generated.length} de ${quantity} jogos Atrasadas foram salvos; o limite de tentativas foi atingido sem completar o conjunto.`);
  }

  function generateRandomWithSumFilter() {
    const quantity = Number(document.querySelector('#gameSetCount')?.value);
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
    const sumFilter = resolveSumFilter(draws, size);
    if (!sumFilter.valid) { toast(sumFilter.error); return; }
    const used = new Set(data.games.filter(game => Array.isArray(game.dezenas) && game.dezenas.length === size)
      .map(game => game.dezenas.map(Number).sort((a, b) => a - b).join('-')));
    const generated = [];
    const batchName = `Conjunto aleatório com filtro de soma · ${new Date().toLocaleString('pt-BR')}`;
    const maxAttempts = Math.max(2000, Math.min(100000, quantity * 2000));
    let attempts = 0;
    while (generated.length < quantity && attempts < maxAttempts) {
      attempts++;
      const dezenas = randomGame(size);
      const total = dezenas.reduce((sum, number) => sum + number, 0);
      const key = dezenas.join('-');
      if (used.has(key) || !sumFilterMatches(total, sumFilter)) continue;
      used.add(key);
      generated.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${generated.length}-${Math.random()}`,
        nome: `${batchName} · ${size} dezenas · jogo ${String(generated.length + 1).padStart(2, '0')}`,
        observacao: appendSumFilterAnnotation(`Preset Aleatório · concursos #${draws[0]?.numero ?? '—'}–#${draws.at(-1)?.numero ?? '—'}${draws.length ? ` (${draws.length} registros)` : ''}.`, sumFilter),
        dezenas,
        updatedAt: new Date().toISOString()
      });
    }
    if (!generated.length) {
      toast('Nenhum jogo atendeu à faixa de soma. Amplie a faixa ou, para o modo típico, amplie o período estatístico.');
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
      ? `${generated.length} jogos aleatórios com filtro de soma foram salvos individualmente.`
      : `${generated.length} de ${quantity} jogos com filtro de soma foram salvos; o limite de tentativas foi atingido sem completar o conjunto.`);
  }

  function interceptStatisticalGeneration(event) {
    const button = event.target.closest('[data-action="generate-game-set"]');
    const preset = document.querySelector('#statsRangePreset')?.value;
    const filterMode = sumFilterSettings().mode;
    if (!button) return;
    if (preset === 'random' && filterMode === 'off') return;
    if (!['random', 'balanced', 'typical-sum', 'overdue'].includes(preset)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (preset === 'balanced') generateBalancedSet();
    else if (preset === 'typical-sum') generateTypicalSumSet();
    else if (preset === 'overdue') generateOverdueSet();
    else generateRandomWithSumFilter();
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
      const value = ['balanced', 'typical-sum', 'overdue'].includes(event.target.value) ? event.target.value : 'random';
      try { localStorage.setItem(PRESET_STORAGE_KEY, value); } catch {}
      refreshPresetNote();
    }
    if (['statsSumFilterMode', 'statsSumMin', 'statsSumMax'].includes(event.target.id)) saveSumFilterFromInputs();
    if (event.target.id === 'gameSetSize') refreshSumFilter();
  });
  document.addEventListener('click', interceptStatisticalGeneration, true);

  const observer = new MutationObserver(refresh);
  const games = document.querySelector('#games');
  if (games) observer.observe(games, { childList: true, subtree: true });
  refresh();
})();
