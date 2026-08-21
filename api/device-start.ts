const CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c";
const AUTHORITY = "https://login.microsoftonline.com/common";
const SCOPES = "openid profile email";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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

    return res.status(200).json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri || "https://microsoft.com/devicelogin",
      expires_in: data.expires_in,
      interval: data.interval || 5,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
