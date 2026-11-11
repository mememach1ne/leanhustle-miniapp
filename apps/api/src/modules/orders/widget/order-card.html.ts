/**
 * Live order card — a Telegram chat widget (Bot API 10.4). Fixed code; the
 * bot only changes `chat_data` (OrderCardState as JSON) and the card redraws.
 * Limits: 32 KB of HTML and 4096 bytes after zlib, no network, no form
 * controls, no scrolling (height ≤ 600 px). Colors come from the chat theme.
 *
 * State keys (kept short — chat_data is at most 1024 bytes):
 *   n  order number          c  current step index    w  1 = waiting for the client
 *   h  1 = duty step shown   d  date of the current step («12 окт»)
 *   x  1 = cancelled         it [[title, size], …]   m  more items count
 *   t  goods total («$41.80»)   dm delivery method   dd days («19–20 дн.»)
 *   p  delivery bill {a: rubles, l: [[name, rubles], …], u: pay url}
 *   tr track {c: carrier, n: number}
 */
const RAW = `<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.35 system-ui,sans-serif;color:var(--tg-theme-text-color)}
.h{display:flex;justify-content:space-between;align-items:center;gap:8px}
.n{font-weight:700;font-size:16px}
.pl{font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;background:rgba(64,167,227,.16);color:var(--tg-theme-link-color)}
.pl.w{background:#f5a6231f;color:#e8961a}.pl.x{background:#e5484d1f;color:#e5484d}
.bar{display:flex;gap:3px;margin:10px 0 6px}.bar i{flex:1;height:5px;border-radius:3px;background:var(--tg-theme-hint-color);opacity:.25}
.bar i.d{background:var(--tg-theme-button-color);opacity:1}.bar i.c{animation:p 1.4s ease-in-out infinite;background:var(--tg-theme-button-color)}
@keyframes p{50%{opacity:.35}}
.st{font-weight:600}.mu{color:var(--tg-theme-hint-color);font-size:12px}
.bx{margin-top:10px;padding:10px;border-radius:12px;background:rgba(128,128,128,.13)}
.r{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-top:3px}
button{border:0;font:inherit;width:100%;cursor:pointer;display:block;text-align:center;border-radius:10px;padding:8px;margin-top:8px;font-weight:600;font-size:13px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}
.tk{display:flex;gap:6px}.tk button{flex:1;margin-top:6px}.tk .g{background:rgba(128,128,128,.2);color:var(--tg-theme-text-color)}
ul{margin:8px 0 0;padding:0;list-style:none}li{font-size:12px;margin-top:3px;display:flex;gap:6px}li span:first-child{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
</style><div id="a"></div><script>
var W=window.TelegramWidget,S=["Заказ оформлен","Заказ оплачен","Выкуплен на Poizon","На складе в Китае","Доставка оплачена","Пошлина оплачена","Отправлен в Россию","На таможне","На складе в России","В пути по России","Доставлен"],
WT={1:"Ожидает оплаты",4:"Ожидает оплаты доставки",5:"Ожидает оплаты пошлины"},WD={1:"Оплатите заказ — после этого выкупим товар",4:"Оплатите доставку — посылка сразу поедет в Россию",5:"Оплатите пошлину, чтобы посылку выпустили"},CN={cdek:"СДЭК",pochta:"Почта"},
TU={cdek:"https://www.cdek.ru/ru/tracking?order_id=",pochta:"https://www.pochta.ru/tracking?barcode="};
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})}
function lo(t){return t.charAt(0).toLowerCase()+t.slice(1)}
function rub(v){return String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g," ")+" ₽"}
function r(){var s={};try{s=JSON.parse(W&&W.chatData||"{}")}catch(_){}
var st=S.filter(function(_,i){return i!=5||s.h}),c=s.c||0,ci=s.h||c<5?c:c-1,k=s.x?"x":s.w?"w":"",
lb=s.x?"Отменён":s.w?WT[c]||"Ожидает действия":st[ci],
o='<div class="h"><span class="n">Заказ '+e(s.n)+'</span><span class="pl '+k+'">'+e(lb)+'</span></div><div class="bar">';
for(var i=0;i<st.length;i++)o+='<i class="'+(i<ci||(i==ci&&!s.w)?"d":i==ci?"c":"")+'"></i>';
var nx=!s.w&&!s.x&&st[ci+1]?"далее: "+lo(st[ci+1]):"",dt=s.w?"":s.d||"";
o+='</div><div class="st">'+e(s.x?"Заказ отменён":s.w?WD[c]||WT[c]:st[ci])+'</div>';
if(dt||nx)o+='<div class="mu">'+e(dt)+(dt&&nx?" · ":"")+e(nx)+'</div>';
if(s.p){o+='<div class="bx"><div class="st">Доставка: '+rub(s.p.a)+'</div>';(s.p.l||[]).forEach(function(l){o+='<div class="r"><span class="mu">'+e(l[0])+'</span><span>'+rub(l[1])+'</span></div>'});
if(s.p.u)o+='<button id="pay">Оплатить '+rub(s.p.a)+'</button>';o+='</div>'}
if(s.tr){o+='<div class="bx"><div class="mu">Трек '+e(CN[s.tr.c]||"")+'</div><div class="st">'+e(s.tr.n)+'</div><div class="tk"><button class="g" id="cp">Скопировать</button>'+(TU[s.tr.c]?'<button id="tg">Отследить</button>':"")+'</div></div>'}
if(s.it&&s.it.length){o+='<ul>';s.it.forEach(function(t){o+='<li><span>'+e(t[0])+'</span><span class="mu">'+e(t[1])+'</span></li>'});
if(s.m)o+='<li class="mu">и ещё '+s.m+'</li>';o+='</ul>'}
if(s.dm)o+='<div class="r" style="margin-top:8px"><span class="mu">'+e(s.dm)+'</span><span class="mu">'+e(s.dd||"")+'</span></div>';
if(s.t)o+='<div class="r"><span class="mu">Товары</span><span>'+e(s.t)+'</span></div>';
var a=document.getElementById("a");a.innerHTML=o;
b("pay",function(){W.openLink(s.p.u)});b("cp",function(){W.copyText(s.tr.n);W.HapticFeedback&&W.HapticFeedback.notificationOccurred("success")});
b("tg",function(){W.openLink(TU[s.tr.c]+encodeURIComponent(s.tr.n))})}
function b(id,f){var x=document.getElementById(id);x&&x.addEventListener("click",f)}
r();if(W){W.onEvent("chatDataChanged",r);W.onEvent("themeChanged",r);W.request("r").catch(function(){})}
</script>`;

/** Collapses the template's line breaks (the code itself is written compact). */
export const ORDER_CARD_HTML = RAW.replace(/\n/g, '');
