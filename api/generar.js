// 📦 Importaciones
import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';
import sgMail from '@sendgrid/mail';

const readFile = promisify(fs.readFile);

// ✅ Clave de SendGrid desde Vercel (variable de entorno)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1️⃣ Leer plantilla HTML desde la carpeta "templates"
    const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
    let html = await readFile(templatePath, 'utf8');

    // 2️⃣ Reemplazar {{variables}} con valores del formulario
    const datos = req.body;
    for (const key in datos) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, datos[key]);
    }
    
    // 3️⃣ Convertir HTML a DOCX
    const docxBuffer = await docx.asBlob(html);
    const arrayBuffer = await docxBuffer.arrayBuffer();
    const bufferFinal = Buffer.from(arrayBuffer);

    // 4️⃣ Nombre del archivo a enviar
    const filename = `Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO} - RaiTrai.docx`;

    // 🛡️ Normalizar nombre de archivo para evitar caracteres conflictivos en encabezados HTTP
    const filenameSeguro = filename
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");

    // 5️⃣ Texto plano del correo
    const textoCorreo = `Estimado/a:

Adjuntamos el contrato correspondiente al grupo "${datos.nombreGrupo}", programado para el año ${datos.AÑO}. 
En la ficha, el campo de autorización dice "${datos.AUTORIZACION}" y el campo descuento "${datos.DESCUENTO}".

Para cualquier duda, estamos atentos.

Saludos,
Equipo RaiTrai`;

    // 6️⃣ Enviar email con SendGrid
    await sgMail.send({
      to: [datos.DEST_EMAIL, 'administracion@raitrai.cl'],
      from: 'notificaciones@raitrai.online',
      subject: `Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO}`,
      text: textoCorreo,
      attachments: [{
        content: bufferFinal.toString('base64'),
        filename,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: 'attachment'
      }]
    });

    // 7️⃣ Descargar archivo como respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filenameSeguro}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(bufferFinal);

  } catch (error) {
    console.error('❌ Error al generar contrato:', error);
    res.status(500).json({ error: 'Error al generar el contrato' });
  }
}
