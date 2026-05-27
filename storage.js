const HPH_SUPABASE_URL="https://yiryrnxqsdhitbodjgrn.supabase.co";
const HPH_SUPABASE_PUBLISHABLE_KEY="sb_publishable_FRV9Y4x2GjbzjYcxt9AgAQ_eMwJZcHQ";
window.HPH_USE_SUPABASE=true;

const HPH_DEFAULT_DATA={users:[{id:"u1",username:"admin",password:"admin123",role:"admin",createdAt:"2026-01-01T00:00:00.000Z"},{id:"u2",username:"user",password:"user123",role:"user",createdAt:"2026-01-01T00:00:00.000Z"}],projects:[{id:"p1",name:"IGTV (Islamabad Green Traders Valley)",createdAt:"2026-01-01T00:00:00.000Z"},{id:"p2",name:"Badar Farms",createdAt:"2026-01-01T00:00:00.000Z"},{id:"p3",name:"Sanam Gardens",createdAt:"2026-01-01T00:00:00.000Z"},{id:"p4",name:"Baba Chitu",createdAt:"2026-01-01T00:00:00.000Z"}],clients:[],plots:[],sellers:[],payments:[],dues:[]};
const HPH_STORAGE_KEY="hph_estate_manager_v2";
function hphIsSupabaseOnlineMode(){return !!(window.HPH_USE_SUPABASE && window.HPH_SUPABASE_ACTIVE)}
function hphIsUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||""))}
function hphRemoveLocalFallbackUsers(users){return (users||[]).filter(user=>hphIsUuid(user.id)||user.email).map(user=>({...user,password:""}))}

function hphNormalizePaymentStatus(status){if(!status)return "";return {sold:"fully_paid",partial:"partially_paid",available:"",fully_paid:"fully_paid",partially_paid:"partially_paid",to_be_paid:"to_be_paid"}[status]??""}
function hphNormalizeAvailability(status){return {available:"available",sold:"sold",partial:"sold",partially_paid:"sold",fully_paid:"sold",to_be_paid:"sold"}[status]||"available"}
function hphClientPlotId(client){return `plot_from_${client.id}`}
function hphDisplayReceived(client){const status=hphNormalizePaymentStatus(client.paymentStatus);if(status==="fully_paid"&&Number(client.totalAmount||0)>0)return Number(client.totalAmount||0);return Number(client.tokenAmount||0)}
const HPHStorage={defaultData(){return structuredClone(HPH_DEFAULT_DATA)},load(){try{const raw=localStorage.getItem(HPH_STORAGE_KEY);const parsed=raw?JSON.parse(raw):{};return this.normalize(parsed)}catch(error){console.error("Storage load failed:",error);return structuredClone(HPH_DEFAULT_DATA)}},save(data){const clean=this.normalize(data);localStorage.setItem(HPH_STORAGE_KEY,JSON.stringify(clean));return clean},normalize(data){const base=structuredClone(HPH_DEFAULT_DATA);const merged={...base,...(data||{})};for(const key of Object.keys(base)){if(!Array.isArray(merged[key]))merged[key]=[]}if(hphIsSupabaseOnlineMode()){merged.users=hphRemoveLocalFallbackUsers(merged.users)}else{for(const defaultUser of base.users){if(!merged.users.some(user=>user.username===defaultUser.username)){merged.users.push(defaultUser)}}}for(const defaultProject of base.projects){if(!merged.projects.some(project=>project.name===defaultProject.name)){merged.projects.push(defaultProject)}}merged.clients=merged.clients.map(client=>({...client,paymentStatus:hphNormalizePaymentStatus(client.paymentStatus)}));merged.plots=merged.plots.map(plot=>{const availabilityStatus=hphNormalizeAvailability(plot.availabilityStatus||plot.status);return {...plot,khasraNo:plot.khasraNo||"",khatauniNo:plot.khatauniNo||"",transferredFrom:plot.transferredFrom||"",availabilityStatus,paymentStatus:availabilityStatus==="available"?"":hphNormalizePaymentStatus(plot.paymentStatus),amountReceived:Number(plot.amountReceived??plot.tokenAmount??0)}});for(const client of merged.clients){if(!client.plotNo)continue;const plotId=hphClientPlotId(client);const existingIndex=merged.plots.findIndex(plot=>plot.sourceClientId===client.id||plot.id===plotId);const plot={id:existingIndex>=0?merged.plots[existingIndex].id:plotId,sourceClientId:client.id,projectName:client.projectName||"",plotNo:client.plotNo||"",intikalNo:client.intikalNo||"",plotSize:client.plotSize||"",plotUnit:client.plotUnit||"Marla",plotSizeMarla:Number(client.plotSizeMarla||0),khasraNo:client.khasraNo||"",khatauniNo:client.khatauniNo||"",transferredFrom:client.transferredFrom||"",propertyType:client.propertyType||"Residential",constructionStatus:client.constructionStatus||"plot",availabilityStatus:"sold",linkedClientId:client.id,price:Number(client.totalAmount||0),amountReceived:hphDisplayReceived(client),paymentStatus:hphNormalizePaymentStatus(client.paymentStatus),notes:client.notes||"",createdAt:existingIndex>=0?merged.plots[existingIndex].createdAt:(client.createdAt||new Date().toISOString()),updatedAt:client.updatedAt||new Date().toISOString()};if(existingIndex>=0)merged.plots[existingIndex]={...merged.plots[existingIndex],...plot};else merged.plots.push(plot)}return merged},clear(){localStorage.removeItem(HPH_STORAGE_KEY);return structuredClone(HPH_DEFAULT_DATA)}};

function hphIso(value){return value||new Date().toISOString()}
function hphDate(value){return value||null}
function hphNum(value){return Number(value||0)}
function hphStripPasswords(users){return (users||[]).map(u=>({...u,password:""}))}

function profileFromRow(row){return {id:row.id,username:row.username||"",email:row.email||"",password:"",role:row.role||"user",createdAt:row.created_at,updatedAt:row.updated_at}}
function projectFromRow(row){return {id:row.id,name:row.name,createdAt:row.created_at,updatedAt:row.updated_at}}
function clientFromRow(row){return {id:row.id,nameEn:row.name_en||"",nameUr:row.name_ur||"",fatherEn:row.father_en||"",fatherUr:row.father_ur||"",cnic:row.cnic||"",phone:row.phone||"",addressEn:row.address_en||"",addressUr:row.address_ur||"",notes:row.notes||"",createdAt:row.created_at,updatedAt:row.updated_at,paymentStatus:""}}
function plotFromRow(row){return {id:row.id,sourceClientId:null,projectId:row.project_id||"",projectName:row.project_name||"",plotNo:row.plot_no||"",intikalNo:row.intikal_no||"",plotSize:row.plot_size??"",plotUnit:row.plot_unit||"Marla",plotSizeMarla:Number(row.plot_size_marla||0),khasraNo:row.khasra_no||"",khatauniNo:row.khatauni_no||"",transferredFrom:row.transferred_from||"",propertyType:row.property_type||"Residential",constructionStatus:row.construction_status||"plot",availabilityStatus:row.availability_status||"available",linkedClientId:row.linked_client_id||"",price:Number(row.price||0),amountReceived:Number(row.amount_received||0),paymentStatus:row.payment_status||"",dealDate:row.deal_date||"",notes:row.notes||"",createdAt:row.created_at,updatedAt:row.updated_at}}
function sellerFromRow(row){return {id:row.id,nameEn:row.name_en||"",nameUr:row.name_ur||"",fatherEn:row.father_en||"",fatherUr:row.father_ur||"",cnic:row.cnic||"",phone:row.phone||"",addressEn:row.address_en||"",addressUr:row.address_ur||"",createdAt:row.created_at,updatedAt:row.updated_at}}
function paymentFromRow(row){return {id:row.id,clientId:row.client_id||"",plotId:row.plot_id||"",type:row.type||"cash",amount:Number(row.amount||0),date:row.date||"",note:row.note||"",exchangeItem:row.exchange_item||"",createdAt:row.created_at}}
function dueFromRow(row){return {id:row.id,clientId:row.client_id||"",plotId:row.plot_id||"",type:row.type||"",amount:Number(row.amount||0),discountAmount:Number(row.discount_amount||0),date:row.date||"",paid:!!row.paid,paidDate:row.paid_date||"",status:row.status||"unpaid",note:row.note||"",createdAt:row.created_at,updatedAt:row.updated_at}}

function projectToRow(p){return {id:p.id,name:p.name,created_at:hphIso(p.createdAt),updated_at:hphIso(p.updatedAt)}}
function clientToRow(c){return {id:c.id,name_en:c.nameEn||"",name_ur:c.nameUr||"",father_en:c.fatherEn||"",father_ur:c.fatherUr||"",cnic:c.cnic||"",phone:c.phone||"",address_en:c.addressEn||"",address_ur:c.addressUr||"",notes:c.notes||"",created_at:hphIso(c.createdAt),updated_at:hphIso(c.updatedAt)}}
function plotToRow(p){return {id:p.id,project_id:p.projectId||null,project_name:p.projectName||"",plot_no:p.plotNo||"",intikal_no:p.intikalNo||"",plot_size:p.plotSize===""?null:Number(p.plotSize||0),plot_unit:p.plotUnit||"Marla",plot_size_marla:Number(p.plotSizeMarla||0),khasra_no:p.khasraNo||"",khatauni_no:p.khatauniNo||"",transferred_from:p.transferredFrom||"",property_type:p.propertyType||"Residential",construction_status:p.constructionStatus||"plot",availability_status:p.availabilityStatus||"available",linked_client_id:p.linkedClientId||null,price:Number(p.price||0),amount_received:Number(p.amountReceived||0),payment_status:p.availabilityStatus==="available"?null:(p.paymentStatus||null),deal_date:p.dealDate||null,notes:p.notes||"",created_at:hphIso(p.createdAt),updated_at:hphIso(p.updatedAt)}}
function sellerToRow(s){return {id:s.id,name_en:s.nameEn||"",name_ur:s.nameUr||"",father_en:s.fatherEn||"",father_ur:s.fatherUr||"",cnic:s.cnic||"",phone:s.phone||"",address_en:s.addressEn||"",address_ur:s.addressUr||"",created_at:hphIso(s.createdAt),updated_at:hphIso(s.updatedAt)}}
function paymentToRow(p){return {id:p.id,client_id:p.clientId,plot_id:p.plotId,type:p.type||"cash",amount:Number(p.amount||0),date:p.date||new Date().toISOString().slice(0,10),note:p.note||"",exchange_item:p.exchangeItem||"",created_at:hphIso(p.createdAt)}}
function dueToRow(d){return {id:d.id,client_id:d.clientId,plot_id:d.plotId,type:d.type||"",amount:Number(d.amount||0),discount_amount:Number(d.discountAmount||0),date:d.date||"",paid:!!d.paid,paid_date:d.paidDate||null,status:d.status||"unpaid",note:d.note||"",created_at:hphIso(d.createdAt),updated_at:hphIso(d.updatedAt)}}

const HPHSupabase={
  client:null,
  ready:false,
  async ensureReady(){
    if(this.ready&&this.client)return true;
    if(!window.supabase){
      await new Promise((resolve,reject)=>{
        const existing=document.querySelector('script[data-hph-supabase-loader]');
        if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
        const script=document.createElement('script');
        script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.setAttribute('data-hph-supabase-loader','true');
        script.onload=resolve;
        script.onerror=()=>reject(new Error('Could not load Supabase library. Check internet connection or CDN access.'));
        document.head.appendChild(script);
      });
    }
    this.init();
    if(!this.ready||!this.client)throw new Error('Supabase client is not ready. Check Project URL and publishable key.');
    return true;
  },
  init(){
    if(!window.supabase||!HPH_SUPABASE_URL||!HPH_SUPABASE_PUBLISHABLE_KEY)return null;
    this.client=window.supabase.createClient(HPH_SUPABASE_URL,HPH_SUPABASE_PUBLISHABLE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true}});
    this.ready=true;
    return this.client;
  },
  async resolveLoginEmail(identifier){
    const login=(identifier||'').trim();
    if(!login)throw new Error('Enter username or email.');
    if(login.includes('@'))return login;
    const {data,error}=await this.client.rpc('get_login_email',{login_identifier:login});
    if(error)throw error;
    if(!data)throw new Error('No online user found with this username.');
    return data;
  },
  async signIn(identifier,password){
    await this.ensureReady();
    window.HPH_SUPABASE_ACTIVE=true;
    const email=await this.resolveLoginEmail(identifier);
    const {data,error}=await this.client.auth.signInWithPassword({email,password});
    if(error)throw error;
    const user=data.user;
    const {data:profile,error:profileError}=await this.client.from('profiles').select('*').eq('id',user.id).single();
    if(profileError)throw profileError;
    return profileFromRow(profile);
  },
  async signOut(){if(!this.ready)await this.ensureReady();if(this.ready)await this.client.auth.signOut()},
  async getCurrentProfile(){
    try{await this.ensureReady();}catch(e){return null}
    const {data:{session}}=await this.client.auth.getSession();
    if(!session)return null;
    window.HPH_SUPABASE_ACTIVE=true;
    const {data,error}=await this.client.from('profiles').select('*').eq('id',session.user.id).single();
    if(error)return null;
    return profileFromRow(data);
  },
  async loadAll(){
    await this.ensureReady();
    window.HPH_SUPABASE_ACTIVE=true;
    const [profiles,projects,clients,plots,sellers,payments,dues]=await Promise.all([
      this.client.from('profiles').select('*').order('created_at'),
      this.client.from('projects').select('*').order('name'),
      this.client.from('clients').select('*').order('name_en'),
      this.client.from('plots').select('*').order('project_name').order('plot_no'),
      this.client.from('sellers').select('*').order('name_en'),
      this.client.from('payments').select('*').order('created_at'),
      this.client.from('dues').select('*').order('created_at')
    ]);
    const failed=[profiles,projects,clients,plots,sellers,payments,dues].find(r=>r.error);
    if(failed)throw failed.error;
    return HPHStorage.normalize({
      users:hphRemoveLocalFallbackUsers(hphStripPasswords((profiles.data||[]).map(profileFromRow))),
      projects:(projects.data||[]).map(projectFromRow),
      clients:(clients.data||[]).map(clientFromRow),
      plots:(plots.data||[]).map(plotFromRow),
      sellers:(sellers.data||[]).map(sellerFromRow),
      payments:(payments.data||[]).map(paymentFromRow),
      dues:(dues.data||[]).map(dueFromRow)
    });
  },
  async saveAll(data){
    await this.ensureReady();
    window.HPH_SUPABASE_ACTIVE=true;
    const clean=HPHStorage.normalize(data);
    const validClientIds=new Set((clean.clients||[]).map(client=>client.id));
    const validPlotIds=new Set((clean.plots||[]).map(plot=>plot.id));
    const safePayments=(clean.payments||[]).filter(payment=>validClientIds.has(payment.clientId)&&validPlotIds.has(payment.plotId));
    const safeDues=(clean.dues||[]).filter(due=>validClientIds.has(due.clientId)&&validPlotIds.has(due.plotId));
    const c=this.client;
    for(const table of ["dues","payments","sellers","plots","clients"]){
      const {error}=await c.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000');
      if(error)throw error;
    }
    if(clean.projects.length){const {error}=await c.from('projects').upsert(clean.projects.filter(p=>/^[0-9a-f-]{36}$/i.test(p.id)).map(projectToRow));if(error)throw error;}
    if(clean.clients.length){const {error}=await c.from('clients').insert(clean.clients.map(clientToRow));if(error)throw error;}
    if(clean.plots.length){const {error}=await c.from('plots').insert(clean.plots.map(plotToRow));if(error)throw error;}
    if(clean.sellers.length){const {error}=await c.from('sellers').insert(clean.sellers.map(sellerToRow));if(error)throw error;}
    if(safePayments.length){const {error}=await c.from('payments').insert(safePayments.map(paymentToRow));if(error)throw error;}
    if(safeDues.length){const {error}=await c.from('dues').insert(safeDues.map(dueToRow));if(error)throw error;}
    clean.payments=safePayments;
    clean.dues=safeDues;
    return clean;
  },
  async clearBusinessData(){
    await this.ensureReady();
    window.HPH_SUPABASE_ACTIVE=true;
    for(const table of ['dues','payments','sellers','plots','clients']){
      const {error}=await this.client.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000');
      if(error)throw error;
    }
  }
};
window.HPHSupabase=HPHSupabase;
window.HPHStorage=HPHStorage;
HPHSupabase.init();
