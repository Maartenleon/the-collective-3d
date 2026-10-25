// Shared by the screenshot scripts: start a browser and open the site the way a visitor does.
// The site uses relative paths (site/styles.css, site/icons/), so it has to be opened by URL or file, not pasted into an empty page.
//   node story10.js                                   -> http://127.0.0.1:8099/the-collective-3d/ (serve the folder above the repo first)
//   node story10.js https://maartenleon.github.io/the-collective-3d/
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { pathToFileURL } = require('url');
const SITE = 'http://127.0.0.1:8099/the-collective-3d/';
exports.launch = () => fs.existsSync('/opt/pw-browsers/chromium')
  ? chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })   // the earlier sandbox, software GL
  : chromium.launch({ channel: 'chrome' });                                                                                                      // the installed Chrome, with the GPU
exports.open = async (p, target) => {
  const local = path.join(__dirname, 'node_modules/three');
  if (fs.existsSync(local)) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => { const rel = r.request().url().split('three@0.147.0/')[1]; r.fulfill({ body: fs.readFileSync(path.join(local, rel)), contentType: 'application/javascript' }); });
  await p.route(/fonts\./, r => r.abort());
  if (process.env.NOPEOPLE) await p.addInitScript(() => { window.__noPeople = true; });
  const t = target || SITE;
  return p.goto(/^(https?|file):/.test(t) ? t : pathToFileURL(path.resolve(t)).href, { timeout: 0 });
};
