// Defense-in-depth for non-invasive scans.
// This is browser-network interception, not a guarantee that arbitrary GET
// endpoints or application JavaScript are side-effect-free.
const SAFE_METHODS = new Set(['GET', 'HEAD']);
export const SAFETY_POLICY = 'non-invasive-v1';

export async function installReadOnlyGuards(context, { allowNavigation } = {}) {
  const counts = {
    blockedMutations: 0,
    blockedNavigations: 0,
    blockedWebSockets: 0,
    methods: {}
  };
  const blocked = new WeakSet();
  await context.route('**/*', route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      counts.blockedMutations++;
      counts.methods[method] = (counts.methods[method] || 0) + 1;
      blocked.add(request);
      return route.abort('blockedbyclient');
    }
    if (request.isNavigationRequest() && allowNavigation && !allowNavigation(request.url())) {
      counts.blockedNavigations++;
      blocked.add(request);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await context.routeWebSocket('**/*', socket => {
    counts.blockedWebSockets++;
    socket.close();
  });
  return {
    counts,
    isIntentionallyBlocked: request => blocked.has(request)
  };
}

export function combineSafetyCounters(total, current) {
  total.blockedMutations += current.blockedMutations;
  total.blockedNavigations += current.blockedNavigations;
  total.blockedWebSockets += current.blockedWebSockets;
  for (const [method, value] of Object.entries(current.methods)) {
    total.methods[method] = (total.methods[method] || 0) + value;
  }
  return total;
}

export function safetyTotals() {
  return { blockedMutations:0, blockedNavigations:0, blockedWebSockets:0, methods:{} };
}
