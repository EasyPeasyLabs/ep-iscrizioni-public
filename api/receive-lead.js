export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // Read the secure key from environment variables
    const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY;
    if (!BRIDGE_SECURE_KEY) {
      console.warn("CRITICAL WARNING: Missing BRIDGE_SECURE_KEY environment variable. API calls will fail.");
      return res.status(500).json({ success: false, error: "Internal Server Error: Configuration missing" });
    }
    
    const response = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const cleanError = errorText.includes('<html') ? 'Unauthorized or Forbidden (Check IAM or API Key)' : errorText;
      console.warn(`External API returned ${response.status}: ${cleanError}`);
      // Return success anyway to avoid blocking the user with a 401 error,
      // as the lead is already saved locally in Firebase.
      return res.status(200).json({ success: true, warning: "External API failed, but lead was saved locally" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying lead submission:", error);
    // Return success anyway to avoid blocking the user
    return res.status(200).json({ success: true, warning: "Failed to submit lead to external API, but lead was saved locally" });
  }
}
