
/* ============ CONFIG (edit here) ============ */
const CONFIG = {
  brand: "Laroz",
  apiBaseUrl: "https://YOUR-RENDER-SERVICE.onrender.com", // replace after deploying the backend
  currency: "ج.م",
  orderTypes: ["Pickup", "Delivery"]
};

/* ============ MENU DATA (edit here) ============
   Item format: [name, price, flags]
   - price: a number, or [["label",price],["label",price]] for items with several prices
   - flags: "n" = NEW on the original menu, "c" = name/price needs owner verification
   Names are kept exactly as printed on the menu. Open the site with #check to see the verify marks (⚠). */
const mk=(id,name,items)=>({id,name,items:items.map(([n,p,f=""],i)=>({id:id+i,name:n,variants:Array.isArray(p)?p:[["",p]],isNew:f.includes("n"),check:f.includes("c"),image:""}))});
const MENU = [
 mk("hot-drinks","Hot Drinks",[["Tea",20],["Tea Flavour",30],["Herbs",30],["Turkish Coffee",30],["Hazelnut Coffee",55],["Hot Oreo",55],["Hot Chocolate",60],["Hot Marshmelo",65,"c"],["Hot Lotus",65],["Hot Cinnamon",55],["Hot Sahlab",55]]),
 mk("espresso","Espresso",[["Amricano",55,"c"],["Mocca",65],["Cappuccino",70],["Latte",60],["Spanish Latte",75],["Nescafe Latte",55],["Nescafe Black",35],["Mecato",48,"c"],["Matcha",60],["Espresso",[["S",40],["D",50]]],["Cortado",55],["Avocado Espresso",60]]),
 mk("waffle","Waffle",[["Nutella",65],["Kender",65,"c"],["Lotus",75],["Dark Chocit",65,"c"],["Pestachio",85,"c"],["White Chocolate",60],["Nutella Banana",65]]),
 mk("breakfast","Breakfast",[["Italian Breakfast",55],["Egyptian Style",60],["Healthy Breakfast",55],["Cheese Mix",60],["Mix Chocolate",55],["Banana Bliss",70,"n"],["Strawberry Nutella",65],["Basturma Toast",55],["Turkey & Cheese Toast",65],["Toasty Pizza",60,"n"]]),
 mk("milk-shake","Milk Shake",[["Vanella",55,"c"],["Chocolate",65],["Caramel",70],["Oreo",60],["Strawberry",75],["Blueberry",55],["Mango",35],["Red Velvet",48,"n"],["Kender",60,"c"],["Pestachio",40,"cn"],["Lutas",55,"c"],["Coconut",60]]),
 mk("pancakes","Pancakes",[["Dark Chocolate",[["Price 1",80],["Price 2",65]],"c"],["Pestachio",[["Price 1",110],["Price 2",80]],"cn"],["Nutella",[["Price 1",85],["Price 2",70]],"c"],["White Chocolate",[["Price 1",80],["Price 2",65]],"c"],["Kender",[["Price 1",75],["Price 2",60]],"c"],["Mix Chocolate",[["Price 1",110],["Price 2",95]],"c"]]),
 mk("dessert","Dessert",[["Cheese Cake",75],["Galaxy",90],["Kender",85,"c"],["Red Velvet",95],["Molten Cake",80]]),
 mk("ice-coffee","Ice Coffee",[["Ice Amricano",55,"c"],["Ice Latte",65],["Ice Mocca",70],["Ice Cappuccino",75],["Ice Spanish",75],["Ice Caramel",75],["Ice Matcha",65]]),
 mk("frappe","Frappe",[["Classic",60],["Breey",72,"c"],["Strawberry",75,"n"],["Chocolate",70],["Vanella",60,"c"],["Caramel",70],["Hazelnut",65],["Pistachio",90]]),
 mk("coffee-boba","Coffee Boba",[["Ice Latte Boba",75],["Ice Matcha Boba",85,"n"],["Ice Spanish Latte Boba",85],["Ice Caramel Latte Boba",65],["Ice Mocha Boba",60]]),
 mk("sparkling-boba","Sparkling Boba",[["Bluebarry Boba",70,"c"],["Passion Fruit Boba",65],["Lemon Mint Boba",55],["Mix Berries Boba",75],["Mango Boba",60],["Watermelon Boba",70,"n"],["Strawberry Boba",55]]),
 mk("milk-shake-boba","Milk Shake Boba",[["Chocolate Boba",80],["Vanella Boba",75,"c"],["Strawberry Boba",70],["Oreo Boba",85],["Caramel Boba",80],["Coffee Boba",65],["Peanut Butter",70,"n"]]),
 mk("smoothie","Smoothie",[["Lemmon Ment",60,"c"],["Strawberry",60],["Watermelon",65],["Mango",65],["Pasion Fruit",60,"c"],["Blue Berry",70],["Kiwi",55],["Ppineapple",60,"c"]]),
 mk("soda","Soda",[["Lemmon Ment",55,"c"],["Cherry Cola",50],["Strawberry",60],["Blue Soda",55],["Itallian Soda",65,"c"],["Blue Berry",75],["Mango Peach",65]]),
 mk("fresh-juice","Fresh Juice",[["Lemmon Ment",55,"c"],["Lemmon",50,"c"],["Bananna Mmilk",60,"c"],["Strawberry",52],["Mango",65],["Guafa",60,"c"],["Avocado",90],["Kiwi",75]])
];

/* ============ STATE ============ */
const KEY="laroz-cart-v1";
const ICON={"hot-drinks":"🍵","espresso":"☕","waffle":"🧇","breakfast":"🍳","milk-shake":"🥤","pancakes":"🥞","dessert":"🍰","ice-coffee":"🧊","frappe":"🥛","coffee-boba":"🧋","sparkling-boba":"🍹","milk-shake-boba":"🧋","smoothie":"🍓","soda":"🥤","fresh-juice":"🧃"};
const RM = matchMedia("(prefers-reduced-motion:reduce)").matches;
let fresh=null,prevN=null,lock=0,active=null,skipBump=false;
const S=b=>`<svg viewBox="0 0 32 32" fill="none" stroke="#243C37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const glass=c=>S(`<path d="M8 8h16l-2 19H10z" fill="#FFFCF6"/><path d="M9.2 15h13.6l-1.2 12h-11.2z" fill="${c}" stroke="none"/><path d="M8 8h16M17 8l4-5"/>`);
const boba=c=>S(`<path d="M8 12h16l-2 15H10z" fill="#FFFCF6"/><path d="M9.3 18h13.4l-.8 9H10.1z" fill="${c}" stroke="none"/><path d="M7 12h18M17 12l3-9"/><circle cx="13" cy="25" r="1.6" fill="#243C37" stroke="none"/><circle cx="17" cy="25" r="1.6" fill="#243C37" stroke="none"/><circle cx="20.5" cy="24.5" r="1.6" fill="#243C37" stroke="none"/>`);
const cup=S(`<path d="M6 12h16v6a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" fill="#FFFCF6"/><path d="M22 14h2a3 3 0 0 1 0 6h-2M5 28h18"/><path d="M11 4c-1 2 1 3 0 5M16 4c-1 2 1 3 0 5" stroke="#E69A48"/>`);
const ice=S(`<path d="M8 8h16l-2 19H10z" fill="#FFFCF6"/><path d="M9.2 14h13.6l-1.2 13h-11.2z" fill="#79523B" stroke="none"/><rect x="11" y="15" width="5" height="5" rx="1" fill="#FFFCF6" stroke="none" opacity=".8"/><rect x="16.5" y="19" width="4.5" height="4.5" rx="1" fill="#FFFCF6" stroke="none" opacity=".8"/><path d="M8 8h16M17 8l4-5"/>`);
const waffle=S(`<rect x="5" y="5" width="22" height="22" rx="6" fill="#E69A48"/><path d="M5 13h22M5 19h22M13 5v22M19 5v22"/>`);
const pan=S(`<rect x="5" y="19" width="22" height="7" rx="3.5" fill="#E69A48"/><rect x="6" y="13" width="20" height="7" rx="3.5" fill="#E69A48"/><rect x="7" y="7" width="18" height="7" rx="3.5" fill="#E69A48"/><path d="M9 10.5h14" stroke="#79523B" stroke-width="3"/>`);
const cake=S(`<rect x="5" y="16" width="22" height="11" rx="3" fill="#79523B"/><path d="M5 16c0-3 3-4 5-4h12c2 0 5 1 5 4z" fill="#FFFCF6"/><circle cx="16" cy="8" r="2.5" fill="#E69A48"/>`);
const plate=S(`<circle cx="16" cy="16" r="12" fill="#E9EBDF"/><path d="M9 16c0-4 3-6 6-6s8 2 8 6-4 7-8 7-6-3-6-7z" fill="#fff"/><circle cx="16" cy="16" r="3" fill="#E69A48" stroke="none"/>`);
const GLYPH={"hot-drinks":cup,espresso:cup,waffle,breakfast:plate,"milk-shake":glass("#79523B"),pancakes:pan,dessert:cake,"ice-coffee":ice,frappe:ice,"coffee-boba":boba("#79523B"),"sparkling-boba":boba("#278E89"),"milk-shake-boba":boba("#A5AD91"),smoothie:glass("#A5AD91"),soda:glass("#278E89"),"fresh-juice":glass("#E69A48")};
const ico=id=>GLYPH[id]||cup;
const TL={Pickup:"استلام من الكافيه",Delivery:"توصيل"};
const LAST="laroz-last-v1";
function openBadge(){ const el=$("openNow"); try{ const h=parseInt(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hourCycle:"h23",timeZone:"Africa/Cairo"}).format(new Date()),10); const on=h>=10||h<2; el.className="open"+(on?"":" off"); el.innerHTML=`<i></i>${on?"مفتوح دلوقتي":"مقفول دلوقتي · بنفتح 10 الصبح"}`; }catch(e){ el.remove(); } }
function renderAgain(){
  const box=$("again"); if(Object.keys(cart).length){ if(box.firstChild){ box.innerHTML=""; requestAnimationFrame(measure); } return; }
  if(box.firstChild) return; let l={}; try{ l=JSON.parse(localStorage.getItem(LAST)||"{}"); }catch(e){}
  const ks=Object.keys(l).filter(k=>byId[k]&&l[k]>0);
  if(!ks.length||Object.keys(cart).length){ box.innerHTML=""; return; }
  const sum=ks.reduce((a,k)=>a+byId[k].price*l[k],0);
  box.innerHTML=`<button class="again" id="againBtn"><span>اطلب تاني زي آخر مرة</span><small>${ks.map(k=>l[k]+"× "+esc(byId[k].name)).join("، ")}</small><b>${money(sum)}</b></button>`;
  $("againBtn").onclick=()=>{ ks.forEach(k=>cart[k]=l[k]); save(); renderCart(); openCart(true); }; requestAnimationFrame(measure);
}
const showCheck = location.hash==="#check";
const byId = {}; /* one entry per orderable item/size: sku = productId_variantIndex */
MENU.forEach(c=>c.items.forEach(p=>p.variants.forEach(([l,pr],i)=>{byId[p.id+"_"+i]={name:p.name+(l?` (${l})`:""),price:pr};})));
let cart = {};
try{ const s=JSON.parse(localStorage.getItem(KEY)||"{}"); for(const k in s){ if(byId[k] && s[k]>0) cart[k]=s[k]; } }catch(e){}
const save=()=>{ try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){} };
const money=n=>(Math.round(n*100)/100).toString()+(CONFIG.currency?" "+CONFIG.currency:"");
const $=id=>document.getElementById(id);
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ============ RENDER ============ */
function renderChips(){
  $("chips").innerHTML = MENU.map((c,i)=>`<button class="chip" data-c="${c.id}" ${i===0?'aria-current="true"':''}>${ico(c.id)}${c.name}</button>`).join("")+'<i class="pill" id="pill"></i>';
}
function normalizeSearch(value){
  return String(value||"").toLocaleLowerCase("ar")
    .normalize("NFD").replace(/[\u064B-\u065F\u0670\u0640]/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[^\p{L}\p{N}]+/gu," ").trim();
}
function renderMenu(){
  const rawQ=$("q").value.trim();
  const q=normalizeSearch(rawQ);
  const total = MENU.reduce((n,c)=>n+c.items.length,0);
  if(total===0){
    $("menu").innerHTML = `<div class="empty"><b>The menu is being added.</b><br>Add the products in the MENU list at the top of the script (see the comments there).</div>`;
    return;
  }
  let html="", matched=0, matchedCats=0;
  MENU.forEach(c=>{
    const items=c.items.filter(p=>!q||normalizeSearch(p.name+" "+c.name).includes(q));
    matched+=items.length; if(items.length) matchedCats++;
    if(!items.length) return;
    html+=`<section class="cat" id="cat-${c.id}"><h2 class="rv">${c.name}</h2><div class="grid">`+
    items.map(p=>`<article class="card rv">
      ${p.image?`<span class="th"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="44" height="44"></span>`:`<span class="tile" aria-hidden="true">${ico(c.id)}</span>`}<div class="info">
      <h3>${esc(p.name)}${p.isNew?' <span class="new">New</span>':''}${p.check&&showCheck?' ⚠':''}</h3>
      </div><div class="act">${p.variants.length===1
        ? `<span class="price">${money(p.variants[0][1])}</span><button class="add" data-add="${p.id}_0" aria-label="أضف ${esc(p.name)} للسلة">أضف</button>`
        : p.variants.map(([l,pr],i)=>`<button class="add vb" data-add="${p.id}_${i}" aria-label="أضف ${esc(p.name)} ${esc(l)} بسعر ${pr}">${esc(l)} · ${pr}</button>`).join("")}</div></article>`).join("")+
    `</div></section>`;
  });
  $("menu").innerHTML = html || `<div class="empty"><b>ملقيناش نتيجة لـ “${esc(rawQ)}”</b><br>جرّب اسم تاني أو كلمة أقصر.</div>`;
  $("searchMeta").textContent = q ? `${matched} نتيجة في ${matchedCats} قسم` : `${total} منتج في ${MENU.length} قسم`;
  $("clearSearch").classList.toggle("show",!!rawQ);
  $("resetSearch").hidden = !rawQ;
}
function totals(){
  let n=0,t=0; for(const k in cart){ n+=cart[k]; t+=cart[k]*byId[k].price; } return {n,t};
}
function renderCart(){
  const {n,t}=totals();
  $("count").textContent=n; if(prevN!==null&&n!==prevN&&!skipBump){ bump($("count")); bump($("stickyTotal")); } skipBump=false; prevN=n;
  $("sticky").classList.toggle("on",n>0);
  $("stickyCount").textContent=`شوف السلة · ${n} ${n===1?"صنف":n===2?"صنفين":n<=10?"أصناف":"صنف"}`;
  $("stickyTotal").textContent=money(t);
  $("total").textContent=money(t);
  const ids=Object.keys(cart);
  $("items").innerHTML = ids.length? ids.map(k=>{const p=byId[k];return `<div class="item${k===fresh?' fresh':''}" data-row="${k}"><div class="nm">${esc(p.name)}<small>${money(p.price)} للواحد · ${money(p.price*cart[k])}</small><button class="rm" data-rm="${k}">شيل</button></div>
    <div class="qty"><button data-dec="${k}" aria-label="قلّل ${esc(p.name)}">−</button><b data-q="${k}">${cart[k]}</b><button data-inc="${k}" aria-label="زوّد ${esc(p.name)}">+</button></div></div>`}).join("")
    : `<div class="empty">السلة فاضية.<br>اختار حاجة حلوة من المنيو.</div>`;
  fresh=null; renderAgain();
  $("foot").style.display = ids.length?"block":"none";
  $("waWarn").innerHTML = `<div class="warn">بعد تأكيد الطلب هنبعته للكافيه، وهيظهرلك تأكيد هنا.</div>`;
  $("send").textContent = "تأكيد وإرسال الطلب";
  $("send").disabled = !ids.length;
}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),1400)}
function setQty(k,v){
  if(v<=0){ delete cart[k]; save(); const r=document.querySelector(`[data-row="${k}"]`); if(r&&!RM){ r.classList.add("out"); setTimeout(renderCart,190); } else renderCart(); return; }
  cart[k]=v; save(); renderCart(); const q=document.querySelector(`[data-q="${k}"]`); if(q) bump(q);
}
function openCart(o){ $("sheet").classList.toggle("on",o); $("overlay").classList.toggle("on",o); if(o) $("closeCart").focus(); }

/* ============ WHATSAPP ============ */
function buildMessage(){
  const name=$("cname").value.trim(), note=$("cnote").value.trim(), type=$("otype").value, addr=$("caddr").value.trim();
  const L=[`*طلب جديد – LAROZ*`,"",`الاسم: ${name}`,`نوع الطلب: ${TL[type]||type}`,"","*الأصناف:*"];
  for(const k in cart){const p=byId[k];L.push(`${p.name} × ${cart[k]}`,`  سعر الواحد: ${money(p.price)}`,`  الإجمالي: ${money(p.price*cart[k])}`);}
  L.push("",`*الإجمالي الكلي: ${money(totals().t)}*`);
  if(type==="Delivery") L.push("",`العنوان: ${addr}`);
  if(note) L.push("",`ملحوظات: ${note}`);
  return L.join("\n");
}
function makeOrderId(){return "LZ-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();}
async function send(){
  if(!Object.keys(cart).length) return;
  const name=$("cname").value.trim(), type=$("otype").value, addr=$("caddr").value.trim(), note=$("cnote").value.trim();
  if(!name){ toast("اكتب اسمك الأول"); $("cname").focus(); return; }
  if(type==="Delivery" && !addr){ toast("اكتب عنوان التوصيل لو سمحت"); $("caddr").focus(); return; }
  if(!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl.includes("YOUR-RENDER-SERVICE")){ toast("لسه محتاجين نربط رابط السيرفر"); return; }
  const button=$("send"), oldText=button.textContent;
  button.disabled=true; button.textContent="جاري إرسال طلبك...";
  const orderId=makeOrderId();
  const items=Object.keys(cart).map(k=>({name:byId[k].name,quantity:cart[k],unitPrice:byId[k].price}));
  const payload={orderId,customerName:name,orderType:type,items,total:totals().t,deliveryAddress:type==="Delivery"?addr:"-",notes:note};
  try{
    const response=await fetch(CONFIG.apiBaseUrl.replace(/\/$/,"")+"/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok || !result.success) throw new Error(result.message||"تعذر إرسال الطلب. حاول مرة تانية.");
    try{localStorage.setItem(LAST,JSON.stringify(cart));}catch(e){}
    $("successOrderId").textContent=result.orderId||orderId;
    $("successTotal").textContent=money(totals().t);
    $("successScreen").hidden=false;
    openCart(false);
    // Clear only after backend confirms WhatsApp accepted the message.
    cart={}; save(); renderCart();
  }catch(err){
    toast(err.message||"حصلت مشكلة أثناء إرسال الطلب");
  }finally{
    button.disabled=!Object.keys(cart).length; button.textContent=oldText;
  }
}
function copyMsg(){ const t=$("preview").textContent; try{navigator.clipboard.writeText(t).then(()=>toast("اتنسخت"),()=>toast("ماقدرتش أنسخ، انسخ بإيدك"));}catch(e){toast("ماقدرتش أنسخ، انسخ بإيدك");} }

/* ============ EVENTS ============ */
document.addEventListener("click",e=>{
  const t=e.target.closest("button"); if(!t) return;
  if(t.dataset.add){ const k=t.dataset.add; if(!cart[k]) fresh=k; skipBump=!RM&&!!t.animate; fly(t,k); pop(t); setQty(k,(cart[k]||0)+1); }
  else if(t.dataset.inc){ if(cart[t.dataset.inc]) setQty(t.dataset.inc,cart[t.dataset.inc]+1); }
  else if(t.dataset.dec){ if(cart[t.dataset.dec]) setQty(t.dataset.dec,cart[t.dataset.dec]-1); }
  else if(t.dataset.rm) setQty(t.dataset.rm,0);
  else if(t.dataset.c){ const el=$("cat-"+t.dataset.c); jumping=true; clearTimeout(jt); jt=setTimeout(()=>{jumping=false;},300); if(el) el.scrollIntoView({behavior:RM?"auto":"smooth",block:"start"}); setActive(t.dataset.c,true); }
});
$("openCart").onclick=$("openCart2").onclick=()=>openCart(true);
$("closeCart").onclick=$("overlay").onclick=()=>openCart(false);
document.addEventListener("keydown",e=>{if(e.key==="Escape")openCart(false)});
/* ---- motion helpers ---- */
const KF={bump:[{transform:"scale(1)"},{transform:"scale(1.5)",offset:.4},{transform:"scale(1)"}],bounce:[{transform:"translateY(0) scale(1)"},{transform:"translateY(-7px) scale(1.1)",offset:.3},{transform:"translateY(1px) scale(.96)",offset:.6},{transform:"translateY(0) scale(1)"}]};
function bump(el,c="bump"){ if(RM||!el||!el.animate) return; el.animate(KF[c]||KF.bump,{duration:c==="bounce"?450:350}); }
function pop(t){ if(!t.dataset.t){ t.dataset.t=t.textContent; } t.textContent="\u2713"; t.classList.add("ok"); if(!RM&&t.animate) t.animate([{transform:"scale(1)"},{transform:"scale(1.18)",offset:.4},{transform:"scale(1)"}],{duration:400}); clearTimeout(t._h); t._h=setTimeout(()=>{t.textContent=t.dataset.t;t.classList.remove("ok");},650); }
function fly(from,k){
  const name=byId[k]?byId[k].name:"Item", msg=()=>toast(name+" اتضاف للسلة");
  const done=()=>{ bump($("count")); bump($("stickyTotal")); bump($("openCart"),"bounce"); msg(); };
  if(RM||!from.animate){ msg(); return; }
  if(document.querySelectorAll(".fly").length>8){ done(); return; }
  const card=from.closest(".card"), src=card&&(card.querySelector(".th")||card.querySelector(".tile"));
  const a=(src||from).getBoundingClientRect(), b=$("openCart").getBoundingClientRect();
  const S0=a.width/64, S1=.38, x0=a.left+a.width/2-32, y0=a.top+a.height/2-32;
  const dx=b.left+b.width/2-32-x0, dy=b.top+b.height/2-32-y0, lift=Math.min(120,Math.abs(dy)*.35+50);
  const d=document.createElement("div"); d.className="fly"; d.setAttribute("aria-hidden","true");
  const im=src&&src.querySelector("img");
  if(im){ const m=new Image(); m.src=im.currentSrc||im.src; m.alt=""; d.appendChild(m); }
  else { d.classList.add("ic"); const cat=from.closest(".cat"); d.innerHTML=ico(cat?cat.id.slice(4):""); }
  document.body.appendChild(d);
  const f=[]; for(let i=0;i<=8;i++){ const t=i/8, s=S0+(S1-S0)*t+.3*Math.sin(Math.PI*t); f.push({transform:`translate(${x0+dx*t}px,${y0+dy*t-lift*4*t*(1-t)}px) scale(${s}) rotate(${14*t}deg)`,opacity:t>.9?.5:1}); }
  d.animate(f,{duration:650,easing:"cubic-bezier(.45,.05,.35,1)"}).onfinish=()=>{ d.remove(); done(); };
}
function movePill(c){ $("pill").style.transform=`translateX(${c.offsetLeft}px) scaleX(${c.offsetWidth/100})`; }
let chipEls=null;
function setActive(id,smooth){
  if(id===active) return; active=id;
  chipEls=chipEls||[...document.querySelectorAll(".chip")];
  const t=chipEls.find(c=>c.dataset.c===id); if(!t) return;
  keepChipVisible(t,smooth); movePill(t);
  chipEls.forEach(c=>{ if(c===t) c.setAttribute("aria-current","true"); else if(c.hasAttribute("aria-current")) c.removeAttribute("aria-current"); });
}
function keepChipVisible(c,smooth){
  const box=$("chips"), cr=c.getBoundingClientRect(), br=box.getBoundingClientRect(), pad=28;
  let d=0; if(cr.left<br.left+pad) d=cr.left-br.left-pad; else if(cr.right>br.right-pad) d=cr.right-br.right+pad;
  if(d) box.scrollBy({left:d,behavior:smooth&&!RM?"smooth":"auto"});
}
let io;
function observe(){
  const els=document.querySelectorAll(".rv:not(.in)");
  if(!("IntersectionObserver" in window)){ els.forEach(e=>e.classList.add("in")); return; }
  io=io||new IntersectionObserver(es=>{ const hit=es.filter(e=>e.isIntersecting||e.boundingClientRect.top<0); const fast=hit.length>5; hit.forEach((e,n)=>{ if(fast||e.boundingClientRect.top<0) e.target.classList.add("nr"); else e.target.style.setProperty("--d",Math.min(n,3)*35+"ms"); e.target.classList.add("in"); io.unobserve(e.target); }); },{rootMargin:"0px 0px 250px 0px"});
  els.forEach(e=>io.observe(e));
}
const _rm=renderMenu; renderMenu=function(){ _rm(); observe(); measure(); };
let tick=false,jumping=false,jt=0,st=0,qt=0,heroOn=true,tops=[];
const blobsEl=document.querySelector(".blobs"), cupEl=document.querySelector(".cupw");
function measure(){ tops=MENU.map(c=>{ const el=$("cat-"+c.id); return el?el.getBoundingClientRect().top+scrollY:Infinity; }); }
function sweep(){ document.querySelectorAll(".rv:not(.in)").forEach(e=>{ if(e.getBoundingClientRect().top<innerHeight+250){ e.classList.add("nr","in"); if(io) io.unobserve(e); } }); }
addEventListener("scroll",()=>{
  clearTimeout(st); st=setTimeout(sweep,160);
  if(jumping){ clearTimeout(jt); jt=setTimeout(()=>{ jumping=false; },140); }
  if(tick) return; tick=true;
  requestAnimationFrame(()=>{ tick=false; const y=scrollY;
    if(heroOn&&!RM){ blobsEl.style.transform=`translate3d(0,${-y*.15}px,0)`; cupEl.style.transform=`translate3d(0,${y*.12}px,0)`; }
    if(jumping||!tops.length) return;
    let cur=0; for(let i=0;i<tops.length;i++){ if(tops[i]-y<=170) cur=i; }
    setActive(MENU[cur].id); });
},{passive:true});
addEventListener("resize",measure);
$("q").oninput=()=>{ clearTimeout(qt); qt=setTimeout(renderMenu,90); };
function clearSearch(){ $("q").value=""; renderMenu(); $("q").focus(); }
$("clearSearch").onclick=clearSearch;
$("resetSearch").onclick=clearSearch;
$("send").onclick=send;
$("copy").onclick=copyMsg;
$("successDone").onclick=()=>{ $("successScreen").hidden=true; window.scrollTo({top:0,behavior:"smooth"}); };
$("otype").innerHTML=CONFIG.orderTypes.map(t=>`<option value="${t}">${TL[t]||t}</option>`).join("");
$("otype").onchange=()=>{
  const delivery=$("otype").value==="Delivery";
  $("addressField").hidden=!delivery;
  $("caddr").required=delivery;
  if(!delivery) $("caddr").value="";
};
$("otype").onchange();

document.documentElement.classList.add("js");
renderChips(); renderMenu(); renderCart(); setActive(MENU[0].id); openBadge(); measure(); addEventListener("load",measure); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(measure);
if("IntersectionObserver" in window) new IntersectionObserver(([e])=>{ heroOn=e.isIntersecting; $("hero").classList.toggle("paused",!heroOn); },{rootMargin:"60px"}).observe($("hero"));
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ const c=document.querySelector('.chip[aria-current="true"]'); if(c) movePill(c); });
