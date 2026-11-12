// Optimistic compare-and-swap on one D1 row. No process-local quota counters.
export function quotaDatabase(binding,HttpsError){
  return {doc:path=>({path}),async runTransaction(work){
    if(!binding)throw new HttpsError('failed-precondition','Backend chưa gắn QUOTA_DB. Tạo D1 và chạy migration trước khi dùng API.');
    for(let attempt=0;attempt<6;attempt++){
      let path=null,version=0,value=null,pending=null;
      const result=await work({
        async get(ref){
          if(path&&path!==ref.path)throw Error('Quota transactions support one row.');path=ref.path;
          const row=await binding.prepare('SELECT version, value FROM usage WHERE path = ?').bind(path).first();
          version=row?.version||0;value=row?JSON.parse(row.value):null;
          return {exists:!!row,data:()=>value};
        },
        set(ref,next){if(ref.path!==path)throw Error('Read quota before write.');pending=next;},
        update(ref,next){if(ref.path!==path)throw Error('Read quota before write.');pending={...value,...next};}
      });
      if(!pending)return result;
      const saved=await binding.prepare('INSERT INTO usage (path, version, value) VALUES (?, 1, ?) ON CONFLICT(path) DO UPDATE SET version = usage.version + 1, value = excluded.value WHERE usage.version = ? RETURNING version').bind(path,JSON.stringify(pending),version).first();
      if(saved)return result;
    }
    throw new HttpsError('resource-exhausted','Có yêu cầu OpenAI khác đang chạy. Hãy thử lại sau.');
  }};
}
