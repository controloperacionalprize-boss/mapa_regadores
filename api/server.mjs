import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c";
const AUTHORITY = "https://login.microsoftonline.com/common";
const SCOPES = "openid profile email";

app.post("/api/device-start", async (req, res) => {
  try {
    const msRes = await fetch(`${AUTHORITY}/oauth2/v2.0/devicecode`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}`,
    });
    const data = await msRes.json();
    if (!msRes.ok || !data.device_code) {
      return res.status(502).json({ error: data.error_description || "Error al conectar con Microsoft" });
    }
    return res.json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri || "https://microsoft.com/devicelogin",
      expires_in: data.expires_in,
      interval: data.interval || 5,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/device-poll", async (req, res) => {
  const { device_code } = req.body || {};
  if (!device_code) return res.status(400).json({ error: "device_code requerido" });

  try {
    const msRes = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${CLIENT_ID}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${device_code}`,
    });
    const data = await msRes.json();

    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return res.json({ status: "pending" });
    }
    if (data.error === "expired_token") {
      return res.status(400).json({ error: "El código expiró. Intenta de nuevo." });
    }
    if (data.error) {
      return res.status(401).json({ error: data.error_description || "Microsoft rechazó el acceso" });
    }
    if (!data.id_token && !data.access_token) {
      return res.status(401).json({ error: "No se recibió token" });
    }

    // Decode id_token (JWT) to get email - no verification needed, came from Microsoft directly
    let email = "";
    let displayName = "";
    const token = data.id_token || data.access_token;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      email = (payload.preferred_username || payload.email || payload.upn || payload.unique_name || "").toLowerCase();
      displayName = payload.name || email;
    } catch {}

    if (!email || !email.includes("@")) {
      return res.status(401).json({ error: "No se pudo leer el correo de Microsoft" });
    }
    return res.json({ status: "ok", email, displayName });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("API server corriendo en http://localhost:3001");
});
