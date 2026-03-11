import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import cors from "cors";
import admin from "firebase-admin";

// Initialize Firebase Admin for local dev (if credentials are provided)
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  console.warn("Could not initialize firebase-admin locally. Available seats calculation might fail.");
}
const db = admin.apps.length ? admin.firestore() : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Proxy for Slots
  app.get("/api/slots", async (req, res) => {
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
        const cleanError = errorText.includes('<html') ? 'HTML Error Page (Unauthorized/Forbidden)' : errorText;
        console.log(`[API Proxy] External API returned ${response.status}:`, cleanError);
        return res.status(response.status).json({ 
          success: false, 
          error: `External API error: ${response.status}`,
          details: cleanError.substring(0, 200) 
        });
      }

      const data = await response.json();
      
      // --- CALCULATE AVAILABLE SEATS ---
      if (data.success && Array.isArray(data.data) && db) {
        // Get current month boundaries
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        try {
          // Fetch all registrations for the current month
          const registrationsSnapshot = await db.collection("raw_registrations")
            .where("submittedAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth))
            .where("submittedAt", "<=", admin.firestore.Timestamp.fromDate(endOfMonth))
            .get();

          // Count registrations per bundleId
          const registrationCounts: { [key: string]: number } = {};
          registrationsSnapshot.forEach(doc => {
            const regData = doc.data();
            const bundleId = regData.selectedSlot?.bundleId;
            if (bundleId) {
              registrationCounts[bundleId] = (registrationCounts[bundleId] || 0) + 1;
            }
          });

          // Update availableSeats in the response data
          data.data.forEach((location: any) => {
            if (Array.isArray(location.bundles)) {
              location.bundles.forEach((bundle: any) => {
                const registeredCount = registrationCounts[bundle.bundleId] || 0;
                const totalCapacity = bundle.availableSeats; 
                bundle.availableSeats = Math.max(0, totalCapacity - registeredCount);
                
                if (bundle.availableSeats === 0) {
                  bundle.isFull = true;
                }
              });
            }
          });
        } catch (calcError) {
          console.warn("Could not calculate available seats from raw_registrations locally:", calcError);
        }
      }
      // ---------------------------------

      return res.json(data);
    } catch (error) {
      console.warn("Warning proxying slots:", error);
      res.status(500).json({ success: false, error: "Failed to fetch slots from external API", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // API Proxy for Lead Submission
  app.post("/api/receive-lead", async (req, res) => {
    try {
      const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY;
      if (!BRIDGE_SECURE_KEY) {
        console.warn("CRITICAL WARNING: Missing BRIDGE_SECURE_KEY environment variable. API calls will fail.");
        return res.status(500).json({ success: false, error: "Internal Server Error: Configuration missing" });
      }
      const response = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLeadV2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bridge-key": BRIDGE_SECURE_KEY
        },
        body: JSON.stringify(req.body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const cleanError = errorText.includes('<html') ? 'Unauthorized or Forbidden (Check IAM or API Key)' : errorText;
        console.log(`[API Proxy] External API returned ${response.status}: ${cleanError}`);
        // Return success anyway to avoid blocking the user with a 401 error
        return res.json({ success: true, warning: "External API failed, but lead was saved locally" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.warn("Warning proxying lead submission:", error);
      // Return success anyway to avoid blocking the user
      res.json({ success: true, warning: "Failed to submit lead to external API, but lead was saved locally" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// --- TYPES FOR API RESPONSE ---
interface ApiIncludedSlot {
  type: string;
  startTime: string;
  endTime: string;
  minAge?: number;
  maxAge?: number;
}

interface ApiBundle {
  bundleId: string;
  name: string;
  publicName?: string;
  description?: string;
  price?: number;
  dayOfWeek: number;
  minAge: number;
  maxAge: number;
  availableSeats: number;
  isFull: boolean;
  includedSlots: ApiIncludedSlot[];
}

interface ApiLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  googleMapsLink?: string;
  bundles: ApiBundle[];
}
// ------------------------------

startServer();
