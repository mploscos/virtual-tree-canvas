import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

/** Run a browser fixture exposing window.testResult, using only Node and Chromium. */
export async function runBrowser(root, entry = '/test/browser/view.html') {
  let browser, socket;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vtc-contract-'));
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + name);
      if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid path');
      const bytes = await readFile(file);
      response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml' })[path.extname(file)] ?? 'application/octet-stream');
      response.end(bytes);
    } catch { response.statusCode = 404; response.end('Not found'); }
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = spawn(process.env.CHROMIUM ?? 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      let log = '';
      const timeout = setTimeout(() => reject(new Error('Chromium startup timed out')), 15000);
      browser.once('error', reject);
      browser.stderr.on('data', bytes => { log += bytes; const match = log.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
      browser.once('exit', code => { clearTimeout(timeout); reject(new Error(`Chromium exited: ${code}`)); });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map(), errors = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const p = pending.get(message.id); if (!p) return;
        pending.delete(message.id); clearTimeout(p.timeout);
        if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
      } else if (message.method === 'Runtime.bindingCalled' && message.params.name === '__testMouse') {
        const {id, options} = JSON.parse(message.params.payload);
        send('Input.dispatchMouseEvent', options, message.sessionId)
          .then(() => send('Runtime.evaluate', {expression: `window.__mouseCallbacks.get(${id})()`}, message.sessionId))
          .catch(error => errors.push({message: error.message}));
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    });
    function send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    }
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 850, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Runtime.addBinding', {name: '__testMouse'}, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', {source: `
      window.__mouseCallbacks = new Map(); let mouseSequence = 0;
      window.testMouse = options => new Promise(resolve => {
        const id = ++mouseSequence;
        window.__mouseCallbacks.set(id, () => {window.__mouseCallbacks.delete(id); resolve();});
        window.__testMouse(JSON.stringify({id, options}));
      });
    `}, sessionId);
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}${entry}` }, sessionId);
    let result;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const value = await send('Runtime.evaluate', { expression: 'window.testResult', returnByValue: true }, sessionId);
      result = value.result?.value;
      if (result) break;
      if (errors.length) throw new Error(JSON.stringify(errors));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!result) throw new Error('Browser contract timed out');
    if (errors.length) throw new Error(JSON.stringify(errors));
    return result;
  } finally {
    socket?.close(); browser?.kill(); server.closeAllConnections(); server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
