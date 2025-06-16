// api/generar.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import nodemailer from "nodemailer";

// Ajuste __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Configuración SMTP vía vars de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // 1) Leer y renderizar plantilla DOCX
    const tplPath = path.join(__dirname, "..", "templates", "contract-template.docx");
    const content = fs.readFileSync(tplPath, "binary");
    const zip     = new PizZip(content);
    const doc     = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.setData(req.body);
    doc.render();
    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

    // Nombre de archivo basado en curso/año
    const docxFilename = `Contrato_${req.body.CURSO}_${req.body.AÑO}.docx`;

    // 2) Enviar DOCX por email
    await transporter.sendMail({
      from: `"RaiTrai" <${process.env.SMTP_USER}>`,
      to: [ req.body.DEST_EMAIL, "administracion@raitrai.cl" ],
      subject: `Contrato ${req.body.CURSO} ${req.body.AÑO}`,
      text: "Adjunto encontrarás el contrato en formato DOCX.",
      attachments: [
        { filename: docxFilename, content: docxBuf }
      ]
    });

    // 3) Devolver el DOCX al cliente para descarga
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${docxFilename}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.send(docxBuf);

  } catch (err) {
    console.error("Error en /api/generar:", err);
    res.status(500).send("Error generando el contrato");
  }
}
