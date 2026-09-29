// Surveillance : toute erreur serveur non interceptée (pages, routes, actions) est enregistrée.
// Les routes d'API sont en plus enveloppées par monitored() (lib/monitor.ts), qui voit aussi
// les réponses 5xx renvoyées sans exception.
export async function register() { /* rien à initialiser */ }

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Les routes d'API enveloppées interceptent leurs propres erreurs ; ce crochet couvre le reste (pages, rendu serveur)
  if (context?.routeType === 'route') return;
  try {
    const { reportError } = await import('./lib/monitor');
    await reportError(err, { source: 'server', route: context?.routePath || request?.path?.split('?')[0] || null, method: request?.method || null, status: 500, context: { type: context?.routeType, routeur: context?.routerKind } });
  } catch { /* la surveillance ne doit jamais aggraver une erreur */ }
}
