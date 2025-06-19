import fs from 'fs';
import path from 'path';
import docx from 'html-docx-js';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Cargar el template HTML
    const templatePath = path.join(process.cwd(), 'templates', 'contrato-template.html');
    let html = await readFile(templatePath, 'utf8');

    // 2. Reemplazar variables del HTML con valores del body
    const datos = req.body;
    for (const key in datos) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, datos[key]);
    }

    // 3. Convertir HTML a DOCX
    const docxBuffer = docx.asBlob(html);

    // 4. Enviar el archivo
    const filename = `Contrato ${req.body.CURSO} ${req.body.COLEGIO} ${req.body.AÑO} - RaiTrai`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(docxBuffer);
  } catch (error) {
    console.error('Error al generar contrato:', error);
    res.status(500).json({ error: 'Error al generar el contrato' });
  }
}
