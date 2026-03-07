export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getPublicSlots", {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Set cache headers (e.g., cache for 5 minutes)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching slots:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch slots from external API" });
  }
}
