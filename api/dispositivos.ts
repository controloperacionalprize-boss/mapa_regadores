import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { android_id } = req.query;
    if (android_id) {
      const { rows } = await pool.query(`SELECT * FROM dispositivos WHERE android_id = $1`, [android_id]);
      return res.json(rows[0] || null);
    }
    const { rows } = await pool.query(`SELECT * FROM dispositivos ORDER BY registrado_en DESC`);
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { android_id, modelo } = req.body;
    const existing = await pool.query(`SELECT id FROM dispositivos WHERE android_id = $1`, [android_id]);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE dispositivos SET modelo = $1, ultimo_acceso = NOW() WHERE android_id = $2`,
        [modelo, android_id]
      );
    } else {
      await pool.query(
        `INSERT INTO dispositivos (android_id, modelo) VALUES ($1, $2)`,
        [android_id, modelo]
      );
    }
    return res.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `UPDATE dispositivos SET ${sets.join(", ")} WHERE id = $1`,
      [id, ...keys.map((k) => updates[k])]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await pool.query(`DELETE FROM dispositivos WHERE id = $1`, [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
