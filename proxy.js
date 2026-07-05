const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // 设置 CORS 响应头，允许前端页面访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 解析 target 参数
  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.target;

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing target parameter. Usage: /?target=<encoded_url>' }));
    return;
  }

  console.log('[Proxy] ' + req.method + ' -> ' + targetUrl);

  const targetParsed = url.parse(targetUrl);
  const isHttps = targetParsed.protocol === 'https:';
  const client = isHttps ? https : http;

  // 收集请求体
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: targetParsed.hostname,
      port: targetParsed.port || (isHttps ? 443 : 80),
      path: targetParsed.path,
      method: req.method,
      headers: {}
    };

    // 透传必要的请求头
    const forwardHeaders = ['content-type', 'authorization', 'accept'];
    forwardHeaders.forEach(h => {
      const val = req.headers[h];
      if (val) options.headers[h] = val;
    });

    if (body) {
      options.headers['content-length'] = Buffer.byteLength(body);
    }

    const proxyReq = client.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log('Proxy server running at http://localhost:' + PORT);
  console.log('Usage: http://localhost:' + PORT + '/?target=<encoded_url>');
});
