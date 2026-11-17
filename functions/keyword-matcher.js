// Public browser copy: /keyword-matcher.js. Keep both files byte-identical.
(function(root,factory){const api=factory();root.FBTQKeywords=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(){
 const segmenter=new Intl.Segmenter('vi',{granularity:'grapheme'});
 function indexed(value){
  const text=String(value??''),starts=[],ends=[];let normalized='';
  for(const item of segmenter.segment(text)){
   const start=item.index,end=start+item.segment.length;
   const part=item.segment.replace(/\p{Cf}/gu,'').normalize('NFC').toLocaleLowerCase('vi');
   for(const char of part){
    const mapped=/\s/u.test(char)?' ':char;
    if(mapped===' '&&normalized.endsWith(' ')){ends[ends.length-1]=end;continue;}
    normalized+=mapped;for(let i=0;i<mapped.length;i++){starts.push(start);ends.push(end);}
   }
  }
  return {text,normalized,starts,ends};
 }
 function findKeywordMatches(value,words,limit=5000){
  const source=indexed(value),out=[],seenRules=new Set(),seenRanges=new Set();
  for(const value of words||[]){
   if(typeof value!=='string')continue;const label=value.trim(),term=indexed(label).normalized.trim();
   if(!term||seenRules.has(term))continue;seenRules.add(term);let from=0,start;
   while((start=source.normalized.indexOf(term,from))>=0){
    const end=start+term.length;from=start+1;
    if(/^[\p{L}\p{N}\p{M}_]/u.test(term)&&/[\p{L}\p{N}\p{M}_]$/u.test(source.normalized.slice(Math.max(0,start-2),start)))continue;
    if(/[\p{L}\p{N}\p{M}_]$/u.test(term)&&/^[\p{L}\p{N}\p{M}_]/u.test(source.normalized.slice(end,end+2)))continue;
    const a=source.starts[start],b=source.ends[end-1],key=a+':'+b;
    if(!seenRanges.has(key)){seenRanges.add(key);out.push({word:label,quote:source.text.slice(a,b),start:a,end:b});}
    if(out.length>=limit)return out.sort((a,b)=>a.start-b.start||b.end-a.end);
   }
  }
  return out.sort((a,b)=>a.start-b.start||b.end-a.end);
 }
 return Object.freeze({findKeywordMatches});
});
