// global variables
let arr = [];
let messbufarr = [];
let netip = null;
let netport = null;

// npm install ws
const WebSocket = require('ws');
const wssmercury = new WebSocket.Server({ port: 5000 });
console.log(`WebSocket сервер запущен на порту ${wssmercury.options.port}`);

wssmercury.on('connection', (connection) => {
  console.log('Новый пользователь WebSocket подключился');
  connection.on('message', (message) => {      
    arr = message.toString().split(' Tx: ');
    netip = arr[0].split(':')[0];
    netport = parseInt(arr[0].split(':')[1]);
    messbufarr = arr[1].split('_');
    Array.isArray(messbufarr) && messbufarr.length === 1 ? messbufarr = arr[1].split(' ') : messbufarr;
    messbufarr = messbufarr.filter(el => el !== '').map(el => '0x' + el);
    toNetMess(netip, netport, messbufarr);
    // Рассылаем сообщение всем клиентам
    wssmercury.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
});

// http server
const http = require('http');
const url = require('url');
const fs = require('fs');

const portmercury = 4000;
const httpmercury = http.createServer(function (req, res) {
  const q = url.parse(req.url, true);
  let filename;
  if (q.pathname === "/") {
    filename = "./client/clientmercury.html"
  } else {
    filename = "." + q.pathname
  }
  fs.readFile(filename, function(err, data) {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/html'});
      return res.end("404 Not Found");
    }
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    return res.end();
  });
})

httpmercury.listen(portmercury, function(){
  console.log(`HTTP сервер запущен на порту ${portmercury}`)
});

// try modbus (mercury) 43728456 10.78.178.228:4001
// связной номер 56 = 38_
// запрос на соединение = 01_
// уровень доступа = 02_
// пароль "222222" = 32_32_32_32_32_32_
// crc16 = DD_29_
// Tx: 38_01_02_32_32_32_32_32_32_DD_29_
// Rx: 38 00 12 70
// 38_04_00_F2_CD_ текущее время
// 38_51_45_15_01_28_04_25_01_45_31_ ответ 15:45:51 пн 28.04.25 зима
// 38_08_00_F7_CD_ серийный номер ПУ и дата выпуска
// 38 2b 48 54 38 04 02 15 6b f1 номер 43728456 дата 04.02.21
// СПОДЭС 7e a0 08 02 CF 61 53 D5 48 7e 10.78.44.17:4001

// Creates a new Buffer
// const { Buffer } = require('buffer');
// const buf = Buffer.from([0x38, 0x00, 0x12, 0x70]);

// net
const net = require('net');
const netsocket = new net.Socket();

netsocket.on('data', function(data) {
  console.log('Rx: ', data);
  wssmercury.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(netip + ':' + netport + ' Rx: ' + data.toString('hex').match(/..?/g).join('_')+'_');
    }
  });
});

netsocket.on('error', function(){
  console.log('error request to connection');
  wssmercury.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('error request to connection');
    }
  });
});

netsocket.on('close', function(){
  console.log(`NetSocket closed ${netip}:${netport}`);
  wssmercury.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(`NetSocket closed ${netip}:${netport}`);
    }
  });
});

function toNetMess(netip, netport, messbufarr) {
  const { Buffer } = require('buffer');
  const buf = Buffer.from(messbufarr);
  if (netsocket.readyState === 'open') {
    console.log('Tx: ', buf);   
    netsocket.write(buf)
  } else {
    netsocket.connect(netport, netip, function(){
      console.log(`NetSocket connected on ${netip}:${netport}`);
      wssmercury.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(`NetSocket connected on ${netip}:${netport}`);
        }
      });
    });  
    netsocket.on('connect', function() {
      console.log('Tx: ', buf);
      netsocket.write(buf)
    });
  }
}
