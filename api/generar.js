// api/generar.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import libre from "libreoffice-convert";

// __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1) Leer plantilla DOCX fija
    const tplPath = path.join(
      __dirname,
      "..",
      "templates",
      "contract-template.docx"
    );
    const content = fs.readFileSync(tplPath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 2) Rellenar con datos enviados en JSON
    doc.setData(req.body);
    doc.render();
    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

    // 3) Convertir a PDF
    const pdfBuf = await new Promise((resolve, reject) => {
      libre.convert(docxBuf, ".pdf", undefined, (err, done) => {
        if (err) reject(err);
        else resolve(done);
      });
    });

    // 4) Devolver PDF al cliente
    const filename = `Contrato_${req.body.CURSO}_${req.body.AÑO}.pdf`;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuf);

  } catch (e) {
    console.error("Error en función /api/generar:", e);
    res.status(500).send("Error generando el contrato");
  }
}
