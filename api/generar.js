import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';
import sgMail from '@sendgrid/mail';
import formidable from 'formidable'; // ✅ NUEVO

const readFile = promisify(fs.readFile);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 👇 Evita que Next.js procese el body por defecto
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('❌ Error al parsear el formulario:', err);
      return res.status(500).json({ error: 'Error al procesar el formulario' });
    }

    try {
      // 🔄 1. Reemplazar {{variables}} en la plantilla HTML
      const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
      let html = await readFile(templatePath, 'utf8');

      for (const key in fields) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        html = html.replace(regex, fields[key]);
      }

      // 📝 2. Generar DOCX desde HTML
      const docxBuffer = await docx.asBlob(html);
      const arrayBuffer = await docxBuffer.arrayBuffer();
      const bufferFinal = Buffer.from(arrayBuffer);

      // 🏷️ Nombre del contrato
      const filename = `Contrato ${fields.CURSO} ${fields.COLEGIO} ${fields.AÑO} - RaiTrai.docx`;
      const filenameSeguro = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");

      // 📨 3. Crear cuerpo del correo
      const textoCorreo = `Estimado/a:

Adjuntamos el contrato correspondiente al grupo "${fields.nombreGrupo}", programado para el año ${fields.AÑO}. 
En la ficha, el campo de autorización dice "${fields.AUTORIZACION}" y el campo descuento "${fields.DESCUENTO}".

Para cualquier duda, estamos atentos.

Saludos,
Equipo RaiTrai`;

      // 📎 4. Adjuntos
      const attachments = [
        {
          content: bufferFinal.toString('base64'),
          filename,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          disposition: 'attachment'
        }
      ];

      // 📎 Anexo 1 (archivo subido por el usuario)
      if (fields.incluirAnexo1 === 'true' && files.anexo1) {
        const filePath = files.anexo1.filepath;
        const buffer = fs.readFileSync(filePath);
        attachments.push({
          content: buffer.toString('base64'),
          filename: files.anexo1.originalFilename,
          type: files.anexo1.mimetype,
          disposition: 'attachment'
        });
      }

      // 📎 Anexo 2 (uno de los 7 PDF internos)
      if (fields.incluirAnexo2 === 'true' && fields.anexo2Nombre) {
        const anexo2Path = path.join(process.cwd(), 'anexos', fields.anexo2Nombre);
        const buffer = fs.readFileSync(anexo2Path);
        attachments.push({
          content: buffer.toString('base64'),
          filename: fields.anexo2Nombre,
          type: 'application/pdf',
          disposition: 'attachment'
        });
      }

      // 📎 Anexo 3 (siempre el mismo archivo interno)
      if (fields.incluirAnexo3 === 'true') {
        const anexo3Path = path.join(process.cwd(), 'anexos', 'Anexo_3.pdf');
        const buffer = fs.readFileSync(anexo3Path);
        attachments.push({
          content: buffer.toString('base64'),
          filename: 'Anexo_3.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        });
      }

      // 📤 5. Enviar correo
      await sgMail.send({
        to: [fields.DEST_EMAIL, 'administracion@raitrai.cl'],
        from: 'notificaciones@raitrai.online',
        subject: `Contrato ${fields.CURSO} ${fields.COLEGIO} ${fields.AÑO}`,
        text: textoCorreo,
        attachments
      });

      // 6️⃣ Devolver el archivo DOCX como descarga
      res.setHeader('Content-Disposition', `attachment; filename="${filenameSeguro}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(bufferFinal);

    } catch (error) {
      console.error('❌ Error al generar contrato:', error);
      res.status(500).json({ error: 'Error al generar el contrato' });
    }
  });
}
