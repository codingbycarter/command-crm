/* Command CRM — Wholesale Desk
   Single-file app. Data lives in this browser (localStorage). Back up with Import / export. */
(() => {
const KEY = "commandcrm.wholesale.v1";
const STAGES = ["Lead","Contacted","Appointment","Offer made","Under contract","Marketing to buyers","Assigned","Closed","Dead"];
const STAGE_PROB = {"Lead":.05,"Contacted":.1,"Appointment":.2,"Offer made":.3,"Under contract":.6,"Marketing to buyers":.7,"Assigned":.9,"Closed":1,"Dead":0};
const BUYER_TYPES = ["Cash buyer","Fix & flip investor","Landlord / buy & hold","High-net-worth private investor","Private lender","Developer","Institutional / fund"];
const PA_CHECK = [
  "My broker has approved this wholesale transaction in writing (PA Act 52: wholesaling is licensed activity)",
  "Seller received written disclosure that this is a wholesale transaction and I intend to transfer my interest without taking title",
  "Contract states the seller's right to obtain an appraisal",
  "Contract states the right to cancel (Act 52) and how to send notice",
  "Contract states payments are refunded within 10 business days of a cancellation notice",
  "Written disclosure of my interest given to the end buyer",
  "If property is in Philadelphia: City Residential Property Wholesaler License (L&I) is active",
  "Title company / attorney reviewed the assignment"
];
const NJ_CHECK = [
  "Confirmed with a NJ attorney whether my activity requires a NJ license (NJSA 45:15) — I hold a PA license only",
  "Track pending NJ bill A4278 (2026), which would require a license for wholesale transactions",
  "Attorney review period (3 business days) accounted for in the timeline",
  "Written disclosure of my interest given to seller and end buyer",
  "Title company / attorney reviewed the assignment"
];

// ---------- storage ----------
const empty = () => ({buyers:[], deals:[], sellers:[], tasks:[], log:[]});
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { db = empty(); }
for (const k of Object.keys(empty())) db[k] = db[k] || [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alertBox("Could not save: " + e.message); } };
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
const today = () => new Date().toISOString().slice(0,10);
const log = (msg) => { db.log.unshift({at:new Date().toISOString(), msg}); db.log = db.log.slice(0,300); };

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => (n===""||n==null||isNaN(n)) ? "—" : "$" + Math.round(Number(n)).toLocaleString();
const num = v => v===""||v==null ? null : Number(v);
const list = s => String(s||"").split(/[,;]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
const alertBox = msg => { const d=document.createElement("div"); d.className="banner"; d.textContent=msg; $("#view").prepend(d); setTimeout(()=>d.remove(),5000); };

function buyerScore(b){
  let s = 0;
  if (b.pofVerified) s += 30;
  if (b.closedDeals > 0) s += Math.min(25, b.closedDeals*5);
  if (b.funding === "Cash") s += 15;
  if (b.tier === "A") s += 15; else if (b.tier === "B") s += 8;
  if (b.emailConsent) s += 10;
  if (b.lastContact) { const days=(Date.now()-new Date(b.lastContact))/864e5; if (days < 30) s += 5; }
  if (b.dnc) s = Math.min(s, 10);
  return Math.min(100, s);
}
function dealCalc(d){
  const arv=num(d.arv)||0, rep=num(d.repairs)||0, pct=(num(d.maoPct)||70)/100, fee=num(d.targetFee)||0;
  const mao = arv*pct - rep - fee;
  const contract=num(d.contractPrice), ask=num(d.buyerPrice);
  const spread = (contract!=null && ask!=null) ? ask - contract : (num(d.assignmentFee)||null);
  return {mao, spread};
}
function matchBuyers(d){
  const area = [d.city,d.county,d.state].map(x=>String(x||"").toLowerCase());
  const price = num(d.buyerPrice) ?? num(d.contractPrice);
  return db.buyers.filter(b => {
    if (b.dnc) return false;
    const mk = list(b.markets);
    const areaOk = !mk.length || mk.some(m => area.some(a => a && (a.includes(m) || m.includes(a))));
    const minOk = b.minPrice==null||b.minPrice===""||price==null||price >= Number(b.minPrice);
    const maxOk = b.maxPrice==null||b.maxPrice===""||price==null||price <= Number(b.maxPrice);
    return areaOk && minOk && maxOk;
  }).sort((a,b)=>buyerScore(b)-buyerScore(a));
}
const followUps = () => {
  const t = today(); const out=[];
  db.buyers.forEach(b=>{ if(b.nextFollowUp && b.nextFollowUp<=t) out.push({kind:"Investor",name:b.name,date:b.nextFollowUp,id:b.id,ref:"buyers"}); });
  db.sellers.forEach(s=>{ if(s.nextFollowUp && s.nextFollowUp<=t) out.push({kind:"Seller",name:s.name,date:s.nextFollowUp,id:s.id,ref:"sellers"}); });
  db.tasks.forEach(k=>{ if(!k.done && k.due && k.due<=t) out.push({kind:"Task",name:k.title,date:k.due,id:k.id,ref:"tasks"}); });
  return out.sort((a,b)=>a.date.localeCompare(b.date));
};

// ---------- modal / forms ----------
function modal(html, onMount){
  $("#modalRoot").innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
  const bg = $("#modalRoot .modal-bg");
  bg.addEventListener("click", e => { if (e.target===bg) closeModal(); });
  onMount && onMount($("#modalRoot .modal"));
}
const closeModal = () => $("#modalRoot").innerHTML = "";
function field(name,label,val,type="text",opts){
  if (type==="select") return `<div><label>${label}</label><select name="${name}">${opts.map(o=>`<option ${o===val?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  if (type==="textarea") return `<div style="grid-column:1/-1"><label>${label}</label><textarea name="${name}">${esc(val)}</textarea></div>`;
  if (type==="checkbox") return `<div><label style="display:flex;gap:6px;align-items:center;color:var(--ink)"><input type="checkbox" name="${name}" ${val?"checked":""} style="width:auto"> ${label}</label></div>`;
  return `<div><label>${label}</label><input name="${name}" type="${type}" value="${esc(val)}"></div>`;
}
function readForm(form){
  const o={};
  form.querySelectorAll("input,select,textarea").forEach(el=>{
    if(!el.name) return;
    o[el.name] = el.type==="checkbox" ? el.checked : (el.type==="number" ? (el.value===""?"":Number(el.value)) : el.value.trim());
  });
  return o;
}

function editBuyer(id){
  const b = db.buyers.find(x=>x.id===id) || {type:BUYER_TYPES[0],tier:"B",funding:"Cash"};
  modal(`<h2>${id?"Edit":"New"} investor / buyer</h2>
  <form class="grid g3">
    ${field("name","Full name *",b.name)}${field("company","Company / LLC",b.company)}${field("type","Type",b.type,"select",BUYER_TYPES)}
    ${field("email","Email",b.email,"email")}${field("phone","Phone",b.phone)}${field("linkedin","LinkedIn URL",b.linkedin)}
    ${field("markets","Target markets (comma separated)",b.markets)}${field("strategy","Strategy",b.strategy,"select",["Fix & flip","Buy & hold","BRRRR","New construction","Multifamily","Lending","Mixed"])}
    ${field("propertyTypes","Property types",b.propertyTypes)}
    ${field("minPrice","Min price",b.minPrice,"number")}${field("maxPrice","Max price",b.maxPrice,"number")}${field("funding","Funding",b.funding,"select",["Cash","Hard money","Private lender","Conventional","Unknown"])}
    ${field("tier","Tier",b.tier,"select",["A","B","C"])}${field("closedDeals","Deals closed with me",b.closedDeals||0,"number")}${field("source","Lead source (e.g. Apollo, referral, REIA meetup)",b.source)}
    ${field("lastContact","Last contact",b.lastContact,"date")}${field("nextFollowUp","Next follow-up",b.nextFollowUp,"date")}${field("tags","Tags",b.tags)}
    ${field("pofVerified","Proof of funds verified",b.pofVerified,"checkbox")}${field("emailConsent","Opted in to deal emails",b.emailConsent,"checkbox")}${field("dnc","Do not contact",b.dnc,"checkbox")}
    ${field("notes","Notes / relationship history",b.notes,"textarea")}
    <div style="grid-column:1/-1" class="row">
      <button class="primary" type="submit">Save</button><button type="button" id="cancel">Cancel</button>
      <span class="spacer"></span>${id?'<button type="button" class="danger" id="del">Delete</button>':""}
    </div>
  </form>`, m => {
    m.querySelector("#cancel").onclick = closeModal;
    const del = m.querySelector("#del");
    if (del) del.onclick = () => { if (confirmInline(del)) { db.buyers = db.buyers.filter(x=>x.id!==id); log("Deleted investor "+b.name); save(); closeModal(); render(); } };
    m.querySelector("form").onsubmit = e => {
      e.preventDefault(); const v = readForm(e.target);
      if (!v.name) return alertBox("Name is required.");
      const dup = db.buyers.find(x => x.id!==id && v.email && x.email && x.email.toLowerCase()===v.email.toLowerCase());
      if (dup) return alertBox("An investor with that email already exists: " + dup.name);
      if (id) Object.assign(b, v); else db.buyers.push({...v, id:uid(), createdAt:today()});
      log((id?"Updated":"Added")+" investor "+v.name); save(); closeModal(); render();
    };
  });
}
// two-click delete instead of a browser confirm() dialog
function confirmInline(btn){ if (btn.dataset.armed) return true; btn.dataset.armed="1"; btn.textContent="Click again to delete"; return false; }

function editDeal(id){
  const d = db.deals.find(x=>x.id===id) || {stage:"Lead",state:"PA",maoPct:70,checks:{}};
  modal(`<h2>${id?"Edit":"New"} deal</h2>
  <form class="grid g3">
    ${field("address","Property address *",d.address)}${field("city","City / neighborhood",d.city)}${field("county","County",d.county)}
    ${field("state","State",d.state,"select",["PA","NJ"])}${field("stage","Stage",d.stage,"select",STAGES)}${field("propertyType","Property type",d.propertyType)}
    ${field("beds","Beds",d.beds,"number")}${field("baths","Baths",d.baths,"number")}${field("sqft","Sq ft",d.sqft,"number")}
    ${field("sellerName","Seller name",d.sellerName)}${field("sellerPhone","Seller phone",d.sellerPhone)}${field("motivation","Seller motivation",d.motivation)}
    ${field("arv","ARV (after-repair value)",d.arv,"number")}${field("repairs","Repair estimate",d.repairs,"number")}${field("maoPct","MAO % of ARV",d.maoPct,"number")}
    ${field("targetFee","Target assignment fee",d.targetFee,"number")}${field("contractPrice","Contract price with seller",d.contractPrice,"number")}${field("buyerPrice","Price to end buyer",d.buyerPrice,"number")}
    ${field("contractDate","Contract signed",d.contractDate,"date")}${field("closingDate","Expected closing",d.closingDate,"date")}${field("assignedBuyer","Assigned buyer",d.assignedBuyer,"select",["",...db.buyers.map(b=>b.name)])}
    ${field("publish","Show on public deals page",d.publish,"checkbox")}
    ${field("notes","Notes",d.notes,"textarea")}
    <div style="grid-column:1/-1" id="calc" class="card"></div>
    <div style="grid-column:1/-1"><h3>Compliance checklist</h3><div id="checks"></div></div>
    <div style="grid-column:1/-1" class="row">
      <button class="primary" type="submit">Save</button><button type="button" id="cancel">Cancel</button>
      ${id?'<button type="button" id="match">Match buyers</button>':""}
      <span class="spacer"></span>${id?'<button type="button" class="danger" id="del">Delete</button>':""}
    </div>
  </form>`, m => {
    const form = m.querySelector("form");
    const drawChecks = () => {
      const st = form.state.value, items = st==="PA" ? PA_CHECK : NJ_CHECK;
      m.querySelector("#checks").innerHTML = items.map((t,i)=>`<label class="check"><input type="checkbox" data-k="${st}-${i}" ${d.checks?.[st+"-"+i]?"checked":""}> <span>${esc(t)}</span></label>`).join("");
    };
    const drawCalc = () => {
      const v = readForm(form), c = dealCalc(v);
      m.querySelector("#calc").innerHTML = `<b>Deal math</b> · Max allowable offer: <b>${money(c.mao)}</b>
        <span class="muted">(ARV × ${v.maoPct||70}% − repairs − fee)</span> · Your spread: <b>${money(c.spread)}</b>
        ${num(v.contractPrice)!=null && num(v.contractPrice) > c.mao ? ' <span class="pill bad">Contract is above MAO</span>':''}`;
    };
    drawChecks(); drawCalc();
    form.addEventListener("input", drawCalc);
    form.state.addEventListener("change", drawChecks);
    m.querySelector("#cancel").onclick = closeModal;
    const del = m.querySelector("#del");
    if (del) del.onclick = () => { if (confirmInline(del)) { db.deals = db.deals.filter(x=>x.id!==id); log("Deleted deal "+d.address); save(); closeModal(); render(); } };
    const mb = m.querySelector("#match"); if (mb) mb.onclick = () => { closeModal(); showMatches(id); };
    form.onsubmit = e => {
      e.preventDefault(); const v = readForm(form); delete v[""];
      if (!v.address) return alertBox("Address is required.");
      const checks = {...(d.checks||{})};
      m.querySelectorAll("#checks input").forEach(c => checks[c.dataset.k] = c.checked);
      v.checks = checks;
      const c = dealCalc(v); v.assignmentFee = c.spread;
      if (v.publish && !complianceDone(v)) { v.publish = false; alertBox("Not published: finish the compliance checklist first."); }
      if (id) { if (d.stage!==v.stage) log(`Deal ${d.address}: ${d.stage} → ${v.stage}`); Object.assign(d, v); }
      else db.deals.push({...v, id:uid(), createdAt:today()});
      save(); closeModal(); render();
    };
  });
}
const complianceDone = d => { const items = d.state==="PA"?PA_CHECK:NJ_CHECK; return items.every((_,i)=>d.checks?.[d.state+"-"+i]); };

function editSeller(id){
  const s = db.sellers.find(x=>x.id===id) || {status:"New"};
  modal(`<h2>${id?"Edit":"New"} seller lead</h2><form class="grid g3">
    ${field("name","Owner name *",s.name)}${field("phone","Phone",s.phone)}${field("email","Email",s.email)}
    ${field("address","Property address",s.address)}${field("city","City",s.city)}${field("state","State",s.state||"PA","select",["PA","NJ"])}
    ${field("source","Source (referral, direct mail, driving for dollars…)",s.source)}${field("status","Status",s.status,"select",["New","Contacted","Interested","Not interested","Converted to deal"])}${field("nextFollowUp","Next follow-up",s.nextFollowUp,"date")}
    ${field("dnc","Do not contact",s.dnc,"checkbox")}${field("notes","Notes",s.notes,"textarea")}
    <div style="grid-column:1/-1" class="row"><button class="primary">Save</button><button type="button" id="cancel">Cancel</button>
      ${id?'<button type="button" id="toDeal">Convert to deal</button>':""}<span class="spacer"></span>${id?'<button type="button" class="danger" id="del">Delete</button>':""}</div>
  </form>`, m => {
    m.querySelector("#cancel").onclick = closeModal;
    const del=m.querySelector("#del"); if(del) del.onclick=()=>{ if(confirmInline(del)){ db.sellers=db.sellers.filter(x=>x.id!==id); save(); closeModal(); render(); } };
    const td=m.querySelector("#toDeal"); if(td) td.onclick=()=>{ db.deals.push({id:uid(),address:s.address||s.name,city:s.city,state:s.state||"PA",stage:"Contacted",sellerName:s.name,sellerPhone:s.phone,maoPct:70,checks:{},createdAt:today()}); s.status="Converted to deal"; log("Converted seller "+s.name+" to deal"); save(); closeModal(); location.hash="deals"; render(); };
    m.querySelector("form").onsubmit=e=>{ e.preventDefault(); const v=readForm(e.target); if(!v.name) return alertBox("Name is required.");
      if(id) Object.assign(s,v); else db.sellers.push({...v,id:uid(),createdAt:today()}); save(); closeModal(); render(); };
  });
}

function showMatches(id){
  const d = db.deals.find(x=>x.id===id); const ms = matchBuyers(d);
  const emailable = ms.filter(b=>b.email && b.emailConsent);
  const c = dealCalc(d);
  const body = `New off-market deal: ${d.address}${d.city?", "+d.city:""}

Price: ${money(d.buyerPrice||d.contractPrice)}
Est. ARV: ${money(d.arv)} · Est. repairs: ${money(d.repairs)}
${d.beds||"?"} bd / ${d.baths||"?"} ba${d.sqft?" · "+d.sqft+" sqft":""}

Disclosure: I hold an equitable interest in this property under a contract to purchase and intend to assign that interest for a fee. I am a licensed real estate salesperson in Pennsylvania. Figures are estimates; please do your own due diligence.

Reply to this email if you'd like access or a walkthrough.
To stop receiving deals, reply "unsubscribe".`;
  modal(`<h2>Matched buyers · ${esc(d.address)}</h2>
  <p class="muted">${ms.length} match by market and price. ${emailable.length} have an email and opted in. Investors marked do-not-contact are excluded.</p>
  <table><tr><th>Name</th><th>Type</th><th>Markets</th><th>Range</th><th>Score</th><th>Email OK</th></tr>
  ${ms.map(b=>`<tr><td>${esc(b.name)}</td><td>${esc(b.type)}</td><td>${esc(b.markets)}</td><td>${money(b.minPrice)}–${money(b.maxPrice)}</td><td>${buyerScore(b)}</td><td>${b.emailConsent&&b.email?'<span class="pill ok">yes</span>':'<span class="pill warn">no</span>'}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">No matches yet. Add investors with markets and price ranges.</td></tr>'}</table>
  <h3 style="margin-top:16px">Deal blast draft</h3>
  <p class="muted">Nothing is sent automatically. Copy the draft or open it in your email app. Addresses go in BCC so buyers don't see each other.</p>
  <pre class="draft" id="draft">${esc(body)}</pre>
  <div class="row"><button id="copy">Copy draft</button>
  <a class="btn primary" href="mailto:?bcc=${encodeURIComponent(emailable.map(b=>b.email).join(","))}&subject=${encodeURIComponent("Off-market deal: "+(d.city||d.address))}&body=${encodeURIComponent(body)}">Open in email app (${emailable.length} BCC)</a>
  <button id="close">Close</button></div>`, m => {
    m.querySelector("#close").onclick = closeModal;
    m.querySelector("#copy").onclick = () => navigator.clipboard.writeText(body).then(()=>m.querySelector("#copy").textContent="Copied");
  });
}

// ---------- views ----------
const views = {
dashboard(){
  const active = db.deals.filter(d=>!["Closed","Dead"].includes(d.stage));
  const uc = db.deals.filter(d=>["Under contract","Marketing to buyers","Assigned"].includes(d.stage));
  const closed = db.deals.filter(d=>d.stage==="Closed");
  const realized = closed.reduce((s,d)=>s+(Number(d.assignmentFee)||0),0);
  const weighted = active.reduce((s,d)=>s+(Number(d.assignmentFee)||Number(d.targetFee)||0)*STAGE_PROB[d.stage],0);
  const fu = followUps();
  const pubIssues = db.deals.filter(d=>uc.includes(d) && !complianceDone(d));
  const counts = STAGES.map(s=>[s, db.deals.filter(d=>d.stage===s).length]);
  const max = Math.max(1,...counts.map(c=>c[1]));
  return `<h1>Dashboard</h1>
  ${db.buyers.length+db.deals.length===0?`<div class="banner">No records yet. Add your first investor or deal, import a CSV from Apollo, or <a href="#data">load clearly labeled sample data</a>.</div>`:""}
  <div class="grid g4">
    ${kpi(db.buyers.length,"Investors & buyers")}${kpi(db.buyers.filter(b=>b.pofVerified).length,"Proof of funds verified")}
    ${kpi(active.length,"Active deals")}${kpi(uc.length,"Under contract / marketing")}
    ${kpi(money(weighted),"Weighted pipeline (fees)")}${kpi(money(realized),"Fees realized (closed)")}
    ${kpi(closed.length ? Math.round(closed.length/Math.max(1,closed.length+db.deals.filter(d=>d.stage==="Dead").length)*100)+"%" : "—","Win rate")}${kpi(fu.length,"Follow-ups due")}
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Pipeline by stage</h3>
      ${counts.map(([s,n])=>`<div class="row" style="margin:4px 0"><span style="width:150px" class="muted">${s}</span><div style="flex:1;background:var(--bg);border-radius:6px;height:14px"><div style="width:${n/max*100}%;background:var(--accent);height:14px;border-radius:6px"></div></div><b style="width:24px;text-align:right">${n}</b></div>`).join("")}
    </div>
    <div class="card"><h3>Due today or overdue</h3>
      ${fu.length? `<table>${fu.slice(0,10).map(f=>`<tr><td><span class="pill">${f.kind}</span></td><td>${esc(f.name)}</td><td class="muted">${f.date}</td></tr>`).join("")}</table>` : '<p class="muted">Nothing due.</p>'}
      ${pubIssues.length?`<h3 style="margin-top:12px">Compliance gaps</h3>${pubIssues.map(d=>`<div><span class="pill bad">open items</span> <a href="#" data-deal="${d.id}">${esc(d.address)}</a></div>`).join("")}`:""}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Recent activity</h3>${db.log.slice(0,8).map(l=>`<div class="muted" style="font-size:12px">${l.at.slice(0,16).replace("T"," ")} · ${esc(l.msg)}</div>`).join("")||'<p class="muted">No activity yet.</p>'}</div>`;
},
deals(){
  return `<div class="row"><h1>Deal pipeline</h1><span class="spacer"></span><button class="primary" id="newDeal">+ Deal</button></div>
  <p class="muted">Drag cards between stages. Click a card to edit, run the numbers, check compliance, or match buyers.</p>
  <div class="kanban">${STAGES.map(s=>`<div class="col" data-stage="${s}"><h4>${s} · ${db.deals.filter(d=>d.stage===s).length}</h4>
    ${db.deals.filter(d=>d.stage===s && hit(d)).map(d=>`<div class="dcard" draggable="true" data-deal="${d.id}">
      <div class="t">${esc(d.address)}</div><div class="muted" style="font-size:12px">${esc(d.city||"")} ${d.state||""}${d.sample?' <span class="pill sample">sample</span>':""}</div>
      <div style="font-size:12px;margin-top:4px">Fee: <b>${money(d.assignmentFee||d.targetFee)}</b> · MAO ${money(dealCalc(d).mao)}</div>
      ${["Under contract","Marketing to buyers","Assigned"].includes(d.stage)&&!complianceDone(d)?'<span class="pill bad">compliance open</span>':""}
    </div>`).join("")}</div>`).join("")}</div>`;
},
buyers(){
  const rows = db.buyers.filter(hit).sort((a,b)=>buyerScore(b)-buyerScore(a));
  return `<div class="row"><h1>Investors & buyers</h1><span class="spacer"></span><button class="primary" id="newBuyer">+ Investor</button></div>
  <p class="muted">Your buyers list: cash buyers, landlords, flippers and high-net-worth private investors. Score weighs proof of funds, track record, funding and consent.</p>
  <div class="card"><table><tr><th>Name</th><th>Type</th><th>Markets</th><th>Range</th><th>Funding</th><th>Score</th><th>Follow-up</th><th></th></tr>
  ${rows.map(b=>`<tr data-buyer="${b.id}" style="cursor:pointer"><td><b>${esc(b.name)}</b>${b.sample?' <span class="pill sample">sample</span>':""}<div class="muted" style="font-size:12px">${esc(b.company||"")}</div></td>
    <td>${esc(b.type)}</td><td>${esc(b.markets)}</td><td>${money(b.minPrice)}–${money(b.maxPrice)}</td><td>${esc(b.funding)}${b.pofVerified?' <span class="pill ok">POF</span>':""}</td>
    <td>${buyerScore(b)}</td><td class="muted">${b.nextFollowUp||""}</td><td>${b.dnc?'<span class="pill bad">DNC</span>':""}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">No investors yet.</td></tr>'}</table></div>`;
},
sellers(){
  return `<div class="row"><h1>Seller leads</h1><span class="spacer"></span><button class="primary" id="newSeller">+ Seller lead</button></div>
  <div class="banner">Pennsylvania (Act 52) and Philadelphia rules apply to soliciting homeowners. Contact sellers by phone or text only with their consent, honor do-not-call requests, and never pressure or mislead.</div>
  <div class="card"><table><tr><th>Owner</th><th>Property</th><th>Source</th><th>Status</th><th>Follow-up</th></tr>
  ${db.sellers.filter(hit).map(s=>`<tr data-seller="${s.id}" style="cursor:pointer"><td><b>${esc(s.name)}</b>${s.dnc?' <span class="pill bad">DNC</span>':""}</td><td>${esc(s.address||"")} ${esc(s.city||"")}</td><td>${esc(s.source||"")}</td><td><span class="pill">${esc(s.status)}</span></td><td class="muted">${s.nextFollowUp||""}</td></tr>`).join("")||'<tr><td colspan="5" class="muted">No seller leads yet.</td></tr>'}</table></div>`;
},
analyzer(){
  return `<h1>Deal analyzer</h1><p class="muted">Quick numbers before you make an offer. Save it as a deal when it works.</p>
  <div class="card"><form id="an" class="grid g4">
    ${field("arv","ARV",200000,"number")}${field("repairs","Repairs",40000,"number")}${field("maoPct","MAO % of ARV",70,"number")}${field("targetFee","Target fee",10000,"number")}
    ${field("holding","Buyer holding + closing costs",15000,"number")}${field("contractPrice","Your offer to seller",85000,"number")}
  </form><div id="anOut" style="margin-top:12px"></div></div>`;
},
outreach(){
  const t = TEMPLATES;
  return `<h1>Outreach drafts</h1>
  <p class="muted">Edit the brackets, then copy. Use these to build relationships with investors. Every email includes an opt-out line, and nothing sends from here.</p>
  ${Object.entries(t).map(([k,v])=>`<div class="card" style="margin-bottom:12px"><div class="row"><h3 style="margin:0">${k}</h3><span class="spacer"></span><button data-copy="${esc(k)}">Copy</button></div><pre class="draft">${esc(v)}</pre></div>`).join("")}`;
},
tasks(){
  const fu = followUps();
  return `<h1>Follow-ups & tasks</h1>
  <div class="grid g2"><div class="card"><h3>Due now</h3>${fu.map(f=>`<div class="row" style="padding:4px 0"><span class="pill">${f.kind}</span> ${esc(f.name)} <span class="muted">${f.date}</span></div>`).join("")||'<p class="muted">All clear.</p>'}</div>
  <div class="card"><h3>Tasks</h3><form id="taskForm" class="row"><input name="title" placeholder="New task" style="flex:2"><input name="due" type="date" style="flex:1"><button class="primary">Add</button></form>
  ${db.tasks.map(k=>`<label class="check"><input type="checkbox" data-task="${k.id}" ${k.done?"checked":""}><span style="${k.done?"text-decoration:line-through;color:var(--muted)":""}">${esc(k.title)} <span class="muted">${k.due||""}</span></span></label>`).join("")}</div></div>`;
},
compliance(){
  return `<h1>Compliance</h1>
  <div class="banner">This is a working checklist, not legal advice. Confirm with your broker and a real estate attorney in each state before you sign or market a deal.</div>
  <div class="grid g2">
  <div class="card"><h3>Pennsylvania (incl. Philadelphia)</h3>
    <p>Act 52 of 2024 (effective Jan 4, 2025) makes residential wholesaling licensed real estate activity under RELRA. You must be licensed and work through your broker. Wholesale contracts must include specific disclosures and give the consumer a right to cancel.</p>
    <p>In Philadelphia, L&I also requires a <b>Residential Property Wholesaler License</b> for anyone in the business of buying or soliciting residential properties for resale.</p>
    <ul>${PA_CHECK.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>
    <p class="muted">Sources: PA Association of Realtors (Act 52 overview); phila.gov (Residential Property Wholesaler License).</p></div>
  <div class="card"><h3>New Jersey</h3>
    <p>NJ has no wholesaling-specific statute yet, but the Real Estate Brokers and Salespersons Act (NJSA 45:15) applies, and a single act can violate it. Bill A4278, introduced Feb 2026, would require a license for wholesale transactions. Your PA license does not cover NJ.</p>
    <ul>${NJ_CHECK.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>
  <div class="card"><h3>Outreach rules</h3><ul>
    <li><b>Email (CAN-SPAM):</b> accurate sender and subject, your physical address, a working opt-out honored within 10 business days.</li>
    <li><b>Calls and texts (TCPA):</b> no autodialed or prerecorded or AI-voice calls, and no marketing texts, without prior express written consent. Scrub against the National Do Not Call Registry.</li>
    <li><b>Contact data:</b> use lawful sources only (your own network, Apollo or other licensed providers, public records). Don't scrape sites that prohibit it.</li>
    <li><b>Investors:</b> you are selling a contract interest in real estate. Don't pool investor money or promise returns; that can turn a deal into a securities offering.</li>
  </ul></div>
  <div class="card"><h3>Before a deal goes on the public site</h3><ul>
    <li>All checklist items for that state are ticked (the app enforces this).</li>
    <li>Your license disclosure in <code>assets/config.js</code> is filled in with your brokerage details.</li>
    <li>Export the public deal sheet (Import / export) and commit <code>deals.json</code>.</li></ul></div>
  </div>`;
},
data(){
  return `<h1>Import / export</h1>
  <div class="grid g2">
  <div class="card"><h3>Back up & restore</h3><p class="muted">Your data lives in this browser. Download a backup regularly, or before switching computers.</p>
    <div class="row"><button id="exportJson" class="primary">Download full backup (.json)</button><label class="btn">Restore backup<input type="file" id="importJson" accept=".json" hidden></label></div></div>
  <div class="card"><h3>Import investors from CSV</h3><p class="muted">Works with Apollo exports and most spreadsheets. Recognized columns: name / first name + last name, email, phone, company, title, city, state, linkedin. Duplicates (same email) are skipped.</p>
    <label class="btn">Choose CSV<input type="file" id="importCsv" accept=".csv" hidden></label> <span id="csvMsg" class="muted"></span></div>
  <div class="card"><h3>Export CSV</h3><div class="row"><button id="csvBuyers">Investors CSV</button><button id="csvDeals">Deals CSV</button><button id="csvSellers">Sellers CSV</button></div></div>
  <div class="card"><h3>Public deal sheet</h3><p class="muted">Downloads <code>deals.json</code> with only deals marked "Show on public deals page" that passed the compliance checklist. Seller names and phone numbers are never included. Upload it to the repo to update the public site.</p>
    <button id="pubDeals" class="primary">Download deals.json</button></div>
  <div class="card"><h3>Sample data</h3><p class="muted">Loads a few records labeled "sample" so you can try the features. Remove them anytime.</p>
    <div class="row"><button id="loadSample">Load sample data</button><button id="clearSample">Remove sample data</button></div></div>
  <div class="card"><h3>Delete everything</h3><p class="muted">Erases all records in this browser. Download a backup first.</p><button id="wipe" class="danger">Delete all data</button></div>
  </div>`;
}
};
const kpi = (v,l) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
let q = "";
const hit = o => !q || JSON.stringify(o).toLowerCase().includes(q);

const TEMPLATES = {
"Intro — high-net-worth / private investor": `Subject: Off-market residential deals in Philly & South Jersey

Hi [First name],

I'm Brittany Carter, a licensed real estate salesperson in Pennsylvania. I source off-market residential properties in Philadelphia and South Jersey and offer them to a small private list of investors before they hit the market.

[Personal line: e.g. "I saw you've been active in rental properties in Delaware County" / "[Mutual contact] suggested I reach out."]

If it's useful, I'd send you only what fits your buy box: area, price range and strategy. Would a 10-minute call next week work to hear what you look for?

Best,
Brittany Carter
[Phone] · [Brokerage name and address]

If you'd rather not hear from me, just reply "no thanks" and I won't email again.`,
"Follow-up (no reply, 5–7 days)": `Subject: Re: Off-market deals in Philly & South Jersey

Hi [First name], quick follow-up. I have a [3BR rowhome in Kensington] under contract this week at [price] with an est. ARV of [ARV]. Happy to send the numbers if you're buying in that area right now.

Brittany
Reply "no thanks" to stop these emails.`,
"Buy-box questionnaire": `Thanks for connecting! To send you only relevant deals:
1. Which areas/zip codes do you buy in?
2. Price range, and max rehab budget?
3. Strategy: flip, rental, BRRRR, or new construction?
4. Funding: cash, hard money, or private lender? Can you share proof of funds?
5. How many deals do you want per month?
6. Best way to reach you, and how fast can you close?`,
"LinkedIn connection note (under 300 characters)": `Hi [First name], I source off-market residential deals in Philadelphia & South Jersey for a small private investor list. Your work in [area/asset type] caught my eye, and I'd love to connect and learn what you're buying.`
};

// ---------- render & events ----------
function render(){
  const v = (location.hash.slice(1) || "dashboard");
  document.querySelectorAll(".side a.nav").forEach(a => a.classList.toggle("active", a.getAttribute("href")==="#"+v));
  $("#view").innerHTML = (views[v] || views.dashboard)();
  bind(v);
}
function bind(v){
  const V = $("#view");
  V.querySelectorAll("[data-deal]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); editDeal(el.dataset.deal); }));
  V.querySelectorAll("[data-buyer]").forEach(el => el.onclick = () => editBuyer(el.dataset.buyer));
  V.querySelectorAll("[data-seller]").forEach(el => el.onclick = () => editSeller(el.dataset.seller));
  const on = (id, fn) => { const el = V.querySelector("#"+id); if (el) el.onclick = fn; };
  on("newDeal", () => editDeal()); on("newBuyer", () => editBuyer()); on("newSeller", () => editSeller());
  if (v==="deals") {
    V.querySelectorAll(".dcard").forEach(c => c.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", c.dataset.deal)));
    V.querySelectorAll(".col").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag"));
      col.addEventListener("drop", e => { e.preventDefault(); const d = db.deals.find(x=>x.id===e.dataTransfer.getData("text/plain"));
        if (d && d.stage!==col.dataset.stage) { log(`Deal ${d.address}: ${d.stage} → ${col.dataset.stage}`); d.stage = col.dataset.stage; save(); } render(); });
    });
  }
  if (v==="analyzer") {
    const f = V.querySelector("#an"), out = V.querySelector("#anOut");
    const calc = () => { const x = readForm(f); const c = dealCalc(x);
      const buyerAll = (Number(x.contractPrice)||0) + (Number(x.targetFee)||0) + (Number(x.repairs)||0) + (Number(x.holding)||0);
      const buyerProfit = (Number(x.arv)||0) - buyerAll;
      out.innerHTML = `<div class="grid g3">${kpi(money(c.mao),"Max allowable offer")}${kpi(money(buyerAll),"Buyer's all-in cost")}${kpi(money(buyerProfit),"Buyer's est. profit")}</div>
        <p class="muted" style="margin-top:8px">${Number(x.contractPrice) > c.mao ? "Your offer is above MAO. Negotiate lower or lower your fee." : "Your offer is within MAO."} Most flip buyers want roughly 15–20% of ARV as profit; this one is ${x.arv?Math.round(buyerProfit/x.arv*100):0}%.</p>`; };
    f.addEventListener("input", calc); calc();
  }
  if (v==="outreach") V.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => navigator.clipboard.writeText(TEMPLATES[b.dataset.copy]).then(()=>b.textContent="Copied"));
  if (v==="tasks") {
    V.querySelector("#taskForm").onsubmit = e => { e.preventDefault(); const x = readForm(e.target); if (!x.title) return; db.tasks.unshift({id:uid(), ...x, done:false}); save(); render(); };
    V.querySelectorAll("[data-task]").forEach(c => c.onchange = () => { const k = db.tasks.find(t=>t.id===c.dataset.task); k.done = c.checked; save(); render(); });
  }
  if (v==="data") bindData(V);
}

// ---------- CSV ----------
function parseCSV(text){
  const rows=[]; let row=[], cell="", inQ=false;
  for (let i=0;i<text.length;i++){ const ch=text[i];
    if (inQ){ if (ch==='"'){ if (text[i+1]==='"'){cell+='"';i++;} else inQ=false; } else cell+=ch; }
    else if (ch==='"') inQ=true; else if (ch===','){row.push(cell);cell="";}
    else if (ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=""; }
    else cell+=ch; }
  if (cell||row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(c=>c.trim()));
}
const toCSV = (rows, cols) => [cols.join(","), ...rows.map(r=>cols.map(c=>`"${String(r[c]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
const download = (name, text, type="text/plain") => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };

function bindData(V){
  V.querySelector("#exportJson").onclick = () => download(`command-crm-backup-${today()}.json`, JSON.stringify(db,null,2), "application/json");
  V.querySelector("#importJson").onchange = async e => { try { const x = JSON.parse(await e.target.files[0].text());
      if (!x.buyers || !x.deals) throw new Error("not a Command CRM backup"); db = {...empty(), ...x}; save(); alertBox("Backup restored."); render(); }
    catch (err) { alertBox("Restore failed: " + err.message); } };
  V.querySelector("#importCsv").onchange = async e => {
    const rows = parseCSV(await e.target.files[0].text()); if (rows.length<2) return;
    const h = rows[0].map(x=>x.trim().toLowerCase());
    const col = (...names) => h.findIndex(x => names.includes(x));
    const ix = {name:col("name","full name"), first:col("first name","firstname"), last:col("last name","lastname"), email:col("email","email address","work email"),
      phone:col("phone","mobile phone","work direct phone","corporate phone","phone number"), company:col("company","company name","account name"),
      title:col("title","job title"), city:col("city"), state:col("state"), linkedin:col("linkedin","person linkedin url","linkedin url")};
    const g = (r,k) => ix[k]>=0 ? (r[ix[k]]||"").trim() : "";
    let added=0, skipped=0;
    rows.slice(1).forEach(r => {
      const name = g(r,"name") || [g(r,"first"),g(r,"last")].filter(Boolean).join(" ");
      const email = g(r,"email");
      if (!name) { skipped++; return; }
      if (email && db.buyers.some(b=>b.email && b.email.toLowerCase()===email.toLowerCase())) { skipped++; return; }
      db.buyers.push({id:uid(), name, email, phone:g(r,"phone"), company:g(r,"company"), linkedin:g(r,"linkedin"),
        markets:[g(r,"city"),g(r,"state")].filter(Boolean).join(", "), type:"High-net-worth private investor", tier:"C", funding:"Unknown",
        notes:g(r,"title")?("Title: "+g(r,"title")):"", source:"CSV import", emailConsent:false, createdAt:today()});
      added++;
    });
    log(`CSV import: ${added} added, ${skipped} skipped`); save();
    V.querySelector("#csvMsg").textContent = `${added} added, ${skipped} skipped (duplicates or no name). Imported contacts start as not opted in.`;
  };
  V.querySelector("#csvBuyers").onclick = () => download("investors.csv", toCSV(db.buyers,["name","company","type","email","phone","linkedin","markets","strategy","minPrice","maxPrice","funding","tier","pofVerified","emailConsent","dnc","lastContact","nextFollowUp","source","tags","notes"]), "text/csv");
  V.querySelector("#csvDeals").onclick = () => download("deals.csv", toCSV(db.deals,["address","city","county","state","stage","propertyType","beds","baths","sqft","arv","repairs","contractPrice","buyerPrice","assignmentFee","contractDate","closingDate","assignedBuyer","notes"]), "text/csv");
  V.querySelector("#csvSellers").onclick = () => download("sellers.csv", toCSV(db.sellers,["name","phone","email","address","city","state","source","status","nextFollowUp","dnc","notes"]), "text/csv");
  V.querySelector("#pubDeals").onclick = () => {
    const pub = db.deals.filter(d=>d.publish && complianceDone(d) && !["Closed","Dead"].includes(d.stage)).map(d=>({
      id:d.id, title:`${d.beds?d.beds+"BR ":""}${d.propertyType||"Residential"}, ${d.city||""}`.trim(), area:`${d.city||""}${d.city?", ":""}${d.state}`,
      type:d.propertyType||"", beds:d.beds, baths:d.baths, sqft:d.sqft, askingPrice:d.buyerPrice||d.contractPrice, arv:d.arv, repairEstimate:d.repairs,
      status:d.stage==="Assigned"?"Pending":"Available", notes:""}));
    download("deals.json", JSON.stringify(pub,null,2), "application/json");
    alertBox(`${pub.length} deal(s) exported. Upload deals.json to the repo to publish.`);
  };
  V.querySelector("#loadSample").onclick = () => { loadSample(); save(); alertBox("Sample data loaded (labeled 'sample')."); render(); };
  V.querySelector("#clearSample").onclick = () => { for (const k of ["buyers","deals","sellers"]) db[k]=db[k].filter(x=>!x.sample); save(); alertBox("Sample data removed."); render(); };
  const w = V.querySelector("#wipe"); w.onclick = () => { if (!w.dataset.armed){ w.dataset.armed=1; w.textContent="Click again to erase everything"; return; } db = empty(); save(); render(); };
}
function loadSample(){
  const S = {sample:true, createdAt:today()};
  db.buyers.push(
    {...S,id:uid(),name:"SAMPLE — Jordan Reyes",company:"Reyes Holdings LLC",type:"Fix & flip investor",email:"jordan@example.com",markets:"Philadelphia, Kensington, Fishtown",minPrice:60000,maxPrice:180000,funding:"Cash",tier:"A",closedDeals:2,pofVerified:true,emailConsent:true},
    {...S,id:uid(),name:"SAMPLE — Dana Whitfield",company:"Whitfield Family Office",type:"High-net-worth private investor",email:"dana@example.com",markets:"Camden County, Cherry Hill, Haddonfield",minPrice:150000,maxPrice:450000,funding:"Cash",tier:"B",closedDeals:0,pofVerified:false,emailConsent:true},
    {...S,id:uid(),name:"SAMPLE — Marcus Lee",company:"",type:"Landlord / buy & hold",email:"marcus@example.com",markets:"Delaware County, Philadelphia",minPrice:50000,maxPrice:140000,funding:"Hard money",tier:"C",emailConsent:false,nextFollowUp:today()});
  db.deals.push(
    {...S,id:uid(),address:"SAMPLE — 123 Example St",city:"Kensington, Philadelphia",county:"Philadelphia",state:"PA",stage:"Under contract",beds:3,baths:1,sqft:1120,arv:185000,repairs:55000,maoPct:70,targetFee:10000,contractPrice:62000,buyerPrice:74000,assignmentFee:12000,checks:{}},
    {...S,id:uid(),address:"SAMPLE — 45 Sample Ave",city:"Cherry Hill",county:"Camden",state:"NJ",stage:"Offer made",beds:4,baths:2,sqft:1900,arv:420000,repairs:70000,maoPct:70,targetFee:15000,checks:{}});
  db.sellers.push({...S,id:uid(),name:"SAMPLE — Pat Owner",address:"78 Placeholder Rd",city:"Pennsauken",state:"NJ",source:"Referral",status:"Interested",nextFollowUp:today()});
}

// ---------- shell ----------
window.addEventListener("hashchange", render);
$("#search").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); render(); });
document.addEventListener("keydown", e => {
  if (e.key==="/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) { e.preventDefault(); $("#search").focus(); }
  if (e.key==="Escape") closeModal();
});
$("#quickDeal").onclick = () => editDeal();
$("#quickBuyer").onclick = () => editBuyer();
const theme = localStorage.getItem("commandcrm.theme"); if (theme) document.documentElement.dataset.theme = theme;
$("#themeBtn").onclick = () => { const t = document.documentElement.dataset.theme==="dark" ? "" : "dark"; document.documentElement.dataset.theme = t; localStorage.setItem("commandcrm.theme", t); };
render();
})();
