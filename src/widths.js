const GEOMETRY = new Set(['page-overflow', 'clipped-control', 'occluded-control']);

function geometryIds(result) {
  return new Set(result.status === 'complete' ? result.issues.filter(i => GEOMETRY.has(i.type)).map(i => i.id) : []);
}

// A coarse grid finds multiple distinct failing regions; interval refinement then
// narrows observed transitions. We deliberately make no monotonicity assumption.
export async function discoverWidths({ initial, inspect, maxSamples = 30, tolerance = 5, budgetExceeded = () => false }) {
  const coarse = [240, 280, 320, 340, 360, 390, 420, 480, 540, 600, 640, 768, 900, 1024, 1200, 1440, 1920, 2560, 3840];
  const min = Math.min(...initial), max = Math.max(...initial);
  const queue = [...new Set([...initial, ...coarse.filter(w => w >= min && w <= max)])].sort((a,b) => a-b);
  // Reserve additional samples for refining transitions.
  const seedBudget = Math.min(maxSamples - 8, 22);
  const seed = queue.length <= seedBudget ? queue : [...initial, ...queue.filter(w => !initial.includes(w)).slice(0, Math.max(0, seedBudget-initial.length))];
  const samples = new Map();
  let exhausted = false;
  async function add(width) {
    if (samples.has(width)) return;
    if (samples.size >= maxSamples || budgetExceeded()) { exhausted = true; return; }
    samples.set(width, await inspect(width));
  }
  for (const width of [...new Set(seed)].sort((a,b) => a-b)) await add(width);
  while (samples.size < maxSamples && !budgetExceeded()) {
    const sorted = [...samples.keys()].sort((a,b) => a-b);
    const intervals = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = samples.get(sorted[i]), b = samples.get(sorted[i+1]);
      if (a.status !== 'complete' || b.status !== 'complete') continue;
      const aa = geometryIds(a), bb = geometryIds(b);
      if ([...aa].some(id => !bb.has(id)) || [...bb].some(id => !aa.has(id))) {
        const gap = sorted[i+1] - sorted[i];
        if (gap > tolerance) intervals.push({ left:sorted[i], right:sorted[i+1], gap });
      }
    }
    intervals.sort((a,b) => b.gap - a.gap || a.left - b.left);
    const next = intervals[0];
    if (!next) break;
    const midpoint = Math.floor((next.left + next.right) / 2);
    if (samples.has(midpoint)) break;
    await add(midpoint);
  }
  const ordered = [...samples.values()].sort((a,b) => a.width-b.width);
  const allIds = new Set(ordered.flatMap(v => [...geometryIds(v)]));
  const transitions = {};
  const observedRanges = {};
  for (const id of allIds) {
    transitions[id] = [];
    observedRanges[id] = [];
    let current = null;
    for (const sample of ordered) {
      const active = geometryIds(sample).has(id);
      if (active && !current) current = { minObserved: sample.width, maxObserved: sample.width };
      else if (active) current.maxObserved = sample.width;
      else if (current) { observedRanges[id].push(current); current = null; }
    }
    if (current) observedRanges[id].push(current);
    for (let i = 1; i < ordered.length; i++) {
      const a=ordered[i-1], b=ordered[i];
      if (a.status !== 'complete' || b.status !== 'complete') continue;
      const before=geometryIds(a).has(id), after=geometryIds(b).has(id);
      if (before !== after) transitions[id].push({
        between: [a.width,b.width], direction: after ? 'appears' : 'disappears',
        precisionPx: b.width-a.width
      });
    }
  }
  const unresolved = Object.values(transitions).some(list => list.some(t => t.precisionPx > tolerance));
  return { viewports: ordered, transitions, observedRanges, exhausted: exhausted || (unresolved && (samples.size >= maxSamples || budgetExceeded())),
    disclaimer: 'Transitions are bracketed by observed samples; behavior between untested widths remains unknown.' };
}
