import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { fundo, active } = req.query;
    let query = `SELECT * FROM sesiones_gps WHERE app = 'mapa_regadores'`;
    const params: any[] = [];

    if (active === "true") {
      query += ` AND terminado_en IS NULL`;
    }
    if (fundo) {
      params.push(fundo);
      query += ` AND fundo = $${params.length}`;
    }
    query += ` ORDER BY iniciado_en DESC`;

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  }

  if (req.method === "POST") {
    const s = req.body;
    const { rows } = await pool.query(
      `INSERT INTO sesiones_gps (id, fundo, modulo_origen, turno_origen, modulo_destino, turno_destino, iniciado_en, terminado_en, dispositivo, app, usuario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [s.id, s.fundo, s.modulo_origen, s.turno_origen, s.modulo_destino, s.turno_destino, s.iniciado_en, s.terminado_en, s.dispositivo, s.app, s.usuario]
    );
    return res.json(rows[0] || { id: s.id });
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `UPDATE sesiones_gps SET ${sets.join(", ")} WHERE id = $1`,
      [id, ...keys.map((k) => updates[k])]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    const paradaIds = await pool.query(`SELECT id FROM paradas WHERE sesion_id = $1`, [id]);
    const ids = paradaIds.rows.map((r: any) => r.id);
    if (ids.length > 0) {
      await pool.query(`DELETE FROM parada_fotos WHERE parada_id = ANY($1)`, [ids]);
    }
    await pool.query(`DELETE FROM paradas WHERE sesion_id = $1`, [id]);
    await pool.query(`DELETE FROM punto_gps WHERE sesion_id = $1`, [id]);
    await pool.query(`DELETE FROM sesiones_gps WHERE id = $1`, [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
