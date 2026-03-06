const https = require('https');

const options = {
  hostname: 'getavailableslots-7wnvtld3xq-ew.a.run.app',
  port: 443,
  path: '/',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer EP_V1_BRIDGE_SECURE_KEY_8842_XY',
    'Accept': 'application/json'
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  let data = '';
  res.on('data', d => {
    data += d;
  });

  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
