// 📦 Importaciones
import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';
import sgMail from '@sendgrid/mail';

const readFile = promisify(fs.readFile);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
    let html = await readFile(templatePath, 'utf8');

    const datos = req.body;
    for (const key in datos) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, datos[key]);
    }

    const docxBuffer = await docx.asBlob(html);
    const arrayBuffer = await docxBuffer.arrayBuffer();
    const bufferFinal = Buffer.from(arrayBuffer);

    const filename = `Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO} - RaiTrai.docx`;

    const textoCorreo = `Estimado/a:

Adjuntamos el contrato correspondiente al grupo "${datos.nombreGrupo}", programado para el año ${datos.AÑO}, creado por "${datos.DEST_EMAIL}. 
En la ficha, el campo de autorización dice "${datos.AUTORIZACION}" y el campo descuento "${datos.DESCUENTO}".
Por favor revisa y convierte a PDF cuando corresponda.

Para cualquier duda, estamos atentos.

Saludos,
Equipo RaiTrai`;

    await sgMail.send({
      to: ['sistemas@raitrai.cl', 'administracion@raitrai.cl'],
      from: 'notificaciones@raitrai.online',
      subject: `Nuevo Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO}`,
      text: textoCorreo,
      attachments: [{
        content: bufferFinal.toString('base64'),
        filename,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: 'attachment'
      }]
    });

    // 4️⃣ Envío #2: al usuario que lo solicitó, solo texto de confirmación
    await sgMail.send({
      to: datos.DEST_EMAIL,
      from: 'notificaciones@raitrai.online',
      subject: 'Tu contrato ha sido enviado',
      text: `
Hola,

Tu contrato para "${datos.nombreGrupo}" ha sido recibido y está en proceso de revisión.
En el sistema de Raitrai.online te alertará cuando el contrato esté revisado.

Saludos,
Equipo RaiTrai`
    });

    // ✅ Solo responde OK sin enviar el archivo al navegador
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Error al enviar contrato:', error);
    res.status(500).json({ error: 'Error al enviar el contrato' });
  }
}
