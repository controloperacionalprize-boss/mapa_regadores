import { useState, useEffect, useCallback } from "react";
import { getUsuariosAutorizados, addUsuarioAutorizado, updateUsuarioAutorizado, deleteUsuarioAutorizado, getAreas } from "../services/api";
import type { UsuarioAutorizado, Area } from "../services/api";
import "./UsersAdmin.css";

interface Props {
  onClose: () => void;
}

export default function UsersAdmin({ onClose }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("usuario");
  const [area, setArea] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [data, areasData] = await Promise.all([getUsuariosAutorizados(), getAreas()]);
      setUsuarios(data);
      setAreas(areasData.filter((a) => a.activo));
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
      await addUsuarioAutorizado(email, nombre, rol, area || null);
      setEmail("");
      setNombre("");
      setRol("usuario");
      setArea("");
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
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.nombre}>{a.nombre}</option>
            ))}
          </select>
          <button type="submit" disabled={adding}>
            {adding ? "Agregando..." : "Agregar"}
          </button>
        </form>

        <div className="users-search">
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
                  <th>Área</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.filter((u) => {
                  if (!search) return true;
                  const q = search.toLowerCase();
                  return u.email.toLowerCase().includes(q) || (u.nombre || "").toLowerCase().includes(q);
                }).map((u) => (
                  <tr key={u.id} className={u.activo ? "" : "users-inactive"}>
                    <td>{u.email}</td>
                    <td>{u.nombre || "—"}</td>
                    <td>
                      <span className={`users-rol ${u.rol === "admin" ? "users-rol-admin" : ""}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td>
                      <select
                        className="users-area-select"
                        value={u.area || ""}
                        onChange={async (e) => {
                          try {
                            await updateUsuarioAutorizado(u.id, { area: e.target.value || null } as any);
                            await load();
                          } catch (err: any) { setError(err.message); }
                        }}
                      >
                        <option value="">Sin área</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.nombre}>{a.nombre}</option>
                        ))}
                      </select>
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
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>No hay usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
