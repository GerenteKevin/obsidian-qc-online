const url=(import.meta.env.VITE_SUPABASE_URL as string|undefined)?.replace(/\/$/,'');
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const configured=Boolean(url&&key);
type AuthSession={access_token:string;refresh_token:string;expires_at?:number;user:{id:string;email?:string}};
type Result<T=any>={data:T|null;error:{message:string}|null};
const SESSION_KEY='oqc-supabase-session';
let listeners=new Set<(event:string,session:AuthSession|null)=>void>();
function readSession():AuthSession|null{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s:AuthSession|null){if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY);listeners.forEach(fn=>fn(s?'SIGNED_IN':'SIGNED_OUT',s))}
async function request(path:string,init:RequestInit={}):Promise<any>{const session=readSession();const res=await fetch(`${url}${path}`,{...init,headers:{apikey:key||'',Authorization:`Bearer ${session?.access_token||key||''}`,'Content-Type':'application/json',Prefer:'return=representation',...(init.headers||{})}});const text=await res.text();let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error_description||data?.hint||`请求失败 ${res.status}`);return data}
class Query implements PromiseLike<Result<any>>{
 table:string;method='GET';body:any;filters:string[]=[];orders:string[]=[];selectCols='*';wantSingle=false;headers:Record<string,string>={};
 constructor(table:string){this.table=table}
 select(cols='*'){this.selectCols=cols;if(this.method==='GET')this.method='GET';else this.headers.Prefer='return=representation';return this}
 insert(body:any){this.method='POST';this.body=body;return this}
 upsert(body:any,opts?:{onConflict?:string}){this.method='POST';this.body=body;this.headers.Prefer='resolution=merge-duplicates,return=representation';if(opts?.onConflict)this.filters.push(`on_conflict=${encodeURIComponent(opts.onConflict)}`);return this}
 update(body:any){this.method='PATCH';this.body=body;return this}
 delete(){this.method='DELETE';return this}
 eq(k:string,v:any){this.filters.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`);return this}
 gte(k:string,v:any){this.filters.push(`${encodeURIComponent(k)}=gte.${encodeURIComponent(v)}`);return this}
 lte(k:string,v:any){this.filters.push(`${encodeURIComponent(k)}=lte.${encodeURIComponent(v)}`);return this}
 in(k:string,vals:any[]){this.filters.push(`${encodeURIComponent(k)}=in.(${vals.map(v=>encodeURIComponent(v)).join(',')})`);return this}
 order(k:string,opt?:{ascending?:boolean}){this.orders.push(`${encodeURIComponent(k)}.${opt?.ascending===false?'desc':'asc'}`);return this}
 single(){this.wantSingle=true;this.headers.Accept='application/vnd.pgrst.object+json';return this}
 async exec():Promise<Result<any>>{try{const parts=[`select=${encodeURIComponent(this.selectCols)}`,...this.filters];if(this.orders.length)parts.push(`order=${this.orders.join(',')}`);const data=await request(`/rest/v1/${this.table}?${parts.join('&')}`,{method:this.method,headers:this.headers,body:this.body===undefined?undefined:JSON.stringify(this.body)});return{data,error:null}}catch(e){return{data:null,error:{message:e instanceof Error?e.message:'请求失败'}}}}
 then<TResult1=Result<any>,TResult2=never>(onfulfilled?:((value:Result<any>)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null){return this.exec().then(onfulfilled,onrejected)}
}
export const supabase={
 auth:{
  async signInWithPassword({email,password}:{email:string;password:string}):Promise<Result<{session:AuthSession;user:any}>>{try{const d=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{Authorization:`Bearer ${key||''}`},body:JSON.stringify({email,password})});const session:AuthSession={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at,user:d.user};saveSession(session);return{data:{session,user:d.user},error:null}}catch(e){return{data:null,error:{message:e instanceof Error?e.message:'登录失败'}}}},
  async getSession(){return{data:{session:readSession()},error:null}},
  async signOut(){saveSession(null);return{error:null}},
  onAuthStateChange(fn:(event:string,session:AuthSession|null)=>void){listeners.add(fn);return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}}
 },
 from:(table:string)=>new Query(table),
 async rpc(name:string,args:Record<string,any>):Promise<Result<any>>{try{const data=await request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(args)});return{data,error:null}}catch(e){return{data:null,error:{message:e instanceof Error?e.message:'请求失败'}}}}
};
export const userEmail=(userId:string)=>`${userId.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'_')}@qc.local`;
