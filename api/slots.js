import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

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
    
    // --- CALCULATE AVAILABLE SEATS ---
    if (data.success && Array.isArray(data.data)) {
      // Get current month boundaries
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Fetch all registrations for the current month
      const registrationsSnapshot = await db.collection("raw_registrations")
        .where("submittedAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
        .where("submittedAt", "<=", admin.firestore.Timestamp.fromDate(endOfMonth))
        .get();

      // Count registrations per bundleId
      const registrationCounts = {};
      registrationsSnapshot.forEach(doc => {
        const regData = doc.data();
        const bundleId = regData.selectedSlot?.bundleId;
        if (bundleId) {
          registrationCounts[bundleId] = (registrationCounts[bundleId] || 0) + 1;
        }
      });

      // Update availableSeats in the response data
      data.data.forEach((location) => {
        if (Array.isArray(location.bundles)) {
          location.bundles.forEach((bundle) => {
            const registeredCount = registrationCounts[bundle.bundleId] || 0;
            const totalCapacity = bundle.availableSeats; 
            bundle.availableSeats = Math.max(0, totalCapacity - registeredCount);
            
            if (bundle.availableSeats === 0) {
              bundle.isFull = true;
            }
          });
        }
      });
    }
    // ---------------------------------

    // Set cache headers (e.g., cache for 5 minutes)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (error) {
    console.warn("Warning fetching slots:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch slots from external API" });
  }
}
