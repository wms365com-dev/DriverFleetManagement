const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const baseURL = process.env.GUIDE_BASE_URL || process.env.QA_BASE_URL || 'http://127.0.0.1:3130';
const outDir = path.resolve(__dirname, '..', 'public', 'guides');

const guides = [
  ['user-guide.html', 'dispatcher365-user-guide-en.pdf'],
  ['user-guide-pa.html', 'dispatcher365-user-guide-pa.pdf'],
  ['user-guide-ta.html', 'dispatcher365-user-guide-ta.pdf']
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  try {
    for (const [htmlFile, pdfFile] of guides) {
      await page.goto(`${baseURL}/guides/${htmlFile}`, { waitUntil: 'networkidle' });
      await page.pdf({
        path: path.join(outDir, pdfFile),
        format: 'Letter',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '0.45in',
          right: '0.45in',
          bottom: '0.45in',
          left: '0.45in'
        }
      });
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, output: outDir, pdfs: guides.map(([, pdf]) => pdf) }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
