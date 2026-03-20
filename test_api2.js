import fetch from 'node-fetch';

async function test() {
  const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
  const res = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getPublicSlotsV5", {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "x-bridge-key": BRIDGE_SECURE_KEY
    }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
