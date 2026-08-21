import { useState } from "react";
import { checkUsuarioAutorizado } from "../services/supabase";
import { startDeviceFlow, pollDeviceFlow } from "../services/msalConfig";
import type { UsuarioAutorizado } from "../services/supabase";
import "./LoginPage.css";

interface Props {
  onLogin: (usuario: UsuarioAutorizado) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"button" | "device">("button");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const flow = await startDeviceFlow();
      setUserCode(flow.user_code);
      setVerificationUri(flow.verification_uri);
      setStep("device");

      const result = await pollDeviceFlow(flow.device_code, flow.interval, flow.expires_in);

      const usuario = await checkUsuarioAutorizado(result.email);
      if (!usuario) {
        setError("Este correo no está registrado. Contacta al administrador.");
        setStep("button");
        setLoading(false);
        return;
      }

      onLogin(usuario);
    } catch (err: any) {
      setError(err.message || "Error de autenticación");
      setStep("button");
    }
    setLoading(false);
  };

  if (step === "device") {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">📍</div>
          <h1 className="login-title">Verificación Microsoft</h1>
          <p className="login-subtitle">Confirma tu identidad con MFA</p>

          <div className="login-device-steps">
            <div className="login-step">
              <span className="login-step-num">1</span>
              <span>Ve a <a href={verificationUri} target="_blank" rel="noopener noreferrer" className="login-link">{verificationUri}</a></span>
            </div>
            <div className="login-step">
              <span className="login-step-num">2</span>
              <span>Ingresa el código:</span>
            </div>
          </div>

          <div className="login-code-box">{userCode}</div>

          <div className="login-waiting">
            <div className="login-spinner" />
            <span>Esperando confirmación...</span>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn login-btn-secondary" onClick={() => { setStep("button"); setLoading(false); setError(""); }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📍</div>
        <h1 className="login-title">Mapa Regadores</h1>
        <p className="login-subtitle">Control Operacional</p>

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          <svg className="login-ms-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          {loading ? "Conectando..." : "Iniciar sesión con Microsoft"}
        </button>

        {error && <p className="login-error">{error}</p>}

        <p className="login-footer">Se validará tu identidad con Microsoft (MFA)</p>
      </div>
    </div>
  );
}
