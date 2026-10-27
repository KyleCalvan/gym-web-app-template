import net from 'node:net';
import { once } from 'node:events';

export async function startSmtp() {
  const messages = [];
  const sockets = new Set();
  let rejectNextRecipient = false;
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 local test SMTP ready\r\n');
    let buffer = '';
    let inData = false;
    let lines = [];
    socket.on('data', chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            messages.push(lines.join('\r\n'));
            lines = [];
            inData = false;
            socket.write('250 queued\r\n');
          } else lines.push(line.startsWith('..') ? line.slice(1) : line);
        } else if (/^EHLO /i.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 1000000\r\n');
        else if (/^AUTH PLAIN /i.test(line)) socket.write('235 authenticated\r\n');
        else if (/^RCPT TO:/i.test(line) && rejectNextRecipient) {
          rejectNextRecipient = false;
          socket.write('550 delivery rejected\r\n');
        }
        else if (/^MAIL FROM:|^RCPT TO:|^RSET$/i.test(line)) socket.write('250 ok\r\n');
        else if (/^DATA$/i.test(line)) { inData = true; socket.write('354 end with dot\r\n'); }
        else if (/^QUIT$/i.test(line)) { socket.write('221 bye\r\n'); socket.end(); }
        else socket.write('500 unsupported\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    messages,
    env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port),
      SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', SMTP_FROM: 'VinAthletics <no-reply@example.test>' },
    rejectNextRecipient() { rejectNextRecipient = true; },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
