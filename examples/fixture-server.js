import { createServer } from 'node:http';
const port = Number(process.env.PORT || 45271);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Breakpoint Doctor example</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui}
main{max-width:940px;margin:auto;padding:24px}
nav{display:flex;gap:16px;flex-wrap:wrap}a{display:inline-flex;align-items:center;min-height:40px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}
article{min-width:0;padding:16px;background:#f3f4f6;border-radius:10px}
</style></head><body><main><h1>Responsive demo fixture</h1><nav>
<a href="/">Home</a><a href="/about">About</a></nav>
<div class="cards"><article><h2>First card</h2><p>Fluid width.</p></article>
<article><h2>Second card</h2><p>Responsive layout.</p></article></div></main></body></html>`;
createServer((request, response) => {
  if (request.method !== 'GET' || !['/','/about'].includes(new URL(request.url, 'http://localhost').pathname)) {
    response.writeHead(404); response.end('not found'); return;
  }
  response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html);
}).listen(port, '127.0.0.1', () => console.log('Demo fixture listening on '+port));
