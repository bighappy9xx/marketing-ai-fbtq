const fs=require('node:fs/promises');
const path=require('node:path');
const {transform}=require('esbuild');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'web-dist');
const landingAtRoot=process.argv.includes('--landing-root');
const includeDesktopDownloads=process.argv.includes('--include-desktop-downloads');
const pages=[
  ['index.html','workspace.html'],
  ['home.html','home.html'],
  [landingAtRoot?'home.html':'index.html','index.html'],
  ...['canva-callback.html','privacy.html','terms.html','data-deletion.html'].map(file=>[file,file])
];
const staticFiles=[
  'icons.svg','favicon.svg','logo.svg','logo-light.svg','apple-touch-icon.png','messenger-app.webmanifest',
  'OPENAI_FIREBASE_SETUP.md','FIREBASE_AI_SETUP.md','FACEBOOK-CONNECT.md',
  'extension/README.md','extension/FBTQ-Ads-Clipper.zip',
  'vendor/mediabunny/LICENSE','scripts/publish-global-directory.py'
];

const privateKeyPatterns=[
  /(?<![\w-])sk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{40,}/,
  /(?<!\w)sk-ant-[a-zA-Z0-9_-]{35,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  /(?<!\w)EAA[a-zA-Z0-9]{80,}/,
  /(?<!\w)(?:gh[pousr]_[a-zA-Z0-9]{35,}|github_pat_[a-zA-Z0-9_]{40,})/,
  /(?:META_APP_SECRET|META_VERIFY_TOKEN|META_TOKEN_ENCRYPTION_KEY)\s*[:=]\s*['"][A-Za-z\d_-]{24,}['"]/,
  /(?<!\w)(?:AKIA|ASIA)[A-Z0-9]{16}(?!\w)/
];
const browserKey=/(?<!\w)AIza[A-Za-z0-9_-]{35}/;
const sent=new Set();
const csp=[
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://cdn.jsdelivr.net 'wasm-unsafe-eval'",
  "worker-src 'self' blob: https://cdn.jsdelivr.net"
].join('; ');

function checkPublicText(file,text){
  if(privateKeyPatterns.some(pattern=>pattern.test(text)))throw Error('Tệp công khai có dấu hiệu chứa khóa riêng: '+file);
  if(!file.startsWith('vendor/')&&file!=='firebase-config.js'&&browserKey.test(text))throw Error('Chỉ đặt Firebase browser API key trong firebase-config.js: '+file);
}

async function write(file,data){
  const target=path.join(output,file);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,data);
}

function findModules(source){
  const imports=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]((?:\.\.?\/)[^'"]+)['"]/g;
  return [...source.matchAll(imports)].map(match=>match[1].split(/[?#]/)[0]);
}
function resolveModule(parent,ref){
  const file=path.posix.normalize(path.posix.join(path.posix.dirname(parent),ref));
  if(!/^(?:[a-zA-Z0-9_-]+\.(?:js|mjs|css)|vendor\/mediabunny\/mediabunny-[\d.]+\.mjs)$/.test(file)){
    throw Error('Tệp phụ thuộc ngoài phạm vi web: '+file);
  }
  return file;
}

async function addModule(file){
  if(sent.has(file))return;
  sent.add(file);
  const source=await fs.readFile(path.join(root,file),'utf8');
  checkPublicText(file,source);
  const css=file.endsWith('.css');
  if(!css)for(const ref of findModules(source))await addModule(resolveModule(file,ref));
  const result=await transform(source,{loader:css?'css':'js',target:'es2022',minify:true,legalComments:'inline',sourcemap:false,sourcefile:file});
  await write(file,result.code);
}

async function addAssets(directory){
  for(const entry of await fs.readdir(path.join(root,directory),{withFileTypes:true})){
    const file=path.posix.join(directory,entry.name);
    if(entry.name.startsWith('.'))continue;
    if(entry.isDirectory()){await addAssets(file);continue;}
    if(!entry.isFile()||!(/\.(?:png|jpe?g|svg|webp|wav|ogg|ttf|woff2|json|txt)$/i.test(entry.name)))throw Error('Tệp tài nguyên web không hợp lệ: '+file);
    const bytes=await fs.readFile(path.join(root,file));
    if(/\.(?:json|txt|svg)$/i.test(file))checkPublicText(file,bytes.toString('utf8'));
    await write(file,bytes);
  }
}

async function build(){
  await fs.rm(output,{recursive:true,force:true});
  try{
    for(const [file,target] of pages){
      const html=await fs.readFile(path.join(root,file),'utf8');
      checkPublicText(file,html);
      const links=html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g);
      for(const [,link] of links){
        const dep=link.split(/[?#]/)[0];
        if(/^[a-zA-Z0-9_-]+\.(js|css)$/.test(dep))await addModule(dep);
      }
      await write(target,html.replace(/<head\b[^>]*>/i,head=>head+'\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">'));
    }
    await addAssets('assets');
    await addModule('messenger-push-worker.js');
    for(const file of staticFiles){
      const data=await fs.readFile(path.join(root,file));
      if(!file.endsWith('.png')&&!file.endsWith('.zip'))checkPublicText(file,data.toString('utf8'));
      await write(file,data);
    }
    if (includeDesktopDownloads) {
      for (const platform of ['macOS-Apple-Silicon','macOS-Intel','Windows-x64']) {
        const file = 'downloads/ban-ho-so/BanHoSo-v1.3.12-' + platform + '.zip';
        const target = path.join(output,file);
        await fs.mkdir(path.dirname(target),{recursive:true});
        await fs.copyFile(path.join(root,file),target);
      }
    }
    await write('.nojekyll','');
    console.log('Built web-dist with '+sent.size+' minimized frontend modules.');
  }catch(error){
    await fs.rm(output,{recursive:true,force:true});
    throw error;
  }
}

build().catch(error=>{console.error(error.message);process.exitCode=1;});
