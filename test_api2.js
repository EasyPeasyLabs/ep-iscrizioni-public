import fetch from 'node-fetch';

async function test() {
  const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
  const res = await fetch("https://getpublicslotsv2-7wnvtld3xq-ew.a.run.app/", {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
    }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
