// Stable public rule IDs. Unknown names are errors instead of silently ignored options.
export const RULES = Object.freeze({
  'page-overflow': { category:'layout', severity:'high', title:'Page overflows viewport', autoConfirm:true },
  'clipped-control': { category:'layout', severity:'medium', title:'Control crosses clipping boundary', autoConfirm:true },
  'occluded-control': { category:'layout', severity:'medium', title:'Control appears covered', autoConfirm:false },
  'small-target': { category:'advisory', severity:'info', title:'Small interactive target', autoConfirm:false },
  'broken-image': { category:'resource', severity:'medium', title:'Visible image failed to load', autoConfirm:true },
  'javascript-error': { category:'runtime', severity:'high', title:'Uncaught browser exception', autoConfirm:true },
  'http-error': { category:'resource', severity:'medium', title:'HTTP failure may be intentional', autoConfirm:false },
  'failed-request': { category:'resource', severity:'medium', title:'Network failure may be intentional', autoConfirm:false }
});

export function validateRules(disabled = [], overrides = {}) {
  for (const name of [...disabled, ...Object.keys(overrides)]) {
    if (!Object.hasOwn(RULES, name)) throw new Error('Unknown rule "' + name + '". Valid rules: ' + Object.keys(RULES).join(', '));
  }
  for (const severity of Object.values(overrides)) {
    if (!['high','medium','info','off'].includes(severity)) throw new Error('Severity must be high, medium, info, or off.');
  }
}
