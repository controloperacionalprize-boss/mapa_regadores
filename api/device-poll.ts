const CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c";
const AUTHORITY = "https://login.microsoftonline.com/common";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
      return res.status(200).json({ status: "pending" });
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

    const token = data.id_token || data.access_token;
    let email = "";
    let displayName = "";
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      email = (payload.preferred_username || payload.email || payload.upn || payload.unique_name || "").toLowerCase();
      displayName = payload.name || email;
    } catch {}

    if (!email || !email.includes("@")) {
      return res.status(401).json({ error: "No se pudo leer el correo de Microsoft" });
    }

    return res.status(200).json({ status: "ok", email, displayName });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
