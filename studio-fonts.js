export const SYSTEM_FONTS=['Arial','Georgia','Times New Roman','Courier New','Trebuchet MS','Verdana'];
export const BUNDLED_FONTS=[
 {family:'Be Vietnam Pro',slug:'bevietnampro',faces:[['regular.ttf','400'],['bold.ttf','700']]},
 {family:'Noto Serif',slug:'notoserif',faces:[['font.ttf','100 900']]},
 {family:'Lora',slug:'lora',faces:[['font.ttf','400 700']]},
 {family:'Montserrat',slug:'montserrat',faces:[['font.ttf','100 900']]},
 {family:'Baloo 2',slug:'baloo2',faces:[['font.ttf','400 800']]},
 {family:'Dancing Script',slug:'dancingscript',faces:[['font.ttf','400 700']]}
];
export const STUDIO_FONT_FAMILIES=[...SYSTEM_FONTS,...BUNDLED_FONTS.map(f=>f.family)];
const loading=new Map();
export async function ensureStudioFont(family){const font=BUNDLED_FONTS.find(x=>x.family===family);if(!font)return;if(!loading.has(family)){const job=Promise.all(font.faces.map(async([file,weight])=>{const url=new URL(`./assets/studio-free/fonts/${font.slug}/${file}`,import.meta.url),face=new FontFace(family,`url("${url.href}")`,{weight,style:'normal'});await face.load();document.fonts.add(face);})).catch(error=>{loading.delete(family);throw Error('Không tải được font '+family+'. Kiểm tra đã triển khai thư mục assets/studio-free/fonts.');});loading.set(family,job);}await loading.get(family);}
export async function ensureProjectFonts(layers){await Promise.all([...new Set(layers.filter(c=>c.type==='text'&&!c.hidden).map(c=>c.fontFamily))].map(ensureStudioFont));}
