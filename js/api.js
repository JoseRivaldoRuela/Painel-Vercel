const SUPA_URL='https://jlfltollgwtrqpapqnnp.supabase.co';
const ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmx0b2xsZ3d0cnFwYXBxbm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDcwNDQsImV4cCI6MjA5NDI4MzA0NH0.A9uEdtRQrI0zjFn6W9euH7B3cmMVuRyuTud7_oFSF7g';

// API
function url(p){ return `${SUPA_URL}/rest/v1/${p}${p.includes('?')?'&':'?'}apikey=${ANON_KEY}`; }
const hdrs=(e={})=>({'Authorization':`Bearer ${ANON_KEY}`,'Accept':'application/json',...e});
async function apiGet(p){ const r=await fetch(url(p),{headers:hdrs({'Prefer':'count=exact'})}); return r.json(); }
async function apiPost(p,b){ const r=await fetch(url(p),{method:'POST',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)}); return{ok:r.ok,data:await r.json()}; }
async function apiPatch(p,b){ const r=await fetch(url(p),{method:'PATCH',headers:hdrs({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(b)}); return{ok:r.ok,data:await r.json()}; }
async function apiDelete(p){ const r=await fetch(url(p),{method:'DELETE',headers:hdrs({'Authorization':`Bearer ${ANON_KEY}`})}); return r.ok; }
