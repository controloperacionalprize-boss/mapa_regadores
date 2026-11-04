import pool from "./_db.js";

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { rows } = await pool.query(`SELECT * FROM areas ORDER BY nombre ASC`);
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });
    await pool.query(
      `INSERT INTO areas (nombre) VALUES ($1)`,
      [nombre.trim()]
    );
    return res.json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    await pool.query(
      `UPDATE areas SET ${sets.join(", ")} WHERE id = $1`,
      [id, ...keys.map((k) => updates[k])]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    await pool.query(`DELETE FROM areas WHERE id = $1`, [id]);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
