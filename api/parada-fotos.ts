import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { parada_id } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM parada_fotos WHERE parada_id = $1 ORDER BY grabado_en ASC`,
      [parada_id]
    );
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { parada_id, url, grabado_en } = req.body;
    await pool.query(
      `INSERT INTO parada_fotos (parada_id, url, grabado_en) VALUES ($1,$2,$3)`,
      [parada_id, url, grabado_en]
    );
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
