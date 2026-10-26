import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const limit = parseInt(req.query.limit) || 50;
    const { rows } = await pool.query(
      `SELECT * FROM alertas ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { android_id, tipo, mensaje } = req.body;
    await pool.query(
      `INSERT INTO alertas (android_id, tipo, mensaje) VALUES ($1,$2,$3)`,
      [android_id, tipo, mensaje]
    );
    return res.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { id, all } = req.body;
    if (all) {
      await pool.query(`UPDATE alertas SET leida = true WHERE leida = false`);
    } else if (id) {
      await pool.query(`UPDATE alertas SET leida = true WHERE id = $1`, [id]);
    }
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
