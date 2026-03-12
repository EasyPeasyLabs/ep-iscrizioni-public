export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY;
    if (!BRIDGE_SECURE_KEY) {
      console.warn("CRITICAL WARNING: Missing BRIDGE_SECURE_KEY environment variable. API calls will fail.");
      return res.status(500).json({ success: false, error: "Internal Server Error: Configuration missing" });
    }
    const response = await fetch("https://getpublicslotsv2-7wnvtld3xq-ew.a.run.app", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "x-bridge-key": BRIDGE_SECURE_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        success: false, 
        error: `External API error: ${response.status}`,
        details: errorText.substring(0, 200)
      });
    }

    const data = await response.json();

    // Set cache headers (e.g., cache for 5 minutes)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (error) {
    console.warn("Warning fetching slots:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch slots from external API" });
  }
}
