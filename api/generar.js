import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';
import { Resend } from 'resend';
import fetch from 'node-fetch';

const readFile = promisify(fs.readFile);
const resend = new Resend(process.env.RESEND_API_KEY); // asegúrate de definir esta key en Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const datos = req.body;

    // 1. Leer HTML plantilla
    const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
    let html = await readFile(templatePath, 'utf8');

    for (const key in datos) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, datos[key]);
    }

    // 2. Generar DOCX
    const docxBuffer = await docx.asBlob(html);
    const bufferFinal = Buffer.from(await docxBuffer.arrayBuffer());

    // 3. Leer datos de la fila desde la misma Google Sheet
    const sheetURL = 'https://script.google.com/macros/s/AKfycbzU3RIF2TXDhlUwuSZj9VFnEienz0_XPw1mVwqzj6TWL3afs4GE-9kFkaRy9ps5YSqFaQ/exec';
    let fila = null;
    try {
      const respuesta = await fetch(sheetURL);
      const datosSheet = await respuesta.json();
      fila = datosSheet.find(
        (row) =>
          row.numeroNegocio === datos.numeroNegocio ||
          row.nombreGrupo === datos.nombreGrupo
      );
    } catch (error) {
      console.warn('⚠️ No se pudo leer la fila desde la Google Sheet:', error.message);
    }

    // 4. Texto del correo
    const textoCorreo = fila
      ? `Estimado/a:\n\nAdjuntamos el contrato correspondiente al grupo "${fila.nombreGrupo}", programado para el año ${fila.anoViaje}. En la ficha el campo de autorización dice "${fila.autorizacion}" y el campo descuento "${fila.descuento}".\n\nPara cualquier duda, estamos atentos.\n\nSaludos,\nEquipo RaiTrai`
      : `Adjuntamos el contrato correspondiente al grupo solicitado.`;

    // 5. Enviar por correo
    const filename = `Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO} - RaiTrai.docx`;
    await resend.emails.send({
      from: 'RaiTrai Contratos <no-responder@raitrai.cl>',
      to: [datos.DEST_EMAIL, 'administracion@raitrai.cl'],
      subject: `Contrato ${datos.CURSO} ${datos.COLEGIO} ${datos.AÑO}`,
      text: textoCorreo,
      attachments: [
        {
          filename,
          content: bufferFinal.toString('base64'),
        },
      ],
    });

    // 6. Enviar como descarga
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(bufferFinal);
  } catch (error) {
    console.error('❌ Error al generar contrato:', error);
    res.status(500).json({ error: 'Error al generar el contrato' });
  }
}
