import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')!;const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const token=req.headers.get('Authorization')?.replace('Bearer ','');if(!token)throw new Error('未登录');
 const scoped=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});const {data:{user}}=await scoped.auth.getUser();if(!user)throw new Error('登录失效');
 const admin=createClient(url,service);const {data:me}=await admin.from('profiles').select('role,status').eq('auth_user_id',user.id).single();if(me?.role!=='manager'||me.status!=='ativo')throw new Error('只有经理可导入账号');
 const {accounts}=await req.json();let success=0;const errors:string[]=[];const roleMap:any={gerente:'manager',promotor:'promoter',inspetor:'inspector'};
 for(const a of accounts||[]){try{const role=roleMap[a.role];if(!role)throw new Error('身份无效');const email=`${String(a.user_id).toLowerCase().replace(/[^a-z0-9._-]/g,'_')}@qc.local`;let authId:string|undefined;
  const {data:list}=await admin.auth.admin.listUsers({page:1,perPage:1000});const existing=list.users.find(x=>x.email===email);if(existing){authId=existing.id;await admin.auth.admin.updateUserById(existing.id,{password:a.password,email_confirm:true})}else{const {data:newUser,error}=await admin.auth.admin.createUser({email,password:a.password,email_confirm:true});if(error)throw error;authId=newUser.user.id}
  let display=String(a.user_id);if(role==='promoter'){const {data:p}=await admin.from('promoters').select('nickname').eq('id',a.user_id).single();display=p?.nickname||display}if(role==='inspector'){const {data:i}=await admin.from('inspectors').select('nickname').eq('id',a.user_id).single();display=i?.nickname||display}if(role==='manager')display=`经理 ${a.user_id}`;
  const {error}=await admin.from('profiles').upsert({auth_user_id:authId,user_id:String(a.user_id),role,status:a.status==='inativo'?'inativo':'ativo',display_name:display},{onConflict:'user_id'});if(error)throw error;success++
 }catch(e){errors.push(`${a.user_id}: ${e.message}`)}}
 return new Response(JSON.stringify({success,errors}),{headers:{...cors,'Content-Type':'application/json'}})
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}});
