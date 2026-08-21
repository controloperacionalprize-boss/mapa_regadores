export interface DeviceFlowData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function startDeviceFlow(): Promise<DeviceFlowData> {
  const res = await fetch("/api/device-start", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al iniciar autenticación");
  return data;
}

export async function pollDeviceFlow(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPending?: () => void
): Promise<{ email: string; displayName: string }> {
  const deadline = Date.now() + expiresIn * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));

    const res = await fetch("/api/device-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });

    const data = await res.json();

    if (data.status === "pending") {
      onPending?.();
      continue;
    }

    if (data.status === "ok") {
      return { email: data.email, displayName: data.displayName };
    }

    throw new Error(data.error || "Error de autenticación");
  }

  throw new Error("Tiempo de espera agotado");
}
