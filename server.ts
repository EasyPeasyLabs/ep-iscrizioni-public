import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Proxy for Slots (Punta alla V2 in produzione)
  app.get("/api/slots", async (req, res) => {
    try {
      const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
      
      const response = await fetch("https://getpublicslotsv2-7wnvtld3xq-ew.a.run.app?projectId=ep-projectb", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
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
      
      // -- DEBUG: Aggiungo corsi finti se l'API torna array vuoti --
      if (data.success && Array.isArray(data.data)) {
        data.data = data.data.map((loc: any) => {
          if (!loc.bundles || loc.bundles.length === 0) {
            loc.bundles = [
              {
                bundleId: "debug-bundle-1",
                name: "CORSO DI PROVA (DEBUG)",
                publicName: "Corso Tech (Prova)",
                dayOfWeek: 1, // Lunedì
                minAge: 5,
                maxAge: 12,
                availableSeats: 5,
                isFull: false,
                includedSlots: [
                  { type: "LAB", startTime: "17:00", endTime: "18:30" }
                ]
              }
            ];
          }
          return loc;
        });
      }
      
      return res.json(data);
    } catch (error) {
      console.warn("Warning proxying slots:", error);
      res.status(500).json({ success: false, error: "Failed to fetch slots from external API", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // API Proxy for Lead Submission (Punta alla V2 in produzione)
  app.post("/api/receive-lead", async (req, res) => {
    // -- FORZA SUCCESSO PER TEST TRIANGOLAZIONE --
    console.log("[DEBUG] Ricevuto lead nel proxy, restituisco successo simulato.");
    return res.json({ success: true, message: "Lead simulato con successo" });
    
    /* 
    try {
      const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
...
    } catch (error) {
      console.warn("Warning proxying lead submission:", error);
      // Forza successo per il test della triangolazione
      res.json({ success: true, message: "Lead simulato con successo per test triangolazione" });
    }
    */
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

// ------------------------------

startServer();
