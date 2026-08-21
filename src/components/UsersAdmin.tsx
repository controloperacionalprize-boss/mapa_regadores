import { useState, useEffect, useCallback } from "react";
import { getUsuariosAutorizados, addUsuarioAutorizado, updateUsuarioAutorizado, deleteUsuarioAutorizado } from "../services/supabase";
import type { UsuarioAutorizado } from "../services/supabase";
import "./UsersAdmin.css";

interface Props {
  onClose: () => void;
}

export default function UsersAdmin({ onClose }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("usuario");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getUsuariosAutorizados();
      setUsuarios(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addUsuarioAutorizado(email, nombre, rol);
      setEmail("");
      setNombre("");
      setRol("usuario");
      await load();
    } catch (err: any) {
      setError(err.message || "Error al agregar usuario");
    }
    setAdding(false);
  };

  const toggleActivo = async (u: UsuarioAutorizado) => {
    try {
      await updateUsuarioAutorizado(u.id, { activo: !u.activo });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (u: UsuarioAutorizado) => {
    if (!confirm(`¿Eliminar a ${u.email}?`)) return;
    try {
      await deleteUsuarioAutorizado(u.id);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="users-overlay" onClick={onClose}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <div className="users-header">
          <h2>Usuarios Autorizados</h2>
          <button className="users-close" onClick={onClose}>×</button>
        </div>

        <form className="users-form" onSubmit={handleAdd}>
          <input
            type="email"
            placeholder="correo@aquanqa.pe"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="usuario">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={adding}>
            {adding ? "Agregando..." : "Agregar"}
          </button>
        </form>

        {error && <p className="users-error">{error}</p>}

        {loading ? (
          <p className="users-loading">Cargando...</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.activo ? "" : "users-inactive"}>
                    <td>{u.email}</td>
                    <td>{u.nombre || "—"}</td>
                    <td>
                      <span className={`users-rol ${u.rol === "admin" ? "users-rol-admin" : ""}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td>
                      <button className={`users-toggle ${u.activo ? "active" : ""}`} onClick={() => toggleActivo(u)}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td>
                      <button className="users-delete" onClick={() => handleDelete(u)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>No hay usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
