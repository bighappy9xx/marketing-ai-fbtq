// Minimal OOXML workbook writer: UTF-8 inline strings, numeric cells, fills and frozen headers.
// No remote script or formula evaluation is needed to export employee data.
const xml = value => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const column = index => { let s=''; for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s; };
const crcTable = Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32 = bytes => {let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function zip(files) {
  const encoder=new TextEncoder(), parts=[], central=[];let offset=0;
  for(const [path,content] of Object.entries(files)) {
    const name=encoder.encode(path), data=encoder.encode(content), crc=crc32(data), head=new Uint8Array(30+name.length), h=new DataView(head.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);head.set(name,30);
    const entry=new Uint8Array(46+name.length), e=new DataView(entry.buffer);
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,33,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,name.length,true);e.setUint32(42,offset,true);entry.set(name,46);
    parts.push(head,data);central.push(entry);offset+=head.length+data.length;
  }
  const centralSize=central.reduce((n,a)=>n+a.length,0), tail=new Uint8Array(22), t=new DataView(tail.buffer);
  t.setUint32(0,0x06054b50,true);t.setUint16(8,central.length,true);t.setUint16(10,central.length,true);t.setUint32(12,centralSize,true);t.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const part of [...parts,...central,tail]){result.set(part,cursor);cursor+=part.length;}return result;
}
export function workbookBytes(sheets) {
  const fills=['EDF2FA','DBEAFE','FFEDD5','EDE9FE','FEF3C7','FEE2E2','DCFCE7'];
  const styles=`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${Array.from({length:8},(_,i)=>`<xf numFmtId="0" fontId="${i===1?1:0}" fillId="${i?i+1:0}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files={
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':styles
  };
  sheets.forEach((sheet,i)=>{
    const last=column(Math.max(0,...sheet.rows.map(r=>r.length-1)))+Math.max(1,sheet.rows.length), frozen=sheet.freeze||0;
    files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet xmlns="${ns}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="${frozen}" ySplit="1" topLeftCell="${column(frozen)}2" activePane="${frozen?'bottomRight':'bottomLeft'}" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${(sheet.widths||[]).map((w,c)=>`<col min="${c+1}" max="${c+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheet.rows.map((row,r)=>`<row r="${r+1}">${row.map((raw,c)=>{const cell=raw!==null&&typeof raw==='object'?raw:{value:raw},value=cell.value,ref=column(c)+(r+1),style=cell.style||0;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${last}"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
  });
  return zip(files);
}
export function downloadWorkbook(sheets,filename) {
  const url=URL.createObjectURL(new Blob([workbookBytes(sheets)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
