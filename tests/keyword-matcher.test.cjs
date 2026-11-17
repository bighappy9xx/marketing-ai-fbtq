const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {findKeywordMatches:match}=require('../functions/keyword-matcher');
test('Vietnamese accents and whole-word boundaries remain meaningful',()=>{
 assert.deepEqual(match('chưa chua chữa CHỮA chữaabc abcchữa',['chữa']).map(m=>m.quote),['chữa','CHỮA']);
 assert.deepEqual(match('ban bán bạn bảng',['bán']).map(m=>m.quote),['bán']);assert.deepEqual(match('tiêu trị liệu điều trị liệu',['trị liệu']).map(m=>m.quote),['trị liệu','trị liệu']);
 assert.equal(match('điều trị bệnh',['trị']).length,1);assert.equal(match('giá trị liệu',['giá trị']).length,1);assert.equal(match('gia tri',['giá trị']).length,0);
});
test('NFC/NFD, flexible whitespace, hidden separators and UTF-16 offsets are handled exactly',()=>{
 const text='😀 chưa, CHỮA; cam\n  kết; ch\u200bữa.',rows=match(text,['chữa','cam kết']);
 assert.deepEqual(rows.map(m=>m.quote),['CHỮA','cam\n  kết','ch\u200bữa']);for(const m of rows)assert.equal(text.slice(m.start,m.end),m.quote);
 assert.deepEqual(match('😀 CAM KẾT và cam kết',['cam kết','CAM KẾT']).map(m=>m.quote),['CAM KẾT','cam kết']);
});
test('rules are literal and browser/server copies cannot diverge',()=>{
 assert.equal(match('test [hello] and xhello',['[hello]']).length,1);assert.equal(match('aaaaaaaaa',['a.*']).length,0);assert.equal(match('khỏi bệnh',['khỏi bệnh']).length,1);
 assert.equal(fs.readFileSync(path.join(__dirname,'../keyword-matcher.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../functions/keyword-matcher.js'),'utf8'));
});
