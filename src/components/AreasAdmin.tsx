import { useState, useEffect, useCallback } from "react";
import { getAreas, addArea, updateArea, deleteArea } from "../services/api";
import type { Area } from "../services/api";
import "./AreasAdmin.css";

interface Props {
  onClose: () => void;
}

export default function AreasAdmin({ onClose }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getAreas();
      setAreas(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addArea(nombre.trim());
      setNombre("");
      await load();
    } catch (err: any) {
      setError(err.message || "Error al agregar área");
    }
    setAdding(false);
  };

  const startEdit = (a: Area) => {
    setEditingId(a.id);
    setEditNombre(a.nombre);
  };

  const saveEdit = async () => {
    if (!editingId || !editNombre.trim()) return;
    try {
      await updateArea(editingId, { nombre: editNombre.trim() });
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActivo = async (a: Area) => {
    try {
      await updateArea(a.id, { activo: !a.activo });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (a: Area) => {
    if (!confirm(`¿Eliminar el área "${a.nombre}"? Los usuarios y dispositivos con esta área quedarán sin área asignada.`)) return;
    try {
      await deleteArea(a.id);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="areas-overlay" onClick={onClose}>
      <div className="areas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="areas-header">
          <h2>Maestro de Áreas</h2>
          <button className="areas-close" onClick={onClose}>×</button>
        </div>

        <form className="areas-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Nombre del área (ej: Campo, Transporte, Almacén)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <button type="submit" disabled={adding}>
            {adding ? "Agregando..." : "Agregar"}
          </button>
        </form>

        {error && <p className="areas-error">{error}</p>}

        {loading ? (
          <p className="areas-loading">Cargando...</p>
        ) : (
          <div className="areas-list">
            {areas.length === 0 ? (
              <p className="areas-empty">No hay áreas creadas. Agrega la primera.</p>
            ) : (
              areas.map((a) => (
                <div key={a.id} className={`areas-card ${!a.activo ? "areas-card-inactive" : ""}`}>
                  {editingId === a.id ? (
                    <div className="areas-card-edit">
                      <input
                        className="areas-input"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      />
                      <button className="areas-btn areas-btn-save" onClick={saveEdit}>Guardar</button>
                      <button className="areas-btn areas-btn-cancel" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="areas-card-row">
                      <span className="areas-card-name">{a.nombre}</span>
                      <div className="areas-card-actions">
                        <button
                          className={`areas-status-btn ${a.activo ? "areas-active" : "areas-inactive"}`}
                          onClick={() => toggleActivo(a)}
                        >
                          {a.activo ? "Activo" : "Inactivo"}
                        </button>
                        <button className="areas-btn areas-btn-edit" onClick={() => startEdit(a)}>Editar</button>
                        <button className="areas-btn areas-btn-delete" onClick={() => handleDelete(a)}>Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
