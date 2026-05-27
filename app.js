const state={data:HPHStorage.load(),currentUser:null,selectedRole:"user",activePage:"dashboard",activePaymentClientId:null,activePaymentPlotId:null,activeDueClientId:null,activeDuePlotId:null,onlineMode:false,remoteSaveTimer:null,remoteSaveInFlight:false,remoteSaveQueued:false};
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
function uid(prefix="id"){return window.HPH_USE_SUPABASE&&window.crypto?.randomUUID?window.crypto.randomUUID():`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function formatMoney(value){return Number(value||0).toLocaleString("en-PK")}
function formatDate(value){if(!value)return "-";try{return new Date(value).toLocaleDateString("en-GB")}catch(e){return String(value).slice(0,10)||"-"}}
function parseMoney(value){return Number(String(value||"").replace(/[^\d.]/g,""))||0}
function formatAmountInput(input){const numeric=String(input.value||"").replace(/[^\d]/g,"");input.value=numeric?Number(numeric).toLocaleString("en-PK"):""}
function formatCNIC(value){const digits=String(value||"").replace(/\D/g,"").slice(0,13);if(digits.length>12)return `${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;if(digits.length>5)return `${digits.slice(0,5)}-${digits.slice(5)}`;return digits}
function formatPhone(value){const digits=String(value||"").replace(/\D/g,"").slice(0,11);if(digits.length>4)return `${digits.slice(0,4)}-${digits.slice(4)}`;return digits}
function formatPlotNo(value){const clean=String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");const letters=clean.match(/^[A-Z]+/)?.[0]||"";const numbers=clean.slice(letters.length).replace(/\D/g,"");if(letters&&numbers)return `${letters}-${numbers}`;return clean}
function toMarla(size,unit){const n=Number(size||0);if(unit==="Kanal")return n*20;if(unit==="Yards")return n/25;return n}
function normalizePaymentStatus(status){if(!status)return "";return {sold:"fully_paid",partial:"partially_paid",available:"",fully_paid:"fully_paid",partially_paid:"partially_paid",to_be_paid:"to_be_paid"}[status]??""}
function paymentStatusLabel(status){const normalized=normalizePaymentStatus(status);return {fully_paid:"Fully Paid",partially_paid:"Partially Paid",to_be_paid:"To Be Paid"}[normalized]||"-"}
function constructionStatusLabel(status){return {plot:"Plot",constructed:"Constructed"}[status]||"-"}
function availabilityStatusLabel(status){return {available:"Available",sold:"Sold"}[status]||"-"}
function getClientName(clientId){const client=state.data.clients.find(c=>c.id===clientId);return client?client.nameEn:"-"}
function clientOptionLabel(client){return `${client.nameEn||"Unnamed"}${client.cnic?" · "+client.cnic:""}` }
function badgeClass(value){value=normalizePaymentStatus(value)==="to_be_paid"&&!['plot','constructed','available','sold'].includes(value)?normalizePaymentStatus(value):value;if(value==="fully_paid"||value==="constructed"||value==="sold")return "green";if(value==="partially_paid")return "yellow";if(value==="to_be_paid"||value==="plot"||value==="available")return "gray";return "gray"}
function calculateClientPaymentStatus(totalAmount,receivedAmount,fullyPaid){const total=Number(totalAmount||0);const received=Number(receivedAmount||0);if(fullyPaid)return "fully_paid";if(total>0&&received>=total)return "fully_paid";if(received>0)return "partially_paid";return "to_be_paid"}
function displayReceivedAmount(client){const status=normalizePaymentStatus(client.paymentStatus);if(status==="fully_paid"&&Number(client.totalAmount||0)>0)return Number(client.totalAmount||0);return Number(client.tokenAmount||0)}
function getClientPlots(clientId){return state.data.plots.filter(plot=>plot.linkedClientId===clientId||plot.sourceClientId===clientId)}
function naturalPlotCompare(a,b){const parse=value=>{const m=String(value||"").toUpperCase().match(/^([A-Z]+)-?(\d+)/);return m?{letters:m[1],number:Number(m[2])}:{letters:String(value||"").toUpperCase(),number:0}};const pa=parse(a),pb=parse(b);return pa.letters.localeCompare(pb.letters)||pa.number-pb.number||String(a||"").localeCompare(String(b||""))}
function sortPlotsList(plots){return [...plots].sort((a,b)=>(a.projectName||"").localeCompare(b.projectName||"")||naturalPlotCompare(a.plotNo,b.plotNo))}
function sortClientsList(clients){return [...clients].sort((a,b)=>(a.nameEn||"").localeCompare(b.nameEn||""))}
function clientAggregate(client){const plots=getClientPlots(client.id);if(!plots.length){const received=displayReceivedAmount(client);const remaining=Math.max(0,Number(client.totalAmount||0)-received);return {plots:[],plotLabels:client.plotNo?[client.plotNo]:[],projectLabels:client.projectName?[client.projectName]:[],sizeLabels:client.plotSizeMarla?[`${client.plotSizeMarla} marla`]:[],typeLabels:client.propertyType?[client.propertyType]:[],constructionStatuses:[client.constructionStatus],paymentStatuses:[normalizePaymentStatus(client.paymentStatus)],total:Number(client.totalAmount||0),received,remaining}}
const sorted=sortPlotsList(plots);const total=sorted.reduce((sum,p)=>sum+Number(p.price||0),0);const received=sorted.reduce((sum,p)=>sum+Number(p.amountReceived||0),0);const remaining=Math.max(0,total-received);return {plots:sorted,plotLabels:sorted.map(p=>p.plotNo).filter(Boolean),projectLabels:[...new Set(sorted.map(p=>p.projectName).filter(Boolean))],sizeLabels:[...new Set(sorted.map(p=>`${p.plotSizeMarla||0} marla`))],typeLabels:[...new Set(sorted.map(p=>p.propertyType).filter(Boolean))],constructionStatuses:[...new Set(sorted.map(p=>p.constructionStatus).filter(Boolean))],paymentStatuses:[...new Set(sorted.map(p=>normalizePaymentStatus(p.paymentStatus)).filter(Boolean))],total,received,remaining}}
function aggregatePaymentStatusLabel(statuses){const unique=[...new Set((statuses||[]).map(normalizePaymentStatus))];if(!unique.length)return "-";if(unique.length===1)return paymentStatusLabel(unique[0]);return unique.map(paymentStatusLabel).join(" / ")}
function aggregateConstructionStatusLabel(statuses){const unique=[...new Set((statuses||[]).filter(Boolean))];if(!unique.length)return "-";if(unique.length===1)return constructionStatusLabel(unique[0]);return unique.map(constructionStatusLabel).join(" / ")}
function userFriendlySyncError(error){
  const message=String(error?.message||error||"");
  if(message.includes("foreign key constraint")){
    return "Online save was blocked because one linked client or plot was missing from the database. Please refresh the app and try again.";
  }
  if(message.includes("Failed to fetch")||message.includes("NetworkError")){
    return "Online save failed because the database could not be reached. Check your internet connection and try again.";
  }
  return "Online database sync failed: "+message;
}
async function runRemoteSave(){
  if(state.remoteSaveInFlight){state.remoteSaveQueued=true;return;}
  state.remoteSaveInFlight=true;
  try{
    const latest=structuredClone(state.data);
    state.data=await HPHSupabase.saveAll(latest);
    HPHStorage.save(state.data);
    console.log("Supabase sync complete");
  }catch(error){
    console.error("Supabase sync failed",error);
    alert(userFriendlySyncError(error));
  }finally{
    state.remoteSaveInFlight=false;
    if(state.remoteSaveQueued){
      state.remoteSaveQueued=false;
      runRemoteSave();
    }
  }
}
function scheduleRemoteSave(){
  if(!state.onlineMode||!window.HPHSupabase?.ready)return;
  clearTimeout(state.remoteSaveTimer);
  state.remoteSaveTimer=setTimeout(runRemoteSave,700);
}
function saveData(){state.data=HPHStorage.save(state.data);scheduleRemoteSave()}
function saveSession(){
  if(!state.currentUser)return;
  sessionStorage.setItem("hphSession",JSON.stringify({username:state.currentUser.username,role:state.currentUser.role,page:state.activePage||"dashboard"}));
}
function clearSession(){sessionStorage.removeItem("hphSession");localStorage.removeItem("hphSession")}
async function restoreSession(){
  try{
    if(window.HPH_USE_SUPABASE&&window.HPHSupabase?.ready){
      const profile=await HPHSupabase.getCurrentProfile();
      if(profile){
        state.onlineMode=true;
        state.currentUser=profile;
        state.selectedRole=profile.role;
        state.data=await HPHSupabase.loadAll();
        HPHStorage.save(state.data);
        document.getElementById("loginView").classList.add("hidden");
        document.getElementById("mainView").classList.remove("hidden");
        document.getElementById("activeUsername").textContent=profile.username;
        document.getElementById("activeRole").textContent=profile.role+" · online";
        document.querySelectorAll('.admin-only').forEach(item=>item.classList.toggle("hidden",profile.role!=="admin"));
        setRole(profile.role);
        const savedPage=sessionStorage.getItem("hphActivePage")||"dashboard";
        goPage(savedPage);
        return true;
      }
    }
    const saved=JSON.parse(sessionStorage.getItem("hphSession")||"null");
    if(!saved)return false;
    const user=state.data.users.find(u=>u.username===saved.username&&u.role===saved.role);
    if(!user)return false;
    state.currentUser=user;
    state.selectedRole=user.role;
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("mainView").classList.remove("hidden");
    document.getElementById("activeUsername").textContent=user.username;
    document.getElementById("activeRole").textContent=user.role;
    document.querySelectorAll('.admin-only').forEach(item=>item.classList.toggle("hidden",user.role!=="admin"));
    setRole(user.role);
    goPage(saved.page||"dashboard");
    return true;
  }catch(e){console.error(e);clearSession();return false}
}
function setRole(role){state.selectedRole=role;$("#roleUserBtn").classList.toggle("active",role==="user");$("#roleAdminBtn").classList.toggle("active",role==="admin")}
function loginErrorMessage(error){
  const message=String(error?.message||error||"");
  if(/email not confirmed/i.test(message))return "Email is not confirmed. Ask admin to confirm this user in Supabase.";
  if(/profile/i.test(message)&&/missing|not found|no rows|0 rows/i.test(message))return "Login succeeded, but this user's profile is missing. Contact admin.";
  if(/failed to fetch|network|load Supabase|CDN|internet/i.test(message))return "Could not connect to the online database. Check internet connection.";
  return "Incorrect username/email or password.";
}
async function login(){
  const username=$("#loginUsername").value.trim();
  const password=$("#loginPassword").value;

  if(window.HPH_USE_SUPABASE){
    try{
      $("#loginError").classList.add("hidden");
      if(!window.HPHSupabase){
        throw new Error("Online login module did not load. Make sure storage.js is uploaded and browser cache is cleared.");
      }
      await HPHSupabase.ensureReady();
      const profile=await HPHSupabase.signIn(username,password);
      state.onlineMode=true;
      state.currentUser=profile;
      state.selectedRole=profile.role;
      state.data=await HPHSupabase.loadAll();
      HPHStorage.save(state.data);
      $("#loginView").classList.add("hidden");
      $("#mainView").classList.remove("hidden");
      $("#activeUsername").textContent=profile.username || username;
      $("#activeRole").textContent=profile.role+" · online";
      $$('.admin-only').forEach(item=>item.classList.toggle("hidden",profile.role!=="admin"));
      goPage("dashboard");
      return;
    }catch(error){
      console.error("Supabase login error:",error);
      $("#loginError").textContent=loginErrorMessage(error);
      $("#loginError").classList.remove("hidden");
      return;
    }
  }

  const user=state.data.users.find(u=>u.username===username&&u.password===password&&u.role===state.selectedRole);
  if(!user){$("#loginError").textContent="Incorrect username/email or password.";$("#loginError").classList.remove("hidden");return}
  $("#loginError").classList.add("hidden");state.onlineMode=false;state.currentUser=user;$("#loginView").classList.add("hidden");$("#mainView").classList.remove("hidden");$("#activeUsername").textContent=user.username;$("#activeRole").textContent=user.role;$$('.admin-only').forEach(item=>item.classList.toggle("hidden",user.role!=="admin"));goPage("dashboard");saveSession()
}
async function logout(){
  if(state.onlineMode&&window.HPHSupabase?.ready){try{await HPHSupabase.signOut()}catch(e){console.warn(e)}}
  state.currentUser=null;state.onlineMode=false;clearSession();sessionStorage.removeItem("hphActivePage");$("#mainView").classList.add("hidden");$("#loginView").classList.remove("hidden");$("#loginPassword").value=""
}
function goPage(page){state.activePage=page;sessionStorage.setItem("hphActivePage",page);$$('.page').forEach(section=>section.classList.remove("active"));$(`#page-${page}`)?.classList.add("active");$$('.nav-item').forEach(btn=>btn.classList.toggle("active",btn.dataset.page===page));if(page==="dashboard")renderDashboard();if(page==="clients")renderClients();if(page==="plots")renderPlots();if(page==="payments")renderPaymentsPage();if(page==="dues")renderDuesPage();if(page==="documents")renderDocumentsPage();if(page==="reports")renderReports();if(page==="sellers")renderSellers();if(page==="users")renderUsers();if(state.currentUser)saveSession()}
function renderDashboard(){
  if(ensureSecurityDuesForAllSoldPlots()) saveData();
  const clients=state.data.clients;
  const plots=state.data.plots;
  const soldPlots=plots.filter(plot=>plot.availabilityStatus==="sold");
  const availablePlots=plots.filter(plot=>plot.availabilityStatus==="available");
  const totalValue=soldPlots.reduce((sum,p)=>sum+Number(p.price||0),0)||clients.reduce((sum,c)=>sum+Number(c.totalAmount||0),0);
  const received=soldPlots.reduce((sum,p)=>sum+Number(p.amountReceived||0),0)||clients.reduce((sum,c)=>sum+displayReceivedAmount(c),0);
  const remaining=Math.max(0,totalValue-received);
  const unpaidDues=state.data.dues.filter(due=>!due.paid);
  const dueReceivable=unpaidDues.reduce((sum,due)=>sum+Math.max(0,Number(due.amount||0)-Number(due.discountAmount||0)),0);
  const clientsWithRemainingDues=new Set(unpaidDues
    .filter(due=>Math.max(0,Number(due.amount||0)-Number(due.discountAmount||0))>0)
    .map(due=>due.clientId)
    .filter(Boolean)
  ).size;

  $("#statsGrid").innerHTML=[
    ["Clients",clients.length],
    ["Sold Plot Value",`Rs ${formatMoney(totalValue)}`],
    ["Remaining Value",`Rs ${formatMoney(remaining)}`],
    ["Available Plots",availablePlots.length],
    ["Clients With Dues",clientsWithRemainingDues],
    ["Dues Receivable",`Rs ${formatMoney(dueReceivable)}`],
    ["Projects",state.data.projects.length],
    ["Sellers",state.data.sellers.length]
  ].map(([label,value])=>`<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join("");

  const query=($("#dashboardSearchInput")?.value||"").toLowerCase().trim();
  let list=sortClientsList(clients);
  if(query){
    list=list.filter(client=>[client.nameEn,client.nameUr,client.fatherEn,client.fatherUr,client.cnic,client.phone].join(" ").toLowerCase().includes(query));
  }

  $("#dashboardClientsBody").innerHTML=list.length?list.map(client=>{
    const agg=clientAggregate(client);
    return `<tr>
      <td><strong>${escapeHtml(client.nameEn||"-")}</strong><br><span class="muted urdu-text">${escapeHtml(client.nameUr||"")}</span></td>
      <td>${escapeHtml(client.cnic||"-")}</td>
      <td>${escapeHtml(agg.plotLabels.join(", ")||client.plotNo||"-")}</td>
      <td>Rs ${formatMoney(agg.received)}</td>
      <td>Rs ${formatMoney(agg.remaining)}</td>
      <td><span class="badge gray">${aggregateConstructionStatusLabel(agg.constructionStatuses.length?agg.constructionStatuses:[client.constructionStatus])}</span></td>
      <td><div class="row-actions">
        <button class="btn small-btn" type="button" data-dashboard-view="${client.id}">View</button>
        <button class="btn small-btn" type="button" data-dashboard-edit="${client.id}">Edit</button>
        <button class="btn small-btn" type="button" data-dashboard-delete="${client.id}">Delete</button>
        <button class="btn small-btn" type="button" data-dashboard-payments="${client.id}">Payments</button>
        <button class="btn small-btn" type="button" data-dashboard-dues="${client.id}">Dues</button>
      </div></td>
    </tr>`;
  }).join(""):`<tr><td colspan="7" class="muted">No dashboard records found.</td></tr>`;
}

function getSoldPlotsForClient(clientId){return sortPlotsList(state.data.plots).filter(plot=>plot.availabilityStatus==="sold"&&plot.linkedClientId===clientId)}
function getPaymentsForPlot(plotId){return state.data.payments.filter(payment=>payment.plotId===plotId).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.createdAt||"").localeCompare(String(b.createdAt||"")))}
function paymentTypeLabel(type){return type==="exchange"?"Exchange":"Cash Payment"}
function recalculatePlotPayment(plot){if(!plot||plot.availabilityStatus!=="sold")return;const price=Number(plot.price||0);const received=Number(plot.amountReceived||0);plot.paymentStatus=price>0&&received>=price?"fully_paid":received>0?"partially_paid":"to_be_paid";plot.updatedAt=new Date().toISOString()}
function openPaymentsPage(clientId,plotId=null){
  const client=state.data.clients.find(c=>c.id===clientId);
  if(!client){alert("Client not found.");return}
  const plots=getSoldPlotsForClient(clientId);
  if(!plots.length){alert("This client has no sold/linked plots yet. Payments are handled plot by plot.");return}
  state.activePaymentClientId=clientId;
  state.activePaymentPlotId=plotId&&plots.some(p=>p.id===plotId)?plotId:plots[0].id;
  goPage("payments");
  renderPaymentsPage();
}
function openPaymentsPlaceholder(clientId){openPaymentsPage(clientId)}

function getDuesForPlot(plotId){return state.data.dues.filter(due=>due.plotId===plotId).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.createdAt||"").localeCompare(String(b.createdAt||"")))}
function dueRemainingAmount(due){if(due.status==="waived")return 0;return Math.max(0,Number(due.amount||0)-Number(due.discountAmount||0))}
function dueStatusLabel(due){if(due.status==="waived")return "Waived";if(due.paid)return "Paid";if(Number(due.discountAmount||0)>0)return "Discounted";return "Unpaid"}
function dueStatusBadgeClass(due){if(due.paid||due.status==="waived")return "green";if(Number(due.discountAmount||0)>0)return "yellow";return "gray"}
function currentMonth(){return new Date().toISOString().slice(0,7)}
function monthRange(startMonth,endMonth){const out=[];if(!startMonth||!endMonth)return out;let [y,m]=startMonth.split("-").map(Number);const [ey,em]=endMonth.split("-").map(Number);while(y<ey||(y===ey&&m<=em)){out.push(`${y}-${String(m).padStart(2,"0")}`);m++;if(m>12){m=1;y++}}return out}
function ensureSecurityDuesForPlot(plot){
  if(!plot||plot.availabilityStatus!=="sold"||!plot.linkedClientId)return false;
  let changed=false;
  const start=(plot.dealDate||plot.createdAt||new Date().toISOString()).slice(0,7);
  const end=currentMonth();
  monthRange(start,end).forEach(month=>{
    const exists=state.data.dues.some(d=>d.plotId===plot.id&&String(d.type||"").toLowerCase()==="security fee"&&d.date===month);
    if(!exists){
      state.data.dues.push({id:uid("due"),clientId:plot.linkedClientId,plotId:plot.id,type:"Security Fee",amount:500,discountAmount:0,date:month,paid:false,paidDate:"",status:"unpaid",note:"Auto monthly security fee",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      changed=true;
    }
  });
  return changed;
}
function ensureSecurityDuesForAllSoldPlots(){
  let changed=false;
  state.data.plots.filter(plot=>plot.availabilityStatus==="sold"&&plot.linkedClientId).forEach(plot=>{
    if(ensureSecurityDuesForPlot(plot)) changed=true;
  });
  return changed;
}
function openDuesPage(clientId,plotId=null){
  const client=state.data.clients.find(c=>c.id===clientId);
  if(!client){alert("Client not found.");return}
  const plots=sortPlotsList(getClientPlots(clientId).filter(plot=>plot.availabilityStatus==="sold"));
  if(!plots.length){alert("This client has no sold/linked plots yet. Dues are handled plot by plot.");return}
  plots.forEach(ensureSecurityDuesForPlot);
  saveData();
  state.activeDueClientId=clientId;
  state.activeDuePlotId=plotId&&plots.some(p=>p.id===plotId)?plotId:plots[0].id;
  goPage("dues");
  renderDuesPage();
}
function openDuesPlaceholder(clientId){openDuesPage(clientId)}
function renderProjectsDropdown(selectedName="",selector="#clientProject"){const options=state.data.projects.map(project=>`<option value="${escapeHtml(project.name)}" ${project.name===selectedName?"selected":""}>${escapeHtml(project.name)}</option>`).join("");const el=$(selector);if(el)el.innerHTML=options}
function addProject(targetSelector="#clientProject"){const name=prompt("Enter new project name:");if(!name||!name.trim())return;const cleanName=name.trim();const exists=state.data.projects.some(p=>p.name.toLowerCase()===cleanName.toLowerCase());if(exists){alert("This project already exists.");const existing=state.data.projects.find(p=>p.name.toLowerCase()===cleanName.toLowerCase()).name;renderProjectsDropdown(existing,"#clientProject");renderProjectsDropdown(existing,"#plotProject");const target=$(targetSelector);if(target)target.value=existing;if(targetSelector==="#clientProject")renderAvailablePlotSelect();return}state.data.projects.push({id:uid("project"),name:cleanName,createdAt:new Date().toISOString()});saveData();renderProjectsDropdown(cleanName,"#clientProject");renderProjectsDropdown(cleanName,"#plotProject");const target=$(targetSelector);if(target)target.value=cleanName;if(targetSelector==="#clientProject")renderAvailablePlotSelect()}
function getAvailablePlotsForProject(projectName){return sortPlotsList(state.data.plots).filter(plot=>plot.availabilityStatus==="available"&&plot.projectName===projectName)}
function renderAvailablePlotSelect(selectedPlotId=""){const select=$("#clientAssignedPlot");if(!select)return;const project=$("#clientProject")?.value||state.data.projects[0]?.name||"";const available=getAvailablePlotsForProject(project);select.innerHTML=`<option value="">No plot selected</option>`+available.map(plot=>`<option value="${escapeHtml(plot.id)}" ${plot.id===selectedPlotId?"selected":""}>${escapeHtml(plot.plotNo)} · ${escapeHtml(plot.plotSizeMarla||0)} marla · ${escapeHtml(plot.propertyType||"")}</option>`).join("");}
function openClientModal(clientId=null){
  const client=clientId?state.data.clients.find(c=>c.id===clientId):null;
  $("#clientModalTitle").textContent=client?"Edit Client":"Add Client";
  $("#clientForm").reset();
  $("#clientId").value=client?.id||"";
  renderProjectsDropdown(state.data.projects[0]?.name||"","#clientProject");
  if(client){
    $("#clientNameEn").value=client.nameEn||"";
    $("#clientNameUr").value=client.nameUr||"";
    $("#clientFatherEn").value=client.fatherEn||"";
    $("#clientFatherUr").value=client.fatherUr||"";
    $("#clientCnic").value=client.cnic||"";
    $("#clientPhone").value=client.phone||"";
    $("#clientAddressEn").value=client.addressEn||"";
    $("#clientAddressUr").value=client.addressUr||"";
    $("#clientNotes").value=client.notes||"";
  }
  renderAvailablePlotSelect();
  $("#clientModal").classList.remove("hidden");
}
function closeClientModal(){$("#clientModal").classList.add("hidden")}
function assignSelectedPlotToClient(clientId){
  const plotId=$("#clientAssignedPlot")?.value||"";
  if(!plotId)return;
  const plot=state.data.plots.find(p=>p.id===plotId);
  if(!plot)return;
  const price=parseMoney($("#clientTotalAmount").value);
  let amountReceived=parseMoney($("#clientTokenAmount").value);
  const paymentStatus=calculateClientPaymentStatus(price,amountReceived,$("#clientFullyPaid").checked);
  if(paymentStatus==="fully_paid"&&price>0)amountReceived=price;
  plot.availabilityStatus="sold";
  plot.linkedClientId=clientId;
  plot.sourceClientId=null;
  plot.intikalNo=$("#clientIntikalNo")?.value.trim() || "";
  plot.price=price;
  plot.amountReceived=amountReceived;
  plot.paymentStatus=paymentStatus;
  plot.dealDate=$("#clientDealDate").value;
  const saleNotes=$("#clientNotes").value.trim();
  if(saleNotes)plot.notes=saleNotes;
  plot.updatedAt=new Date().toISOString();
  ensureSecurityDuesForPlot(plot);
}
function saveClient(event){
  event.preventDefault();
  const id=$("#clientId").value||uid("client");
  const now=new Date().toISOString();
  const existing=state.data.clients.find(c=>c.id===id);
  const client={
    id,
    nameEn:$("#clientNameEn").value.trim(),
    nameUr:$("#clientNameUr").value.trim(),
    fatherEn:$("#clientFatherEn").value.trim(),
    fatherUr:$("#clientFatherUr").value.trim(),
    cnic:$("#clientCnic").value.trim(),
    phone:$("#clientPhone").value.trim(),
    addressEn:$("#clientAddressEn").value.trim(),
    addressUr:$("#clientAddressUr").value.trim(),
    notes:$("#clientNotes").value.trim(),
    createdAt:existing?.createdAt||now,
    updatedAt:now
  };
  if(!client.nameEn){alert("Client name in English is required.");return}
  const index=state.data.clients.findIndex(c=>c.id===id);
  if(index>=0)state.data.clients[index]=client;else state.data.clients.push(client);
  assignSelectedPlotToClient(id);
  saveData();closeClientModal();renderClients();renderDashboard();renderPlots();
}
function resetPlotAfterClientDelete(plot){
  plot.availabilityStatus="available";
  plot.linkedClientId="";
  plot.sourceClientId=null;
  plot.intikalNo="";
  plot.price=0;
  plot.amountReceived=0;
  plot.paymentStatus="";
  plot.dealDate="";
  plot.updatedAt=new Date().toISOString();
}
function deleteClient(id){
  const client=state.data.clients.find(c=>c.id===id);if(!client)return;
  const linkedPlots=getClientPlots(id);
  const linkedPlotIds=linkedPlots.map(plot=>plot.id);
  const message=linkedPlots.length?`Delete client "${client.nameEn}"? This client is linked to ${linkedPlots.length} plot(s). Confirming will unlink those plots, remove their sale/payment data, remove intikal numbers, delete related payment records, delete related dues, and mark the plots as Available.`:`Delete client "${client.nameEn}"? This cannot be undone.`;
  if(!confirm(message))return;

  // Remove financial records tied to this client/these plots before resetting plots.
  // Otherwise dashboard dues/payment totals can still count records for a deleted client.
  state.data.dues=state.data.dues.filter(due=>due.clientId!==id && !linkedPlotIds.includes(due.plotId));
  state.data.payments=state.data.payments.filter(payment=>payment.clientId!==id && !linkedPlotIds.includes(payment.plotId));

  linkedPlots.forEach(resetPlotAfterClientDelete);
  state.data.clients=state.data.clients.filter(c=>c.id!==id);
  saveData();renderClients();renderDashboard();renderPlots();
}
function viewClient(id){
  const client=state.data.clients.find(c=>c.id===id);
  if(!client)return;
  const agg=clientAggregate(client);
  $("#viewClientTitle").textContent=client.nameEn;
  $("#viewClientBody").className="details-content";

  const field=(label,value,extra="")=>`<div class="detail-item ${extra}"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(value||"-")}</div></div>`;
  const section=(title,content)=>`<section class="detail-section"><h4 class="detail-section-title">${escapeHtml(title)}</h4>${content}</section>`;

  const clientInfo=`<div class="detail-grid two-col">
    ${field("Name English",client.nameEn)}
    ${field("Name Urdu",client.nameUr)}
    ${field("Father English",client.fatherEn)}
    ${field("Father Urdu",client.fatherUr)}
    ${field("CNIC",client.cnic)}
    ${field("Phone",client.phone)}
    ${field("Address English",client.addressEn,"full")}
    ${field("Address Urdu",client.addressUr,"full urdu-text")}
  </div>`;

  const summary=`<div class="summary-grid">
    ${field("Total Plots",String(agg.plots.length || (client.plotNo?1:0)))}
    ${field("Total Value",`Rs ${formatMoney(agg.total)}`)}
    ${field("Received",`Rs ${formatMoney(agg.received)}`)}
    ${field("Remaining",`Rs ${formatMoney(agg.remaining)}`)}
  </div>`;

  const plots = agg.plots.length ? sortPlotsList(agg.plots) : [{
    plotNo:client.plotNo,projectName:client.projectName,intikalNo:client.intikalNo,plotSizeMarla:client.plotSizeMarla,
    khasraNo:client.khasraNo||"",khatauniNo:client.khatauniNo||"",transferredFrom:client.transferredFrom||"",propertyType:client.propertyType,constructionStatus:client.constructionStatus,
    paymentStatus:client.paymentStatus,price:client.totalAmount,amountReceived:displayReceivedAmount(client)
  }];

  const plotsHtml=plots.filter(p=>p.plotNo).map((plot,index)=>{
    const remaining=Math.max(0,Number(plot.price||0)-Number(plot.amountReceived||0));
    return `<section class="plot-detail-card">
      <h4>Plot ${index+1} — ${escapeHtml(plot.plotNo||"-")}</h4>
      <div class="detail-grid two-col">
        ${field("Project",plot.projectName)}
        ${field("Intikal",plot.intikalNo||"-")}
        ${field("Size",`${plot.plotSizeMarla||0} marla`)}
        ${field("Khasra #",plot.khasraNo||"-")}
        ${field("Khatauni #",plot.khatauniNo||"-")}
        ${field("Transferred From",plot.transferredFrom||"-")}
        ${field("Type",plot.propertyType||"-")}
        ${field("Construction",constructionStatusLabel(plot.constructionStatus))}
        ${field("Payment",paymentStatusLabel(plot.paymentStatus))}
        ${field("Price",`Rs ${formatMoney(plot.price)}`)}
        ${field("Received",`Rs ${formatMoney(plot.amountReceived)}`)}
        ${field("Remaining",`Rs ${formatMoney(remaining)}`)}
      </div>
    </section>`;
  }).join("") || `<div class="empty-state">No plots linked to this client yet.</div>`;

  $("#viewClientBody").innerHTML=section("Client Information",clientInfo)+section("Summary",summary)+section("Plots Owned",plotsHtml);
  $("#viewClientModal").classList.remove("hidden");
}
function closeViewClientModal(){$("#viewClientModal").classList.add("hidden")}
function renderClients(){
  const query=($("#clientSearchInput").value||"").toLowerCase().trim();
  const construction=$("#clientConstructionFilter").value;
  const payment=$("#clientPaymentFilter").value;
  let clients=sortClientsList(state.data.clients);
  if(query){
    clients=clients.filter(client=>[client.nameEn,client.nameUr,client.fatherEn,client.fatherUr,client.cnic,client.phone,client.addressEn,client.addressUr].join(" ").toLowerCase().includes(query));
  }
  if(construction!=="all"){
    clients=clients.filter(client=>{
      const agg=clientAggregate(client);
      const statuses=agg.constructionStatuses.length?agg.constructionStatuses:[client.constructionStatus];
      return statuses.includes(construction);
    });
  }
  if(payment!=="all"){
    clients=clients.filter(client=>{
      const agg=clientAggregate(client);
      const statuses=agg.paymentStatuses.length?agg.paymentStatuses:[normalizePaymentStatus(client.paymentStatus)];
      return statuses.map(normalizePaymentStatus).includes(payment);
    });
  }
  $("#clientsTableBody").innerHTML=clients.length?clients.map(client=>{
    const agg=clientAggregate(client);
    const plotText=agg.plotLabels.join(", ")||client.plotNo||"-";
    const sizeText=agg.sizeLabels.join(", ")||`${client.plotSizeMarla||0} marla`;
    const typeText=agg.typeLabels.join(", ")||client.propertyType||"-";
    const paymentStatuses=agg.paymentStatuses.length?agg.paymentStatuses:[client.paymentStatus];
    const constructionStatuses=agg.constructionStatuses.length?agg.constructionStatuses:[client.constructionStatus];
    return `<tr>
      <td><strong>${escapeHtml(client.nameEn)}</strong><div class="muted">${escapeHtml(client.nameUr||"")}</div></td>
      <td>${escapeHtml(client.fatherEn||"-")}</td>
      <td>${escapeHtml(client.cnic||"-")}</td>
      <td>${escapeHtml(client.phone||"-")}</td>
      <td>${escapeHtml(client.addressEn||client.addressUr||"-")}</td>
      <td>${escapeHtml(plotText)}</td>
      <td>${escapeHtml(sizeText)}</td>
      <td>${escapeHtml(typeText)}</td>
      <td><span class="badge ${badgeClass(paymentStatuses[0])}">${aggregatePaymentStatusLabel(paymentStatuses)}</span></td>
      <td><span class="badge ${badgeClass(constructionStatuses[0])}">${aggregateConstructionStatusLabel(constructionStatuses)}</span></td>
      <td><div class="row-actions"><button class="btn small-btn" type="button" data-view-client="${client.id}">View</button><button class="btn small-btn" type="button" data-edit-client="${client.id}">Edit</button><button class="btn small-btn" type="button" data-delete-client="${client.id}">Delete</button></div></td>
    </tr>`;
  }).join(""):`<tr><td colspan="13" class="muted">No clients found.</td></tr>`;
}

function renderPaymentPlotSelect(){
  const select=$("#paymentPlotSelect");
  if(!select)return;
  const plots=getSoldPlotsForClient(state.activePaymentClientId);
  select.innerHTML=plots.map(plot=>`<option value="${escapeHtml(plot.id)}" ${plot.id===state.activePaymentPlotId?"selected":""}>${escapeHtml(plot.projectName)} · ${escapeHtml(plot.plotNo)} · ${formatMoney(plot.plotSizeMarla)} marla</option>`).join("");
}
function renderPaymentsPage(){
  if(state.activePage!=="payments")return;
  const client=state.data.clients.find(c=>c.id===state.activePaymentClientId);
  const plots=getSoldPlotsForClient(state.activePaymentClientId);
  if(!client||!plots.length){
    $("#paymentsPageTitle").textContent="Payments";
    $("#paymentsPageSubtitle").textContent="No client/plot selected.";
    $("#paymentSummaryGrid").innerHTML="";
    $("#paymentsTableBody").innerHTML='<tr><td colspan="6" class="muted">No payment record selected.</td></tr>';
    return;
  }
  if(!state.activePaymentPlotId||!plots.some(p=>p.id===state.activePaymentPlotId))state.activePaymentPlotId=plots[0].id;
  const plot=state.data.plots.find(p=>p.id===state.activePaymentPlotId);
  renderPaymentPlotSelect();
  const received=Number(plot.amountReceived||0);
  const price=Number(plot.price||0);
  const remaining=Math.max(0,price-received);
  $("#paymentsPageTitle").textContent=`Payments — ${client.nameEn}`;
  $("#paymentsPageSubtitle").textContent=`Plot ${plot.plotNo} · ${plot.projectName}`;
  $("#paymentSummaryGrid").innerHTML=[
    ["Client",client.nameEn||"-"],
    ["Plot",plot.plotNo||"-"],
    ["Total Price",`Rs ${formatMoney(price)}`],
    ["Received",`Rs ${formatMoney(received)}`],
    ["Remaining",`Rs ${formatMoney(remaining)}`],
    ["Payment Status",paymentStatusLabel(plot.paymentStatus)],
    ["Intikal",plot.intikalNo||"-"],
    ["Project",plot.projectName||"-"]
  ].map(([label,value])=>`<div class="stat-card"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value" style="font-size:1rem">${escapeHtml(value)}</div></div>`).join("");
  const rows=getPaymentsForPlot(plot.id);
  $("#paymentsTableBody").innerHTML=rows.length?rows.map(payment=>`<tr>
    <td><span class="badge ${payment.type==="exchange"?"payment-type-exchange":"payment-type-cash"}">${paymentTypeLabel(payment.type)}</span></td>
    <td>Rs ${formatMoney(payment.amount)}</td>
    <td>${escapeHtml(payment.date||"-")}</td>
    <td>${escapeHtml(payment.exchangeItem||"-")}</td>
    <td>${escapeHtml(payment.note||"-")}</td>
    <td><div class="row-actions"><button class="btn small-btn" type="button" data-delete-payment="${payment.id}">Delete</button></div></td>
  </tr>`).join(""):'<tr><td colspan="6" class="muted">No additional payments yet. Use Add Payment or Add Exchange.</td></tr>';
}
function openPaymentModal(type="cash"){
  const plot=state.data.plots.find(p=>p.id===state.activePaymentPlotId);
  if(!plot){alert("Select a plot first.");return}
  $("#paymentForm").reset();
  $("#paymentId").value="";
  $("#paymentType").value=type;
  $("#paymentDate").value=new Date().toISOString().slice(0,10);
  $("#paymentModalTitle").textContent=type==="exchange"?"Add Exchange Payment":"Add Cash Payment";
  $("#exchangeItemLabel").classList.toggle("hidden",type!=="exchange");
  $("#paymentModal").classList.remove("hidden");
}
function closePaymentModal(){$("#paymentModal").classList.add("hidden")}
function savePayment(event){
  event.preventDefault();
  const client=state.data.clients.find(c=>c.id===state.activePaymentClientId);
  const plot=state.data.plots.find(p=>p.id===state.activePaymentPlotId);
  if(!client||!plot){alert("Client or plot not found. Refresh the app and try again before adding this payment.");return}
  if(state.onlineMode){
    if(!client.id||!plot.id){alert("This payment cannot be saved until the client and plot are saved online. Refresh the app and try again.");return}
    if(plot.linkedClientId && plot.linkedClientId!==client.id){alert("This plot is not linked to the selected client. Refresh the app before adding payment.");return}
  }
  const type=$("#paymentType").value||"cash";
  const amount=parseMoney($("#paymentAmount").value);
  if(!amount){alert("Enter the payment amount or exchange value.");return}
  const exchangeItem=$("#paymentExchangeItem").value.trim();
  if(type==="exchange"&&!exchangeItem){alert("Enter what was exchanged, for example car, plot, or other item.");return}
  const payment={id:uid("payment"),clientId:client.id,plotId:plot.id,type,amount,date:$("#paymentDate").value,note:$("#paymentNote").value.trim(),exchangeItem:type==="exchange"?exchangeItem:"",createdAt:new Date().toISOString()};
  state.data.payments.push(payment);
  plot.amountReceived=Number(plot.amountReceived||0)+amount;
  recalculatePlotPayment(plot);
  saveData();
  closePaymentModal();
  renderPaymentsPage();
  renderDashboard();
  renderClients();
  renderPlots();
}
function deletePayment(id){
  const payment=state.data.payments.find(p=>p.id===id);
  if(!payment)return;
  if(!confirm("Delete this payment? The plot received amount will be reduced."))return;
  const plot=state.data.plots.find(p=>p.id===payment.plotId);
  if(plot){plot.amountReceived=Math.max(0,Number(plot.amountReceived||0)-Number(payment.amount||0));recalculatePlotPayment(plot)}
  state.data.payments=state.data.payments.filter(p=>p.id!==id);
  saveData();renderPaymentsPage();renderDashboard();renderClients();renderPlots();
}

function prepareTextForTranslation(value){
  return String(value||"")
    .replace(/([A-Za-z])([0-9])/g,"$1 $2")
    .replace(/([0-9])([A-Za-z])/g,"$1 $2")
    .replace(/[,_]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function hasUrdu(text){return /[؀-ۿ]/.test(String(text||""))}
const URDU_NAME_MAP={
  haris:"حارث",harris:"حارث",haaris:"حارث",
  ali:"علی",umer:"عمر",omer:"عمر",omar:"عمر",umar:"عمر",
  khan:"خان",noor:"نور",adnan:"عدنان",danial:"دانیال",daniel:"دانیال",
  majeed:"مجید",majid:"مجید",chheenah:"چینہ",cheena:"چینہ",china:"چینہ",
  rizwan:"رضوان",ashraf:"اشرف",hassan:"حسن",hasan:"حسن",
  malik:"ملک",ahmed:"احمد",ahmad:"احمد",muhammad:"محمد",mohammad:"محمد",
  bilal:"بلال",hamza:"حمزہ",zain:"زین",usman:"عثمان",osman:"عثمان",
  waqas:"وقاص",imran:"عمران",rehman:"رحمان",rahman:"رحمان",
  abdul:"عبد",kareem:"کریم",karim:"کریم",asif:"آصف",arif:"عارف",
  yousaf:"یوسف",yousuf:"یوسف",yusuf:"یوسف",ibrahim:"ابراہیم",ismail:"اسماعیل",
  irfan:"عرفان",nadeem:"ندیم",naeem:"نعیم",saeed:"سعید",saleem:"سلیم",
  farhan:"فرحان",faizan:"فیضان",faisal:"فیصل",shahid:"شاہد",shahzad:"شہزاد",
  amjad:"امجد",akram:"اکرم",ikram:"اکرام",tariq:"طارق",rashid:"راشد",
  naveed:"نوید",javed:"جاوید",jawad:"جواد",sajid:"ساجد",majid:"مجید"
};
const URDU_NAME_POST_CORRECTIONS={
  "ہارس":"حارث","حارس":"حارث","ہیریس":"حارث",
  "علی خان":"علی خان","اومر":"عمر","عومر":"عمر","ماجد":"مجید",
  "دنיאל":"دانیال","ڈینیئل":"دانیال","چینا":"چینہ","چیناھ":"چینہ"
};
function isPersonalNameField(sourceId){
  const id=String(sourceId||"").toLowerCase();
  return (id.includes("name")||id.includes("father")) && !id.includes("address");
}
function translateKnownNamePhrase(value){
  const clean=prepareTextForTranslation(value);
  if(!clean)return "";
  const parts=clean.split(/(\s+|-)/);
  let hasKnown=false;
  let hasUnknown=false;
  const out=parts.map(part=>{
    if(/^\s+$/.test(part)||part==="-")return part;
    const key=part.toLowerCase().replace(/[^a-z]/g,"");
    if(URDU_NAME_MAP[key]){hasKnown=true;return URDU_NAME_MAP[key]}
    if(key){hasUnknown=true}
    return part;
  }).join("").trim();
  return hasKnown&&!hasUnknown?out:"";
}
function applyNameCorrections(translated){
  let out=String(translated||"");
  for(const [wrong,right] of Object.entries(URDU_NAME_POST_CORRECTIONS)){
    out=out.replaceAll(wrong,right);
  }
  return out;
}
function basicUrduAddressFallback(value){
  const replacements={
    house:"مکان", street:"اسٹریٹ", road:"روڈ", sector:"سیکٹر", colony:"کالونی",
    phase:"فیز", block:"بلاک", plot:"پلاٹ", islamabad:"اسلام آباد", rawalpindi:"راولپنڈی",
    bara:"بارہ", kahu:"کہو", khau:"کھاؤ", main:"مین", murree:"مری"
  };
  return prepareTextForTranslation(value).split(/(\s+)/).map(part=>replacements[part.toLowerCase()]||part).join("");
}
async function translateWithMyMemory(text){
  const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ur`;
  const response=await fetch(url);
  if(!response.ok)throw new Error("MyMemory translation request failed");
  const data=await response.json();
  return data?.responseData?.translatedText||"";
}
async function translateWithGooglePublic(text){
  const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ur&dt=t&q=${encodeURIComponent(text)}`;
  const response=await fetch(url);
  if(!response.ok)throw new Error("Google translation request failed");
  const data=await response.json();
  return Array.isArray(data?.[0]) ? data[0].map(part=>part?.[0]||"").join("") : "";
}
async function translateText(sourceId,targetId){
  const source=$(`#${sourceId}`);
  const target=$(`#${targetId}`);
  if(!source||!target)return;
  const originalValue=source.value.trim();
  if(!originalValue){alert("Type English text first, then click Translate.");return}
  let value=prepareTextForTranslation(originalValue);
  const isAddress=sourceId.toLowerCase().includes("address");
  const isName=isPersonalNameField(sourceId);
  const existing=target.value.trim();
  if(existing && hasUrdu(existing)){
    if(!confirm("This Urdu field already has text. Replace it with a new translation?"))return;
  }
  const button=document.querySelector(`[data-translate="${sourceId}:${targetId}"]`);
  const oldText=button?button.textContent:"Translate";
  if(button){button.textContent="Translating...";button.disabled=true}
  try{
    let translated="";
    if(isName){
      translated=translateKnownNamePhrase(value);
    }
    if(!translated){
      try{translated=await translateWithMyMemory(value)}catch(e){console.warn("MyMemory failed, trying backup translator",e)}
      const sameOrEmpty=!translated || translated.trim().toLowerCase()===value.trim().toLowerCase() || !hasUrdu(translated);
      if(sameOrEmpty){
        try{translated=await translateWithGooglePublic(value)}catch(e){console.warn("Backup translator failed",e)}
      }
    }
    if(isName && translated){translated=applyNameCorrections(translated)}
    if((!translated || !hasUrdu(translated)) && isAddress){translated=basicUrduAddressFallback(value)}
    if(!translated){throw new Error("No translation returned")}
    target.value=translated;
  }catch(error){
    console.error("Translation failed:",error);
    if(isAddress){
      target.value=basicUrduAddressFallback(value);
      alert("Online translation failed, so I used a basic address fallback. You can edit the Urdu address manually.");
    }else{
      alert("Translation failed. Please check your internet connection or type Urdu manually.");
    }
  }finally{
    if(button){button.textContent=oldText;button.disabled=false}
  }
}

function renderClientDropdown(selectedId=""){const options=state.data.clients.map(client=>`<option value="${client.id}" ${client.id===selectedId?"selected":""}>${escapeHtml(clientOptionLabel(client))}</option>`).join("");$("#plotLinkedClient").innerHTML=`<option value="">No linked client</option>${options}`}
function openPlotModal(plotId=null){const plot=plotId?state.data.plots.find(p=>p.id===plotId):null;$("#plotModalTitle").textContent=plot?"Edit Plot":"Add Plot";$("#plotForm").reset();$("#plotId").value=plot?.id||"";renderProjectsDropdown(plot?.projectName||state.data.projects[0]?.name||"","#plotProject");renderClientDropdown(plot?.linkedClientId||"");if(plot){$("#plotProject").value=plot.projectName||"";$("#plotNo").value=plot.plotNo||"";$("#plotIntikalNo").value=plot.intikalNo||"";$("#plotSize").value=plot.plotSize||"";$("#plotUnit").value=plot.plotUnit||"Marla";$("#plotKhasraNo").value=plot.khasraNo||"";$("#plotKhatauniNo").value=plot.khatauniNo||"";$("#plotTransferredFrom").value=plot.transferredFrom||"";$("#plotPropertyType").value=plot.propertyType||"Residential";$("#plotConstructionStatus").value=plot.constructionStatus||"plot";$("#plotAvailabilityStatus").value=plot.availabilityStatus||"available";$("#plotLinkedClient").value=plot.linkedClientId||"";$("#plotPrice").value=plot.price?formatMoney(plot.price):"";$("#plotTokenAmount").value=plot.amountReceived?formatMoney(plot.amountReceived):"";$("#plotFullyPaid").checked=normalizePaymentStatus(plot.paymentStatus)==="fully_paid";$("#plotNotes").value=plot.notes||""}updatePlotSoldFields();updatePlotSizePreview();$("#plotModal").classList.remove("hidden")}
function closePlotModal(){$("#plotModal").classList.add("hidden")}
function updatePlotSoldFields(){const sold=$("#plotAvailabilityStatus").value==="sold";$("#soldPlotFields").classList.toggle("hidden",!sold)}
function updatePlotSizePreview(){const size=$("#plotSize").value;const unit=$("#plotUnit").value;if(!size){$("#plotSizePreview").textContent="";return}$("#plotSizePreview").textContent=`Converted size: ${toMarla(size,unit).toFixed(2)} marla`}
function savePlot(event){event.preventDefault();const id=$("#plotId").value||uid("plot");const now=new Date().toISOString();const existing=state.data.plots.find(p=>p.id===id);const availability=$("#plotAvailabilityStatus").value;const price=parseMoney($("#plotPrice").value);let amountReceived=parseMoney($("#plotTokenAmount").value);let paymentStatus="to_be_paid";if(availability==="sold"){paymentStatus=calculateClientPaymentStatus(price,amountReceived,$("#plotFullyPaid").checked);if(paymentStatus==="fully_paid"&&price>0)amountReceived=price}else{amountReceived=0;paymentStatus=""}
const plot={id,sourceClientId:existing?.sourceClientId||null,projectName:$("#plotProject").value,plotNo:formatPlotNo($("#plotNo").value),intikalNo:$("#plotIntikalNo").value.trim(),plotSize:$("#plotSize").value,plotUnit:$("#plotUnit").value,plotSizeMarla:Number(toMarla($("#plotSize").value,$("#plotUnit").value).toFixed(2)),khasraNo:$("#plotKhasraNo").value.trim(),khatauniNo:$("#plotKhatauniNo").value.trim(),transferredFrom:$("#plotTransferredFrom").value.trim(),propertyType:$("#plotPropertyType").value,constructionStatus:$("#plotConstructionStatus").value,availabilityStatus:availability,linkedClientId:availability==="sold"?$("#plotLinkedClient").value:"",price:availability==="sold"?price:0,amountReceived,paymentStatus,notes:$("#plotNotes").value.trim(),createdAt:existing?.createdAt||now,updatedAt:now};
if(!plot.plotNo){alert("Plot number is required.");return}
if(availability==="sold"&&!plot.linkedClientId){if(!confirm("This plot is marked Sold but no client is linked. Save anyway?"))return}
if(existing && existing.availabilityStatus==="sold"){
  const becomingAvailable=availability!=="sold";
  const clientChanged=availability==="sold" && existing.linkedClientId && existing.linkedClientId!==plot.linkedClientId;
  if((becomingAvailable||clientChanged) && (state.data.payments.some(p=>p.plotId===id)||state.data.dues.some(d=>d.plotId===id))){
    const warning=becomingAvailable
      ? "This plot currently has payment/due records. Marking it Available will remove linked payments and dues. Continue?"
      : "Changing the linked client will remove old payment/due records for this plot. Continue?";
    if(!confirm(warning))return;
    removeFinancialsForPlot(id,existing.linkedClientId||"");
  }
  if(becomingAvailable){plot.sourceClientId=null;plot.intikalNo="";plot.price=0;plot.amountReceived=0;plot.paymentStatus="";plot.dealDate="";}
}
const index=state.data.plots.findIndex(p=>p.id===id);if(index>=0)state.data.plots[index]=plot;else state.data.plots.push(plot);if(plot.availabilityStatus==="sold")ensureSecurityDuesForPlot(plot);saveData();closePlotModal();renderPlots();renderClients();renderDashboard()}
function removeFinancialsForPlot(plotId,clientId=""){
  state.data.payments=state.data.payments.filter(payment=>payment.plotId!==plotId && (!clientId || payment.clientId!==clientId));
  state.data.dues=state.data.dues.filter(due=>due.plotId!==plotId && (!clientId || due.clientId!==clientId));
}
function resetPlotSaleData(plot){
  if(!plot)return;
  const clientId=plot.linkedClientId||plot.sourceClientId||"";
  removeFinancialsForPlot(plot.id,clientId);
  plot.sourceClientId=null;
  plot.availabilityStatus="available";
  plot.linkedClientId="";
  plot.intikalNo="";
  plot.price=0;
  plot.amountReceived=0;
  plot.paymentStatus="";
  plot.dealDate="";
  plot.updatedAt=new Date().toISOString();
}
function deletePlot(id){
  const plot=state.data.plots.find(p=>p.id===id);if(!plot)return;
  const linkedClient=plot.linkedClientId?getClientName(plot.linkedClientId):"";
  const message=plot.availabilityStatus==="sold"
    ? `Delete sold plot ${plot.plotNo}? This will remove its linked payments and dues${linkedClient?` for ${linkedClient}`:""}. The client record will not be deleted.`
    : `Delete available plot ${plot.plotNo}?`;
  if(!confirm(message))return;
  removeFinancialsForPlot(plot.id,plot.linkedClientId||"");
  state.data.plots=state.data.plots.filter(p=>p.id!==id);
  saveData();renderPlots();renderClients();renderDashboard();renderPaymentsPage();renderDuesPage();
}
function viewPlot(id){const plot=state.data.plots.find(p=>p.id===id);if(!plot)return;$("#viewPlotTitle").textContent=`Plot ${plot.plotNo}`;const fields=[["Project",plot.projectName],["Plot Number",plot.plotNo],["Intikal Number",plot.intikalNo||"-"],["Size",`${plot.plotSize||"-"} ${plot.plotUnit||""} (${plot.plotSizeMarla||0} marla)`],["Khasra Number",plot.khasraNo||"-"],["Khatauni Number",plot.khatauniNo||"-"],["Transferred From",plot.transferredFrom||"-"],["Type",plot.propertyType],["Construction",constructionStatusLabel(plot.constructionStatus)],["Availability",availabilityStatusLabel(plot.availabilityStatus)],["Linked Client",getClientName(plot.linkedClientId)],["Payment",plot.availabilityStatus==="sold"?paymentStatusLabel(plot.paymentStatus):"-"],["Price",plot.availabilityStatus==="sold"?`Rs ${formatMoney(plot.price)}`:"-"],["Received",plot.availabilityStatus==="sold"?`Rs ${formatMoney(plot.amountReceived)}`:"-"],["Notes",plot.notes||"-","full"]];$("#viewPlotBody").innerHTML=fields.map(([label,value,full])=>`<div class="detail-item ${full==="full"?"full":""}"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(value||"-")}</div></div>`).join("");$("#viewPlotModal").classList.remove("hidden")}
function closeViewPlotModal(){$("#viewPlotModal").classList.add("hidden")}
function renderPlots(){const query=($("#plotSearchInput")?.value||"").toLowerCase().trim();const sizeQuery=($("#plotSizeSearchInput")?.value||"").trim();const availability=$("#plotAvailabilityFilter")?.value||"all";let plots=sortPlotsList(state.data.plots);if(query){plots=plots.filter(plot=>[plot.plotNo,plot.intikalNo,plot.projectName,plot.khasraNo,plot.khatauniNo,plot.transferredFrom,getClientName(plot.linkedClientId)].join(" ").toLowerCase().includes(query))}if(sizeQuery){const wanted=Number(sizeQuery.replace(/[^\d.]/g,""));if(!Number.isNaN(wanted)&&wanted>0){plots=plots.filter(plot=>Number(plot.plotSizeMarla||0)===wanted)}}if(availability!=="all")plots=plots.filter(plot=>plot.availabilityStatus===availability);$("#plotsTableBody").innerHTML=plots.length?plots.map(plot=>`<tr><td><strong>${escapeHtml(plot.plotNo)}</strong></td><td>${escapeHtml(plot.projectName||"-")}</td><td>${escapeHtml(plot.intikalNo||"-")}</td><td>${escapeHtml(plot.plotSizeMarla||0)} marla</td><td>${escapeHtml(plot.khasraNo||"-")}</td><td>${escapeHtml(plot.khatauniNo||"-")}</td><td>${escapeHtml(plot.transferredFrom||"-")}</td><td>${escapeHtml(plot.propertyType||"-")}</td><td><span class="badge ${badgeClass(plot.availabilityStatus)}">${availabilityStatusLabel(plot.availabilityStatus)}</span></td><td>${plot.availabilityStatus==="sold"?`<span class="badge ${badgeClass(plot.paymentStatus)}">${paymentStatusLabel(plot.paymentStatus)}</span>`:"-"}</td><td>${escapeHtml(getClientName(plot.linkedClientId))}</td><td>${plot.availabilityStatus==="sold"?`Rs ${formatMoney(plot.price)}`:"-"}</td><td><div class="row-actions"><button class="btn small-btn" type="button" data-view-plot="${plot.id}">View</button><button class="btn small-btn" type="button" data-edit-plot="${plot.id}">Edit</button><button class="btn small-btn" type="button" data-delete-plot="${plot.id}">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="13" class="muted">No plots found.</td></tr>`}


function renderDuesPage(){
  const client=state.data.clients.find(c=>c.id===state.activeDueClientId);
  const plots=client?sortPlotsList(getClientPlots(client.id).filter(plot=>plot.availabilityStatus==="sold")):[];
  const plot=plots.find(p=>p.id===state.activeDuePlotId)||plots[0];
  if(!client||!plot){
    document.getElementById("duesPageTitle").textContent="Dues";
    document.getElementById("duesPageSubtitle").textContent="No client/plot selected.";
    document.getElementById("duePlotSelect").innerHTML="";
    document.getElementById("duesSummaryGrid").innerHTML="";
    document.getElementById("duesTableBody").innerHTML='<tr><td colspan="8" class="empty-table">Open dues from the Dashboard for a sold plot.</td></tr>';
    return;
  }
  ensureSecurityDuesForPlot(plot);
  state.activeDuePlotId=plot.id;
  document.getElementById("duesPageTitle").textContent=`Dues — ${client.nameEn}`;
  document.getElementById("duesPageSubtitle").textContent=`Plot ${plot.plotNo} · ${plot.projectName}`;
  document.getElementById("duePlotSelect").innerHTML=plots.map(p=>`<option value="${p.id}" ${p.id===plot.id?"selected":""}>${escapeHtml(p.plotNo)} · ${escapeHtml(p.projectName)} · ${paymentStatusLabel(p.paymentStatus)}</option>`).join("");
  const dues=getDuesForPlot(plot.id);
  const total=dues.reduce((sum,d)=>sum+Number(d.amount||0),0);
  const discounted=dues.reduce((sum,d)=>sum+Number(d.discountAmount||0),0);
  const unpaid=dues.filter(d=>!d.paid&&d.status!=="waived").reduce((sum,d)=>sum+dueRemainingAmount(d),0);
  document.getElementById("duesSummaryGrid").innerHTML=[
    ["Client",client.nameEn],
    ["Plot",plot.plotNo],
    ["Total Dues",`Rs ${formatMoney(total)}`],
    ["Discount/Waiver",`Rs ${formatMoney(discounted)}`],
    ["Unpaid Remaining",`Rs ${formatMoney(unpaid)}`],
    ["Due Count",dues.length]
  ].map(([label,value])=>`<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join("");
  document.getElementById("duesTableBody").innerHTML=dues.length?dues.map(due=>`<tr>
    <td><input type="checkbox" ${due.paid?"checked":""} data-toggle-due-paid="${due.id}" ${due.status==="waived"?"disabled":""}></td>
    <td><strong>${escapeHtml(due.type)}</strong><br><span class="muted">${escapeHtml(due.note||"")}</span></td>
    <td>Rs ${formatMoney(due.amount)}</td>
    <td>Rs ${formatMoney(due.discountAmount||0)}</td>
    <td>Rs ${formatMoney(dueRemainingAmount(due))}</td>
    <td>${escapeHtml(due.date||"-")}</td>
    <td><span class="badge ${dueStatusBadgeClass(due)}">${dueStatusLabel(due)}</span></td>
    <td><div class="row-actions"><button class="btn small-btn" type="button" data-delete-due="${due.id}">Delete</button></div></td>
  </tr>`).join(""):'<tr><td colspan="8" class="empty-table">No dues yet. Click Add Due to create one.</td></tr>';
}
function openDueModal(){
  if(!state.activeDueClientId||!state.activeDuePlotId){alert("Open dues from a client/plot first.");return}
  document.getElementById("dueForm").reset();
  document.getElementById("dueId").value="";
  document.getElementById("dueDate").value=currentMonth();
  document.getElementById("dueModalTitle").textContent="Add Due";
  document.getElementById("dueModal").classList.remove("hidden");
}
function closeDueModal(){document.getElementById("dueModal").classList.add("hidden")}
function saveDue(event){
  event.preventDefault();
  const amount=parseMoney(document.getElementById("dueAmount").value);
  let discount=parseMoney(document.getElementById("dueDiscount").value);
  const waived=document.getElementById("dueWaived").checked;
  if(waived)discount=amount;
  if(!document.getElementById("dueType").value.trim()){alert("Due type is required.");return}
  if(!amount){alert("Due amount is required.");return}
  const id=document.getElementById("dueId").value||uid("due");
  const existing=state.data.dues.find(d=>d.id===id);
  const due={id,clientId:state.activeDueClientId,plotId:state.activeDuePlotId,type:document.getElementById("dueType").value.trim(),amount,discountAmount:Math.min(discount,amount),date:document.getElementById("dueDate").value,paid:existing?.paid||false,paidDate:existing?.paidDate||"",status:waived?"waived":(existing?.paid?"paid":"unpaid"),note:document.getElementById("dueNote").value.trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const index=state.data.dues.findIndex(d=>d.id===id);
  if(index>=0)state.data.dues[index]=due;else state.data.dues.push(due);
  saveData();closeDueModal();renderDuesPage();renderDashboard();renderClients();renderPlots();
}
function toggleDuePaid(dueId,paid){
  const due=state.data.dues.find(d=>d.id===dueId);if(!due)return;
  due.paid=paid;due.paidDate=paid?new Date().toISOString().slice(0,10):"";due.status=paid?"paid":"unpaid";due.updatedAt=new Date().toISOString();
  saveData();renderDuesPage();renderDashboard();renderClients();renderPlots();
}
function deleteDue(dueId){
  const due=state.data.dues.find(d=>d.id===dueId);if(!due)return;
  if(!confirm(`Delete due "${due.type}"?`))return;
  state.data.dues=state.data.dues.filter(d=>d.id!==dueId);
  saveData();renderDuesPage();renderDashboard();renderClients();renderPlots();
}


function sortSellersList(sellers){return [...sellers].sort((a,b)=>(a.nameEn||"").localeCompare(b.nameEn||""))}
function renderSellers(){
  const query=(document.getElementById("sellerSearchInput")?.value||"").toLowerCase().trim();
  let sellers=sortSellersList(state.data.sellers||[]);
  if(query){
    sellers=sellers.filter(seller=>[seller.nameEn,seller.nameUr,seller.fatherEn,seller.fatherUr,seller.cnic,seller.phone,seller.addressEn,seller.addressUr].join(" ").toLowerCase().includes(query));
  }
  const body=document.getElementById("sellersTableBody");
  if(!body)return;
  body.innerHTML=sellers.length?sellers.map(seller=>`<tr>
    <td><strong>${escapeHtml(seller.nameEn||"-")}</strong><br><span class="muted urdu-text">${escapeHtml(seller.nameUr||"")}</span></td>
    <td>${escapeHtml(seller.fatherEn||"-")}<br><span class="muted urdu-text">${escapeHtml(seller.fatherUr||"")}</span></td>
    <td>${escapeHtml(seller.cnic||"-")}</td>
    <td>${escapeHtml(seller.phone||"-")}</td>
    <td>${escapeHtml(seller.addressEn||"-")}<br><span class="muted urdu-text">${escapeHtml(seller.addressUr||"")}</span></td>
    <td><div class="row-actions">
      <button class="btn small-btn" type="button" data-view-seller="${seller.id}">View</button>
      <button class="btn small-btn" type="button" data-edit-seller="${seller.id}">Edit</button>
      <button class="btn small-btn" type="button" data-delete-seller="${seller.id}">Delete</button>
    </div></td>
  </tr>`).join(""):`<tr><td colspan="6" class="muted">No sellers found.</td></tr>`;
}
function openSellerModal(sellerId=null){
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can manage sellers.");return}
  const seller=sellerId?state.data.sellers.find(s=>s.id===sellerId):null;
  document.getElementById("sellerModalTitle").textContent=seller?"Edit Seller":"Add Seller";
  document.getElementById("sellerForm").reset();
  document.getElementById("sellerId").value=seller?.id||"";
  if(seller){
    document.getElementById("sellerNameEn").value=seller.nameEn||"";
    document.getElementById("sellerNameUr").value=seller.nameUr||"";
    document.getElementById("sellerFatherEn").value=seller.fatherEn||"";
    document.getElementById("sellerFatherUr").value=seller.fatherUr||"";
    document.getElementById("sellerCnic").value=seller.cnic||"";
    document.getElementById("sellerPhone").value=seller.phone||"";
    document.getElementById("sellerAddressEn").value=seller.addressEn||"";
    document.getElementById("sellerAddressUr").value=seller.addressUr||"";
  }
  document.getElementById("sellerModal").classList.remove("hidden");
}
function closeSellerModal(){document.getElementById("sellerModal").classList.add("hidden")}
function saveSeller(event){
  event.preventDefault();
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can manage sellers.");return}
  const id=document.getElementById("sellerId").value||uid("seller");
  const now=new Date().toISOString();
  const existing=state.data.sellers.find(s=>s.id===id);
  const seller={
    id,
    nameEn:document.getElementById("sellerNameEn").value.trim(),
    nameUr:document.getElementById("sellerNameUr").value.trim(),
    fatherEn:document.getElementById("sellerFatherEn").value.trim(),
    fatherUr:document.getElementById("sellerFatherUr").value.trim(),
    cnic:document.getElementById("sellerCnic").value.trim(),
    phone:document.getElementById("sellerPhone").value.trim(),
    addressEn:document.getElementById("sellerAddressEn").value.trim(),
    addressUr:document.getElementById("sellerAddressUr").value.trim(),
    createdAt:existing?.createdAt||now,
    updatedAt:now
  };
  if(!seller.nameEn){alert("Seller name is required.");return}
  const index=state.data.sellers.findIndex(s=>s.id===id);
  if(index>=0)state.data.sellers[index]=seller;else state.data.sellers.push(seller);
  saveData();closeSellerModal();renderSellers();renderDashboard();
}
function viewSeller(sellerId){
  const seller=state.data.sellers.find(s=>s.id===sellerId);if(!seller)return;
  document.getElementById("viewSellerTitle").textContent=`${seller.nameEn||"Seller"} — Seller Details`;
  document.getElementById("viewSellerBody").innerHTML=`
    <div class="detail-item"><div class="detail-label">Name English</div><div class="detail-value">${escapeHtml(seller.nameEn||"-")}</div></div>
    <div class="detail-item"><div class="detail-label">Name Urdu</div><div class="detail-value urdu-text">${escapeHtml(seller.nameUr||"-")}</div></div>
    <div class="detail-item"><div class="detail-label">Father English</div><div class="detail-value">${escapeHtml(seller.fatherEn||"-")}</div></div>
    <div class="detail-item"><div class="detail-label">Father Urdu</div><div class="detail-value urdu-text">${escapeHtml(seller.fatherUr||"-")}</div></div>
    <div class="detail-item"><div class="detail-label">CNIC</div><div class="detail-value">${escapeHtml(seller.cnic||"-")}</div></div>
    <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${escapeHtml(seller.phone||"-")}</div></div>
    <div class="detail-item full"><div class="detail-label">Address English</div><div class="detail-value">${escapeHtml(seller.addressEn||"-")}</div></div>
    <div class="detail-item full"><div class="detail-label">Address Urdu</div><div class="detail-value urdu-text">${escapeHtml(seller.addressUr||"-")}</div></div>`;
  document.getElementById("viewSellerModal").classList.remove("hidden");
}
function closeViewSellerModal(){document.getElementById("viewSellerModal").classList.add("hidden")}
function deleteSeller(sellerId){
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can delete sellers.");return}
  const seller=state.data.sellers.find(s=>s.id===sellerId);if(!seller)return;
  if(!confirm(`Delete seller "${seller.nameEn}"?`))return;
  state.data.sellers=state.data.sellers.filter(s=>s.id!==sellerId);
  saveData();renderSellers();renderDashboard();
}

function sortUsersList(users){return [...users].sort((a,b)=>(a.username||"").localeCompare(b.username||""))}
function renderUsers(){
  if(!document.getElementById("usersTableBody"))return;
  if(!state.currentUser||state.currentUser.role!=="admin")return;
  const roleFilter=(document.getElementById("userRoleFilter")?.value||"all");
  let users=sortUsersList(state.data.users||[]);
  if(roleFilter!=="all")users=users.filter(user=>(user.role||"user")===roleFilter);
  document.getElementById("usersTableBody").innerHTML=users.length?users.map(user=>`<tr>
    <td><strong>${escapeHtml(user.username||"-")}</strong>${state.currentUser&&state.currentUser.id===user.id?`<br><span class="muted">Current user</span>`:""}</td>
    <td><span class="badge ${user.role==="admin"?"green":"gray"}">${escapeHtml(user.role||"user")}</span></td>
    <td>${formatDate(user.createdAt)}</td>
    <td><div class="row-actions">
      <button class="btn small-btn" type="button" data-edit-user="${user.id}">Edit</button>
      <button class="btn small-btn" type="button" data-delete-user="${user.id}">Delete</button>
    </div></td>
  </tr>`).join(""):`<tr><td colspan="4" class="muted">No users found.</td></tr>`;
}
function openUserModal(userId=null){
  if(state.onlineMode){alert("Online users must be created in Supabase Authentication for now. This app will read them from the profiles table.");return}
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can manage users.");return}
  const user=userId?state.data.users.find(u=>u.id===userId):null;
  document.getElementById("userModalTitle").textContent=user?"Edit User":"Add User";
  document.getElementById("userForm").reset();
  document.getElementById("userId").value=user?.id||"";
  document.getElementById("userUsername").value=user?.username||"";
  document.getElementById("userPassword").required=!user;
  document.getElementById("userPassword").placeholder=user?"Leave blank to keep current password":"Enter password";
  document.getElementById("userRole").value=user?.role||"user";
  document.getElementById("userModal").classList.remove("hidden");
}
function closeUserModal(){document.getElementById("userModal").classList.add("hidden")}
function saveUser(event){
  event.preventDefault();
  if(state.onlineMode){alert("Online users must be managed in Supabase Authentication for now.");return}
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can manage users.");return}
  const id=document.getElementById("userId").value||uid("user");
  const username=document.getElementById("userUsername").value.trim();
  const password=document.getElementById("userPassword").value;
  const role=document.getElementById("userRole").value;
  if(!username){alert("Username is required.");return}
  const existing=state.data.users.find(u=>u.id===id);
  if(!existing&&!password){alert("Password is required for a new user.");return}
  const duplicate=state.data.users.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.id!==id);
  if(duplicate){alert("This username already exists.");return}
  if(existing&&existing.id===state.currentUser.id&&existing.role==="admin"&&role!=="admin"){
    alert("You cannot change your own admin account to user while logged in.");return;
  }
  const adminCount=state.data.users.filter(u=>u.role==="admin").length;
  if(existing&&existing.role==="admin"&&role!=="admin"&&adminCount<=1){alert("You must keep at least one admin account.");return}
  const now=new Date().toISOString();
  const user={id,username,password:password||existing?.password||"",role,createdAt:existing?.createdAt||now,updatedAt:now};
  const index=state.data.users.findIndex(u=>u.id===id);
  if(index>=0)state.data.users[index]=user;else state.data.users.push(user);
  if(state.currentUser&&state.currentUser.id===id){state.currentUser=user;document.getElementById("activeUsername").textContent=user.username;document.getElementById("activeRole").textContent=user.role;saveSession()}
  saveData();closeUserModal();renderUsers();
}
function deleteUser(userId){
  if(state.onlineMode){alert("Online users must be deleted/disabled in Supabase Authentication for now.");return}
  if(!state.currentUser||state.currentUser.role!=="admin"){alert("Only admin can delete users.");return}
  const user=state.data.users.find(u=>u.id===userId);if(!user)return;
  if(user.id===state.currentUser.id){alert("You cannot delete the account you are currently logged into.");return}
  const adminCount=state.data.users.filter(u=>u.role==="admin").length;
  if(user.role==="admin"&&adminCount<=1){alert("You must keep at least one admin account.");return}
  if(!confirm(`Delete user "${user.username}"?`))return;
  state.data.users=state.data.users.filter(u=>u.id!==userId);
  saveData();renderUsers();
}


function soldDocumentPlots(){
  return sortPlotsList(state.data.plots).filter(plot=>plot.availabilityStatus==="sold"&&plot.linkedClientId&&state.data.clients.some(c=>c.id===plot.linkedClientId));
}
function renderDocumentsPage(){
  const clientPlotSelect=document.getElementById("docClientPlotSelect");
  const sellerSelect=document.getElementById("docSellerSelect");
  if(clientPlotSelect){
    const plots=soldDocumentPlots();
    clientPlotSelect.innerHTML=plots.length?plots.map(plot=>{
      const client=state.data.clients.find(c=>c.id===plot.linkedClientId);
      return `<option value="${escapeHtml(plot.id)}">${escapeHtml(client?.nameEn||"-")} — ${escapeHtml(plot.plotNo||"-")} — ${escapeHtml(plot.projectName||"")}</option>`;
    }).join(""):`<option value="">No sold plots with linked clients</option>`;
  }
  if(sellerSelect){
    sellerSelect.innerHTML=state.data.sellers.length?state.data.sellers.map(seller=>`<option value="${escapeHtml(seller.id)}">${escapeHtml(seller.nameEn||seller.nameUr||"-")}</option>`).join(""):`<option value="">No sellers available</option>`;
  }
  updateDocumentControlVisibility();
  renderDocumentPaymentSelect();
  updateReceiptPaymentFields();
}
function selectedDocumentData(){
  const plotId=document.getElementById("docClientPlotSelect")?.value||"";
  const sellerId=document.getElementById("docSellerSelect")?.value||"";
  const plot=state.data.plots.find(p=>p.id===plotId);
  const client=plot?state.data.clients.find(c=>c.id===plot.linkedClientId):null;
  const seller=state.data.sellers.find(s=>s.id===sellerId);
  return {plot,client,seller};
}
function safeDocText(value,fallback="______________"){return escapeHtml(value||fallback)}
function plotSizeYards(plot){
  return Number(plot?.plotSizeMarla||0) * 25;
}
function docDateValue(){
  return new Date().toISOString().slice(0,10);
}
function getSelectedDocumentPayment(){
  const paymentId=document.getElementById("docPaymentSelect")?.value||"";
  return state.data.payments.find(payment=>payment.id===paymentId)||null;
}
function toUrduNumberWords(value){
  let n=Math.floor(Number(value||0));
  if(!n)return "صفر روپے";
  const ones=["","ایک","دو","تین","چار","پانچ","چھ","سات","آٹھ","نو","دس","گیارہ","بارہ","تیرہ","چودہ","پندرہ","سولہ","سترہ","اٹھارہ","انیس"];
  const tens=["","","بیس","تیس","چالیس","پچاس","ساٹھ","ستر","اسی","نوے"];
  function belowHundred(x){
    if(x<20)return ones[x];
    const t=Math.floor(x/10),o=x%10;
    return o?`${tens[t]} ${ones[o]}`:tens[t];
  }
  function belowThousand(x){
    const h=Math.floor(x/100),r=x%100;
    if(h&&r)return `${ones[h]} سو ${belowHundred(r)}`;
    if(h)return `${ones[h]} سو`;
    return belowHundred(r);
  }
  const parts=[];
  const crore=Math.floor(n/10000000); n%=10000000;
  const lakh=Math.floor(n/100000); n%=100000;
  const hazar=Math.floor(n/1000); n%=1000;
  if(crore)parts.push(`${belowThousand(crore)} کروڑ`);
  if(lakh)parts.push(`${belowThousand(lakh)} لاکھ`);
  if(hazar)parts.push(`${belowThousand(hazar)} ہزار`);
  if(n)parts.push(belowThousand(n));
  return `${parts.join(" ")} روپے`;
}
function updateDocumentControlVisibility(){
  const template=document.getElementById("docTemplateSelect")?.value||"sale_agreement";
  document.querySelectorAll(".doc-agreement-only").forEach(el=>el.classList.toggle("hidden",template!=="sale_agreement"));
  document.querySelectorAll(".doc-receipt-only").forEach(el=>el.classList.toggle("hidden",template!=="receipt"));
  document.querySelectorAll(".doc-witness-field").forEach(el=>el.classList.remove("hidden"));
}
function renderDocumentPaymentSelect(){
  const select=document.getElementById("docPaymentSelect");
  if(!select)return;
  const {plot}=selectedDocumentData();
  const payments=plot?state.data.payments.filter(payment=>payment.plotId===plot.id):[];
  select.innerHTML=payments.length?`<option value="">Select a saved payment</option>`+payments.map(payment=>{
    const label=`${payment.date||"No date"} — Rs ${formatMoney(payment.amount)} — ${payment.type==="exchange"?"Exchange: "+(payment.exchangeItem||"-"):"Cash"}`;
    return `<option value="${escapeHtml(payment.id)}">${escapeHtml(label)}</option>`;
  }).join(""):`<option value="">No saved payments for this plot</option>`;
}
function updateReceiptPaymentFields(){
  // Receipt amount is now always taken from the selected saved payment.
  // This function remains as a safe hook for the payment dropdown change event.
}
function generateSaleAgreementHtml(client,plot,seller){
  const price=Number(plot.price||0);
  const received=Number(plot.amountReceived||0);
  const remaining=Math.max(0,price-received);
  const w1n=document.getElementById("docWitness1Name")?.value||"______________";
  const w1c=document.getElementById("docWitness1Cnic")?.value||"______________";
  const w2n=document.getElementById("docWitness2Name")?.value||"______________";
  const w2c=document.getElementById("docWitness2Cnic")?.value||"______________";
  const dueDate=document.getElementById("docRemainingDueDate")?.value||"______________";
  const today=docDateValue();
  return `
    <div class="doc-content agreement-doc">
      <h1 class="agreement-title">اقرار نامه امعاہدہ بیع</h1>
      <table class="agreement-party-table borderless-table">
        <tr>
          <td class="party-label">منجانب</td>
          <td>: <strong>${safeDocText(seller?.nameUr||seller?.nameEn)}</strong> ولد <strong>${safeDocText(seller?.fatherUr||seller?.fatherEn,"__")}</strong> ساکن <strong>${safeDocText(seller?.addressUr||seller?.addressEn,"__")}</strong>۔</td>
          <td class="party-side">(فریق اوّل)</td>
        </tr>
        <tr>
          <td class="party-label">بحق</td>
          <td>: <strong>${safeDocText(client?.nameUr||client?.nameEn)}</strong> ولد <strong>${safeDocText(client?.fatherUr||client?.fatherEn,"__")}</strong> ساکن <strong>${safeDocText(client?.addressUr||client?.addressEn,"__")}</strong>۔</td>
          <td class="party-side">(فریق دوئم)</td>
        </tr>
      </table>
      <div class="agreement-body">
        <p>جو کہ فریق اول نے اپنا پلاٹ نمبر <strong class="doc-ltr">${safeDocText(plot.plotNo)}</strong> | تعدادی <strong>${safeDocText(plot.plotSizeMarla)} مرلہ</strong> خسرہ نمبر <span class="doc-ltr">${safeDocText(plot.khasraNo,"__")}</span>، کھتونی نمبر <span class="doc-ltr">${safeDocText(plot.khatauniNo,"__")}</span>، منتقل از <strong>${safeDocText(plot.transferredFrom,"__")}</strong>، بمطابق <span class="doc-ltr">${formatMoney(plotSizeYards(plot))}</span> مربع گز واقع موضع اٹھال تحصیل وضلع اسلام آباد کا مالک و قابض ہے اور فریق اول نے پلاٹ ذہا کا معاہدہ بیع ہمراہ فریق دوئم بالعوض مبلغ <strong>Rs ${formatMoney(price)}</strong> میں طے کر کے فریق اول نے فریق دوئم سے بطور بیانہ مبلغ <strong>Rs ${formatMoney(received)}</strong> روپے نقد آج مورخہ <span class="doc-ltr">${safeDocText(today)}</span> کو وصول پا لیا ہے جبکہ بقایا رقم مبلغ <strong>Rs ${formatMoney(remaining)}</strong> روپے فریق دوئم فریق اول کو مورخہ <span class="doc-ltr">${safeDocText(dueDate)}</span> تک ادا کرنے کے پابند وذمہ دار ہے۔</p>
        <p>یہ کہ اگر کوئی تھوڑی بہت رقم رہ بھی گئی تو اُس کے لئے مزید کچھ وقت دے دیا جائے گا جبکہ پلاٹ مذکورہ بالا کی رجسٹری / انتقال حق فریق دوئم یا اُس کے نامزد کردہ فرد افراد کے نام منتقل کروا دے جس کی ٹرانسفر کا خرچ بذمہ مشتری خریدار ہو گا۔ رقم مکمل ہونے پر پلاٹ مذکورہ بالا کا قبضہ حوالہ مشتری فریق دوئم کر دیا جائے گا۔</p>
        <p>یہ کہ پلاٹ ذہا کی محکمہ مال میں فی مرلہ قیمت 275,000 روپے ہے اور اس پر فائلر کا گین ٹیکس 4.5 فیصد اور E7 ٹیکس 1 فیصد ہے اور فریق اول وقت مقررہ تک موجودہ شرح کے مطابق پلاٹ ذہا پر اپنے ذمہ واجب الادا ٹیکس ادا کرنے کا پابند و ذمہ دار ہے اور اگر فریق دوئم نے دیر سے رجسٹری / انتقال کروانے پر اگر فی مرلہ قیمت یا کوئی ٹیکس بڑھا تو ایسی صورت میں موجودہ شرح سے زائد جو بھی ٹیکس ہوگا وہ فریق دوئم ادا کرے گا۔</p>
        <p>نیز یہ کہ فریق دوئم پلاٹ ذہا کا تجارتی استعمال کرنے کا مجاز نہیں ہوگا اور نہ ہی اپنے پلاٹ مکان کے ارد گرد کوئی ریڑھی، کھوکھا لگائے گا۔ ایسا کرنے کی صورت میں فریق اول فریق دوئم کے ریڑھی کھوکھا کو توڑنے گرانے موقع سے ہٹانے کا حق محفوظ رکھتا ہے۔ اس صورت میں فریق دوئم مذکورہ اور وارثان / خریداران بازگشت کو کوئی عذر اعتراض نہ ہوگا۔</p>
        <p>یہ کہ مشتری کو حق حاصل نہ ہوگا کہ وہ اپنے خرید کردہ پلاٹ مطابق نقشہ سے باہر کوئی تعمیر از قسم کاری یا ریمپ بنائے۔ ریمپ پلاٹ کی آر کی حد سے باہر 03 فٹ تک بن سکتا ہے۔ نیز پلاٹ مکان کی کرسی خریدار فریق دوئم جس قدر چاہے اونچی رکھ سکتا ہے مگر پورچ گیٹ والی جگہ کو سڑک سے زیادہ سے زیادہ ایک فٹ تک اونچا رکھ سکتا ہے۔</p>
        <p>فریق دوئم / خریدار گراؤنڈ فلور کے مکان کے شیڈ گلی میں نکالنے کا مستحق و مجاز نہ ہوگا۔ مشتری فریق دوئم پلاٹ سے باہر نہ تو کوئی بور کرے گا اور نہ باہر گٹر بنائے گا اور نہ کوئی ایسی چیز یا رکاوٹ پیدا کرے گا جس سے فراہم کردہ گلی میں کوئی کمی واقع ہو۔</p>
        <p>فریق دوئم پلاٹ مذکورہ کی تعمیر کے وقت اس بات کا خیال رکھے گا کہ گٹر کے پانی کے لیے ٹینک بنائے اور ہاتھ کے پانی، صابن والے پانی، کچن ٹپ کے لیے سوک پٹ بنائے۔ فریق دوئم کسی قسم کے گندے پانی کا اخراج پلاٹ سے باہر گلی میں نہ کرے گا۔</p>
        <p>یہ کہ اس تمام رقبہ اور اس کے چھوٹے قطعات (پلاٹس) کے لیے بائع اور اس کے ساتھیوں نے زر کثیر خرچ کر کے سڑکیں یا گلیاں بنائی ہیں۔ مشتری فریق دوئم صرف اور صرف پلاٹ ذہا کے لیے استعمال کر سکتا ہے اور نہ ہی اس راستہ اور پلاٹ کو استعمال کرتے ہوئے خود راستہ آگے لے کر جا سکتا ہے اور نہ ہی اس راستہ اور پلاٹ کو آگے مزید کسی شخص یا رقبہ کے راستہ کے لیے فروخت کر سکتا ہے۔ ایسا کرنے کی صورت میں فریق اول کو حق حاصل ہوگا کہ فریق دوئم کا راستہ بند کر دے۔</p>
        <p>نیز یہ کہ فریق دوئم پلاٹ کی دیکھ بھال کے پانچ سو (Rs 500/-) روپے ہر مہینہ باقاعدگی سے دیکھ بھال کرنے والوں کو ادا کرنے کا پابند و ذمہ دار ہوگا اور اس میں جو بھی مشترکہ طور پر کام کریں گے اس کی مد میں جو بھی اخراجات ہوں گے وہ بھی ادا کرے گا۔ معاہدہ ذہا کی پاسداری ہر دو فریقین اور ان کے قائم مقام وارثان بازگشت پر بھی یکساں عائد ہوگی۔ اقرارنامہ ذہا بقائمی ہوش و حواس خمسہ بلا جبر اقرار برضا و رغبت آج مورخہ <span class="doc-ltr">${safeDocText(today)}</span> روبرو گواہان سند تحریر کر دیا گیا ہے۔</p>
      </div>
      <div class="agreement-signature-wrap">
        <table class="agreement-signature-table borderless-table" width="100%" dir="rtl" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 auto;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif;text-align:center;">
          <tr>
            <td width="50%" align="center" style="width:50%;text-align:center;vertical-align:middle;border:none;padding:8pt 18pt;"><div class="signature-heading">العبــــــــــــــــــــــــــــــــــــــــــد</div><div>${safeDocText(seller?.nameUr||seller?.nameEn)} ولد ${safeDocText(seller?.fatherUr||seller?.fatherEn,"__")}</div><div>${safeDocText(seller?.cnic,"__")}</div><div>${safeDocText(seller?.phone,"__")}</div></td>
            <td width="50%" align="center" style="width:50%;text-align:center;vertical-align:middle;border:none;padding:8pt 18pt;"><div class="signature-heading">العبــــــــــــــــــــــــــــــــــــــــــد</div><div>${safeDocText(client?.nameUr||client?.nameEn)} ولد ${safeDocText(client?.fatherUr||client?.fatherEn,"__")}</div><div>${safeDocText(client?.cnic,"__")}</div><div>${safeDocText(client?.phone,"__")}</div></td>
          </tr>
          <tr>
            <td width="50%" align="center" style="width:50%;text-align:center;vertical-align:middle;border:none;padding:8pt 18pt;"><div class="signature-heading">گواہ شــــــــــــــــــــــــــــــــــــد</div><div>${safeDocText(w1n)} ${safeDocText(w1c)}</div></td>
            <td width="50%" align="center" style="width:50%;text-align:center;vertical-align:middle;border:none;padding:8pt 18pt;"><div class="signature-heading">گواہ شـــــــــد</div><div>${safeDocText(w2n)} ${safeDocText(w2c)}</div></td>
          </tr>
        </table>
      </div>
    </div>
  `;
}
function generateReceiptHtml(client,plot,seller){
  const payment=getSelectedDocumentPayment();
  const receiptAmount=payment?Number(payment.amount||0):0;
  const amountUrdu=payment?toUrduNumberWords(receiptAmount):"____________________";
  const paymentPlace=document.getElementById("docPaymentPlace")?.value||"____________________";
  const receiptDate=payment?.date||docDateValue();
  const w1n=document.getElementById("docWitness1Name")?.value||"______________";
  const w1c=document.getElementById("docWitness1Cnic")?.value||"______________";
  const w2n=document.getElementById("docWitness2Name")?.value||"______________";
  const w2c=document.getElementById("docWitness2Cnic")?.value||"______________";
  return `
    <div class="doc-content receipt-doc">
      <h1 class="receipt-title">رسید وصولی رقم</h1>
      <div class="receipt-body">
        <p>منکہ مسمی <strong>${safeDocText(client?.nameUr||client?.nameEn)}</strong> ولد <strong>${safeDocText(client?.fatherUr||client?.fatherEn,"__")}</strong></p>
        <p>ساکن <strong>${safeDocText(client?.addressUr||client?.addressEn,"__")}</strong> نے آج مورخہ <span class="doc-ltr">${safeDocText(receiptDate)}</span> کو</p>
        <p>بمقام <strong>${safeDocText(paymentPlace)}</strong> مبلغ <strong>${safeDocText(amountUrdu)}</strong> <span class="doc-ltr">(Rs. ${formatMoney(receiptAmount)})</span></p>
        <p>برائے پلاٹ نمبر <span class="doc-ltr"><strong>${safeDocText(plot.plotNo)}</strong></span> واقع <strong>${safeDocText(plot.projectName)}</strong> وصول پائے اور پڑھ کر، سن کر اور سمجھ کر گواہوں کی موجودگی میں دستخط/انگوٹھا ثبت کر دیئے ہیں تاکہ سند رہے اور بوقت ضرورت کام آ سکے۔</p>
        <div class="receipt-manual-underscores">________________________________________________________________________________
________________________________________________________________________________
________________________________________________________________________________</div>
        <p class="receipt-sign-label">دستخط/انگوٹھا وصول کنندہ:</p>
        <div class="receipt-cnic-plain">${safeDocText(client?.cnic,"شناختی کارڈ نمبر: _____________")}</div>
        <table class="receipt-witness-table bordered-table"><tr><td>گواہ 1۔ ${safeDocText(w1n,"________")} &nbsp; ${safeDocText(w1c,"")}</td><td>گواہ 2۔ ${safeDocText(w2n,"________")} &nbsp; ${safeDocText(w2c,"")}</td></tr></table>
      </div>
    </div>
  `;
}
function generateDocumentPreview(){
  updateDocumentControlVisibility();
  const {plot,client,seller}=selectedDocumentData();
  if(!plot||!client){alert("Select a sold client plot first.");return}
  const template=document.getElementById("docTemplateSelect")?.value||"sale_agreement";
  if(template==="sale_agreement"&&!seller){alert("Select a seller first. Add a seller if none exists.");return}
  updateReceiptPaymentFields();
  document.getElementById("documentPreview").innerHTML=template==="receipt"?generateReceiptHtml(client,plot,seller):generateSaleAgreementHtml(client,plot,seller);
}
function documentPrintStyles(){
  return `
    @page{size:A4;margin:12mm}
    body{margin:0;background:white}
    .document-paper{font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif;direction:rtl;text-align:right;color:#111}
    .doc-content{box-sizing:border-box}
    .agreement-doc{font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif;font-size:12pt;line-height:1.75}
    .agreement-title{text-align:center;font-size:22pt;font-weight:bold;text-decoration:underline;margin:0 0 8pt}
    .agreement-body p{margin:0 0 5pt;text-align:justify}
    .agreement-party-table{width:100%;border-collapse:collapse;direction:rtl;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif!important}
    .agreement-party-table td{border:none!important;padding:2pt 4pt;vertical-align:top;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif!important}
    .party-label{width:55pt;font-weight:bold}.party-side{width:80pt;text-align:center}
    .agreement-signature-wrap{margin-top:18pt;padding-top:0;text-align:center}
    .agreement-signature-table{width:100%;margin:0 auto;border-collapse:collapse;direction:rtl;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif!important;table-layout:fixed;text-align:center!important}
    .agreement-signature-table td{border:none!important;padding:8pt 18pt;vertical-align:middle;text-align:center!important;height:58pt;width:50%;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Times New Roman',serif!important}
    .signature-heading{font-weight:bold;margin-bottom:6pt}.signature-line{font-family:Arial,sans-serif;direction:ltr;text-align:left;unicode-bidi:embed}.doc-ltr{font-family:Arial,sans-serif;direction:ltr;unicode-bidi:embed}
    .receipt-doc{font-size:16pt;line-height:2.1}.receipt-title{text-align:center;font-size:20pt;font-weight:bold;margin:0 0 18pt}.receipt-body p{margin:0 0 12pt}
    .receipt-manual-lines-table{display:none!important}.receipt-manual-underscores{font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu',serif;line-height:1.8;margin:24pt 0 10pt;text-align:right;white-space:pre-wrap}
    .receipt-sign-label{margin-top:10pt}.receipt-cnic-label{font-weight:bold;margin-top:8pt;text-align:center}.receipt-cnic-plain{font-weight:bold;text-align:center;margin:10pt 0 18pt;direction:ltr;font-family:Arial,sans-serif}
    .receipt-cnic-table{display:none!important}
    .receipt-witness-table{width:100%;border-collapse:collapse;direction:rtl;margin:10pt 0 16pt}.receipt-witness-table td{border:1px solid #111!important;padding:10pt 12pt;height:34pt;width:50%;text-align:right}
  `;
}
function safeFilePart(value){
  return String(value||"")
    .trim()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g,"_")
    .replace(/^_+|_+$/g,"")
    .slice(0,60) || "file";
}
function currentDocumentFileName(extension="doc"){
  const template=document.getElementById("docTemplateSelect")?.value||"sale_agreement";
  const {plot,client}=selectedDocumentData();
  const clientName=safeFilePart(client?.nameEn||client?.nameUr||"Client");
  const plotNo=safeFilePart(plot?.plotNo||"Plot");
  if(template==="receipt"){
    const payment=getSelectedDocumentPayment();
    const date=safeFilePart(payment?.date||docDateValue());
    return `${clientName}_${date}.${extension}`;
  }
  return `${clientName}_${plotNo}.${extension}`;
}
function printDocumentPreview(){
  const html=document.getElementById("documentPreview")?.innerHTML||"";
  if(!html.trim()||html.includes("Select a client plot")){alert("Generate a document first.");return}
  const w=window.open("","_blank");
  const title=currentDocumentFileName("pdf").replace(/\.pdf$/i,"");
  w.document.write(`<html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${documentPrintStyles()}</style></head><body><div class="document-paper">${html}</div></body></html>`);
  w.document.close();w.focus();w.print();
}
function downloadDocumentPreview(){
  const html=document.getElementById("documentPreview")?.innerHTML||"";
  if(!html.trim()||html.includes("Select a client plot")){alert("Generate a document first.");return}
  const title=currentDocumentFileName("doc").replace(/\.doc$/i,"");
  const full=`<html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${documentPrintStyles()}</style></head><body><div class="document-paper">${html}</div></body></html>`;
  const blob=new Blob([full],{type:"application/msword;charset=utf-8"});
  const a=document.createElement("a");
  const name=currentDocumentFileName("doc");
  a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);
}

function resetReportColumns(){
  const config=getReportConfig();
  delete reportPrefs[config.type];
  renderReports();
}

function loadDummyRecords(){
  if(state.onlineMode&&!confirm("Load dummy records into the online Supabase database? This will replace current online test business data."))return;
  if(!state.onlineMode&&!confirm("Load dummy clients and plots for testing? This will replace the current local test data in this browser."))return;
  const c1=uid("client"),c2=uid("client"),c3=uid("client");
  const p1=uid("plot"),p2=uid("plot"),p3=uid("plot"),p4=uid("plot"),p5=uid("plot");
  const now=new Date().toISOString();
  state.data.clients=[
    {id:c1,nameEn:"Ali Khan",nameUr:"علی خان",fatherEn:"Omer Khan",fatherUr:"عمر خان",cnic:"61101-1111111-1",phone:"0300-1111111",addressEn:"House 4, Street 2, Islamabad",addressUr:"مکان 4، اسٹریٹ 2، اسلام آباد",notes:"Demo client",createdAt:now,updatedAt:now},
    {id:c2,nameEn:"Noor Adnan",nameUr:"نور عدنان",fatherEn:"Adnan Khan",fatherUr:"عدنان خان",cnic:"61101-2222222-2",phone:"0300-2222222",addressEn:"House 13, Street 3, Islamabad",addressUr:"مکان 13، اسٹریٹ 3، اسلام آباد",notes:"Demo client",createdAt:now,updatedAt:now},
    {id:c3,nameEn:"Danial Chheenah",nameUr:"دانیال چینہ",fatherEn:"Majeed Chheenah",fatherUr:"ماجد چینہ",cnic:"61101-3333333-3",phone:"0300-3333333",addressEn:"Alwadi Colony, Islamabad",addressUr:"الوادی کالونی، اسلام آباد",notes:"Demo client",createdAt:now,updatedAt:now}
  ];
  state.data.plots=[
    {id:p1,sourceClientId:null,projectName:"IGTV (Islamabad Green Traders Valley)",plotNo:"A-1",intikalNo:"",plotSize:"5",plotUnit:"Marla",plotSizeMarla:5,khasraNo:"125/7",khatauniNo:"48",transferredFrom:"Original Project File",propertyType:"Residential",constructionStatus:"plot",availabilityStatus:"available",linkedClientId:"",price:0,amountReceived:0,paymentStatus:"",notes:"Demo available plot",createdAt:now,updatedAt:now},
    {id:p2,sourceClientId:null,projectName:"IGTV (Islamabad Green Traders Valley)",plotNo:"A-2",intikalNo:"321",plotSize:"5",plotUnit:"Marla",plotSizeMarla:5,khasraNo:"125/7",khatauniNo:"48",transferredFrom:"Original Project File",propertyType:"Residential",constructionStatus:"plot",availabilityStatus:"sold",linkedClientId:c1,price:2500000,amountReceived:500000,paymentStatus:"partially_paid",notes:"Demo sold plot",createdAt:now,updatedAt:now},
    {id:p3,sourceClientId:null,projectName:"Badar Farms",plotNo:"B-10",intikalNo:"775",plotSize:"1",plotUnit:"Kanal",plotSizeMarla:20,khasraNo:"441/2",khatauniNo:"93",transferredFrom:"Malik Ahmed",propertyType:"Residential",constructionStatus:"constructed",availabilityStatus:"sold",linkedClientId:c2,price:6000000,amountReceived:6000000,paymentStatus:"fully_paid",notes:"Demo fully paid plot",createdAt:now,updatedAt:now},
    {id:p4,sourceClientId:null,projectName:"Sanam Gardens",plotNo:"C-5",intikalNo:"",plotSize:"200",plotUnit:"Yards",plotSizeMarla:8,khasraNo:"208/1",khatauniNo:"12",transferredFrom:"Farm Transfer",propertyType:"Commercial",constructionStatus:"plot",availabilityStatus:"available",linkedClientId:"",price:0,amountReceived:0,paymentStatus:"",notes:"Demo plot",createdAt:now,updatedAt:now},
    {id:p5,sourceClientId:null,projectName:"Baba Chitu",plotNo:"D-4",intikalNo:"901",plotSize:"10",plotUnit:"Marla",plotSizeMarla:10,khasraNo:"77/9",khatauniNo:"31",transferredFrom:"Baba Chitu File",propertyType:"Commercial",constructionStatus:"plot",availabilityStatus:"sold",linkedClientId:c3,price:4000000,amountReceived:0,paymentStatus:"to_be_paid",notes:"Demo to-be-paid plot",createdAt:now,updatedAt:now}
  ];
  state.data.payments=[
    {id:uid("payment"),clientId:c1,plotId:p2,type:"cash",amount:300000,date:new Date().toISOString().slice(0,10),note:"Demo cash instalment",exchangeItem:"",createdAt:now},
    {id:uid("payment"),clientId:c1,plotId:p2,type:"exchange",amount:200000,date:new Date().toISOString().slice(0,10),note:"Demo exchange value",exchangeItem:"Motorcycle",createdAt:now}
  ];
  state.data.dues=[
    {id:uid("due"),clientId:c1,plotId:p2,type:"Security Fee",amount:500,discountAmount:0,date:new Date().toISOString().slice(0,7),paid:false,paidDate:"",status:"unpaid",note:"Demo monthly security fee",createdAt:now},
    {id:uid("due"),clientId:c1,plotId:p2,type:"Boundary Wall",amount:25000,discountAmount:5000,date:new Date().toISOString().slice(0,7),paid:false,paidDate:"",status:"unpaid",note:"Demo discounted due",createdAt:now},
    {id:uid("due"),clientId:c2,plotId:p3,type:"Security Fee",amount:500,discountAmount:0,date:new Date().toISOString().slice(0,7),paid:true,paidDate:new Date().toISOString().slice(0,10),status:"paid",note:"Demo paid security fee",createdAt:now}
  ];
  state.data.sellers=[
    {id:uid("seller"),nameEn:"Hassan Property House",nameUr:"حسن پراپرٹی ہاؤس",fatherEn:"",fatherUr:"",cnic:"",phone:"0300-0000000",addressEn:"Main Murree Road, Bara Kahu, Islamabad",addressUr:"مین مری روڈ، بارہ کہو، اسلام آباد",createdAt:now,updatedAt:now},
    {id:uid("seller"),nameEn:"Malik Ahmed",nameUr:"ملک احمد",fatherEn:"Malik Kareem",fatherUr:"ملک کریم",cnic:"61101-4444444-4",phone:"0300-4444444",addressEn:"Islamabad",addressUr:"اسلام آباد",createdAt:now,updatedAt:now}
  ];
  saveData();renderClients();renderPlots();renderSellers();renderDashboard();alert("Dummy records loaded."+(state.onlineMode?" Syncing to Supabase...":""));
}


const reportPrefs={};
function reportMoney(value){return Number(value||0)}
function reportText(value){return value===undefined||value===null?"":String(value)}
function getClientById(id){return state.data.clients.find(client=>client.id===id)||null}
function cleanSheetName(name){return String(name||"Sheet").replace(/[\\/?*\[\]:]/g," ").slice(0,31)||"Sheet"}
function xmlEscape(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function getReportType(){return document.getElementById("reportTypeSelect")?.value||"master"}
function getDueRemaining(due){return Math.max(0,Number(due.amount||0)-Number(due.discountAmount||0))}
function dueTypeKey(type){return String(type||"Due").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"due"}
function dueTypeLabel(type){return String(type||"Due").trim()||"Due"}
function getReportConfig(type=getReportType()){
  if(type==="master") return getMasterReportConfig();
  if(type==="payments") return getPaymentsReportConfig();
  if(type==="dues") return getDuesReportConfig();
  if(type==="plots") return getPlotsReportConfig();
  return getMasterReportConfig();
}
function getBaseClientPlotRows(includeAvailable=false){
  const rows=[];
  for(const client of sortClientsList(state.data.clients)){
    const plots=getClientPlots(client.id).filter(plot=>includeAvailable||plot.availabilityStatus==="sold");
    if(plots.length){
      for(const plot of sortPlotsList(plots)) rows.push({client,plot});
    }else{
      rows.push({client,plot:null});
    }
  }
  return rows;
}
function getMasterReportConfig(){
  const rows=getBaseClientPlotRows(false).map(({client,plot})=>({client,plot}));
  const columns=[
    {key:"clientName",label:"Client Name",get:r=>r.client?.nameEn||""},
    {key:"clientUrdu",label:"Client Urdu",get:r=>r.client?.nameUr||""},
    {key:"fatherName",label:"Father Name",get:r=>r.client?.fatherEn||""},
    {key:"fatherUrdu",label:"Father Urdu",get:r=>r.client?.fatherUr||""},
    {key:"cnic",label:"CNIC",get:r=>r.client?.cnic||""},
    {key:"phone",label:"Phone",get:r=>r.client?.phone||""},
    {key:"address",label:"Address",get:r=>r.client?.addressEn||""},
    {key:"addressUrdu",label:"Address Urdu",get:r=>r.client?.addressUr||""},
    {key:"project",label:"Project",get:r=>r.plot?.projectName||""},
    {key:"plotNo",label:"Plot #",get:r=>r.plot?.plotNo||""},
    {key:"intikal",label:"Intikal",get:r=>r.plot?.intikalNo||""},
    {key:"size",label:"Size (Marla)",get:r=>r.plot?Number(r.plot.plotSizeMarla||0):""},
    {key:"khasraNo",label:"Khasra Number",get:r=>r.plot?.khasraNo||""},
    {key:"khatauniNo",label:"Khatauni Number",get:r=>r.plot?.khatauniNo||""},
    {key:"transferredFrom",label:"Transferred From",get:r=>r.plot?.transferredFrom||""},
    {key:"type",label:"Type",get:r=>r.plot?.propertyType||""},
    {key:"construction",label:"Construction",get:r=>r.plot?constructionStatusLabel(r.plot.constructionStatus):""},
    {key:"paymentStatus",label:"Payment Status",get:r=>r.plot?paymentStatusLabel(r.plot.paymentStatus):""},
    {key:"price",label:"Total Price",get:r=>r.plot?Number(r.plot.price||0):""},
    {key:"received",label:"Received",get:r=>r.plot?Number(r.plot.amountReceived||0):""},
    {key:"remaining",label:"Remaining",get:r=>r.plot?Math.max(0,Number(r.plot.price||0)-Number(r.plot.amountReceived||0)):""},
    {key:"dealDate",label:"Deal Date",get:r=>r.plot?.dealDate||""},
    {key:"notes",label:"Notes",get:r=>(r.plot?.notes||r.client?.notes||"")}
  ];
  return {type:"master",sheetName:"Master File",rows,columns};
}
function getPaymentsReportConfig(){
  const soldPlots=sortPlotsList(state.data.plots.filter(plot=>plot.availabilityStatus==="sold"));
  const rows=soldPlots.map(plot=>({plot,client:getClientById(plot.linkedClientId),payments:getPaymentsForPlot(plot.id)}));
  const maxPayments=Math.max(1,...rows.map(r=>r.payments.length));
  const columns=[
    {key:"clientName",label:"Client Name",get:r=>r.client?.nameEn||""},
    {key:"cnic",label:"CNIC",get:r=>r.client?.cnic||""},
    {key:"project",label:"Project",get:r=>r.plot.projectName||""},
    {key:"plotNo",label:"Plot #",get:r=>r.plot.plotNo||""},
    {key:"price",label:"Total Price",get:r=>Number(r.plot.price||0)},
    {key:"received",label:"Received",get:r=>Number(r.plot.amountReceived||0)},
    {key:"remaining",label:"Remaining",get:r=>Math.max(0,Number(r.plot.price||0)-Number(r.plot.amountReceived||0))},
    {key:"paymentStatus",label:"Payment Status",get:r=>paymentStatusLabel(r.plot.paymentStatus)}
  ];
  for(let i=0;i<maxPayments;i++){
    const n=i+1;
    columns.push({key:`payment${n}Type`,label:`Payment ${n} Type`,get:r=>r.payments[i]?paymentTypeLabel(r.payments[i].type):""});
    columns.push({key:`payment${n}Amount`,label:`Payment ${n} Amount`,get:r=>r.payments[i]?Number(r.payments[i].amount||0):""});
    columns.push({key:`payment${n}Date`,label:`Payment ${n} Date`,get:r=>r.payments[i]?.date||""});
    columns.push({key:`payment${n}Exchange`,label:`Payment ${n} Exchange`,get:r=>r.payments[i]?.exchangeItem||""});
    columns.push({key:`payment${n}Note`,label:`Payment ${n} Note`,get:r=>r.payments[i]?.note||""});
  }
  return {type:"payments",sheetName:"Payments",rows,columns};
}
function getDuesReportConfig(){
  const dueTypes=[...new Map(state.data.dues.filter(d=>!d.paid&&getDueRemaining(d)>0).map(d=>[dueTypeKey(d.type),dueTypeLabel(d.type)])).entries()].map(([key,label])=>({key,label}));
  const soldPlots=sortPlotsList(state.data.plots.filter(plot=>plot.availabilityStatus==="sold"));
  const rows=soldPlots.map(plot=>{
    const dues=state.data.dues.filter(due=>due.plotId===plot.id&&!due.paid&&getDueRemaining(due)>0);
    const dueSums={};
    for(const due of dues){const key=dueTypeKey(due.type);dueSums[key]=(dueSums[key]||0)+getDueRemaining(due)}
    return {plot,client:getClientById(plot.linkedClientId),dues,dueSums,totalDue:Object.values(dueSums).reduce((a,b)=>a+b,0)};
  });
  const columns=[
    {key:"clientName",label:"Client Name",get:r=>r.client?.nameEn||""},
    {key:"cnic",label:"CNIC",get:r=>r.client?.cnic||""},
    {key:"project",label:"Project",get:r=>r.plot.projectName||""},
    {key:"plotNo",label:"Plot #",get:r=>r.plot.plotNo||""},
    {key:"totalDue",label:"Total Unpaid Dues",get:r=>Number(r.totalDue||0)}
  ];
  for(const dueType of dueTypes){columns.push({key:`due_${dueType.key}`,label:dueType.label,get:r=>Number(r.dueSums[dueType.key]||0)})}
  return {type:"dues",sheetName:"Dues",rows,columns};
}
function getPlotsReportConfig(){
  const rows=sortPlotsList(state.data.plots).map(plot=>({plot,client:getClientById(plot.linkedClientId)}));
  const columns=[
    {key:"project",label:"Project",get:r=>r.plot.projectName||""},
    {key:"plotNo",label:"Plot #",get:r=>r.plot.plotNo||""},
    {key:"intikal",label:"Intikal",get:r=>r.plot.intikalNo||""},
    {key:"size",label:"Size (Marla)",get:r=>Number(r.plot.plotSizeMarla||0)},
    {key:"originalSize",label:"Original Size",get:r=>`${r.plot.plotSize||""} ${r.plot.plotUnit||""}`.trim()},
    {key:"khasraNo",label:"Khasra Number",get:r=>r.plot.khasraNo||""},
    {key:"khatauniNo",label:"Khatauni Number",get:r=>r.plot.khatauniNo||""},
    {key:"transferredFrom",label:"Transferred From",get:r=>r.plot.transferredFrom||""},
    {key:"type",label:"Type",get:r=>r.plot.propertyType||""},
    {key:"construction",label:"Construction",get:r=>constructionStatusLabel(r.plot.constructionStatus)},
    {key:"availability",label:"Availability",get:r=>availabilityStatusLabel(r.plot.availabilityStatus)},
    {key:"linkedClient",label:"Linked Client",get:r=>r.client?.nameEn||""},
    {key:"price",label:"Price",get:r=>r.plot.availabilityStatus==="sold"?Number(r.plot.price||0):""},
    {key:"received",label:"Received",get:r=>r.plot.availabilityStatus==="sold"?Number(r.plot.amountReceived||0):""},
    {key:"paymentStatus",label:"Payment Status",get:r=>r.plot.availabilityStatus==="sold"?paymentStatusLabel(r.plot.paymentStatus):""},
    {key:"notes",label:"Notes",get:r=>r.plot.notes||""}
  ];
  return {type:"plots",sheetName:"Plots",rows,columns};
}
function ensureReportPrefs(type,columns){
  const keys=columns.map(c=>c.key);
  if(!reportPrefs[type]) reportPrefs[type]={order:[...keys],selected:Object.fromEntries(keys.map(k=>[k,true]))};
  const pref=reportPrefs[type];
  pref.order=pref.order.filter(key=>keys.includes(key));
  for(const key of keys){if(!pref.order.includes(key))pref.order.push(key);if(!(key in pref.selected))pref.selected[key]=true}
  return pref;
}
function getSelectedReportColumns(config){
  const pref=ensureReportPrefs(config.type,config.columns);
  const byKey=Object.fromEntries(config.columns.map(column=>[column.key,column]));
  return pref.order.filter(key=>pref.selected[key]&&byKey[key]).map(key=>byKey[key]);
}
function reportRowMatches(row,columns,query){
  if(!query)return true;
  const haystack=columns.map(column=>reportText(column.get(row))).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}
let reportDragKey="";
function autoScrollReportColumns(event){
  const list=document.getElementById("reportColumnsList");
  if(!list||!reportDragKey)return;
  const rect=list.getBoundingClientRect();
  const threshold=64;
  const speed=16;
  if(event.clientY<rect.top+threshold){
    list.scrollTop-=speed;
  }else if(event.clientY>rect.bottom-threshold){
    list.scrollTop+=speed;
  }
}
function renderReports(){
  const config=getReportConfig();
  const pref=ensureReportPrefs(config.type,config.columns);
  const byKey=Object.fromEntries(config.columns.map(column=>[column.key,column]));
  const list=document.getElementById("reportColumnsList");
  if(list){
    list.innerHTML=pref.order.map(key=>{
      const column=byKey[key]; if(!column) return "";
      const checked=pref.selected[key]!==false;
      return `<div class="report-column-item ${checked?"":"report-disabled"}" draggable="true" data-report-pref-col="${escapeHtml(key)}">
        <span class="drag-handle" title="Drag to reorder">☰</span>
        <label class="report-column-main"><input type="checkbox" data-report-column-toggle="${escapeHtml(key)}" ${checked?"checked":""}/><span>${escapeHtml(column.label)}</span></label>
      </div>`;
    }).join("");
  }
  renderReportPreview();
}
function getFilteredReportRows(config){
  const allColumns=config.columns;
  const query=(document.getElementById("reportSearchInput")?.value||"").trim();
  return config.rows.filter(row=>reportRowMatches(row,allColumns,query));
}
function renderReportPreview(){
  const config=getReportConfig();
  const columns=getSelectedReportColumns(config);
  const rows=getFilteredReportRows(config);
  const table=document.getElementById("reportPreviewTable");
  if(!table)return;
  table.querySelector("thead").innerHTML=`<tr>${columns.map(column=>`<th>${escapeHtml(column.label)}</th>`).join("")}</tr>`;
  table.querySelector("tbody").innerHTML=rows.slice(0,100).map(row=>`<tr>${columns.map(column=>`<td>${escapeHtml(reportText(column.get(row)))}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(columns.length,1)}" class="muted">No report rows found.</td></tr>`;
  const note=document.getElementById("reportPreviewNote");
  if(note)note.textContent=`Previewing ${Math.min(rows.length,100)} of ${rows.length} row(s). Download includes all filtered rows.`;
}
function moveReportColumn(key,direction){
  const config=getReportConfig(); const pref=ensureReportPrefs(config.type,config.columns); const index=pref.order.indexOf(key); if(index<0)return; const next=index+direction; if(next<0||next>=pref.order.length)return; [pref.order[index],pref.order[next]]=[pref.order[next],pref.order[index]]; renderReports();
}
function toggleReportColumn(key,checked){const config=getReportConfig(); const pref=ensureReportPrefs(config.type,config.columns); pref.selected[key]=checked; renderReports()}
function spreadsheetCell(value){
  const isNumber=typeof value==="number"&&Number.isFinite(value);
  return `<Cell><Data ss:Type="${isNumber?"Number":"String"}">${xmlEscape(value)}</Data></Cell>`;
}
function worksheetXml(name,columns,rows){
  return `<Worksheet ss:Name="${xmlEscape(cleanSheetName(name))}"><Table><Row>${columns.map(c=>spreadsheetCell(c.label)).join("")}</Row>${rows.map(row=>`<Row>${columns.map(c=>spreadsheetCell(c.get(row))).join("")}</Row>`).join("")}</Table></Worksheet>`;
}
async function ensureXlsxLibrary(){
  if(window.XLSX)return true;
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector("script[data-hph-xlsx-loader]");
    if(existing){existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",()=>reject(new Error("Could not load XLSX library.")),{once:true});return;}
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
    script.setAttribute("data-hph-xlsx-loader","true");
    script.onload=resolve;
    script.onerror=()=>reject(new Error("Could not load XLSX library. Check internet connection or CDN access."));
    document.head.appendChild(script);
  });
  return !!window.XLSX;
}
function reportFileBaseName(type){
  return ({master:"PH_Master_File",payments:"PH_Payments_Report",dues:"PH_Dues_Report",plots:"PH_Plots_Report"})[type]||"PH_Report";
}
async function downloadReport(){
  const config=getReportConfig();
  const columns=getSelectedReportColumns(config);
  const rows=getFilteredReportRows(config);
  if(!columns.length){alert("Select at least one column before exporting.");return}
  await ensureXlsxLibrary();
  const workbook=window.XLSX.utils.book_new();
  const addSheet=(sheetName,sheetRows)=>{
    const jsonRows=sheetRows.map(row=>Object.fromEntries(columns.map(column=>[column.label,column.get(row)])));
    const worksheet=window.XLSX.utils.json_to_sheet(jsonRows,{header:columns.map(column=>column.label)});
    window.XLSX.utils.book_append_sheet(workbook,worksheet,cleanSheetName(sheetName));
  };
  if(config.type==="plots"){
    const projectNames=[...new Set(rows.map(row=>row.plot.projectName||"No Project"))].sort((a,b)=>a.localeCompare(b));
    projectNames.forEach(project=>addSheet(project,rows.filter(row=>(row.plot.projectName||"No Project")===project)));
  }else{
    addSheet(config.sheetName,rows);
  }
  const array=window.XLSX.write(workbook,{bookType:"xlsx",type:"array"});
  const blob=new Blob([array],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const date=new Date().toISOString().slice(0,10);
  const filename=`${reportFileBaseName(config.type)}_${date}.xlsx`;
  HPHExports.downloadBlob(blob,filename);
}

function validateBackupPayload(payload){
  if(!payload || typeof payload!=="object")return "Backup file is not valid JSON data.";
  if(!["HPH Estate Manager","PH Estate Manager"].includes(payload.app))return "This does not look like a PH Estate Manager backup.";
  if(!payload.data || typeof payload.data!=="object")return "Backup file is missing the data section.";
  const required=["users","projects","clients","plots","sellers","payments","dues"];
  const missing=required.filter(key=>!Array.isArray(payload.data[key]));
  if(missing.length)return `Backup file is missing: ${missing.join(", ")}.`;
  return "";
}
function restoreBackupFromFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(reader.result);
      const error=validateBackupPayload(payload);
      if(error){alert(error);return;}
      if(!confirm("Restore this backup? This will replace all current local data in this browser."))return;
      state.data=HPHStorage.save(payload.data);
      clearSession();
      alert("Backup restored successfully. Please log in again.");
      location.reload();
    }catch(error){alert("Could not read this backup file. Make sure it is a valid JSON backup.");}
  };
  reader.readAsText(file);
}
async function clearTestData(){
  const phrase="CLEAR TEST DATA";
  const typed=prompt(`This will remove all test clients, plots, sellers, payments, dues, added users, and added projects. It keeps only default users and default projects. Type ${phrase} to continue.`);
  if(typed!==phrase)return;
  if(state.onlineMode&&window.HPHSupabase?.ready){try{await HPHSupabase.clearBusinessData();state.data=await HPHSupabase.loadAll();HPHStorage.save(state.data);renderDashboard();renderClients();renderPlots();renderSellers();alert("Online test business data cleared. Users and projects remain.");return;}catch(error){alert("Could not clear online data: "+(error.message||error));return;}}
  state.data=HPHStorage.save(HPHStorage.defaultData());
  clearSession();
  alert("Test data cleared. Please log in again.");
  location.reload();
}
async function clearAllData(){
  if(!state.currentUser || state.currentUser.role!=="admin"){alert("Only admins can clear all data.");return;}
  const phrase="DELETE";
  const typed=prompt(`DANGER: This will reset all local app data in this browser. Download a backup first. Type ${phrase} to continue.`);
  if(typed!==phrase)return;
  if(state.onlineMode&&window.HPHSupabase?.ready){try{await HPHSupabase.clearBusinessData();state.data=await HPHSupabase.loadAll();HPHStorage.save(state.data);renderDashboard();renderClients();renderPlots();renderSellers();alert("Online business data cleared. Auth users and projects remain.");return;}catch(error){alert("Could not clear online data: "+(error.message||error));return;}}
  state.data=HPHStorage.save(HPHStorage.defaultData());
  clearSession();
  alert("All local data reset. Please log in again.");
  location.reload();
}

function setupEvents(){
  const on=(selector,event,handler)=>{const el=$(selector);if(el)el.addEventListener(event,handler)};
  on("#roleUserBtn","click",()=>setRole("user"));
  on("#roleAdminBtn","click",()=>setRole("admin"));
  on("#loginBtn","click",()=>login());
  on("#loginPassword","keydown",event=>{if(event.key==="Enter")login()});
  on("#logoutBtn","click",()=>logout());
  $$('.nav-item').forEach(btn=>btn.addEventListener("click",()=>goPage(btn.dataset.page)));
  $$('[data-go-page]').forEach(btn=>btn.addEventListener("click",()=>goPage(btn.dataset.goPage)));
  on("#downloadBackupBtn","click",()=>HPHExports.downloadBackup(state.data));
  on("#restoreBackupBtn","click",()=>document.getElementById("restoreBackupInput")?.click());
  on("#restoreBackupInput","change",event=>{restoreBackupFromFile(event.target.files?.[0]); event.target.value="";});
  on("#clearTestDataBtn","click",clearTestData);
  on("#clearAllDataBtn","click",clearAllData);
  on("#loadDummyDataBtn","click",loadDummyRecords);
  on("#dashboardSearchInput","input",renderDashboard);
  on("#dashboardClientsBody","click",event=>{const viewBtn=event.target.closest("[data-dashboard-view]");const editBtn=event.target.closest("[data-dashboard-edit]");const deleteBtn=event.target.closest("[data-dashboard-delete]");const paymentsBtn=event.target.closest("[data-dashboard-payments]");const duesBtn=event.target.closest("[data-dashboard-dues]");if(viewBtn)viewClient(viewBtn.dataset.dashboardView);if(editBtn)openClientModal(editBtn.dataset.dashboardEdit);if(deleteBtn)deleteClient(deleteBtn.dataset.dashboardDelete);if(paymentsBtn)openPaymentsPlaceholder(paymentsBtn.dataset.dashboardPayments);if(duesBtn)openDuesPlaceholder(duesBtn.dataset.dashboardDues)});
  on("#addClientBtn","click",()=>openClientModal());
  on("#closeClientModalBtn","click",closeClientModal);
  on("#cancelClientBtn","click",closeClientModal);
  on("#clientForm","submit",saveClient);
  on("#addProjectBtn","click",()=>addProject("#clientProject"));
  on("#clientProject","change",()=>renderAvailablePlotSelect());
  on("#clientCnic","input",event=>event.target.value=formatCNIC(event.target.value));
  on("#clientPhone","input",event=>event.target.value=formatPhone(event.target.value));
  on("#clientTotalAmount","input",event=>formatAmountInput(event.target));
  on("#clientTokenAmount","input",event=>formatAmountInput(event.target));
  on("#clientFullyPaid","change",()=>{if($("#clientFullyPaid").checked&&$("#clientTotalAmount").value){$("#clientTokenAmount").value=$("#clientTotalAmount").value}});
  on("#clientSearchInput","input",renderClients);
  on("#clientConstructionFilter","change",renderClients);
  on("#clientPaymentFilter","change",renderClients);
  on("#clientsTableBody","click",event=>{const viewBtn=event.target.closest("[data-view-client]");const editBtn=event.target.closest("[data-edit-client]");const deleteBtn=event.target.closest("[data-delete-client]");if(viewBtn)viewClient(viewBtn.dataset.viewClient);if(editBtn)openClientModal(editBtn.dataset.editClient);if(deleteBtn)deleteClient(deleteBtn.dataset.deleteClient)});
  on("#addPlotBtn","click",()=>openPlotModal());
  on("#closePlotModalBtn","click",closePlotModal);
  on("#cancelPlotBtn","click",closePlotModal);
  on("#plotForm","submit",savePlot);
  on("#addProjectFromPlotBtn","click",()=>addProject("#plotProject"));
  on("#plotNo","input",event=>event.target.value=formatPlotNo(event.target.value));
  on("#plotPrice","input",event=>formatAmountInput(event.target));
  on("#plotTokenAmount","input",event=>formatAmountInput(event.target));
  on("#plotFullyPaid","change",()=>{if($("#plotFullyPaid").checked&&$("#plotPrice").value){$("#plotTokenAmount").value=$("#plotPrice").value}});
  on("#plotSize","input",updatePlotSizePreview);
  on("#plotUnit","change",updatePlotSizePreview);
  on("#plotAvailabilityStatus","change",updatePlotSoldFields);
  on("#plotSearchInput","input",renderPlots);
  on("#plotSizeSearchInput","input",renderPlots);
  on("#plotAvailabilityFilter","change",renderPlots);
  on("#plotsTableBody","click",event=>{const viewBtn=event.target.closest("[data-view-plot]");const editBtn=event.target.closest("[data-edit-plot]");const deleteBtn=event.target.closest("[data-delete-plot]");if(viewBtn)viewPlot(viewBtn.dataset.viewPlot);if(editBtn)openPlotModal(editBtn.dataset.editPlot);if(deleteBtn)deletePlot(deleteBtn.dataset.deletePlot)});
  on("#backToDashboardFromPayments","click",()=>goPage("dashboard"));
  on("#paymentPlotSelect","change",event=>{state.activePaymentPlotId=event.target.value;renderPaymentsPage()});
  on("#addCashPaymentBtn","click",()=>openPaymentModal("cash"));
  on("#addExchangePaymentBtn","click",()=>openPaymentModal("exchange"));
  on("#closePaymentModalBtn","click",closePaymentModal);
  on("#cancelPaymentBtn","click",closePaymentModal);
  on("#paymentForm","submit",savePayment);
  on("#paymentAmount","input",event=>formatAmountInput(event.target));
  on("#paymentsTableBody","click",event=>{const deleteBtn=event.target.closest("[data-delete-payment]");if(deleteBtn)deletePayment(deleteBtn.dataset.deletePayment)});
  on("#paymentModal","click",event=>{if(event.target.id==="paymentModal")closePaymentModal()});
  on("#backToDashboardFromDues","click",()=>goPage("dashboard"));
  on("#duePlotSelect","change",event=>{state.activeDuePlotId=event.target.value;renderDuesPage()});
  on("#addDueBtn","click",openDueModal);
  on("#closeDueModalBtn","click",closeDueModal);
  on("#cancelDueBtn","click",closeDueModal);
  on("#dueForm","submit",saveDue);
  on("#dueAmount","input",event=>formatAmountInput(event.target));
  on("#dueDiscount","input",event=>formatAmountInput(event.target));
  on("#dueWaived","change",()=>{if(document.getElementById("dueWaived").checked&&document.getElementById("dueAmount").value){document.getElementById("dueDiscount").value=document.getElementById("dueAmount").value}});
  on("#duesTableBody","click",event=>{const deleteBtn=event.target.closest("[data-delete-due]");if(deleteBtn)deleteDue(deleteBtn.dataset.deleteDue)});
  on("#duesTableBody","change",event=>{const toggle=event.target.closest("[data-toggle-due-paid]");if(toggle)toggleDuePaid(toggle.dataset.toggleDuePaid,toggle.checked)});
  on("#dueModal","click",event=>{if(event.target.id==="dueModal")closeDueModal()});

  on("#generateDocumentBtn","click",generateDocumentPreview);
  on("#printDocumentBtn","click",printDocumentPreview);
  on("#downloadDocumentBtn","click",downloadDocumentPreview);
  on("#docTemplateSelect","change",()=>{updateDocumentControlVisibility();generateDocumentPreview()});
  on("#docClientPlotSelect","change",()=>{renderDocumentPaymentSelect();updateReceiptPaymentFields();generateDocumentPreview()});
  on("#docSellerSelect","change",generateDocumentPreview);
  on("#docPaymentSelect","change",()=>{updateReceiptPaymentFields();generateDocumentPreview()});
  on("#docPaymentPlace","input",()=>{const template=document.getElementById("docTemplateSelect")?.value||"sale_agreement";if(template==="receipt")generateDocumentPreview()});
  on("#reportTypeSelect","change",renderReports);
  on("#reportSearchInput","input",renderReportPreview);
  on("#previewReportBtn","click",renderReportPreview);
  on("#exportReportBtn","click",downloadReport);
  on("#reportColumnsList","change",event=>{
    const toggle=event.target.closest("[data-report-column-toggle]");
    if(toggle) toggleReportColumn(toggle.dataset.reportColumnToggle,toggle.checked);
  });
  on("#reportColumnsList","dragstart",event=>{
    const item=event.target.closest("[data-report-pref-col]");
    if(!item)return;
    reportDragKey=item.dataset.reportPrefCol;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed="move";
  });
  on("#reportColumnsList","dragover",event=>{
    if(!reportDragKey)return;
    event.preventDefault();
    event.dataTransfer.dropEffect="move";
    autoScrollReportColumns(event);
  });
  on("#reportColumnsList","drop",event=>{
    event.preventDefault();
    if(!reportDragKey)return;
    const target=event.target.closest("[data-report-pref-col]");
    const config=getReportConfig();
    const pref=ensureReportPrefs(config.type,config.columns);
    const from=pref.order.indexOf(reportDragKey);
    let to=target?pref.order.indexOf(target.dataset.reportPrefCol):pref.order.length-1;
    if(from>=0&&to>=0&&from!==to){
      const [moved]=pref.order.splice(from,1);
      if(from<to) to-=1;
      pref.order.splice(to,0,moved);
      renderReports();
    }
    reportDragKey="";
  });
  on("#reportColumnsList","dragend",()=>{
    document.querySelectorAll(".report-column-item.dragging").forEach(el=>el.classList.remove("dragging"));
    reportDragKey="";
  });
  on("#resetReportColumnsBtn","click",resetReportColumns);
  on("#docWitness1Cnic","input",event=>event.target.value=formatCNIC(event.target.value));
  on("#docWitness2Cnic","input",event=>event.target.value=formatCNIC(event.target.value));


  on("#addSellerBtn","click",()=>openSellerModal());
  on("#sellerSearchInput","input",renderSellers);
  on("#closeSellerModalBtn","click",closeSellerModal);
  on("#cancelSellerBtn","click",closeSellerModal);
  on("#sellerForm","submit",saveSeller);
  on("#sellerCnic","input",event=>event.target.value=formatCNIC(event.target.value));
  on("#sellerPhone","input",event=>event.target.value=formatPhone(event.target.value));
  on("#sellersTableBody","click",event=>{const viewBtn=event.target.closest("[data-view-seller]");const editBtn=event.target.closest("[data-edit-seller]");const deleteBtn=event.target.closest("[data-delete-seller]");if(viewBtn)viewSeller(viewBtn.dataset.viewSeller);if(editBtn)openSellerModal(editBtn.dataset.editSeller);if(deleteBtn)deleteSeller(deleteBtn.dataset.deleteSeller)});
  on("#sellerModal","click",event=>{if(event.target.id==="sellerModal")closeSellerModal()});
  on("#closeViewSellerBtn","click",closeViewSellerModal);
  on("#viewSellerModal","click",event=>{if(event.target.id==="viewSellerModal")closeViewSellerModal()});
  on("#addUserBtn","click",()=>openUserModal());
  on("#userRoleFilter","change",renderUsers);
  on("#closeUserModalBtn","click",closeUserModal);
  on("#cancelUserBtn","click",closeUserModal);
  on("#userForm","submit",saveUser);
  on("#usersTableBody","click",event=>{const editBtn=event.target.closest("[data-edit-user]");const deleteBtn=event.target.closest("[data-delete-user]");if(editBtn)openUserModal(editBtn.dataset.editUser);if(deleteBtn)deleteUser(deleteBtn.dataset.deleteUser)});
  on("#userModal","click",event=>{if(event.target.id==="userModal")closeUserModal()});
  on("#closeViewPlotBtn","click",closeViewPlotModal);
  on("#plotModal","click",event=>{if(event.target.id==="plotModal")closePlotModal()});
  on("#viewPlotModal","click",event=>{if(event.target.id==="viewPlotModal")closeViewPlotModal()});
  on("#closeViewClientBtn","click",closeViewClientModal);
  $$('[data-translate]').forEach(btn=>btn.addEventListener("click",()=>{const[sourceId,targetId]=btn.dataset.translate.split(":");translateText(sourceId,targetId)}));
  on("#clientModal","click",event=>{if(event.target.id==="clientModal")closeClientModal()});
  on("#viewClientModal","click",event=>{if(event.target.id==="viewClientModal")closeViewClientModal()});
}
async function init(){if(ensureSecurityDuesForAllSoldPlots()) saveData();else saveData();setupEvents();setRole("user");renderProjectsDropdown();renderProjectsDropdown(state.data.projects[0]?.name||"","#plotProject");renderAvailablePlotSelect();if(!(await restoreSession())){document.getElementById("loginView").classList.remove("hidden");document.getElementById("mainView").classList.add("hidden");renderDashboard()}}
document.addEventListener("DOMContentLoaded",init);
