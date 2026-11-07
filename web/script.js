const byId = id => document.getElementById(id);
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, '0');
const addressText = value => '0x' + hex(value);
const operationName = request => request.write ? 'Write' : 'Read';
const cacheNames = ['Direct-mapped', 'Two-way LRU'];
const traceLabels = {
  conflict: 'Alternating conflict',
  lru: 'LRU replacement',
  repeated: 'Repeated address',
  sequential: 'Sequential bytes',
  capacity: 'Capacity overflow',
  three_blocks: 'Three colliding blocks',
  mixed: 'Mixed reads and writes'
};
const scenarios = {
  ...PROJECT_DATA.traces,
  lru_demo: PROJECT_DATA.traces.lru.slice(0, 4),
  conflict_demo: PROJECT_DATA.traces.conflict.slice(0, 4),
  write_demo: [
    {write: true, address: 0x0043, data: 0x2A},
    {write: false, address: 0x0043, data: 0},
    {write: false, address: 0x0042, data: 0}
  ],
  custom: []
};
const intro = {
  lru_demo: 'All four requests go to set 0. Select Next access to see how least recently used (LRU) replacement works.',
  conflict_demo: 'Both addresses map to line 0 in direct mapping and set 0 in two-way. Learn what changes when the set can hold two blocks.',
  write_demo: 'Write 0x2A to offset 3, read it back, then read the neighboring byte at offset 2.'
};
const lruStory = [
  'A misses and fills Way 0. An empty way can accept a new block.',
  'B misses and fills Way 1. Both blocks now fit in set 0. A is the older block.',
  'A hits in Way 0 and becomes the most recently used block. B is now the next victim.',
  'C misses. Both ways are full, so two-way LRU evicts B. A stays in Way 0.'
];
const lruBlocks = {0x0000: 'A', 0x0040: 'B', 0x0080: 'C'};

let scenario = 'lru_demo';
let caches;
let position = 0;
let timer = null;

function renderQueue() {
  const trace = scenarios[scenario];
  const queue = byId('queue');
  queue.replaceChildren();
  byId('seek-row').hidden = trace.length <= 8;
  byId('seek').max = trace.length;
  if (trace.length > 8) return;
  if (!trace.length) {
    const message = document.createElement('span');
    message.textContent = 'Add an address using the custom trace form.';
    queue.append(message);
  }
  trace.forEach((request, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    const block = scenario === 'lru_demo' || scenario === 'lru'
      ? lruBlocks[request.address] : request.write ? 'W' : 'R';
    button.textContent = `${block} ${addressText(request.address)}`;
    button.setAttribute('aria-label', `Request ${index + 1}, ${operationName(request)} ${addressText(request.address)}`);
    button.addEventListener('click', () => {
      pause();
      goTo(index + 1);
    });
    queue.append(button);
  });
}

function showLine(cache, index, way, result, label) {
  const line = cache.sets[index][way];
  const active = result && result.index === index && result.way === way;
  const block = addressText((line.tag * cache.setCount + index) * 4);
  const fullSet = cache.ways === 2 && cache.sets[index].every(slot => slot.valid);
  const recency = fullSet ? (cache.lru[index] === way ? 'Next victim' : 'Most recent') : '';
  return `<div class="line${active ? ' active' : ''}">
    <div class="line-label"><span>${label}</span><small>${recency}</small></div>
    <strong class="block">${line.valid ? block : 'Empty'}</strong>
    <div class="bytes">${line.bytes.map((byte, offset) =>
      `<span${active && offset === result.offset ? ' class="selected"' : ''}>${line.valid ? hex(byte, 2) : '··'}</span>`
    ).join('')}</div>
  </div>`;
}

function explain(cache, result) {
  if (!result) return 'All lines start empty.';
  const location = cache.ways === 2 ? `Way ${result.way}` : `Line ${result.index}`;
  const byte = '0x' + hex(result.result, 2);
  const operation = result.write ? `Wrote ${byte} to cache and memory.` : `Read ${byte}.`;
  if (result.hit) return `${location} has a matching tag. ${operation}`;
  if (result.evicted !== null) return `${location} replaces ${addressText(result.evicted)}. ${operation}`;
  return `${location} was empty, so it takes the fetched block. ${operation}`;
}

function renderCache(cache, name, index) {
  const result = cache.last;
  const target = result?.index ?? index;
  const state = result ? (result.hit ? 'Hit' : 'Miss') : 'Ready';
  const setText = cache.ways === 2 ? `Showing set ${target}` : `Showing line ${target}`;
  return `<article class="cache">
    <div class="cache-header"><div><h3>${name}</h3><p>${cache.setCount} ${cache.ways === 2 ? 'sets × 2 ways' : 'lines × 1 way'}</p></div>
      <span class="result ${state.toLowerCase()}">${state}${result ? ` · ${result.cycles} cycles` : ''}</span>
    </div>
    <p class="location">${setText}</p>
    <div class="lines">${cache.sets[target].map((_, way) =>
      showLine(cache, target, way, result, cache.ways === 2 ? `Way ${way}` : `Line ${target}`)
    ).join('')}</div>
    <p class="reason">${explain(cache, result)}</p>
    <div class="summary-row"><span>${cache.hits} / ${cache.requests} hits</span><span>${cache.cycles} total cycles</span></div>
  </article>`;
}

function renderDetails(request) {
  byId('details-content').innerHTML = caches.map((cache, i) => {
    const address = request?.address ?? 0;
    const {index, tag, offset} = decodeAddress(address, cache.setCount);
    const indexBits = cache.ways === 2 ? 3 : 4;
    const parts = [
      ['Tag', tag, 14 - indexBits],
      [cache.ways === 2 ? 'Set' : 'Line', index, indexBits],
      ['Offset', offset, 2]
    ];
    const timing = cache.last
      ? cycleBreakdown(cache.last).map(step => `${step.label} (${step.cycles})`).join(' → ')
      : 'Step once to see the cycle breakdown.';
    return `<article><h3>${cacheNames[i]} · ${addressText(address)}</h3><div class="field-list">${parts.map(
      ([label, value, width]) => `<span>${label} ${value}<b>${value.toString(2).padStart(width, '0')}</b></span>`
    ).join('')}</div><p>${timing}</p></article>`;
  }).join('');
}

function renderAllLines() {
  byId('all-lines-content').innerHTML = caches.map((cache, i) =>
    `<article><h3>${cacheNames[i]}</h3>${cache.sets.map((set, index) =>
      `<div class="detail-set"><p>${cache.ways === 2 ? 'Set' : 'Line'} ${index}</p><div class="lines">${set.map((_, way) =>
        showLine(cache, index, way, cache.last, cache.ways === 2 ? `Way ${way}` : `Line ${index}`)
      ).join('')}</div></div>`
    ).join('')}</article>`
  ).join('');
}

function render() {
  const trace = scenarios[scenario];
  const request = trace[position ? position - 1 : 0];
  byId('progress').textContent = `${position} / ${trace.length} completed`;
  byId('seek').value = position;
  byId('previous').disabled = position === 0;
  byId('next').disabled = position === trace.length;
  byId('reset').disabled = position === 0;
  byId('play').disabled = !trace.length || position === trace.length;
  byId('request-label').textContent = !request ? 'Waiting for a request'
    : position ? operationName(request) + ' request' : 'First request';
  byId('request-address').textContent = request
    ? addressText(request.address) + (request.write ? ' ← 0x' + hex(request.data, 2) : '') : '—';

  const [direct, twoWay] = caches.map(cache => cache.last);
  const summary = twoWay && (direct.hit === twoWay.hit
    ? `Both caches ${twoWay.hit ? 'hit' : 'miss'} on this request.`
    : `${direct.hit ? 'Direct mapping hits and two-way misses.' : 'Direct mapping misses and two-way hits.'}`);
  byId('narration').textContent = position
    ? ((scenario === 'lru_demo' || scenario === 'lru') && lruStory[position - 1]) || summary
    : intro[scenario] || (trace.length ? 'Both caches are empty. Select Next access to send the first request.' : 'Add a read or write to begin.');
  byId('caches').innerHTML = caches.map((cache, i) =>
    renderCache(cache, cacheNames[i], decodeAddress(request?.address ?? 0, cache.setCount).index)
  ).join('');
  [...byId('queue').children].forEach((button, i) => {
    button.classList.toggle('past', i < position);
    button.classList.toggle('next', i === position);
    if (i + 1 === position) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  if (byId('details').open) renderDetails(request);
  if (byId('all-lines').open) renderAllLines();
}

function goTo(step) {
  const trace = scenarios[scenario];
  // Replay from reset when stepping backward so memory writes rewind too.
  if (step < position || !caches) {
    caches = [new Cache(1), new Cache(2)];
    position = 0;
  }
  while (position < step) {
    for (const cache of caches) cache.access(trace[position]);
    position += 1;
  }
  if (position === trace.length) pause();
  render();
}

function pause() {
  clearInterval(timer);
  timer = null;
  byId('play').textContent = 'Play';
  byId('play').setAttribute('aria-pressed', 'false');
}

function selectScenario(name) {
  pause();
  scenario = name;
  byId('scenario').value = name;
  if (name === 'custom') byId('custom').open = true;
  caches = null;
  renderQueue();
  goTo(0);
}

byId('scenario').addEventListener('change', event => selectScenario(event.target.value));
byId('reset').addEventListener('click', () => { pause(); goTo(0); });
byId('previous').addEventListener('click', () => { pause(); goTo(position - 1); });
byId('next').addEventListener('click', () => { pause(); goTo(position + 1); });
byId('play').addEventListener('click', () => {
  if (timer !== null) {
    pause();
    return;
  }
  byId('play').textContent = 'Pause';
  byId('play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => goTo(position + 1), 950);
});
byId('seek').addEventListener('input', event => { pause(); goTo(Number(event.target.value)); });
byId('operation').addEventListener('change', event => { byId('byte').disabled = event.target.value !== 'write'; });
byId('details').addEventListener('toggle', () => {
  if (byId('details').open) renderDetails(scenarios[scenario][Math.max(0, position - 1)]);
});
byId('all-lines').addEventListener('toggle', () => { if (byId('all-lines').open) renderAllLines(); });

function inputHex(id, maxDigits) {
  const value = byId(id).value.trim().replace(/^0x/i, '');
  const valid = /^[0-9a-f]+$/i.test(value) && value.length <= maxDigits;
  return valid ? Number.parseInt(value, 16) : NaN;
}

byId('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const write = byId('operation').value === 'write';
  const address = inputHex('address', 4);
  const data = write ? inputHex('byte', 2) : 0;
  if (Number.isNaN(address) || Number.isNaN(data)) {
    byId('form-error').textContent = 'Enter a hex address from 0000 to FFFF and, for writes, a hex byte from 00 to FF.';
    return;
  }
  byId('form-error').textContent = '';
  scenarios.custom.push({write, address, data});
  if (scenario === 'custom') {
    pause();
    renderQueue();
    render();
  } else selectScenario('custom');
});

byId('clear-custom').addEventListener('click', () => {
  scenarios.custom.length = 0;
  byId('form-error').textContent = '';
  if (scenario === 'custom') selectScenario('custom');
});

for (const [key, label] of Object.entries(traceLabels)) {
  const direct = PROJECT_DATA.results.find(row => row.trace === key && row.cache === 'direct');
  const twoWay = PROJECT_DATA.results.find(row => row.trace === key && row.cache === '2way');
  const row = document.createElement('tr');
  const cells = [[direct, twoWay], [twoWay, direct]].map(([result, other]) => {
    const hitClass = Number(result.hit_rate_percent) > Number(other.hit_rate_percent) ? 'better' : '';
    const cycleClass = Number(result.total_service_cycles) < Number(other.total_service_cycles) ? 'better' : '';
    return `<td><span class="${hitClass}">${result.hit_rate_percent}% hits</span>
      <span class="${cycleClass}">${result.total_service_cycles} cycles</span></td>`;
  });
  row.innerHTML = `<th scope="row"><button type="button">${label}</button></th>${cells.join('')}`;
  row.querySelector('button').addEventListener('click', () => {
    selectScenario(key);
    byId('scenario').focus({preventScroll: true});
    byId('simulator').scrollIntoView();
  });
  byId('results').append(row);
}

byId('download').addEventListener('click', () => {
  const objectUrl = URL.createObjectURL(new Blob([PROJECT_DATA.csv], {type: 'text/csv'}));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = 'comparison.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
});

selectScenario('lru_demo');
