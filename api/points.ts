import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

export default async function handler(req: any, res: any) {

  if (req.method === "GET") {
    const { sesion_id, sesion_ids } = req.query;

    if (sesion_id) {
      const { rows } = await pool.query(
        `SELECT id, sesion_id, lat, lng, velocidad, precision_metros, fundo, grabado_en, offline
         FROM punto_gps WHERE sesion_id = $1 ORDER BY grabado_en ASC`,
        [sesion_id]
      );
      return res.json(rows);
    }

    if (sesion_ids) {
      const ids = sesion_ids.split(",");
      const { rows } = await pool.query(
        `SELECT id, sesion_id, lat, lng, velocidad, precision_metros, fundo, grabado_en, offline
         FROM punto_gps WHERE sesion_id = ANY($1) ORDER BY grabado_en ASC`,
        [ids]
      );
      return res.json(rows);
    }

    return res.status(400).json({ error: "sesion_id or sesion_ids required" });
  }

  if (req.method === "POST") {
    const points = Array.isArray(req.body) ? req.body : [req.body];
    if (points.length === 0) return res.json({ inserted: 0 });

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const p of points) {
      placeholders.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8})`);
      values.push(p.sesion_id, p.lat, p.lng, p.velocidad, p.precision_metros, p.fundo, p.modulo_actual, p.turno_actual, p.grabado_en);
      idx += 9;
    }

    await pool.query(
      `INSERT INTO punto_gps (sesion_id, lat, lng, velocidad, precision_metros, fundo, modulo_actual, turno_actual, grabado_en)
       VALUES ${placeholders.join(",")}
       ON CONFLICT DO NOTHING`,
      values
    );
    return res.json({ inserted: points.length });
  }

  if (req.method === "HEAD") {
    const { sesion_id } = req.query;
    const { rows } = await pool.query(`SELECT count(*)::int as count FROM punto_gps WHERE sesion_id = $1`, [sesion_id]);
    res.setHeader("x-total-count", rows[0].count);
    return res.status(200).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
