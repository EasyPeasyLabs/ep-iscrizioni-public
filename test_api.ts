import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/slots");
    const data = await res.json();
    console.log(JSON.stringify(data.data[0].bundles[0], null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
