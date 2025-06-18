// api/generar.js
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip       from "pizzip";
import Docxtemplater from "docxtemplater";
import nodemailer   from "nodemailer";

// __dirname en ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Transporter SMTP (variables en Vercel)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    // 1) Leer plantilla
    const tpl = path.join(__dirname, "..", "templates", "contract-template-v2.docx");
    const content = fs.readFileSync(tpl, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.setData(req.body);
    doc.render();

    // Buffer DOCX
    const buf = doc.getZip().generate({ type: "nodebuffer" });
    const filename = `Contrato_${req.body.CURSO}_${req.body.AÑO}.docx`;

    // 2) Intentar envío de correo (si no config, **no** romperá)
    try {
      await transporter.sendMail({
        from: `"RaiTrai" <${process.env.SMTP_USER}>`,
        to: [ req.body.DEST_EMAIL, "administracion@raitrai.cl" ],
        subject: `Contrato ${req.body.CURSO} ${req.body.AÑO}`,
        text:    "Adjunto encontrarás el contrato en formato DOCX.",
        attachments: [{ filename, content: buf }]
      });
    } catch(mailErr) {
      console.warn("⚠️ No se pudo enviar email:", mailErr.message);
    }

    // 3) Devolver DOCX para descarga
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.send(buf);

  } catch (err) {
    console.error("Error en /api/generar:", err);
    res.status(500).send("Error generando el contrato");
  }
}
