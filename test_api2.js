import fetch from 'node-fetch';

async function test() {
  const res = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getPublicSlots", {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
