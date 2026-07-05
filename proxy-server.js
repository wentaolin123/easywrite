const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PROXY_PORT = 3000;
const STATIC_PORT = 8080;

// 创建代理服务器
const proxyServer = http.createServer((req, res) => {
    // 设置CORS响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 解析请求URL
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.target;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing target URL. Use ?target=<url>' }));
        return;
    }

    console.log(`[Proxy] ${req.method} ${targetUrl}`);

    // 解析目标URL
    const targetParsed = url.parse(targetUrl);
    const isHttps = targetParsed.protocol === 'https:';
    const client = isHttps ? https : http;

    // 收集请求体
    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        // 构建代理请求选项
        const options = {
            hostname: targetParsed.hostname,
            port: targetParsed.port || (isHttps ? 443 : 80),
            path: targetParsed.path,
            method: req.method,
            headers: {
                'Content-Type': req.headers['content-type'] || 'application/json',
                'Accept': req.headers['accept'] || 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        // 如果有Authorization头，传递它
        if (req.headers['authorization']) {
            options.headers['Authorization'] = req.headers['authorization'];
        }

        // 发送代理请求
        const proxyReq = client.request(options, (proxyRes) => {
            console.log(`[Proxy] Response: ${proxyRes.statusCode}`);

            // 设置响应状态码和头（必须包含 CORS 头，否则浏览器会拦截）
            const responseHeaders = {
                'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
            };
            res.writeHead(proxyRes.statusCode, responseHeaders);

            // 传递响应体
            proxyRes.on('data', chunk => {
                res.write(chunk);
            });

            proxyRes.on('end', () => {
                res.end();
            });
        });

        proxyReq.on('error', (err) => {
            console.error('[Proxy] Error:', err.message);
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
            });
            res.end(JSON.stringify({ error: 'Proxy request failed', message: err.message }));
        });

        // 发送请求体
        if (body) {
            proxyReq.write(body);
        }
        proxyReq.end();
    });
});

// 创建静态文件服务器
const staticServer = http.createServer((req, res) => {
    // 设置CORS响应头
    res.setHeader('Access-Control-Allow-Origin', '*');

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './内容监控雷达.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 启动代理服务器
proxyServer.listen(PROXY_PORT, () => {
    console.log(`[Proxy Server] 运行在 http://localhost:${PROXY_PORT}`);
    console.log(`[Proxy] 使用方式: http://localhost:${PROXY_PORT}/?target=<目标URL>`);
});

// 启动静态文件服务器
staticServer.listen(STATIC_PORT, () => {
    console.log(`[Static Server] 运行在 http://localhost:${STATIC_PORT}`);
    console.log(`[Static] 访问 http://localhost:${STATIC_PORT}/ 查看页面`);
});

console.log('\n=== 服务器启动完成 ===');
console.log(`代理服务器: http://localhost:${PROXY_PORT}`);
console.log(`静态服务器: http://localhost:${STATIC_PORT}`);
console.log('\n请使用 http://localhost:8080/ 访问页面');
