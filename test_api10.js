import fetch from 'node-fetch';

async function test() {
  const res = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLead?key=EP_V1_BRIDGE_SECURE_KEY_8842_XY", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
