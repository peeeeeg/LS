const http = require('http');

// 创建一个简单的HTTP服务器来测试页面
const server = http.createServer((req, res) => {
  // 返回简单的HTML页面，包含测试脚本
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Console</title>
    </head>
    <body>
      <h1>Testing Console Errors</h1>
      <iframe id="test-iframe" src="http://localhost:3002" width="100%" height="600"></iframe>
      <script>
        // 监听iframe的加载事件
        document.getElementById('test-iframe').addEventListener('load', () => {
          try {
            const iframe = document.getElementById('test-iframe');
            const iframeConsole = iframe.contentWindow.console;
            
            // 重写iframe的console方法来捕获错误
            ['error', 'warn', 'log'].forEach(method => {
              const originalMethod = iframeConsole[method];
              iframeConsole[method] = (...args) => {
                // 发送错误到父窗口
                window.parent.postMessage({ type: 'console', method, args }, '*');
                originalMethod.apply(iframeConsole, args);
              };
            });
          } catch (e) {
            console.error('Error accessing iframe console:', e);
          }
        });
        
        // 监听来自iframe的消息
        window.addEventListener('message', (event) => {
          if (event.data.type === 'console') {
            console[event.data.method](`[IFRAME] ${event.data.args.join(' ')}`);
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

// 启动服务器
server.listen(8080, () => {
  console.log('Test server running at http://localhost:8080');
});
