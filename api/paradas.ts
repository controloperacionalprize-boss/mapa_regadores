import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { sesion_id } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM paradas WHERE sesion_id = $1 ORDER BY inicio ASC`,
      [sesion_id]
    );
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { id, sesion_id, lat, lng, inicio } = req.body;
    await pool.query(
      `INSERT INTO paradas (id, sesion_id, lat, lng, inicio) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [id, sesion_id, lat, lng, inicio]
    );
    return res.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { id, fin, nota } = req.body;
    await pool.query(
      `UPDATE paradas SET fin = COALESCE($2, fin), nota = COALESCE($3, nota) WHERE id = $1`,
      [id, fin, nota]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await pool.query(`DELETE FROM parada_fotos WHERE parada_id = $1`, [id]);
    await pool.query(`DELETE FROM paradas WHERE id = $1`, [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
