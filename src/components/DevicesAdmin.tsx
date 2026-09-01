import { useState, useEffect } from "react";
import { getDispositivos, updateDispositivo, deleteDispositivo } from "../services/supabase";
import type { Dispositivo } from "../services/supabase";
import "./DevicesAdmin.css";

const FUNDOS_MODULOS: Record<string, string[]> = {
  "ARENA AZUL": ["AQ1-1", "AQ1-2", "AQ1-3", "AQ1-4"],
  "QURI ALLPA": ["AQ2-1", "AQ2-2", "AQ2-3", "AQ2-4", "AQ2-5"],
  "KAWSAY ALLPA": ["AQ2-6", "AQ2-7", "AQ2-8", "AQ2-9", "AQ2-10", "AQ2-11", "AQ2-16", "AQ2-17", "AQ2-18"],
  "AYLLU ALLPA": ["AQ2-12", "AQ2-13", "AQ2-14", "AQ2-15"],
};

interface Props {
  onClose: () => void;
}

export default function DevicesAdmin({ onClose }: Props) {
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFundos, setEditFundos] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDispositivos();
      setDevices(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (d: Dispositivo) => {
    setEditingId(d.id);
    setEditName(d.nombre || "");
    setEditFundos(d.fundos_asignados || []);
  };

  const toggleModulo = (m: string) => {
    setEditFundos((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const toggleFundoAll = (fundo: string) => {
    const modulos = FUNDOS_MODULOS[fundo] || [];
    const allSelected = modulos.every((m) => editFundos.includes(m));
    if (allSelected) {
      setEditFundos((prev) => prev.filter((x) => !modulos.includes(x)));
    } else {
      setEditFundos((prev) => [...new Set([...prev, ...modulos])]);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateDispositivo(editingId, { nombre: editName || null, fundos_asignados: editFundos });
    setEditingId(null);
    load();
  };

  const toggleActive = async (d: Dispositivo) => {
    await updateDispositivo(d.id, { activo: !d.activo });
    load();
  };

  const handleDelete = async (d: Dispositivo) => {
    if (!confirm(`¿Eliminar dispositivo ${d.nombre || d.android_id}?`)) return;
    await deleteDispositivo(d.id);
    load();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getModulosLabel = (fundos: string[]) => {
    if (!fundos || fundos.length === 0) return null;
    const grouped: Record<string, string[]> = {};
    fundos.forEach((m) => {
      const fundo = Object.entries(FUNDOS_MODULOS).find(([, mods]) => mods.includes(m))?.[0] || "Otro";
      if (!grouped[fundo]) grouped[fundo] = [];
      grouped[fundo].push(m);
    });
    return grouped;
  };

  return (
    <div className="devices-overlay" onClick={onClose}>
      <div className="devices-modal" onClick={(e) => e.stopPropagation()}>
        <div className="devices-header">
          <h2>Dispositivos Registrados</h2>
          <button className="devices-close" onClick={onClose}>✕</button>
        </div>

        <div className="devices-search">
          <input
            type="text"
            placeholder="Buscar por nombre, modelo o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="devices-loading">Cargando...</p>
        ) : devices.length === 0 ? (
          <p className="devices-empty">No hay dispositivos registrados. Abre la app móvil para que se registre automáticamente.</p>
        ) : (
          <div className="devices-list">
            {devices.filter((d) => {
              if (!search) return true;
              const q = search.toLowerCase();
              return (d.nombre || "").toLowerCase().includes(q) || (d.modelo || "").toLowerCase().includes(q) || d.android_id.toLowerCase().includes(q);
            }).map((d) => (
              <div key={d.id} className={`devices-card ${!d.activo ? "devices-card-inactive" : ""}`}>
                <div className="devices-card-top">
                  <div className="devices-card-info">
                    {editingId === d.id ? (
                      <input
                        className="devices-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre del dispositivo"
                        autoFocus
                      />
                    ) : (
                      <div className="devices-card-name">
                        {d.nombre || <span className="devices-no-name">Sin nombre</span>}
                      </div>
                    )}
                    <div className="devices-card-model">{d.modelo || "Modelo desconocido"}</div>
                    <div className="devices-card-id">ID: {d.android_id}</div>
                    <div className="devices-card-date">Último acceso: {formatDate(d.ultimo_acceso)}</div>
                  </div>
                  <div className="devices-card-actions">
                    <button
                      className={`devices-status-btn ${d.activo ? "devices-active" : "devices-inactive"}`}
                      onClick={() => toggleActive(d)}
                    >
                      {d.activo ? "Activo" : "Inactivo"}
                    </button>
                    {editingId === d.id ? (
                      <>
                        <button className="devices-btn devices-btn-save" onClick={saveEdit}>Guardar</button>
                        <button className="devices-btn devices-btn-cancel" onClick={() => setEditingId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="devices-btn devices-btn-edit" onClick={() => startEdit(d)}>Editar</button>
                        <button className="devices-btn devices-btn-delete" onClick={() => handleDelete(d)}>Eliminar</button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === d.id ? (
                  <div className="devices-modulos-edit">
                    <div className="devices-modulos-title">Asignar módulos:</div>
                    {Object.entries(FUNDOS_MODULOS).map(([fundo, modulos]) => {
                      const allSelected = modulos.every((m) => editFundos.includes(m));
                      const someSelected = modulos.some((m) => editFundos.includes(m));
                      return (
                        <div key={fundo} className="devices-fundo-group">
                          <label className="devices-fundo-header">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => toggleFundoAll(fundo)}
                            />
                            <span className="devices-fundo-name">{fundo}</span>
                          </label>
                          <div className="devices-modulos-grid">
                            {modulos.map((m) => (
                              <label key={m} className="devices-modulo-check">
                                <input
                                  type="checkbox"
                                  checked={editFundos.includes(m)}
                                  onChange={() => toggleModulo(m)}
                                />
                                <span>Módulo {m.split("-")[1]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="devices-modulos-display">
                    {(() => {
                      const grouped = getModulosLabel(d.fundos_asignados || []);
                      if (!grouped) return <span className="devices-no-name">Sin módulos asignados</span>;
                      return Object.entries(grouped).map(([fundo, mods]) => (
                        <div key={fundo} className="devices-assigned-group">
                          <span className="devices-assigned-fundo">{fundo}:</span>
                          {mods.map((m) => (
                            <span key={m} className="devices-fundo-tag">{m}</span>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
