import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';
import { Resend } from 'resend';

const readFile = promisify(fs.readFile);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Leer plantilla HTML
    const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
    let html = await readFile(templatePath, 'utf8');

    // 2. Reemplazar variables {{ }} por datos del body
    const datos = req.body;
    for (const key in datos) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, datos[key]);
    }

    // 3. Convertir HTML a DOCX
    const docxBuffer = await docx.asBlob(html);
    const arrayBuffer = await docxBuffer.arrayBuffer();
    const bufferFinal = Buffer.from(arrayBuffer);

    // 4. Nombre del archivo
    const filename = `Contrato ${req.body.CURSO} ${req.body.COLEGIO} ${req.body.AÑO} - RaiTrai.docx`;

    // 5. Armar el cuerpo del correo
    const textoCorreo = `Estimado/a:

Adjuntamos el contrato correspondiente al grupo "${req.body.nombreGrupo}", programado para el año ${req.body.AÑO}. 
En la ficha, el campo de autorización dice "${req.body.AUTORIZACION}" y el campo descuento "${req.body.DESCUENTO}".

Para cualquier duda, estamos atentos.

Saludos,
Equipo RaiTrai`;

    // 6. Enviar email con Resend
    console.log("🔍 Resend instancia:", resend);
    console.log("📬 Resend.emails:", resend.emails);
    
    await resend.emails.send({
      from: 'RaiTrai <onboarding@resend.dev>',
      to: [req.body.DEST_EMAIL, 'administracion@raitrai.cl'],
      subject: `Contrato ${req.body.CURSO} ${req.body.COLEGIO} ${req.body.AÑO}`,
      text: textoCorreo,
      attachments: [
        {
          filename: filename,
          content: bufferFinal.toString('base64'),
          encoding: 'base64'
        }
      ]
    });

    // 7. Descargar el archivo
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(bufferFinal);

  } catch (error) {
    console.error('❌ Error al generar contrato:', error);
    res.status(500).json({ error: 'Error al generar el contrato' });
  }
}
