import { readFileSync } from "fs";

// Load .env.local
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  if (line.startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  const key = line.slice(0, idx).trim();
  let val = line.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const { register } = await import("tsx/esm/api");
register();

const { default: express } = await import("express");
const app = express();
app.use(express.json());

const routes = [
  "alertas", "dispositivos", "parada-fotos", "paradas",
  "points", "sessions", "usuarios", "device-start", "device-poll",
];

for (const name of routes) {
  try {
    const mod = await import(`./api/${name}.ts`);
    app.all(`/api/${name}`, (req, res) => mod.default(req, res));
  } catch (e) {
    console.log(`Skipped /api/${name}: ${e.message}`);
  }
}

app.listen(3001, () => console.log("API server running on http://localhost:3001"));
