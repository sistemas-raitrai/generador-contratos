// api/generar.js

// Importaciones necesarias
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import nodemailer from "nodemailer";

// ——————————————————————————————————————————
// Ajuste de __dirname para ES modules
// ——————————————————————————————————————————
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ——————————————————————————————————————————
// Configuración de transporte SMTP con nodemailer
// Las credenciales se cargan de variables de entorno en Vercel:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
// ——————————————————————————————————————————
const transporter = nodemailer.createTransport({
  host:     process.env.SMTP_HOST,
  port:     parseInt(process.env.SMTP_PORT, 10),
  secure:   process.env.SMTP_SECURE === "true",
  auth: {
    user:   process.env.SMTP_USER,
    pass:   process.env.SMTP_PASS,
  },
});

export default async function handler(req, res) {
  // Sólo aceptamos POST
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // ——————————————————————————————————————————
    // 1) Leer y renderizar la plantilla DOCX
    //    /templates/contract-template.docx contiene marcadores {{…}}
    // ——————————————————————————————————————————
    const tplPath = path.join(__dirname, "..", "templates", "contract-template.docx");
    const content = fs.readFileSync(tplPath, "binary");
    const zip     = new PizZip(content);
    const doc     = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks:    true,
    });

    // Insertar los datos recibidos en el cuerpo de la petición
    doc.setData(req.body);
    doc.render();

    // Generar el buffer DOCX resultante
    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

    // Construir nombre de archivo: Contrato_CURSO_AÑO.docx
    const docxFilename = `Contrato_${req.body.CURSO}_${req.body.AÑO}.docx`;

    // ——————————————————————————————————————————
    // 2) Enviar el DOCX por email
    //    A: al destinatario elegido (DEST_EMAIL)
    //    B: a administracion@raitrai.cl
    // ——————————————————————————————————————————
    await transporter.sendMail({
      from:    `"RaiTrai" <${process.env.SMTP_USER}>`,
      to:      [ req.body.DEST_EMAIL, "administracion@raitrai.cl" ],
      subject: `Contrato ${req.body.CURSO} ${req.body.AÑO}`,
      text:    "Adjunto encontrarás el contrato en formato DOCX.",
      attachments: [
        {
          filename: docxFilename,
          content:  docxBuf
        }
      ]
    });

    // ——————————————————————————————————————————
    // 3) Devolver el DOCX al cliente para descarga
    //    Establecer headers para que el navegador lo descargue como archivo
    // ——————————————————————————————————————————
    res.setHeader("Content-Disposition", `attachment; filename="${docxFilename}"`);
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
