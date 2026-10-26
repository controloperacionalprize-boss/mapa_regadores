import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { email } = req.query;
    if (email) {
      const { rows } = await pool.query(
        `SELECT * FROM usuarios_autorizados WHERE email = $1 AND activo = true`,
        [email.toLowerCase().trim()]
      );
      return res.json(rows[0] || null);
    }
    const { rows } = await pool.query(`SELECT * FROM usuarios_autorizados ORDER BY creado_en DESC`);
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { email, nombre, rol } = req.body;
    await pool.query(
      `INSERT INTO usuarios_autorizados (email, nombre, rol) VALUES ($1,$2,$3)`,
      [email.toLowerCase().trim(), nombre, rol]
    );
    return res.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `UPDATE usuarios_autorizados SET ${sets.join(", ")} WHERE id = $1`,
      [id, ...keys.map((k) => updates[k])]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await pool.query(`DELETE FROM usuarios_autorizados WHERE id = $1`, [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
