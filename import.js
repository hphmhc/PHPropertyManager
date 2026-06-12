
/* Stage 15.4 Bulk Import System */
(function(){
  const IMPORT_TEMPLATES = {
    projects: {
      title: "Projects",
      sheetName: "Projects",
      columns: ["Project Name"]
    },
    plots: {
      title: "Plots",
      sheetName: "Plots",
      columns: ["Project Name","Plot Number","Intikal Number","Plot Size","Plot Unit","Khasra Number","Khatauni Number","Transferred From","Property Type","Construction Status","Availability Status","Price","Notes"]
    },
    clients: {
      title: "Clients",
      sheetName: "Clients",
      columns: ["Client Name English","Client Name Urdu","Father Name English","Father Name Urdu","CNIC","Phone","Address English","Address Urdu","Notes"]
    },
    sellers: {
      title: "Sellers",
      sheetName: "Sellers",
      columns: ["Seller Name English","Seller Name Urdu","Father Name English","Father Name Urdu","CNIC","Phone","Address English","Address Urdu"]
    },
    sales: {
      title: "Client Plot Sales Links",
      sheetName: "Sales Links",
      columns: ["Client CNIC","Project Name","Plot Number","Intikal Number","Price","Amount Received","Deal Date","Payment Status","Notes"]
    },
    payments: {
      title: "Payments",
      sheetName: "Payments",
      columns: ["Client CNIC","Project Name","Plot Number","Payment Type","Amount","Date","Exchange Item","Note"]
    },
    dues: {
      title: "Dues",
      sheetName: "Dues",
      columns: ["Client CNIC","Project Name","Plot Number","Due Type","Amount","Discount Amount","Month","Paid","Paid Date","Status","Note"]
    }
  };

  let importedRows = [];
  let validated = null;

  function el(id){ return document.getElementById(id); }
  function clean(v){ return String(v ?? "").trim(); }
  function low(v){ return clean(v).toLowerCase(); }
  function money(v){ return Number(String(v ?? "").replace(/[^\d.-]/g,"")) || 0; }
  function truthy(v){ return ["yes","true","paid","1","y"].includes(low(v)); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function excelSerialToDate(serial){
    const days = Number(serial);
    if(!Number.isFinite(days) || days <= 0) return "";
    const utc = Math.round((days - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if(Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0,10);
  }
  function dateValue(value){
    if(value === null || value === undefined || value === "") return "";
    if(typeof value === "number") return excelSerialToDate(value);
    if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
    const raw = clean(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if(/^\d{4}-\d{2}$/.test(raw)) return raw + "-01";
    if(/^\d+(\.\d+)?$/.test(raw)) return excelSerialToDate(Number(raw));
    const parts = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if(parts){
      let a=Number(parts[1]), b=Number(parts[2]), y=Number(parts[3]);
      if(y < 100) y += 2000;
      // Prefer DD/MM/YYYY for Pakistan records, but switch when the first number is clearly a month.
      const day = a > 12 ? a : b > 12 ? b : a;
      const month = a > 12 ? b : b > 12 ? a : b;
      if(month>=1 && month<=12 && day>=1 && day<=31) return `${y}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }
    const d = new Date(raw);
    if(!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return raw;
  }
  function monthValue(value){
    const raw = clean(value);
    if(!raw) return today().slice(0,7);
    if(/^\d{4}-\d{2}$/.test(raw)) return raw;
    return dateValue(value).slice(0,7) || raw;
  }
  function uid2(prefix){ return (typeof uid === "function") ? uid(prefix) : (crypto.randomUUID ? crypto.randomUUID() : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`); }
  function plotNo(v){ return (typeof formatPlotNo === "function") ? formatPlotNo(v) : clean(v).toUpperCase(); }
  function toMarla2(size,unit){ return (typeof toMarla === "function") ? toMarla(size,unit) : Number(size||0); }
  function statusPayment(price, received, input){
    const raw = low(input);
    if(["fully_paid","fully paid","full","paid"].includes(raw)) return "fully_paid";
    if(["partially_paid","partial","partially paid"].includes(raw)) return "partially_paid";
    if(["to_be_paid","to be paid","unpaid"].includes(raw)) return "to_be_paid";
    const p=money(price), r=money(received);
    if(p>0 && r>=p) return "fully_paid";
    if(r>0) return "partially_paid";
    return "to_be_paid";
  }
  function validUnit(unit){
    const u=clean(unit);
    if(/^kanal$/i.test(u)) return "Kanal";
    if(/^marla$/i.test(u)) return "Marla";
    if(/^yards?$/i.test(u)) return "Yards";
    return u || "Marla";
  }
  function propertyType(v){
    const x=low(v);
    if(x.startsWith("com")) return "Commercial";
    return "Residential";
  }
  function construction(v){
    const x=low(v);
    if(x.includes("construct")) return "constructed";
    return "plot";
  }
  function availability(v){
    const x=low(v);
    if(x==="sold") return "sold";
    return "available";
  }
  function normalizeHeader(h){
    return clean(h).toLowerCase().replace(/\s+/g," ").replace(/[_-]/g," ");
  }
  function get(row, names){
    const map = {};
    Object.keys(row || {}).forEach(k => map[normalizeHeader(k)] = row[k]);
    for(const name of names){
      const key = normalizeHeader(name);
      if(map[key] !== undefined) return clean(map[key]);
    }
    return "";
  }
  function escapeHTML(v){
    return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function downloadCSV(filename, columns){
    const csv = columns.map(c => `"${String(c).replaceAll('"','""')}"`).join(",") + "\n";
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function parseCSV(text){
    const rows=[]; let row=[], cur="", quote=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], next=text[i+1];
      if(ch === '"' && quote && next === '"'){ cur += '"'; i++; continue; }
      if(ch === '"'){ quote = !quote; continue; }
      if(ch === "," && !quote){ row.push(cur); cur=""; continue; }
      if((ch === "\n" || ch === "\r") && !quote){
        if(ch === "\r" && next === "\n") i++;
        row.push(cur); cur="";
        if(row.some(x => String(x).trim() !== "")) rows.push(row);
        row=[];
        continue;
      }
      cur += ch;
    }
    row.push(cur);
    if(row.some(x => String(x).trim() !== "")) rows.push(row);
    if(!rows.length) return [];
    const headers=rows[0].map(clean);
    return rows.slice(1).map(r => {
      const obj={};
      headers.forEach((h,i)=>obj[h]=r[i] ?? "");
      return obj;
    });
  }
  function isDataRow(type, row){
    const template = IMPORT_TEMPLATES[type];
    const cols = template?.columns || Object.keys(row || {});
    const first = low(get(row,[cols[0] || ""]));
    if(!first) return false;
    if(first === "note" || first === "notes for this sheet" || first.startsWith("notes for")) return false;
    return cols.some(col => clean(get(row,[col])) !== "");
  }
  function rowsFromMatrix(matrix, type){
    const template = IMPORT_TEMPLATES[type];
    const expected = (template?.columns || []).map(normalizeHeader);
    let headerIndex = -1;
    let headerRow = [];

    for(let i=0; i<matrix.length; i++){
      const row = matrix[i] || [];
      const normalized = row.map(normalizeHeader);
      const matches = expected.filter(h => normalized.includes(h)).length;
      if(matches >= Math.min(2, expected.length)){
        headerIndex = i;
        headerRow = row.map(clean);
        break;
      }
    }

    if(headerIndex === -1){
      throw new Error(`Could not find the column header row for ${template?.title || type}. Make sure this sheet has headings like: ${(template?.columns || []).slice(0,3).join(", ")}.`);
    }

    const rows = [];
    for(let r = headerIndex + 1; r < matrix.length; r++){
      const values = matrix[r] || [];
      const obj = {};
      headerRow.forEach((h, i) => {
        if(h) obj[h] = values[i] ?? "";
      });
      if(isDataRow(type, obj)) rows.push(obj);
    }
    return rows;
  }

  async function parseFile(file, type){
    if(!file) return [];
    const name=file.name.toLowerCase();

    if(name.endsWith(".csv")){
      const csvRows = parseCSV(await file.text()).filter(row => isDataRow(type,row));
      return csvRows;
    }

    if(name.endsWith(".xlsx") || name.endsWith(".xls")){
      if(!window.XLSX) throw new Error("Excel parser is not loaded. Check internet connection and refresh.");
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, {type:"array", cellDates:false, raw:true});
      const expectedSheet = IMPORT_TEMPLATES[type]?.sheetName;
      const sheetName = workbook.SheetNames.find(s => low(s) === low(expectedSheet)) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if(!sheet) throw new Error(`Could not find sheet: ${expectedSheet}.`);

      const matrix = XLSX.utils.sheet_to_json(sheet, {header:1, defval:"", raw:true});
      const rows = rowsFromMatrix(matrix, type);

      const status=el("importStatus");
      if(status) status.textContent = `${file.name} loaded. Reading sheet "${sheetName}". Found ${rows.length} row(s). Click Validate Preview before importing.`;

      return rows;
    }

    throw new Error("Please choose a CSV or Excel file.");
  }

  function findProject(name){
    return state.data.projects.find(p => low(p.name) === low(name));
  }
  function findClientByCNIC(cnic){
    return state.data.clients.find(c => clean(c.cnic) && clean(c.cnic) === clean(cnic));
  }
  function findPlot(projectName, pno){
    return state.data.plots.find(p => low(p.projectName) === low(projectName) && low(p.plotNo) === low(plotNo(pno)));
  }

  function validateRows(type, rows){
    const errors=[], warnings=[], staged=[];
    rows.forEach((row, idx)=>{
      const n = idx + 2;
      try{
        if(type === "projects"){
          const name = get(row,["Project Name","Name"]);
          if(!name) errors.push(`Row ${n}: Project Name is required.`);
          else staged.push({type, name});
        }
        if(type === "plots"){
          const projectName=get(row,["Project Name","Project"]);
          const pno=plotNo(get(row,["Plot Number","Plot No","Plot #"]));
          const size=get(row,["Plot Size","Size"]);
          const unit=validUnit(get(row,["Plot Unit","Unit"]));
          if(!projectName) errors.push(`Row ${n}: Project Name is required.`);
          if(!pno) errors.push(`Row ${n}: Plot Number is required.`);
          if(!findProject(projectName)) warnings.push(`Row ${n}: Project "${projectName}" does not exist yet. It will be created.`);
          staged.push({type, projectName, plotNo:pno, intikalNo:get(row,["Intikal Number","Intikal No"]), plotSize:size, plotUnit:unit, plotSizeMarla:toMarla2(size,unit), khasraNo:get(row,["Khasra Number","Khasra No"]), khatauniNo:get(row,["Khatauni Number","Khatauni No"]), transferredFrom:get(row,["Transferred From"]), propertyType:propertyType(get(row,["Property Type"])), constructionStatus:construction(get(row,["Construction Status"])), availabilityStatus:availability(get(row,["Availability Status"]), "available"), price:money(get(row,["Price"])), notes:get(row,["Notes"])});
        }
        if(type === "clients"){
          const nameEn=get(row,["Client Name English","Client Name","Name English","Name"]);
          const cnic=get(row,["CNIC","Client CNIC"]);
          if(!nameEn) errors.push(`Row ${n}: Client name is required.`);
          staged.push({type, nameEn, nameUr:get(row,["Client Name Urdu","Name Urdu"]), fatherEn:get(row,["Father Name English","Father Name","Father"]), fatherUr:get(row,["Father Name Urdu"]), cnic, phone:get(row,["Phone","Contact"]), addressEn:get(row,["Address English","Address"]), addressUr:get(row,["Address Urdu"]), notes:get(row,["Notes"])});
        }
        if(type === "sellers"){
          const nameEn=get(row,["Seller Name English","Seller Name","Name English","Name"]);
          if(!nameEn) errors.push(`Row ${n}: Seller name is required.`);
          staged.push({type, nameEn, nameUr:get(row,["Seller Name Urdu","Name Urdu"]), fatherEn:get(row,["Father Name English","Father Name","Father"]), fatherUr:get(row,["Father Name Urdu"]), cnic:get(row,["CNIC","Seller CNIC"]), phone:get(row,["Phone","Contact"]), addressEn:get(row,["Address English","Address"]), addressUr:get(row,["Address Urdu"])});
        }
        if(type === "sales"){
          const cnic=get(row,["Client CNIC","CNIC"]);
          const projectName=get(row,["Project Name","Project"]);
          const pno=plotNo(get(row,["Plot Number","Plot No","Plot #"]));
          if(!cnic) errors.push(`Row ${n}: Client CNIC is required.`);
          if(!projectName || !pno) errors.push(`Row ${n}: Project Name and Plot Number are required.`);
          if(cnic && !findClientByCNIC(cnic)) errors.push(`Row ${n}: No client found for CNIC ${cnic}. Import clients first.`);
          if(projectName && pno && !findPlot(projectName,pno)) errors.push(`Row ${n}: No plot found for ${projectName} ${pno}. Import plots first.`);
          staged.push({type, cnic, projectName, plotNo:pno, intikalNo:get(row,["Intikal Number","Intikal No"]), price:money(get(row,["Price","Total Price"])), amountReceived:money(get(row,["Amount Received","Received","Token Amount"]),), dealDate:dateValue(get(row,["Deal Date","Date"])), paymentStatus:get(row,["Payment Status"]), notes:get(row,["Notes"])});
        }
        if(type === "payments"){
          const cnic=get(row,["Client CNIC","CNIC"]);
          const projectName=get(row,["Project Name","Project"]);
          const pno=plotNo(get(row,["Plot Number","Plot No","Plot #"]));
          const amount=money(get(row,["Amount","Payment Amount"]));
          if(!cnic) errors.push(`Row ${n}: Client CNIC is required.`);
          if(!projectName || !pno) errors.push(`Row ${n}: Project Name and Plot Number are required.`);
          if(!amount) errors.push(`Row ${n}: Amount is required.`);
          if(cnic && !findClientByCNIC(cnic)) errors.push(`Row ${n}: No client found for CNIC ${cnic}.`);
          if(projectName && pno && !findPlot(projectName,pno)) errors.push(`Row ${n}: No plot found for ${projectName} ${pno}.`);
          staged.push({type, cnic, projectName, plotNo:pno, paymentType:low(get(row,["Payment Type","Type"])) === "exchange" ? "exchange" : "cash", amount, date:dateValue(get(row,["Date"])) || today(), exchangeItem:get(row,["Exchange Item"]), note:get(row,["Note","Notes"])});
        }
        if(type === "dues"){
          const cnic=get(row,["Client CNIC","CNIC"]);
          const projectName=get(row,["Project Name","Project"]);
          const pno=plotNo(get(row,["Plot Number","Plot No","Plot #"]));
          const amount=money(get(row,["Amount","Due Amount"]));
          if(!cnic) errors.push(`Row ${n}: Client CNIC is required.`);
          if(!projectName || !pno) errors.push(`Row ${n}: Project Name and Plot Number are required.`);
          if(!amount) errors.push(`Row ${n}: Amount is required.`);
          if(cnic && !findClientByCNIC(cnic)) errors.push(`Row ${n}: No client found for CNIC ${cnic}.`);
          if(projectName && pno && !findPlot(projectName,pno)) errors.push(`Row ${n}: No plot found for ${projectName} ${pno}.`);
          const paid=truthy(get(row,["Paid"]));
          const status=low(get(row,["Status"])) || (paid ? "paid" : "unpaid");
          staged.push({type, cnic, projectName, plotNo:pno, dueType:get(row,["Due Type","Type"]) || "Due", amount, discountAmount:money(get(row,["Discount Amount","Discount"])), date:monthValue(get(row,["Month","Date"])) || today().slice(0,7), paid, paidDate:dateValue(get(row,["Paid Date"])), status: status === "waived" ? "waived" : (paid ? "paid" : "unpaid"), note:get(row,["Note","Notes"])});
        }
      }catch(err){
        errors.push(`Row ${n}: ${err.message || err}`);
      }
    });
    return {errors,warnings,staged};
  }

  async function applyImport(type, staged){
    const now = new Date().toISOString();
    const ensureProject = (name)=>{
      let p=findProject(name);
      if(!p){
        p={id:uid2("project"), name, createdAt:now, updatedAt:now};
        state.data.projects.push(p);
      }
      return p;
    };
    const upsertBy = (arr, finder, maker, updater)=>{
      let item = arr.find(finder);
      if(item){ Object.assign(item, updater(item)); item.updatedAt = now; return item; }
      item = maker(); arr.push(item); return item;
    };

    staged.forEach(item=>{
      if(type==="projects"){
        ensureProject(item.name);
      }
      if(type==="plots"){
        ensureProject(item.projectName);
        upsertBy(state.data.plots, p => low(p.projectName)===low(item.projectName) && low(p.plotNo)===low(item.plotNo), () => ({
          id:uid2("plot"), sourceClientId:null, projectName:item.projectName, plotNo:item.plotNo, intikalNo:item.intikalNo, plotSize:item.plotSize, plotUnit:item.plotUnit, plotSizeMarla:item.plotSizeMarla, khasraNo:item.khasraNo, khatauniNo:item.khatauniNo, transferredFrom:item.transferredFrom, propertyType:item.propertyType, constructionStatus:item.constructionStatus, availabilityStatus:item.availabilityStatus, linkedClientId:"", price:item.availabilityStatus==="sold" ? item.price : 0, amountReceived:0, paymentStatus:item.availabilityStatus==="sold" ? "to_be_paid" : "", notes:item.notes, createdAt:now, updatedAt:now
        }), () => ({
          projectName:item.projectName, plotNo:item.plotNo, intikalNo:item.intikalNo, plotSize:item.plotSize, plotUnit:item.plotUnit, plotSizeMarla:item.plotSizeMarla, khasraNo:item.khasraNo, khatauniNo:item.khatauniNo, transferredFrom:item.transferredFrom, propertyType:item.propertyType, constructionStatus:item.constructionStatus, availabilityStatus:item.availabilityStatus, price:item.availabilityStatus==="sold" ? item.price : 0, notes:item.notes
        }));
      }
      if(type==="clients"){
        upsertBy(state.data.clients, c => item.cnic && clean(c.cnic)===clean(item.cnic), () => ({
          id:uid2("client"), nameEn:item.nameEn, nameUr:item.nameUr, fatherEn:item.fatherEn, fatherUr:item.fatherUr, cnic:item.cnic, phone:item.phone, addressEn:item.addressEn, addressUr:item.addressUr, notes:item.notes, createdAt:now, updatedAt:now, paymentStatus:""
        }), () => ({
          nameEn:item.nameEn, nameUr:item.nameUr, fatherEn:item.fatherEn, fatherUr:item.fatherUr, cnic:item.cnic, phone:item.phone, addressEn:item.addressEn, addressUr:item.addressUr, notes:item.notes
        }));
      }
      if(type==="sellers"){
        upsertBy(state.data.sellers, s => item.cnic && clean(s.cnic)===clean(item.cnic), () => ({
          id:uid2("seller"), nameEn:item.nameEn, nameUr:item.nameUr, fatherEn:item.fatherEn, fatherUr:item.fatherUr, cnic:item.cnic, phone:item.phone, addressEn:item.addressEn, addressUr:item.addressUr, createdAt:now, updatedAt:now
        }), () => ({
          nameEn:item.nameEn, nameUr:item.nameUr, fatherEn:item.fatherEn, fatherUr:item.fatherUr, cnic:item.cnic, phone:item.phone, addressEn:item.addressEn, addressUr:item.addressUr
        }));
      }
      if(type==="sales"){
        const client=findClientByCNIC(item.cnic);
        const plot=findPlot(item.projectName,item.plotNo);
        if(client && plot){
          plot.availabilityStatus="sold";
          plot.linkedClientId=client.id;
          plot.intikalNo=item.intikalNo || plot.intikalNo || "";
          plot.price=item.price;
          plot.amountReceived=item.amountReceived;
          plot.dealDate=item.dealDate || plot.dealDate || "";
          plot.paymentStatus=statusPayment(item.price,item.amountReceived,item.paymentStatus);
          plot.notes=item.notes || plot.notes || "";
          plot.updatedAt=now;
          ensureSecurityDuesForAllSoldPlots?.();
        }
      }
      if(type==="payments"){
        const client=findClientByCNIC(item.cnic);
        const plot=findPlot(item.projectName,item.plotNo);
        if(client && plot){
          const exists=state.data.payments.some(p => p.clientId===client.id && p.plotId===plot.id && Number(p.amount)===Number(item.amount) && p.date===item.date && p.type===item.paymentType && clean(p.exchangeItem)===clean(item.exchangeItem));
          if(!exists){
            state.data.payments.push({id:uid2("payment"), clientId:client.id, plotId:plot.id, type:item.paymentType, amount:item.amount, date:item.date, note:item.note, exchangeItem:item.exchangeItem, createdAt:now});
            plot.amountReceived = Number(plot.amountReceived||0) + Number(item.amount||0);
            plot.paymentStatus = statusPayment(plot.price, plot.amountReceived, "");
            plot.updatedAt=now;
          }
        }
      }
      if(type==="dues"){
        const client=findClientByCNIC(item.cnic);
        const plot=findPlot(item.projectName,item.plotNo);
        if(client && plot){
          const exists=state.data.dues.some(d => d.clientId===client.id && d.plotId===plot.id && low(d.type)===low(item.dueType) && d.date===item.date && Number(d.amount)===Number(item.amount));
          if(!exists){
            state.data.dues.push({id:uid2("due"), clientId:client.id, plotId:plot.id, type:item.dueType, amount:item.amount, discountAmount:item.discountAmount, date:item.date, paid:item.paid, paidDate:item.paidDate, status:item.status, note:item.note, createdAt:now, updatedAt:now});
          }
        }
      }
    });
    state.data = HPHStorage.normalize(state.data);
    // Do not call saveData() here, because saveData() schedules a background Supabase sync.
    // Import already needs a direct save. Running both at the same time can cause duplicate primary-key errors.
    HPHStorage.save(state.data);

    if(state.onlineMode && window.HPHSupabase?.ready){
      try{
        state.remoteSaveInFlight = true;
        state.remoteSaveQueued = false;
        clearTimeout(state.remoteSaveTimer);
        await HPHSupabase.saveAll(state.data);
        state.data = await HPHSupabase.loadAll();
        HPHStorage.save(state.data);
      }catch(err){
        console.error("Import Supabase save failed:", err);
        alert("Import saved locally but online database sync failed: " + (err.message || err));
      }finally{
        state.remoteSaveInFlight = false;
      }
    }

    renderDashboard(); renderClients(); renderPlots(); renderSellers(); renderReports();
  }

  function renderImportPreview(){
    const type = el("importTypeSelect")?.value || "plots";
    const template=IMPORT_TEMPLATES[type];
    const result = validated || {errors:[], warnings:[], staged:[]};
    const head = el("importPreviewHead"), body=el("importPreviewBody"), summary=el("importPreviewSummary"), errorsBox=el("importErrors");
    if(!head || !body) return;
    const columns = template.columns;
    head.innerHTML = `<tr>${columns.map(c=>`<th>${escapeHTML(c)}</th>`).join("")}</tr>`;
    const rows = importedRows.slice(0,50);
    body.innerHTML = rows.length ? rows.map(row=>`<tr>${columns.map(c=>`<td>${escapeHTML(get(row,[c]))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="empty-state">No rows loaded yet. Choose the Excel file after selecting the correct Import Type.</td></tr>`;
    if(summary) summary.textContent = importedRows.length ? `${importedRows.length} row(s) loaded. ${result.staged?.length||0} valid row(s).` : "Upload a template file to preview rows before importing.";
    const messages=[...(result.errors||[]), ...(result.warnings||[])];
    if(errorsBox){
      errorsBox.classList.toggle("hidden", messages.length===0);
      errorsBox.innerHTML = messages.map(m=>`<div>${escapeHTML(m)}</div>`).join("");
    }
    const runBtn=el("runImportBtn");
    if(runBtn) runBtn.disabled = !validated || result.errors.length>0 || result.staged.length===0;
  }

  async function chooseFile(file){
    const status=el("importStatus");
    try{
      const type = el("importTypeSelect")?.value || "plots";
      importedRows = await parseFile(file, type);
      validated = null;
      if(status) status.textContent = `${file.name} loaded with ${importedRows.length} row(s). Click Validate Preview before importing. For Excel workbooks, the matching sheet for the selected import type is used.`;
      renderImportPreview();
    }catch(err){
      importedRows=[]; validated=null;
      if(status) status.textContent = "Import failed: " + (err.message || err);
      renderImportPreview();
    }
  }

  function initImportPage(){
    const nav = document.querySelector('[data-page="import"]');
    if(!nav) return;
    el("downloadImportTemplateBtn")?.addEventListener("click", ()=>{
      const type=el("importTypeSelect")?.value || "plots";
      downloadCSV(`PH_${IMPORT_TEMPLATES[type].title.replaceAll(" ","_")}_Import_Template.csv`, IMPORT_TEMPLATES[type].columns);
    });
    el("chooseImportFileBtn")?.addEventListener("click", ()=>el("importFileInput")?.click());
    el("importFileInput")?.addEventListener("change", e=>chooseFile(e.target.files?.[0]));
    el("importTypeSelect")?.addEventListener("change", ()=>{
      importedRows=[]; validated=null;
      if(el("importStatus")) el("importStatus").textContent="No file selected.";
      renderImportPreview();
    });
    el("validateImportBtn")?.addEventListener("click", ()=>{
      const type=el("importTypeSelect")?.value || "plots";
      validated = validateRows(type, importedRows);
      renderImportPreview();
    });
    el("runImportBtn")?.addEventListener("click", ()=>{
      if(!validated || validated.errors.length) return;
      const type=el("importTypeSelect")?.value || "plots";
      if(!confirm(`Import ${validated.staged.length} valid ${IMPORT_TEMPLATES[type].title} row(s)? Download a backup first if this is important data.`)) return;
      el("runImportBtn").disabled = true;
      applyImport(type, validated.staged).then(()=>{
        alert("Import finished. Check the related page and download a backup.");
        el("runImportBtn").disabled = false;
      }).catch(err=>{
        console.error("Import failed:", err);
        alert("Import failed: " + (err.message || err));
        el("runImportBtn").disabled = false;
      });
    });
    renderImportPreview();
  }

  const oldGoPage = window.goPage || goPage;
  window.goPage = goPage = function(page, options={}){
    oldGoPage(page, options);
    if(page === "import") renderImportPreview();
  };

  document.addEventListener("DOMContentLoaded", initImportPage);
})();
