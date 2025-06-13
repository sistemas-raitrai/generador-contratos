// server.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import libre from "libreoffice-convert";

// 🔧 Ajuste para __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1) Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 2) Endpoint para generar el contrato y convertirlo a PDF
app.post("/generar", (req, res) => {
  try {
    // --- Leer plantilla DOCX fija ---
    const tplPath = path.join(
      __dirname,
      "templates",
      "contract-template.docx"
    );
    const content = fs.readFileSync(tplPath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // --- Rellenar con datos del cliente (incluye .clausulas[]) ---
    doc.setData(req.body);
    doc.render();
    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

    // --- Convertir buffer DOCX a PDF ---
    libre.convert(docxBuf, ".pdf", undefined, (err, pdfBuf) => {
      if (err) {
        console.error("Error conversión a PDF:", err);
        return res.status(500).send("Error en conversión a PDF");
      }
      // --- Enviar PDF al cliente ---
      const filename = `Contrato_${req.body.CURSO}_${req.body.AÑO}.pdf`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"${filename}\"`
      );
      res.setHeader("Content-Type", "application/pdf");
      res.send(pdfBuf);
    });
  } catch (e) {
    console.error("Error generando contrato:", e);
    res.status(500).send("Error generando el contrato");
  }
});

// 3) Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
);
