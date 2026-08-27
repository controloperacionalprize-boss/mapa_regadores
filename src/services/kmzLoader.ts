import JSZip from "jszip";

export interface PolygonData {
  coords: [number, number][];
  fundo: string;
  modulo: string;
  color: string;
}

const MODULO_A_FUNDO: Record<string, string> = {};
[1, 2, 3, 4].forEach((n) => { MODULO_A_FUNDO[`AQ1-${n}`] = "ARENA AZUL"; });
[1, 2, 3, 4, 5].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "QURI ALLPA"; });
[6, 7, 8, 9, 10, 11, 16, 17, 18].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "KAWSAY ALLPA"; });
[12, 13, 14, 15].forEach((n) => { MODULO_A_FUNDO[`AQ2-${n}`] = "AYLLU ALLPA"; });

const FUNDO_COLORS: Record<string, string> = {
  "ARENA AZUL": "#e6194b",
  "QURI ALLPA": "#4363d8",
  "KAWSAY ALLPA": "#3cb44b",
  "AYLLU ALLPA": "#f58231",
};

function getModuloCode(mod: string): string {
  const m = mod.toUpperCase().match(/^(AQ\d+)\s*-\s*MODULO\s*(\d+)/);
  if (!m) return "";
  return `${m[1]}-${parseInt(m[2])}`;
}

function getFundo(mod: string): string {
  const code = getModuloCode(mod);
  if (!code) return "SIN FUNDO";
  return MODULO_A_FUNDO[code] || "SIN FUNDO";
}

function assignFolderToPlacemarks(kml: string): string[] {
  const folders: string[] = [];
  const folderStack: string[] = [];
  const regex = /<(\/?)(Folder|Placemark|name)[\s>]/g;
  let m: RegExpExecArray | null;
  let expectingFolderName = false;

  while ((m = regex.exec(kml)) !== null) {
    const isClose = m[1] === "/";
    const tag = m[2];
    if (tag === "Folder" && !isClose) { expectingFolderName = true; folderStack.push(""); }
    else if (tag === "Folder" && isClose) { folderStack.pop(); }
    else if (tag === "name" && !isClose && expectingFolderName) {
      const after = kml.substring(m.index);
      const nameMatch = after.match(/<name>([^<]*)<\/name>/);
      if (nameMatch && folderStack.length > 0) folderStack[folderStack.length - 1] = nameMatch[1].trim();
      expectingFolderName = false;
    } else if (tag === "Placemark" && !isClose) {
      folders.push(folderStack.length > 0 ? folderStack[folderStack.length - 1] : "");
      expectingFolderName = false;
    }
  }
  return folders;
}

export async function loadKmzPolygons(): Promise<PolygonData[]> {
  const resp = await fetch(
    "https://api.github.com/repos/controloperacionalprize-boss/CAMPO_RENDIMIENTO/contents/MODULOS_PRIZE_PAIJAN.kmz",
    {
      headers: {
        Authorization: `token ${import.meta.env.VITE_GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.raw",
      },
    }
  );
  const buf = await resp.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const kmlFile = Object.keys(zip.files).find((f) => f.endsWith(".kml"));
  if (!kmlFile) throw new Error("No KML found");
  const kml = await zip.files[kmlFile].async("text");

  const pmFolders = assignFolderToPlacemarks(kml);
  const pmRegex = /<Placemark[\s>][\s\S]*?<\/Placemark>/g;
  const polygons: PolygonData[] = [];
  let pmMatch: RegExpExecArray | null;
  let pmIndex = 0;

  while ((pmMatch = pmRegex.exec(kml)) !== null) {
    const pm = pmMatch[0];
    const folder = pmFolders[pmIndex] || "";
    pmIndex++;
    if (folder.toLowerCase().includes("pozos")) continue;

    const coordsRegex = /<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/g;
    let cm: RegExpExecArray | null;
    while ((cm = coordsRegex.exec(pm)) !== null) {
      const coords: [number, number][] = cm[1].trim().split(/\s+/).map((c) => {
        const p = c.split(",").map(Number);
        return p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]) ? [p[1], p[0]] as [number, number] : null;
      }).filter(Boolean) as [number, number][];
      if (coords.length < 3) continue;
      const fundo = getFundo(folder);
      const modulo = getModuloCode(folder);
      polygons.push({ coords, fundo, modulo, color: FUNDO_COLORS[fundo] || "#999" });
    }
  }
  return polygons;
}
