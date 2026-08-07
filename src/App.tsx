import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,Archive,BarChart3,CalendarDays,Check,ChevronRight,ClipboardCheck,Download,ExternalLink,FileText,Filter,Gauge,Globe2,LayoutDashboard,LogIn,LogOut,Menu,RefreshCw,Search,Settings,ShieldCheck,Sparkles,Upload,UserCog,Users,X} from 'lucide-react';
import {configured,supabase,userEmail} from './lib/supabase';
import {download,parseCsv,toCsv} from './lib/csv';
import * as XLSX from 'xlsx';
import type {Inspector,Leaderboard,Profile,Promoter,Report,ReviewStatus,Role,Task,TaskStatus} from './types';

type Page='dashboard'|'promoters'|'inspectors'|'allocation'|'tasks'|'reports'|'settlement'|'leaderboard'|'reputation'|'accounts'|'settings';
type Toast={kind:'ok'|'error';text:string}|null;
const roleLabel:Record<Role,string>={manager:'经理',inspector:'质检员',promoter:'推广员'};
const taskLabel:Record<TaskStatus,string>={pending:'待执行',in_progress:'进行中',submitted:'待审核',approved:'审核通过',changes_requested:'需要修改',weekly_unfinished:'本周未完成',cancelled:'已取消'};
const reviewLabel:Record<ReviewStatus,string>={pending_review:'待审核',approved:'审核通过',changes_requested:'需要修改'};
const today=()=>new Date().toISOString().slice(0,10);
const weekStart=(date=today())=>{const d=new Date(`${date}T00:00:00`);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d.toISOString().slice(0,10)};
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`};
const nav:Record<Role,{id:Page;label:string;icon:any}[]>={
 manager:[['dashboard','运营总览',LayoutDashboard],['allocation','分配任务',Sparkles],['tasks','质检任务',ClipboardCheck],['reports','报告中心',FileText],['settlement','每周结算',Archive],['promoters','推广员',Users],['inspectors','质检员',UserCog],['leaderboard','排行榜',BarChart3],['reputation','信誉积分',Gauge],['accounts','登录账号',ShieldCheck],['settings','系统设置',Settings]].map(([id,label,icon])=>({id:id as Page,label:label as string,icon})),
 inspector:[['dashboard','我的工作台',Gauge],['tasks','我的任务',ClipboardCheck],['reports','我的报告',FileText]].map(([id,label,icon])=>({id:id as Page,label:label as string,icon})),
 promoter:[['dashboard','我的主页',LayoutDashboard],['reports','我的报告',FileText],['leaderboard','我的排名',BarChart3],['reputation','我的信誉积分',Gauge]].map(([id,label,icon])=>({id:id as Page,label:label as string,icon}))
};

export default function App(){
 const [profile,setProfile]=useState<Profile|null>(null);const [page,setPage]=useState<Page>('dashboard');const [toast,setToast]=useState<Toast>(null);const [menu,setMenu]=useState(false);const [loading,setLoading]=useState(true);const [lang,setLang]=useState<'zh-CN'|'pt-BR'>(()=>(localStorage.getItem('qc-language')==='pt-BR'?'pt-BR':'zh-CN'));
useEffect(() => {
    if (!configured) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) {
            const { data: p } = await supabase
                .from('profiles')
                .select('*')
                .eq('auth_user_id', data.session.user.id)
                .single();

            if (p?.status === 'ativo') {
                setProfile(p as Profile);
            }
        }

        setLoading(false);
    });

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_e, s) => {
        if (!s) {
            setProfile(null);
            return;
        }

        const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_user_id', s.user.id)
            .single();

        if (p?.status === 'ativo') {
            setProfile(p as Profile);
        }
    });

    return () => {
        subscription.unsubscribe();
    };
}, []);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),3000);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{localStorage.setItem('qc-language',lang);document.documentElement.lang=lang;return installTranslations(lang)},[lang]);
 const notify=(text:string,kind:'ok'|'error'='ok')=>setToast({text,kind});
 if(loading)return <><LanguageDock lang={lang} setLang={setLang}/><div className="splash"><ShieldCheck/><b>正在连接数据库…</b></div></>;
 if(!configured)return <><LanguageDock lang={lang} setLang={setLang}/><ConfigMissing/></>;
 if(!profile)return <><LanguageDock lang={lang} setLang={setLang}/><Login notify={notify}/></>;
 const items=nav[profile.role];
 return <><LanguageDock lang={lang} setLang={setLang}/><div className="app-shell"><aside className={menu?'sidebar open':'sidebar'}><div className="brand"><div className="brand-mark"><ShieldCheck/></div><div><b>曜石质检</b><span>ONLINE DATABASE</span></div><button className="icon-btn mobile-only" onClick={()=>setMenu(false)}><X/></button></div><div className="account"><div className="avatar">{profile.display_name[0]}</div><div><b>{profile.display_name}</b><span>{roleLabel[profile.role]} · {profile.user_id}</span></div></div><nav>{items.map(({id,label,icon:Icon})=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMenu(false)}}><Icon/><span>{label}</span><ChevronRight className="arrow"/></button>)}</nav><div className="sidebar-foot"><div className="online-pill"><i/>Supabase 在线</div><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/>退出登录</button></div></aside>{menu&&<div className="scrim" onClick={()=>setMenu(false)}/>}<main><header><button className="icon-btn mobile-only" onClick={()=>setMenu(true)}><Menu/></button><div><span className="eyebrow">QUALITY OPERATIONS</span><h1>{items.find(x=>x.id===page)?.label}</h1></div><div className="save-state"><i/>云端已连接</div></header><section className="content"><Router page={page} profile={profile} notify={notify} go={setPage}/></section></main>{toast&&<div className={`toast ${toast.kind}`}>{toast.kind==='ok'?<Check/>:<X/>}{toast.text}</div>}</div></>
}

type UiLanguage='zh-CN'|'pt-BR';
function LanguageDock({lang,setLang}:{lang:UiLanguage;setLang:(v:UiLanguage)=>void}){return <div className="language-dock" role="group" aria-label="Language"><Globe2/><button className={lang==='zh-CN'?'active':''} onClick={()=>setLang('zh-CN')}>中文</button><button className={lang==='pt-BR'?'active':''} onClick={()=>setLang('pt-BR')}>Português</button></div>}

const ptExact:Record<string,string>={
'经理':'Gerente','质检员':'Inspetor','推广员':'Promotor','待执行':'Pendente','进行中':'Em andamento','待审核':'Aguardando revisão','审核通过':'Aprovado','需要修改':'Requer alteração','本周未完成':'Não concluída na semana','已取消':'Cancelada',
'运营总览':'Visão geral','分配任务':'Distribuir tarefas','质检任务':'Tarefas de inspeção','报告中心':'Central de relatórios','每周结算':'Fechamento semanal','排行榜':'Ranking','信誉积分':'Pontuação de reputação','登录账号':'Contas de acesso','系统设置':'Configurações','我的工作台':'Meu painel','我的任务':'Minhas tarefas','我的报告':'Meus relatórios','我的主页':'Minha página','我的排名':'Minha posição','我的信誉积分':'Minha reputação',
'退出登录':'Sair','云端已连接':'Conectado à nuvem','正在连接数据库…':'Conectando ao banco de dados…','还差 Supabase 配置':'Configuração do Supabase pendente','登录工作空间':'Entrar no sistema','用户ID':'ID do usuário','密码':'Senha','登录':'Entrar','登录中…':'Entrando…','无法登录时，请联系推广员经理 Kevin。':'Em caso de falha no login, entre em contato com o gerente dos promotores Kevin.','用户ID或密码错误':'ID de usuário ou senha incorretos',
'清楚分配，':'Distribuição clara,','准确审核。':'revisão precisa.','任务、报告、排行榜和周结算全部保存到 Supabase 数据库，多人可同时使用。':'Tarefas, relatórios, ranking e fechamentos semanais ficam salvos no Supabase e podem ser usados por várias pessoas ao mesmo tempo.',
'本周运营概览':'Visão geral desta semana','进入报告中心':'Abrir central de relatórios','本周任务':'Tarefas da semana','已提交报告':'Relatórios enviados','数据库实时统计':'Dados em tempo real','按质检员分组处理':'Organizado por inspetor','本周参与人员':'Participantes da semana','本周质检员进度':'Progresso semanal dos inspetores','查看详情':'Ver detalhes','当前信誉积分':'Pontuação atual','查询信誉积分详情':'Consultar detalhes da reputação','查看信誉积分':'Ver reputação','累计完成质检':'Inspeções concluídas','当前号码':'Número atual',
'推广员ID':'ID do promotor','推广员昵称':'Nome do promotor','质检号码':'Número de inspeção','日期':'Data','评价':'Avaliação','打开 WhatsApp':'Abrir WhatsApp','开始任务':'Iniciar tarefa','任务已开始':'Tarefa iniciada','提交评价':'Enviar avaliação','推广员服务质检问卷':'Questionário de avaliação do atendimento do promotor','选择任务':'Selecionar tarefa','检查时推广员状态':'Status do promotor durante a inspeção','服务评价':'Avaliação do atendimento','评价原因（可多选）':'Motivos da avaliação (múltipla escolha)','完整聊天截图链接':'Link da captura completa da conversa','质检总结':'Resumo da inspeção','需要经理跟进':'Requer acompanhamento do gerente','提交完整评价后，任务才算完成，并进入经理待审核列表。':'A tarefa só será concluída após o envio da avaliação completa e entrará na fila de revisão do gerente.',
'推广员正在服务':'Promotor em atendimento','已发送自动离开消息':'Mensagem automática de ausência enviada','推广员无法接收消息':'O promotor não consegue receber mensagens','已收到但未回复':'Recebeu a mensagem, mas não respondeu','离开超过5分钟':'Ausente por mais de 5 minutos','号码不存在':'O número não existe','其他':'Outro','不满意 😣':'Não satisfeito 😣','一般 😐':'Mais ou menos 😐','满意 😄':'Satisfeito 😄','5分钟内未回复':'Não respondeu em até 5 minutos','回复太慢':'Resposta muito demorada','未解决问题':'Não resolveu o problema','服务态度差':'Atendimento ruim','拒绝帮助':'Recusou-se a ajudar','说明难以理解':'Explicação difícil de entender','疑似诈骗':'Suspeita de golpe','感到不被尊重':'Sentiu-se desrespeitado','回复尚可但较慢':'Resposta aceitável, mas lenta','只解决部分问题':'Resolveu apenas parte do problema','说明不够清楚':'Explicação pouco clara','服务一般':'Atendimento regular','回复快速':'Resposta rápida','服务优秀':'Excelente atendimento','说明清楚易懂':'Explicação clara e fácil de entender','高效解决问题':'Resolveu o problema com eficiência','主动跟进':'Acompanhamento proativo',
'先按质检员查看待审核数量；只有质检员提交后，报告才会出现在这里。':'Veja primeiro a quantidade pendente por inspetor. O relatório só aparece aqui depois do envio pelo inspetor.','全部':'Todos','已审核':'Revisados','按质检员查看审核进度':'Progresso de revisão por inspetor','报告数量':'Quantidade de relatórios','经理备注':'Observação do gerente','打开证据链接':'Abrir link da evidência','退回修改':'Solicitar alteração','请选择质检员':'Selecione um inspetor','批量通过满意报告':'Aprovar avaliações satisfeitas em lote','仅处理当前日期范围和所选质检员中，仍处于待审核状态的满意报告。':'Processa apenas avaliações satisfeitas ainda pendentes no período e inspetor selecionados.','本次可批量通过':'Disponíveis para aprovação em lote','一键通过':'Aprovar em lote','打开 Imgur 上传':'Abrir upload do Imgur','先在 Imgur 上传截图，再将生成的链接粘贴到下方。':'Envie a captura no Imgur e cole abaixo o link gerado.','满意报告批量审核完成':'Avaliações satisfeitas aprovadas em lote',
'我的历史报告':'Meu histórico de relatórios','报告永久保存在数据库，可按日期查看。':'Os relatórios ficam armazenados no banco de dados e podem ser filtrados por data.','选择周一':'Selecionar segunda-feira','质检员本周完成情况':'Desempenho semanal dos inspetores','目标':'Meta','已分配':'Atribuídas','已完成':'Concluídas','剩余':'Restantes','历史未完成':'Pendências históricas','结束并结算本周':'Encerrar e fechar a semana',
'智能分配':'Distribuição inteligente','任务日期':'Data da tarefa','设置每位质检员':'Configurar cada inspetor','使用号码':'Número utilizado','任务数量':'Quantidade de tarefas','预览分配':'Pré-visualizar distribuição','确认生成':'Confirmar criação','搜索…':'Pesquisar…','导入 CSV':'Importar CSV','打开统一查询页面':'Abrir página de consulta','最终信誉积分':'Pontuação final','查询详情':'Consultar detalhes','尚未更新':'Ainda não atualizado','尚未配置统一查询链接。':'Link de consulta ainda não configurado.','管理员尚未配置统一查询链接。':'O administrador ainda não configurou o link de consulta.','经理尚未导入信誉积分':'O gerente ainda não importou a pontuação.',
'排名':'Posição','昵称':'Nome','增长20%':'Crescimento 20%','信誉50%':'Reputação 50%','返利30%':'Rebate 30%','总分':'Pontuação total','排行榜与推广员资料完全独立。':'O ranking é independente dos dados cadastrais dos promotores.','显示名称':'Nome exibido','身份':'Função','状态':'Status','启用':'Ativo','禁用':'Inativo','上线状态':'Status do sistema','数据库已连接':'Banco de dados conectado','账号由 Supabase Auth 保存':'Contas protegidas pelo Supabase Auth','生产版关键设置由 Supabase 数据库与部署环境变量管理。':'As configurações críticas da versão de produção são gerenciadas pelo Supabase e pelas variáveis de ambiente.',
'满意报告可以批量通过，一般和不满意报告建议人工检查。':'Relatórios satisfeitos podem ser aprovados em lote; avaliações regulares e insatisfeitas devem ser revisadas manualmente.','已选择':'Selecionados','份报告':'relatório(s)','当前质检员有':'O inspetor atual tem','份满意报告等待审核':'relatório(s) satisfeito(s) aguardando revisão','全选待审核':'Selecionar todos os pendentes','一键通过全部满意':'Aprovar todos os satisfeitos','通过已选':'Aprovar selecionados','批量审核中…':'Aprovando em lote…','请先从左侧选择一名质检员。':'Selecione um inspetor à esquerda.','当前日期范围内没有报告。':'Não há relatórios no período selecionado.','当前筛选条件下没有报告。':'Não há relatórios com os filtros atuais.','没有可以审核的报告':'Não há relatórios disponíveis para revisão','批量审核完成':'Revisão em lote concluída','经理批量审核通过':'Aprovado em lote pelo gerente','Imgur':'Imgur'
};
const ptPatterns:[RegExp,(m:RegExpMatchArray)=>string][]=[
[/^你好，(.+)$/,(m)=>`Olá, ${m[1]}`],[/^还有 (\d+) 份未审核$/,(m)=>`Ainda há ${m[1]} relatório(s) pendente(s)`],[/^(\d+) 个未提交$/,(m)=>`${m[1]} não enviado(s)`],[/^(\d+) 个未完成$/,(m)=>`${m[1]} não concluído(s)`],[/^(\d+) 已完成 · 剩余 (\d+)$/,(m)=>`${m[1]} concluída(s) · ${m[2]} restante(s)`],[/^更新于 (.+)$/,(m)=>`Atualizado em ${m[1]}`],[/^最后更新：(.+)$/,(m)=>`Última atualização: ${m[1]}`],[/^已导入 (\d+) 位推广员$/,(m)=>`${m[1]} promotor(es) importado(s)`],[/^已导入 (\d+) 位质检员$/,(m)=>`${m[1]} inspetor(es) importado(s)`],[/^已导入 (\d+) 条排行榜$/,(m)=>`${m[1]} registro(s) do ranking importado(s)`],[/^成功导入 (\d+) 个账号$/,(m)=>`${m[1]} conta(s) importada(s)`],[/^预览结果 · (\d+) 条$/,(m)=>`Prévia · ${m[1]} item(ns)`],[/^(.+) 的报告$/,(m)=>`Relatórios de ${m[1]}`]
];
const originalText=new WeakMap<Text,string>();const originalAttr=new WeakMap<Element,Record<string,string>>();
function translateValue(value:string){const clean=value.trim();if(!clean)return value;const exact=ptExact[clean];if(exact)return value.replace(clean,exact);for(const [re,fn] of ptPatterns){const m=clean.match(re);if(m)return value.replace(clean,fn(m))}return value}
function installTranslations(lang:UiLanguage){let observer:MutationObserver|null=null;let scheduled=false;const apply=()=>{scheduled=false;observer?.disconnect();const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Text|null;while((node=walker.nextNode() as Text|null)){if(!originalText.has(node))originalText.set(node,node.nodeValue||'');const base=originalText.get(node)||'';node.nodeValue=lang==='pt-BR'?translateValue(base):base}document.querySelectorAll('input,textarea,button,a,[title],[aria-label]').forEach(el=>{let attrs=originalAttr.get(el);if(!attrs){attrs={};for(const name of ['placeholder','title','aria-label']){const v=el.getAttribute(name);if(v!=null)attrs[name]=v}originalAttr.set(el,attrs)}for(const [name,base] of Object.entries(attrs))el.setAttribute(name,lang==='pt-BR'?translateValue(base):base)});observer?.observe(document.body,{subtree:true,childList:true})};const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply)};observer=new MutationObserver(schedule);apply();return()=>observer?.disconnect()}


function ConfigMissing(){return <div className="config-missing"><ShieldCheck/><h1>还差 Supabase 配置</h1><p>复制 <code>.env.example</code> 为 <code>.env</code>，填写项目 URL 与 anon key，然后重启。</p></div>}
function Login({notify}:{notify:(s:string,k?:'ok'|'error')=>void}){const [id,setId]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);const {error}=await supabase.auth.signInWithPassword({email:userEmail(id),password});setBusy(false);if(error)notify('用户ID或密码错误','error')};return <div className="login-page"><section className="login-story"><div className="brand-mark large"><ShieldCheck/></div><span className="eyebrow">QUALITY CONTROL ONLINE</span><h1>清楚分配，<br/><em>准确审核。</em></h1><p>任务、报告、排行榜和周结算全部保存到 Supabase 数据库，多人可同时使用。</p></section><section className="login-card"><span className="eyebrow">SECURE ACCESS</span><h2>登录工作空间</h2><form onSubmit={submit}><label>用户ID<input value={id} onChange={e=>setId(e.target.value)} required autoComplete="username"/></label><label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="btn primary wide" disabled={busy}><LogIn/>{busy?'登录中…':'登录'}</button></form><small>无法登录，请联系推广员经理 Kevin。</small></section></div>}
function Router({page,profile,notify,go}:{page:Page;profile:Profile;notify:any;go:(p:Page)=>void}){if(page==='dashboard')return <Dashboard profile={profile} go={go}/>;if(page==='promoters')return <Promoters notify={notify}/>;if(page==='inspectors')return <Inspectors notify={notify}/>;if(page==='allocation')return <Allocation notify={notify}/>;if(page==='tasks')return <Tasks profile={profile} notify={notify} go={go}/>;if(page==='reports')return <Reports profile={profile} notify={notify}/>;if(page==='settlement')return <Settlement notify={notify}/>;if(page==='leaderboard')return <LeaderboardPage profile={profile} notify={notify}/>;if(page==='reputation')return <ReputationPage profile={profile} notify={notify}/>;if(page==='accounts')return <Accounts notify={notify}/>;return <SettingsPage/>}

function Dashboard({profile,go}:{profile:Profile;go:(p:Page)=>void}){const [tasks,setTasks]=useState<Task[]>([]);const [reports,setReports]=useState<Report[]>([]);const [inspectors,setInspectors]=useState<Inspector[]>([]);const [myPromoter,setMyPromoter]=useState<Promoter|null>(null);const [reputationUrl,setReputationUrl]=useState('');useEffect(()=>{(async()=>{let tq=supabase.from('tasks').select('*').gte('task_date',weekStart());if(profile.role==='inspector')tq=tq.eq('inspector_id',profile.user_id);if(profile.role==='promoter')tq=tq.eq('promoter_id',profile.user_id);const [{data:t},{data:r},{data:i}]=await Promise.all([tq,profile.role==='manager'?supabase.from('reports').select('*').gte('submitted_at',weekStart()):supabase.from('reports').select('*').eq(profile.role==='inspector'?'inspector_id':'promoter_id',profile.user_id),profile.role==='manager'?supabase.from('inspectors').select('*'):Promise.resolve({data:[]})]);setTasks((t||[]) as Task[]);setReports((r||[]) as Report[]);setInspectors((i||[]) as Inspector[]);if(profile.role==='promoter'){const [{data:p},{data:settings}]=await Promise.all([supabase.from('promoters').select('*').eq('id',profile.user_id).single(),supabase.from('app_settings').select('reputation_query_url').eq('id',1).single()]);setMyPromoter((p||null) as Promoter|null);setReputationUrl(String(settings?.reputation_query_url||''))}})()},[profile]);const done=tasks.filter(t=>['submitted','approved','changes_requested'].includes(t.status)).length;const pendingReview=reports.filter(r=>r.review_status==='pending_review').length;if(profile.role==='manager'){return <><Hero title="本周运营概览" text="先看质检员完成情况，再处理待审核报告和未完成任务。" action={<button className="btn primary" onClick={()=>go('reports')}>进入报告中心</button>}/><div className="stat-grid four"><Stat label="本周任务" value={tasks.length} note="数据库实时统计"/><Stat label="已提交报告" value={done} note={`${tasks.length-done} 个未提交`}/><Stat label="待审核" value={pendingReview} note="按质检员分组处理"/><Stat label="质检员" value={inspectors.length} note="本周参与人员"/></div><InspectorProgress tasks={tasks} reports={reports} inspectors={inspectors}/></>};return <><Hero title={`你好，${profile.display_name}`} text={profile.role==='inspector'?'查看本周剩余任务并提交完整评价。':'查看自己的历史报告、排行榜和最终信誉积分。'} action={<button className="btn primary" onClick={()=>go(profile.role==='inspector'?'tasks':'reports')}>查看详情</button>}/>{profile.role==='promoter'&&<section className="reputation-hero-card"><div><span>当前信誉积分</span><strong>{myPromoter?.reputation_score??'—'}</strong><small>{myPromoter?.reputation_updated_at?`更新于 ${new Date(myPromoter.reputation_updated_at).toLocaleString('zh-CN')}`:'暂未导入信誉积分'}</small></div>{reputationUrl?<a className="btn primary" href={reputationUrl} target="_blank" rel="noreferrer"><ExternalLink/>查询信誉积分详情</a>:<button className="btn secondary" onClick={()=>go('reputation')}>查看信誉积分</button>}</section>}<div className="stat-grid three"><Stat label="本周任务" value={tasks.length} note="只显示当前账号"/><Stat label="已完成" value={done} note={`${tasks.length-done} 个未完成`}/><Stat label="报告数量" value={reports.length} note="永久保存于数据库"/></div></>}
function InspectorProgress({tasks,reports,inspectors}:{tasks:Task[];reports:Report[];inspectors:Inspector[]}){return <Panel title="本周质检员进度"><div className="progress-list">{inspectors.map(i=>{const mine=tasks.filter(t=>t.inspector_id===i.id);const complete=mine.filter(t=>['submitted','approved','changes_requested'].includes(t.status)).length;const pending=reports.filter(r=>r.inspector_id===i.id&&r.review_status==='pending_review').length;const approved=reports.filter(r=>r.inspector_id===i.id&&r.review_status==='approved').length;return <article key={i.id}><div className="avatar">{i.nickname[0]}</div><div className="grow"><b>{i.nickname}</b><span>{complete}/{i.target_tasks} 已完成 · 剩余 {Math.max(0,i.target_tasks-complete)}</span><div className="progress"><i style={{width:`${Math.min(100,i.target_tasks?complete/i.target_tasks*100:0)}%`}}/></div></div><div className="review-count"><b>{pending}</b><span>待审核</span></div><div className="review-count success"><b>{approved}</b><span>已审核</span></div></article>})}</div></Panel>}

function Promoters({notify}:{notify:any}){const [rows,setRows]=useState<Promoter[]>([]);const [q,setQ]=useState('');const load=()=>supabase.from('promoters').select('*').order('nickname').then(({data})=>setRows((data||[]) as Promoter[]));useEffect(()=>{void load()},[]);const importFile=async(f:File)=>{const parsed=parseCsv(await f.text()).map((r:any)=>({id:String(r.promoter_id||'').trim(),nickname:String(r.nickname||'').trim(),whatsapp:String(r.whatsapp||'').trim()})).filter(x=>x.id&&x.nickname&&x.whatsapp);const {error}=await supabase.from('promoters').upsert(parsed,{onConflict:'id'});if(error)return notify(error.message,'error');load();notify(`已导入 ${parsed.length} 位推广员`)};const visible=rows.filter(x=>`${x.id}${x.nickname}`.toLowerCase().includes(q.toLowerCase()));return <><PageHead title="推广员" text="CSV：promoter_id,nickname,whatsapp。WhatsApp 可直接放 wa.me 链接。"><SearchBox value={q} onChange={setQ}/><FileButton onFile={importFile}/></PageHead><div className="card-table">{visible.map(p=><article key={p.id}><div><code>{p.id}</code><h3>{p.nickname}</h3></div><div className="metric"><span>累计完成质检</span><b>{p.inspection_count}</b></div><a className="btn secondary" href={p.whatsapp} target="_blank" rel="noreferrer"><ExternalLink/>打开 WhatsApp</a></article>)}</div></>}
function Inspectors({notify}:{notify:any}){const [rows,setRows]=useState<Inspector[]>([]);const load=()=>supabase.from('inspectors').select('*').order('nickname').then(({data})=>setRows((data||[]) as Inspector[]));useEffect(()=>{void load()},[]);const importFile=async(f:File)=>{const parsed=parseCsv(await f.text()).map((r:any)=>({id:String(r.inspector_id||'').trim(),nickname:String(r.nickname||'').trim(),current_phone:String(r.current_phone||'').trim(),target_tasks:Number(r.target_tasks||0)})).filter(x=>x.id&&x.nickname&&x.current_phone);const {error}=await supabase.from('inspectors').upsert(parsed,{onConflict:'id'});if(error)return notify(error.message,'error');load();notify(`已导入 ${parsed.length} 位质检员`)};return <><PageHead title="质检员" text="CSV：inspector_id,nickname,current_phone,target_tasks。"><FileButton onFile={importFile}/></PageHead><div className="card-table">{rows.map(i=><article key={i.id}><div><code>{i.id}</code><h3>{i.nickname}</h3></div><div className="metric"><span>当前号码</span><b>{i.current_phone}</b></div><div className="metric"><span>本周目标</span><b>{i.target_tasks}</b></div></article>)}</div></>}

function Allocation({notify}:{notify:any}){const [inspectors,setInspectors]=useState<Inspector[]>([]);const [date,setDate]=useState(today());const [counts,setCounts]=useState<Record<string,number>>({});const [phones,setPhones]=useState<Record<string,string>>({});const [preview,setPreview]=useState<any[]>([]);useEffect(()=>{supabase.from('inspectors').select('*').order('nickname').then(({data})=>{const r=(data||[]) as Inspector[];setInspectors(r);setCounts(Object.fromEntries(r.map(x=>[x.id,x.target_tasks])));setPhones(Object.fromEntries(r.map(x=>[x.id,x.current_phone])))})},[]);const make=async()=>{const requests=inspectors.filter(i=>(counts[i.id]||0)>0).map(i=>({inspector_id:i.id,phone:phones[i.id],count:counts[i.id]}));const {data,error}=await supabase.rpc('preview_allocation',{p_task_date:date,p_requests:requests});if(error)return notify(error.message,'error');setPreview(data||[])};const confirm=async()=>{const requests=inspectors.filter(i=>(counts[i.id]||0)>0).map(i=>({inspector_id:i.id,phone:phones[i.id],count:counts[i.id]}));const {data,error}=await supabase.rpc('create_allocation_batch',{p_task_date:date,p_requests:requests});if(error)return notify(error.message,'error');setPreview([]);notify(`已生成 ${data?.created_count||0} 个任务；推广员累计次数尚未增加`)};return <><PageHead title="智能分配" text="分配时只占用“号码 + 推广员”；质检员提交报告后，推广员累计次数才 +1。"><label className="date-large">任务日期<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></PageHead><Panel title="设置每位质检员"><div className="allocation-list">{inspectors.map(i=><div className="allocation-row" key={i.id}><div className="avatar">{i.nickname[0]}</div><div className="grow"><b>{i.nickname}</b><span>{i.id}</span></div><label>使用号码<input value={phones[i.id]||''} onChange={e=>setPhones(v=>({...v,[i.id]:e.target.value}))}/></label><label>任务数<input type="number" min="0" value={counts[i.id]||0} onChange={e=>setCounts(v=>({...v,[i.id]:Number(e.target.value)}))}/></label></div>)}</div><div className="panel-actions"><button className="btn secondary" onClick={make}><Search/>预览分配</button><button className="btn primary" disabled={!preview.length} onClick={confirm}><Sparkles/>确认生成</button></div></Panel>{preview.length>0&&<Panel title={`预览结果 · ${preview.length} 条`}><div className="preview-grid">{preview.map((x:any,i)=><article key={i}><b>{x.inspector_name}</b><span>{x.phone}</span><ChevronRight/><b>{x.promoter_name}</b><span>{x.promoter_id}</span></article>)}</div></Panel>}</>}

function Tasks({profile,notify,go}:{profile:Profile;notify:any;go:(p:Page)=>void}){const [rows,setRows]=useState<Task[]>([]);const load=async()=>{let q=supabase.from('task_details').select('*').order('task_date',{ascending:false});if(profile.role==='inspector')q=q.eq('inspector_id',profile.user_id);if(profile.role==='promoter')q=q.eq('promoter_id',profile.user_id);const {data}=await q;setRows((data||[]) as Task[])};useEffect(()=>{load()},[profile]);const start=async(id:string)=>{const {error}=await supabase.from('tasks').update({status:'in_progress'}).eq('id',id).eq('status','pending');if(error)notify(error.message,'error');else{load();notify('任务已开始')}};return <><PageHead title={profile.role==='manager'?'质检任务':'我的任务'} text="未完成任务会在周结算时释放号码组合，但会保留未完成历史。"/ ><div className="task-grid">{rows.map(t=><article key={t.id}><div className="task-top"><span className={`status ${t.status}`}>{taskLabel[t.status]}</span><small>{t.task_date}</small></div><h3>{(t as any).promoter_name||t.promoter_id}</h3><dl><div><dt>质检员</dt><dd>{(t as any).inspector_name||t.inspector_id}</dd></div><div><dt>质检号码</dt><dd>{t.inspector_phone}</dd></div><div><dt>推广员ID</dt><dd>{t.promoter_id}</dd></div></dl>{(t as any).whatsapp&&<a className="btn secondary wide" href={(t as any).whatsapp} target="_blank" rel="noreferrer"><ExternalLink/>打开 WhatsApp</a>}{profile.role==='inspector'&&t.status==='pending'&&<button className="btn primary wide" onClick={()=>start(t.id)}>开始任务</button>}{profile.role==='inspector'&&['pending','in_progress','changes_requested'].includes(t.status)&&<button className="btn ghost wide" onClick={()=>{sessionStorage.setItem('open-task',t.id);go('reports')}}>填写 / 修改评价</button>}</article>)}</div></>}

const promoterStatuses=[['promotor_em_atendimento','Promotor em atendimento','推广员正在服务'],['mensagem_ausencia','Mensagem automática de ausência enviada','已发送自动离开消息'],['nao_recebe','O promotor não consegue receber mensagens','推广员无法接收消息'],['recebeu_sem_resposta','O promotor recebeu a mensagem, mas não respondeu','已收到但未回复'],['ausente_5min','O promotor se ausentou por mais de 5 minutos','离开超过5分钟'],['numero_inexistente','O número não existe','号码不存在'],['outro','Outro','其他']];
const ratingReasons={dissatisfied:['5分钟内未回复','回复太慢','未解决问题','服务态度差','拒绝帮助','说明难以理解','疑似诈骗','感到不被尊重','其他'],neutral:['回复尚可但较慢','只解决部分问题','说明不够清楚','服务一般','其他'],satisfied:['回复快速','服务优秀','说明清楚易懂','高效解决问题','主动跟进','其他']};
function Reports({profile,notify}:{profile:Profile;notify:any}){if(profile.role==='manager')return <ManagerReports notify={notify}/>;if(profile.role==='promoter')return <ReportHistory profile={profile}/>;return <InspectorReports profile={profile} notify={notify}/>}
function InspectorReports({profile,notify}:{profile:Profile;notify:any}){const [tasks,setTasks]=useState<any[]>([]);const [selected,setSelected]=useState(sessionStorage.getItem('open-task')||'');const [status,setStatus]=useState('promotor_em_atendimento');const [rating,setRating]=useState<'dissatisfied'|'neutral'|'satisfied'>('satisfied');const [reasons,setReasons]=useState<string[]>([]);const [summary,setSummary]=useState('');const [url,setUrl]=useState('');const [follow,setFollow]=useState(false);const load=async()=>{const {data}=await supabase.from('task_details').select('*').eq('inspector_id',profile.user_id).in('status',['pending','in_progress','changes_requested']).order('task_date');setTasks(data||[]);if(!selected&&data?.[0])setSelected(data[0].id)};useEffect(()=>{load();sessionStorage.removeItem('open-task')},[]);const toggle=(r:string)=>setReasons(v=>v.includes(r)?v.filter(x=>x!==r):[...v,r]);const save=async()=>{if(!selected||!summary.trim()||!url.startsWith('http')||!reasons.length)return notify('请完整填写评价、原因、总结和证据链接','error');const {error}=await supabase.rpc('submit_inspection_report',{p_task_id:selected,p_promoter_status:status,p_rating:rating,p_reasons:reasons,p_summary:summary,p_evidence_url:url,p_requires_follow_up:follow,p_other_status_note:null,p_other_reason_note:null});if(error)return notify(error.message,'error');notify('评价已提交；推广员累计质检次数已 +1');setSummary('');setUrl('');setReasons([]);load()};return <><PageHead title="推广员服务质检问卷" text="提交完整评价后，任务才算完成，并进入经理待审核列表。"/><div className="report-editor"><Panel title="选择任务"><select value={selected} onChange={e=>setSelected(e.target.value)}>{tasks.map(t=><option value={t.id} key={t.id}>{t.task_date} · {t.promoter_name} · {t.inspector_phone}</option>)}</select></Panel><Panel title="Questionário de Avaliação do Atendimento do Promotor"><Question n="1" pt="ID do promotor" zh="推广员ID"><input readOnly value={tasks.find(t=>t.id===selected)?.promoter_id||''}/></Question><Question n="2" pt="Status do promotor no momento da inspeção" zh="检查时推广员状态"><div className="option-list">{promoterStatuses.map(x=><label key={x[0]} className="option-card"><input type="radio" checked={status===x[0]} onChange={()=>setStatus(x[0])}/><span><b>{x[1]}</b><small>{x[2]}</small></span></label>)}</div></Question><Question n="3" pt="AVALIAÇÃO DE SERVIÇO" zh="服务评价"><div className="rating-grid">{(['dissatisfied','neutral','satisfied'] as const).map(x=><button className={rating===x?'selected':''} onClick={()=>{setRating(x);setReasons([])}} key={x}>{x==='dissatisfied'?'不满意 😣':x==='neutral'?'一般 😐':'满意 😄'}</button>)}</div></Question><Question n="4-6" pt="Motivos da avaliação" zh="评价原因（可多选）"><div className="option-list">{ratingReasons[rating].map(r=><label className="option-card" key={r}><input type="checkbox" checked={reasons.includes(r)} onChange={()=>toggle(r)}/><span><b>{r}</b></span></label>)}</div></Question>

<Question
    n="7"
    pt="Link da captura de tela da conversa completa"
    zh="完整聊天截图链接"
>
    <div
        style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
        }}
    >
        <input
            style={{ flex: 1 }}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
        />

        <a
            className="btn secondary"
            href="https://imgur.com/upload"
            target="_blank"
            rel="noreferrer"
            style={{
                whiteSpace: "nowrap",
            }}
        >
            <Upload size={18} />
            Imgur
        </a>
    </div>
</Question>

<Question n="8" pt="Resumo da inspeção" zh="质检总结"><textarea rows={5} value={summary} onChange={e=>setSummary(e.target.value)}/></Question><label className="switch-line"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>需要经理跟进</label><button className="btn primary wide" onClick={save}><Check/>提交评价</button></Panel></div></>}
function ManagerReports({ notify }: { notify: any }) {
    const [rows, setRows] = useState<any[]>([]);
    const [promoters, setPromoters] = useState<Promoter[]>([]);

    const [selectedInspector, setSelectedInspector] = useState('');
    const [promoterSearch, setPromoterSearch] = useState('');

    const [review, setReview] =
        useState<ReviewStatus | 'all'>('pending_review');

    const [active, setActive] = useState<any | null>(null);
    const [note, setNote] = useState('');

    const [start, setStart] = useState(monthStart());
    const [end, setEnd] = useState(today());

    const [selectedReports, setSelectedReports] = useState<string[]>([]);
    const [batchBusy, setBatchBusy] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);

    const load = async () => {
        let query = supabase
            .from('report_details')
            .select('*')
            .gte('task_date', start)
            .lte('task_date', end)
            .order('submitted_at', {
                ascending: false,
            });

        if (review !== 'all') {
            query = query.eq(
                'review_status',
                review,
            );
        }

        const { data, error } = await query;

        if (error) {
            notify(error.message, 'error');
            return;
        }

        setRows(data || []);
    };

    const loadPromoters = async () => {
        const { data, error } = await supabase
            .from('promoters')
            .select('*')
            .order('nickname');

        if (error) {
            notify(error.message, 'error');
            return;
        }

        setPromoters((data || []) as Promoter[]);
    };

    useEffect(() => {
        void load();

        setSelectedReports([]);
        setSelectedInspector('');
    }, [start, end, review]);

    useEffect(() => {
        void loadPromoters();
    }, []);

    const groups = useMemo(() => {
        const map = new Map<string, any>();

        for (const report of rows) {
            const key = report.inspector_id;

            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: report.inspector_name,
                    total: 0,
                    pending: 0,
                    approved: 0,
                    changes: 0,
                });
            }

            const group = map.get(key);

            group.total += 1;

            if (
                report.review_status ===
                'pending_review'
            ) {
                group.pending += 1;
            }

            if (
                report.review_status ===
                'approved'
            ) {
                group.approved += 1;
            }

            if (
                report.review_status ===
                'changes_requested'
            ) {
                group.changes += 1;
            }
        }

        return [...map.values()];
    }, [rows]);

    const filtered = selectedInspector
        ? rows.filter(
              (report) =>
                  report.inspector_id ===
                  selectedInspector,
          )
        : [];

    const selectableReports = filtered.filter(
        (report) =>
            report.review_status ===
            'pending_review',
    );

    const selectableIds = selectableReports.map(
        (report) => report.id,
    );

    const allSelectableChecked =
        selectableIds.length > 0 &&
        selectableIds.every((id) =>
            selectedReports.includes(id),
        );

    const selectedCount =
        selectedReports.length;

    const selectedSatisfiedCount =
        filtered.filter(
            (report) =>
                selectedReports.includes(
                    report.id,
                ) &&
                report.rating ===
                    'satisfied' &&
                report.review_status ===
                    'pending_review',
        ).length;

    const pendingSatisfiedReports =
        filtered.filter(
            (report) =>
                report.rating ===
                    'satisfied' &&
                report.review_status ===
                    'pending_review',
        );

    const chooseInspector = (
        inspectorId: string,
    ) => {
        setSelectedInspector(inspectorId);
        setSelectedReports([]);
        setActive(null);
        setNote('');
    };

    const toggleReport = (
        reportId: string,
        checked: boolean,
    ) => {
        setSelectedReports((current) => {
            if (checked) {
                return current.includes(
                    reportId,
                )
                    ? current
                    : [
                          ...current,
                          reportId,
                      ];
            }

            return current.filter(
                (id) =>
                    id !== reportId,
            );
        });
    };

    const toggleAll = (
        checked: boolean,
    ) => {
        if (checked) {
            setSelectedReports(
                selectableIds,
            );
        } else {
            setSelectedReports([]);
        }
    };

    const reviewOneReport = async (
        reportId: string,
        status: ReviewStatus,
        managerNote = '',
    ) => {
        const { error } =
            await supabase.rpc(
                'review_inspection_report',
                {
                    p_report_id:
                        reportId,
                    p_review_status:
                        status,
                    p_manager_note:
                        managerNote,
                },
            );

        if (error) {
            throw error;
        }
    };

    const decide = async (
        status: ReviewStatus,
    ) => {
        if (!active) {
            return;
        }

        try {
            await reviewOneReport(
                active.id,
                status,
                note,
            );

            notify(
                status === 'approved'
                    ? '审核通过'
                    : '已退回修改',
            );

            setActive(null);
            setNote('');

            setSelectedReports(
                (current) =>
                    current.filter(
                        (id) =>
                            id !==
                            active.id,
                    ),
            );

            await load();
        } catch (error: any) {
            notify(
                error?.message ||
                    '审核失败',
                'error',
            );
        }
    };

    const approveReportIds =
        async (
            reportIds: string[],
            successMessage: string,
        ) => {
            if (
                reportIds.length === 0
            ) {
                notify(
                    '没有可以审核的报告',
                    'error',
                );

                return;
            }

            const confirmed =
                window.confirm(
                    `确定一次审核通过 ${reportIds.length} 份报告吗？`,
                );

            if (!confirmed) {
                return;
            }

            setBatchBusy(true);

            let successCount = 0;
            let failedCount = 0;
            let firstError = '';

            for (const reportId of reportIds) {
                try {
                    await reviewOneReport(
                        reportId,
                        'approved',
                        '经理批量审核通过',
                    );

                    successCount += 1;
                } catch (
                    error: any
                ) {
                    failedCount += 1;

                    if (
                        !firstError
                    ) {
                        firstError =
                            error?.message ||
                            '未知错误';
                    }
                }
            }

            setBatchBusy(false);
            setSelectedReports([]);
            setActive(null);
            setNote('');

            await load();

            if (
                failedCount > 0
            ) {
                notify(
                    `成功 ${successCount} 份，失败 ${failedCount} 份。${firstError}`,
                    'error',
                );

                return;
            }

            notify(
                `${successMessage}：${successCount} 份`,
            );
        };

    const approveSelected =
        async () => {
            const validSelectedIds =
                filtered
                    .filter(
                        (report) =>
                            selectedReports.includes(
                                report.id,
                            ) &&
                            report.review_status ===
                                'pending_review',
                    )
                    .map(
                        (report) =>
                            report.id,
                    );

            await approveReportIds(
                validSelectedIds,
                '批量审核完成',
            );
        };

    const approveAllSatisfied =
        async () => {
            const satisfiedIds =
                pendingSatisfiedReports.map(
                    (report) =>
                        report.id,
                );

            await approveReportIds(
                satisfiedIds,
                '满意报告批量审核完成',
            );
        };

    const openReport = (
        report: any,
    ) => {
        setActive(report);

        setNote(
            report.manager_note ||
                '',
        );
    };

    const exportExcel =
        async () => {
            if (!start || !end) {
                notify(
                    '请选择开始和结束日期',
                    'error',
                );

                return;
            }

            if (start > end) {
                notify(
                    '开始日期不能晚于结束日期',
                    'error',
                );

                return;
            }

            setExportBusy(true);

            try {
                let promoterId = '';

                const keyword =
                    promoterSearch
                        .trim()
                        .toLowerCase();

                if (keyword) {
                    const matched =
                        promoters.find(
                            (promoter) =>
                                promoter.id
                                    .toLowerCase() ===
                                    keyword ||
                                promoter.nickname
                                    .toLowerCase() ===
                                    keyword,
                        );

                    if (!matched) {
                        notify(
                            '找不到这个推广员ID或昵称',
                            'error',
                        );

                        return;
                    }

                    promoterId =
                        matched.id;
                }

                let query =
                    supabase
                        .from(
                            'report_details',
                        )
                        .select('*')
                        .gte(
                            'task_date',
                            start,
                        )
                        .lte(
                            'task_date',
                            end,
                        )
                        .order(
                            'task_date',
                            {
                                ascending:
                                    true,
                            },
                        );

                if (promoterId) {
                    query =
                        query.eq(
                            'promoter_id',
                            promoterId,
                        );
                }

                const {
                    data,
                    error,
                } = await query;

                if (error) {
                    throw error;
                }

                const reportRows =
                    data || [];

                if (
                    reportRows.length ===
                    0
                ) {
                    notify(
                        '当前条件下没有质检报告',
                        'error',
                    );

                    return;
                }

                const exportRows =
                    reportRows.map(
                        (
                            report: any,
                            index: number,
                        ) => ({
                            '序号':
                                index +
                                1,

                            '质检日期':
                                report.task_date,

                            '推广员ID':
                                report.promoter_id,

                            '推广员昵称':
                                report.promoter_name,

                            '质检员ID':
                                report.inspector_id,

                            '质检员昵称':
                                report.inspector_name,

                            '质检号码':
                                report.inspector_phone,

                            '推广员状态':
                                report.promoter_status,

                            '评价':
                                report.rating ===
                                'satisfied'
                                    ? '满意'
                                    : report.rating ===
                                        'neutral'
                                      ? '一般'
                                      : '不满意',

                            '评价原因':
                                Array.isArray(
                                    report.reasons,
                                )
                                    ? report.reasons.join(
                                          '；',
                                      )
                                    : '',

                            '其他状态说明':
                                report.other_status_note ||
                                '',

                            '其他原因说明':
                                report.other_reason_note ||
                                '',

                            '质检总结':
                                report.summary ||
                                '',

                            '证据链接':
                                report.evidence_url ||
                                '',

                            '需要经理跟进':
                                report.requires_follow_up
                                    ? '是'
                                    : '否',

                            '审核状态':
                                report.review_status ===
                                'approved'
                                    ? '审核通过'
                                    : report.review_status ===
                                        'changes_requested'
                                      ? '需要修改'
                                      : '待审核',

                            '经理备注':
                                report.manager_note ||
                                '',

                            '提交时间':
                                report.submitted_at
                                    ? new Date(
                                          report.submitted_at,
                                      ).toLocaleString(
                                          'zh-CN',
                                      )
                                    : '',

                            '审核时间':
                                report.reviewed_at
                                    ? new Date(
                                          report.reviewed_at,
                                      ).toLocaleString(
                                          'zh-CN',
                                      )
                                    : '',

                            '审核人':
                                report.reviewed_by ||
                                '',
                        }),
                    );

                const worksheet =
                    XLSX.utils.json_to_sheet(
                        exportRows,
                    );

                worksheet['!cols'] =
                    [
                        { wch: 8 },
                        { wch: 14 },
                        { wch: 18 },
                        { wch: 20 },
                        { wch: 18 },
                        { wch: 20 },
                        { wch: 20 },
                        { wch: 24 },
                        { wch: 12 },
                        { wch: 45 },
                        { wch: 35 },
                        { wch: 35 },
                        { wch: 65 },
                        { wch: 65 },
                        { wch: 18 },
                        { wch: 18 },
                        { wch: 45 },
                        { wch: 24 },
                        { wch: 24 },
                        { wch: 18 },
                    ];

                const range =
                    XLSX.utils.decode_range(
                        worksheet[
                            '!ref'
                        ] ||
                            'A1:A1',
                    );

                worksheet[
                    '!autofilter'
                ] = {
                    ref: XLSX.utils.encode_range(
                        {
                            s: {
                                r: 0,
                                c: 0,
                            },

                            e: {
                                r: range
                                    .e.r,
                                c: range
                                    .e.c,
                            },
                        },
                    ),
                };

                const workbook =
                    XLSX.utils.book_new();

                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    '质检报告',
                );

                let fileLabel =
                    '全部推广员';

                if (promoterId) {
                    const matched =
                        promoters.find(
                            (promoter) =>
                                promoter.id ===
                                promoterId,
                        );

                    if (matched) {
                        fileLabel =
                            `${matched.nickname}_${matched.id}`;
                    }
                }

                const safeFileLabel =
                    fileLabel.replace(
                        /[\\/:*?"<>|]/g,
                        '_',
                    );

                const fileName =
                    `质检报告_${safeFileLabel}_${start}_${end}.xlsx`;

                XLSX.writeFile(
                    workbook,
                    fileName,
                );

                notify(
                    `已导出 ${reportRows.length} 份质检报告`,
                );
            } catch (
                error: any
            ) {
                notify(
                    error?.message ||
                        'Excel 导出失败',
                    'error',
                );
            } finally {
                setExportBusy(false);
            }
        };

    return (
        <>
            <PageHead
                title="报告中心"
                text="选择日期范围，可输入推广员ID或昵称导出指定推广员报告，留空则导出全部"
            >
                <div
                    style={{
                        display: 'grid',
                        gap: 10,
                        minWidth: 320,
                    }}
                >
                    <div className="range-inline">
                        <input
                            type="date"
                            value={start}
                            onChange={(
                                event,
                            ) =>
                                setStart(
                                    event
                                        .target
                                        .value,
                                )
                            }
                        />

                        <span>至</span>

                        <input
                            type="date"
                            value={end}
                            onChange={(
                                event,
                            ) =>
                                setEnd(
                                    event
                                        .target
                                        .value,
                                )
                            }
                        />
                    </div>

                    <div
                        style={{
                            display:
                                'flex',
                            gap: 10,
                            flexWrap:
                                'wrap',
                        }}
                    >
                        <input
                            type="text"
                            value={
                                promoterSearch
                            }
                            onChange={(
                                event,
                            ) =>
                                setPromoterSearch(
                                    event
                                        .target
                                        .value,
                                )
                            }
                            placeholder="推广员ID / 昵称，留空导出全部"
                            style={{
                                minWidth:
                                    260,
                                flex: 1,
                            }}
                        />

                        <button
                            className="btn secondary"
                            onClick={
                                exportExcel
                            }
                            disabled={
                                exportBusy
                            }
                        >
                            <Download />

                            {exportBusy
                                ? '正在导出…'
                                : '导出 Excel'}
                        </button>
                    </div>
                </div>
            </PageHead>

            <div className="review-tabs">
                {(
                    [
                        'pending_review',
                        'approved',
                        'changes_requested',
                        'all',
                    ] as const
                ).map(
                    (status) => (
                        <button
                            key={
                                status
                            }
                            className={
                                review ===
                                status
                                    ? 'active'
                                    : ''
                            }
                            onClick={() => {
                                setReview(
                                    status,
                                );

                                setSelectedReports(
                                    [],
                                );
                            }}
                        >
                            {status ===
                            'all'
                                ? '全部'
                                : reviewLabel[
                                      status
                                  ]}
                        </button>
                    ),
                )}
            </div>

            {selectedInspector && (
                <section
                    style={{
                        marginBottom: 16,
                        padding: 16,
                        border:
                            '1px solid #dfe6ef',
                        borderRadius: 16,
                        background:
                            '#ffffff',
                        display: 'flex',
                        alignItems:
                            'center',
                        justifyContent:
                            'space-between',
                        gap: 16,
                        flexWrap:
                            'wrap',
                    }}
                >
                    <div>
                        <b>
                            已选择{' '}
                            {
                                selectedCount
                            }{' '}
                            份报告
                        </b>

                        <div
                            style={{
                                marginTop: 4,
                                color:
                                    '#778196',
                                fontSize: 13,
                            }}
                        >
                            当前质检员有{' '}
                            {
                                pendingSatisfiedReports.length
                            }{' '}
                            份满意报告等待审核

                            {selectedSatisfiedCount >
                            0
                                ? `，已选中其中 ${selectedSatisfiedCount} 份`
                                : ''}
                        </div>
                    </div>

                    <div
                        style={{
                            display:
                                'flex',
                            alignItems:
                                'center',
                            gap: 10,
                            flexWrap:
                                'wrap',
                        }}
                    >
                        <label
                            style={{
                                display:
                                    'inline-flex',
                                alignItems:
                                    'center',
                                gap: 8,
                                padding:
                                    '10px 12px',
                                border:
                                    '1px solid #dfe6ef',
                                borderRadius:
                                    12,
                                cursor:
                                    'pointer',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={
                                    allSelectableChecked
                                }
                                disabled={
                                    selectableIds.length ===
                                    0
                                }
                                onChange={(
                                    event,
                                ) =>
                                    toggleAll(
                                        event
                                            .target
                                            .checked,
                                    )
                                }
                            />

                            全选待审核
                        </label>

                        <button
                            className="btn secondary"
                            disabled={
                                batchBusy ||
                                pendingSatisfiedReports.length ===
                                    0
                            }
                            onClick={
                                approveAllSatisfied
                            }
                        >
                            <Check />

                            一键通过全部满意

                            {pendingSatisfiedReports.length >
                            0
                                ? `（${pendingSatisfiedReports.length}）`
                                : ''}
                        </button>

                        <button
                            className="btn primary"
                            disabled={
                                batchBusy ||
                                selectedReports.length ===
                                    0
                            }
                            onClick={
                                approveSelected
                            }
                        >
                            <Check />

                            {batchBusy
                                ? '批量审核中…'
                                : `通过已选（${selectedReports.length}）`}
                        </button>
                    </div>
                </section>
            )}

            <div className="review-layout">
                <Panel title="按质检员查看审核进度">
                    <div className="inspector-review-list">
                        {groups.map(
                            (group) => (
                                <button
                                    key={
                                        group.id
                                    }
                                    className={
                                        selectedInspector ===
                                        group.id
                                            ? 'active'
                                            : ''
                                    }
                                    onClick={() =>
                                        chooseInspector(
                                            group.id,
                                        )
                                    }
                                >
                                    <div className="avatar">
                                        {group
                                            .name?.[0] ||
                                            '?'}
                                    </div>

                                    <div className="grow">
                                        <b>
                                            {
                                                group.name
                                            }
                                        </b>

                                        <span>
                                            {group.pending
                                                ? `还有 ${group.pending} 份未审核`
                                                : '这个区间已全部审核完成'}
                                        </span>
                                    </div>

                                    <span className="count-badge">
                                        {
                                            group.pending
                                        }
                                    </span>
                                </button>
                            ),
                        )}

                        {groups.length ===
                            0 && (
                            <div className="empty-hint">
                                当前日期范围内没有报告
                            </div>
                        )}
                    </div>
                </Panel>

                <Panel
                    title={
                        selectedInspector
                            ? `${
                                  groups.find(
                                      (
                                          group,
                                      ) =>
                                          group.id ===
                                          selectedInspector,
                                  )?.name ||
                                  ''
                              } 的报告`
                            : '请选择质检员'
                    }
                >
                    <div className="compact-report-list">
                        {filtered.map(
                            (report) => {
                                const canSelect =
                                    report.review_status ===
                                    'pending_review';

                                return (
                                    <div
                                        key={
                                            report.id
                                        }
                                        style={{
                                            display:
                                                'grid',
                                            gridTemplateColumns:
                                                'auto minmax(0, 1fr)',
                                            alignItems:
                                                'center',
                                            gap: 10,
                                        }}
                                    >
                                        <label
                                            style={{
                                                width: 42,
                                                height: 42,
                                                display:
                                                    'grid',
                                                placeItems:
                                                    'center',
                                                border:
                                                    '1px solid #e4e9f0',
                                                borderRadius:
                                                    12,
                                                background:
                                                    canSelect
                                                        ? '#ffffff'
                                                        : '#f5f7fa',
                                                cursor:
                                                    canSelect
                                                        ? 'pointer'
                                                        : 'not-allowed',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={
                                                    !canSelect
                                                }
                                                checked={selectedReports.includes(
                                                    report.id,
                                                )}
                                                onChange={(
                                                    event,
                                                ) =>
                                                    toggleReport(
                                                        report.id,
                                                        event
                                                            .target
                                                            .checked,
                                                    )
                                                }
                                            />
                                        </label>

                                        <button
                                            onClick={() =>
                                                openReport(
                                                    report,
                                                )
                                            }
                                        >
                                            <div>
                                                <b>
                                                    {
                                                        report.promoter_name
                                                    }
                                                </b>

                                                <span>
                                                    {
                                                        report.task_date
                                                    }{' '}
                                                    ·{' '}

                                                    {report.rating ===
                                                    'satisfied'
                                                        ? '满意'
                                                        : report.rating ===
                                                            'neutral'
                                                          ? '一般'
                                                          : '不满意'}
                                                </span>
                                            </div>

                                            <span
                                                className={`review-badge ${report.review_status}`}
                                            >
                                                {
                                                    reviewLabel[
                                                        report.review_status as ReviewStatus
                                                    ]
                                                }
                                            </span>
                                        </button>
                                    </div>
                                );
                            },
                        )}

                        {selectedInspector &&
                            filtered.length ===
                                0 && (
                            <div className="empty-hint">
                                当前筛选条件下没有报告
                            </div>
                        )}

                        {!selectedInspector && (
                            <div className="empty-hint">
                                请先从左侧选择一名质检员
                            </div>
                        )}
                    </div>
                </Panel>
            </div>

            {active && (
                <div
                    className="drawer-backdrop"
                    onClick={() =>
                        setActive(null)
                    }
                >
                    <aside
                        className="drawer"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="drawer-head">
                            <div>
                                <span className="eyebrow">
                                    REPORT REVIEW
                                </span>

                                <h2>
                                    {
                                        active.promoter_name
                                    }
                                </h2>
                            </div>

                            <button
                                className="icon-btn"
                                onClick={() =>
                                    setActive(
                                        null,
                                    )
                                }
                            >
                                <X />
                            </button>
                        </div>

                        <dl className="detail-grid">
                            <div>
                                <dt>
                                    质检员
                                </dt>

                                <dd>
                                    {
                                        active.inspector_name
                                    }
                                </dd>
                            </div>

                            <div>
                                <dt>
                                    质检号码
                                </dt>

                                <dd>
                                    {
                                        active.inspector_phone
                                    }
                                </dd>
                            </div>

                            <div>
                                <dt>
                                    日期
                                </dt>

                                <dd>
                                    {
                                        active.task_date
                                    }
                                </dd>
                            </div>

                            <div>
                                <dt>
                                    评价
                                </dt>

                                <dd>
                                    {active.rating ===
                                    'satisfied'
                                        ? '满意'
                                        : active.rating ===
                                            'neutral'
                                          ? '一般'
                                          : '不满意'}
                                </dd>
                            </div>
                        </dl>

                        <Panel title="质检总结">
                            <p>
                                {
                                    active.summary
                                }
                            </p>

                            <a
                                className="btn secondary"
                                href={
                                    active.evidence_url
                                }
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink />

                                打开证据链接
                            </a>
                        </Panel>

                        <label>
                            经理备注

                            <textarea
                                rows={5}
                                value={note}
                                onChange={(
                                    event,
                                ) =>
                                    setNote(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                            />
                        </label>

                        <div className="drawer-actions">
                            <button
                                className="btn danger"
                                onClick={() =>
                                    decide(
                                        'changes_requested',
                                    )
                                }
                            >
                                退回修改
                            </button>

                            <button
                                className="btn primary"
                                onClick={() =>
                                    decide(
                                        'approved',
                                    )
                                }
                            >
                                审核通过
                            </button>
                        </div>
                    </aside>
                </div>
            )}
        </>
    );
}

function ReportHistory({profile}:{profile:Profile}){const [rows,setRows]=useState<any[]>([]);const [start,setStart]=useState(monthStart());const [end,setEnd]=useState(today());useEffect(()=>{supabase.from('report_details').select('*').eq(profile.role==='inspector'?'inspector_id':'promoter_id',profile.user_id).gte('task_date',start).lte('task_date',end).order('task_date',{ascending:false}).then(({data})=>setRows(data||[]))},[profile,start,end]);return <><PageHead title="我的历史报告" text="报告永久保存在数据库，可按日期查看。"><div className="range-inline"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>至</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div></PageHead><div className="history-report-list">{rows.map(r=><article key={r.id}><div className="task-top"><span className={`review-badge ${r.review_status}`}>{reviewLabel[r.review_status as ReviewStatus]}</span><small>{r.task_date}</small></div><h3>{profile.role==='inspector'?r.promoter_name:r.inspector_name}</h3><p>{r.summary}</p>{r.manager_note&&<div className="manager-note"><b>经理备注</b><span>{r.manager_note}</span></div>}<a className="btn secondary" href={r.evidence_url} target="_blank" rel="noreferrer"><ExternalLink/>打开证据链接</a></article>)}</div></>}
function Question({n,pt,zh,children}:{n:string;pt:string;zh:string;children:React.ReactNode}){return <div className="question"><div className="question-number">{n}</div><div className="grow"><h4>{pt}</h4><p>{zh}</p>{children}</div></div>}

function Settlement({notify}:{notify:any}){const [week,setWeek]=useState(weekStart());const [preview,setPreview]=useState<any[]>([]);const load=async()=>{const {data,error}=await supabase.rpc('preview_weekly_settlement',{p_week_start:week});if(error)notify(error.message,'error');else setPreview(data||[])};useEffect(()=>{load()},[week]);const settle=async()=>{if(!confirm(`确定结算 ${week} 这一周？未完成任务将释放号码组合。`))return;const {data,error}=await supabase.rpc('settle_week',{p_week_start:week});if(error)return notify(error.message,'error');notify(`结算完成：释放 ${data?.released_count||0} 个号码组合`);load()};return <><PageHead title="每周结算" text="未完成任务不会增加推广员累计次数；结算后释放号码组合，并永久保留未完成记录。"><label className="date-large">选择周一<input type="date" value={week} onChange={e=>setWeek(weekStart(e.target.value))}/></label></PageHead><Panel title="质检员本周完成情况"><Table headers={['质检员','目标','已分配','已完成','剩余','历史未完成']}>{preview.map(r=><tr key={r.inspector_id}><td><b>{r.inspector_name}</b></td><td>{r.target_tasks}</td><td>{r.assigned}</td><td>{r.completed}</td><td>{r.remaining}</td><td>{r.historical_unfinished}</td></tr>)}</Table><div className="panel-actions"><button className="btn primary" onClick={settle}><Archive/>结束并结算本周</button></div></Panel></>}
function LeaderboardPage({profile,notify}:{profile:Profile;notify:any}){const [rows,setRows]=useState<Leaderboard[]>([]);const load=()=>supabase.from('leaderboard').select('*').order('rank').then(({data})=>setRows((data||[]) as Leaderboard[]));useEffect(()=>{void load()},[]);const importFile=async(f:File)=>{const parsed=parseCsv(await f.text()).map((r:any,i)=>({week_start:weekStart(),promoter_id:String(r.ID||r.promoter_id||''),promoter_name:String(r['推广员昵称']||''),player_growth_score:Number(r['玩家增长人数得分（权重：20%）']||0),reputation_score:Number(r['推广员信誉积分 （权重：50%）']||r['推广员信誉积分（权重：50%）']||0),weekly_rebate_score:Number(r['玩家周度返利人数得分（权重：30%）']||0),total_score:Number(r['总分']||0),rank:i+1})).filter(x=>x.promoter_id).sort((a,b)=>b.total_score-a.total_score).map((x,i)=>({...x,rank:i+1}));await supabase.from('leaderboard').delete().eq('week_start',weekStart());const {error}=await supabase.from('leaderboard').insert(parsed);if(error)return notify(error.message,'error');load();notify(`已导入 ${parsed.length} 条排行榜`)};const visible=profile.role==='promoter'?rows.filter(r=>r.promoter_id===profile.user_id):rows;return <><PageHead title={profile.role==='promoter'?'我的排名':'排行榜'} text="排行榜与推广员资料完全独立。">{profile.role==='manager'&&<FileButton onFile={importFile}/>}</PageHead><Table headers={['排名','推广员ID','昵称','增长20%','信誉50%','返利30%','总分']}>{visible.map(r=><tr key={r.id}><td><b>#{r.rank}</b></td><td>{r.promoter_id}</td><td>{r.promoter_name}</td><td>{r.player_growth_score}</td><td>{r.reputation_score}</td><td>{r.weekly_rebate_score}</td><td><strong>{r.total_score}</strong></td></tr>)}</Table></>}
function ReputationPage({profile,notify}:{profile:Profile;notify:any}){const [rows,setRows]=useState<Promoter[]>([]);const [q,setQ]=useState('');const [queryUrl,setQueryUrl]=useState('');const load=async()=>{let query=supabase.from('promoters').select('*').order('nickname');if(profile.role==='promoter')query=query.eq('id',profile.user_id);const [{data,error},{data:settings}]=await Promise.all([query,supabase.from('app_settings').select('reputation_query_url').eq('id',1).single()]);if(error)return notify(error.message,'error');setRows((data||[]) as Promoter[]);setQueryUrl(String(settings?.reputation_query_url||''))};useEffect(()=>{void load()},[profile.user_id]);const importFile=async(f:File)=>{const parsed=parseCsv(await f.text()).map((r:any)=>({promoter_id:String(r.promoter_id||'').trim(),reputation_score:Number(r.reputation_score)})).filter(x=>x.promoter_id);const invalid=parsed.filter(x=>!Number.isFinite(x.reputation_score)||x.reputation_score<0||x.reputation_score>100);const valid=parsed.filter(x=>!invalid.includes(x));let updated=0,missing=0,failed=0;for(const row of valid){const {data,error}=await supabase.from('promoters').update({reputation_score:row.reputation_score,reputation_updated_at:new Date().toISOString()}).eq('id',row.promoter_id).select('id');if(error)failed++;else if(!data?.length)missing++;else updated++}await load();notify(`信誉积分导入完成：更新 ${updated}，找不到 ${missing}，格式错误 ${invalid.length}，失败 ${failed}`,failed?'error':'ok')};const visible=rows.filter(x=>`${x.id}${x.nickname}`.toLowerCase().includes(q.toLowerCase()));if(profile.role==='promoter'){const p=rows[0];return <><PageHead title="我的信誉积分" text="这里仅显示你的最终信誉积分；加扣分明细请通过统一查询入口查看。"/><section className="reputation-profile"><span className="eyebrow">REPUTATION SCORE</span><div className="score-orb">{p?.reputation_score??'—'}<small>分</small></div><h2>{p?.nickname||profile.display_name}</h2><p>{p?.reputation_updated_at?`最后更新：${new Date(p.reputation_updated_at).toLocaleString('zh-CN')}`:'经理尚未导入信誉积分'}</p>{queryUrl?<a className="btn primary" href={queryUrl} target="_blank" rel="noreferrer"><ExternalLink/>查询信誉积分详情</a>:<div className="empty-hint">管理员尚未配置统一查询链接。</div>}</section></>}return <><PageHead title="信誉积分" text="导入 reputation.csv，只更新每位推广员的最终分数；详情统一使用系统查询链接。"><SearchBox value={q} onChange={setQ}/><FileButton onFile={importFile}/></PageHead><Panel title="CSV 格式：promoter_id,reputation_score"><p className="panel-help">分数范围 0–100；不存在的推广员不会自动新增；重复导入会覆盖旧分数。统一查询链接在 Supabase app_settings 中配置一次即可。</p>{queryUrl?<a className="btn secondary" href={queryUrl} target="_blank" rel="noreferrer"><ExternalLink/>打开统一查询页面</a>:<div className="empty-hint">尚未配置统一查询链接。</div>}</Panel><div className="reputation-grid">{visible.map(p=><article key={p.id}><div className="reputation-person"><div className="avatar">{p.nickname[0]}</div><div><code>{p.id}</code><h3>{p.nickname}</h3></div></div><div className="reputation-number"><strong>{p.reputation_score??'—'}</strong><span>最终信誉积分</span></div><div className="reputation-meta"><span>{p.reputation_updated_at?new Date(p.reputation_updated_at).toLocaleString('zh-CN'):'尚未更新'}</span>{queryUrl?<a href={queryUrl} target="_blank" rel="noreferrer"><ExternalLink/>查询详情</a>:<em>未配置查询链接</em>}</div></article>)}</div></>}
function Accounts({notify}:{notify:any}){const [rows,setRows]=useState<Profile[]>([]);const load=()=>supabase.from('profiles').select('*').order('user_id').then(({data})=>setRows((data||[]) as Profile[]));useEffect(()=>{void load()},[]);const importFile=async(f:File)=>{const accounts=parseCsv(await f.text()).map((r:any)=>({user_id:String(r.user_id||'').trim(),password:String(r.password||''),role:String(r.role||'').trim(),status:String(r.status||'ativo').trim()})).filter(x=>x.user_id&&x.password);const {data:{session}}=await supabase.auth.getSession();const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-accounts`,{method:'POST',headers:{Authorization:`Bearer ${session?.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({accounts})});const json=await res.json();if(!res.ok)return notify(json.error||'账号导入失败','error');notify(`成功导入 ${json.success} 个账号`);load()};return <><PageHead title="登录账号" text="CSV：user_id,password,role,status；角色 gerente/promotor/inspetor，状态 ativo/inativo。"><FileButton onFile={importFile}/></PageHead><Table headers={['用户ID','显示名称','身份','状态']}>{rows.map(r=><tr key={r.auth_user_id}><td>{r.user_id}</td><td>{r.display_name}</td><td>{roleLabel[r.role]}</td><td><span className={`review-badge ${r.status==='ativo'?'approved':'changes_requested'}`}>{r.status==='ativo'?'启用':'禁用'}</span></td></tr>)}</Table></>}
function SettingsPage(){return <><PageHead title="系统设置" text="生产版关键设置由 Supabase 数据库与部署环境变量管理。"/><Panel title="上线状态"><div className="status-check"><Check/>数据库已连接</div><div className="status-check"><Check/>账号由 Supabase Auth 保存</div><div className="status-check"><Check/>任务分配、报告提交、审核和周结算使用数据库函数</div></Panel></>}

function Hero({title,text,action}:{title:string;text:string;action?:React.ReactNode}){return <section className="hero"><div><span className="eyebrow">TODAY'S WORKSPACE</span><h2>{title}</h2><p>{text}</p></div>{action}</section>}
function PageHead({title,text,children}:{title:string;text:string;children?:React.ReactNode}){return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div><div className="page-actions">{children}</div></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="panel"><div className="panel-head"><h3>{title}</h3></div>{children}</section>}
function Stat({label,value,note}:{label:string;value:string|number;note:string}){return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function SearchBox({value,onChange}:{value:string;onChange:(v:string)=>void}){return <label className="search"><Search/><input value={value} onChange={e=>onChange(e.target.value)} placeholder="搜索…"/></label>}
function FileButton({onFile}:{onFile:(f:File)=>void}){return <label className="btn secondary file-btn"><Upload/>导入 CSV<input type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&onFile(e.target.files[0])}/></label>}
function Table({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
