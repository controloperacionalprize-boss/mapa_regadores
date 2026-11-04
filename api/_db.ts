import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const searchPathUrl = connectionString!.includes("?")
  ? `${connectionString}&options=-c%20search_path%3Ddva_mapa_regadores`
  : `${connectionString}?options=-c%20search_path%3Ddva_mapa_regadores`;

const pool = new Pool({
  connectionString: searchPathUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export default pool;
