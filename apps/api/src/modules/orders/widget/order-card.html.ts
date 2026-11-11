/**
 * Live order card — a Telegram chat widget (Bot API 10.4). Fixed code; the
 * bot only changes `chat_data` (OrderCardState as JSON) and the card redraws.
 * Limits: 32 KB of HTML and 4096 bytes after zlib, no network, no form
 * controls, no scrolling (height ≤ 600 px). Colors come from the chat theme.
 *
 * State keys (kept short — chat_data is at most 1024 bytes):
 *   n  order number          c  current step index    w  1 = waiting for the client
 *   h  1 = duty step shown   d  date / note of the current step
 *   x  1 = cancelled         it [[title, size], …]   m  more items count
 *   t  goods total («$41.80»)   dm delivery method   dd days («≈ 19–20 дн.»)
 *   p  delivery bill {a: rubles, l: [[name, rubles], …], u: pay url}
 *   tr track {c: carrier, n: number}
 *
 * Steps (c): 0 оформлен, 1 оплачен, 2 выкуплен, 3 склад в Китае, 4 доставка
 * оплачена, 5 пошлина, 6 отправлен в РФ, 7 таможня, 8 склад РФ, 9 в пути по
 * РФ, 10 доставлен. The card shows them as 5 stages.
 */
const RAW = `<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.35 system-ui,sans-serif;color:var(--tg-theme-text-color)}
.top{display:flex;align-items:center;gap:12px}
.ic{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(64,167,227,.16);color:#40a7e3}
.ic.w{background:rgba(245,166,35,.16);color:#f5a623}.ic.ok{background:rgba(52,199,89,.16);color:#34c759}.ic.x{background:rgba(229,72,77,.16);color:#e5484d}
.ic svg{width:24px;height:24px}
.no{font-size:12px;color:var(--tg-theme-hint-color)}.tt{font-size:17px;font-weight:700;line-height:1.2}
.sub{font-size:12px;color:var(--tg-theme-hint-color);margin-top:2px}
.stg{display:flex;margin:14px 0 4px}.sg{flex:1;text-align:center;position:relative;font-size:10px;color:var(--tg-theme-hint-color)}
.sg:before{content:"";position:absolute;top:7px;left:-50%;right:50%;height:2px;background:rgba(128,128,128,.3)}.sg:first-child:before{display:none}
.sg.d:before,.sg.c:before{background:#40a7e3}
.dot{width:16px;height:16px;border-radius:50%;margin:0 auto 4px;position:relative;background:var(--tg-theme-bg-color,#1c2733);border:2px solid rgba(128,128,128,.4)}
.sg.d .dot{background:#40a7e3;border-color:#40a7e3}.sg.c .dot{border-color:#40a7e3;animation:p 1.6s ease-in-out infinite}
.sg.c{color:var(--tg-theme-text-color);font-weight:600}.w .sg.c .dot{border-color:#f5a623}
@keyframes p{50%{box-shadow:0 0 0 5px rgba(64,167,227,.18)}}
.bx{margin-top:12px;padding:12px;border-radius:14px;background:rgba(128,128,128,.12)}
.r{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-top:4px}.r .k{color:var(--tg-theme-hint-color)}
.big{font-size:20px;font-weight:700}
button{border:0;font:inherit;width:100%;cursor:pointer;display:block;text-align:center;border-radius:12px;padding:10px;margin-top:10px;font-weight:600;font-size:14px;background:#40a7e3;color:#fff}
button.g{background:rgba(128,128,128,.2);color:var(--tg-theme-text-color)}button.pay{background:#34c759}
.tk{display:flex;gap:8px}
.cb{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;background:#1ab248;color:#fff;margin-right:6px}.cb.p{background:#0055a6}
.tn{font:600 16px/1.2 ui-monospace,monospace;letter-spacing:.5px;margin-top:6px}
.it{margin-top:12px;font-size:13px}.it b{font-weight:600}.k{color:var(--tg-theme-hint-color)}
.ft{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(128,128,128,.2);font-size:12px;color:var(--tg-theme-hint-color)}
.ft b{color:var(--tg-theme-text-color);font-size:13px}
</style><div id="a"></div><script>
var W=window.TelegramWidget,
S=["Заказ оформлен","Заказ оплачен","Выкуплен на Poizon","На складе в Китае","Доставка оплачена","Пошлина оплачена","Отправлен в Россию","На таможне","На складе в России","В пути по России","Доставлен"],
G=[["Оплата",1],["Выкуп",2],["Склад",3],["В пути",6],["Получен",10]],
WT={1:"Ждём оплату заказа",4:"Оплатите доставку",5:"Оплатите пошлину"},
WD={1:"После оплаты сразу выкупим товар",4:"Посылка поедет в Россию сразу после оплаты",5:"Посылку выпустят после оплаты"},
CN={cdek:"СДЭК",pochta:"Почта"},TU={cdek:"https://www.cdek.ru/ru/tracking?order_id=",pochta:"https://www.pochta.ru/tracking?barcode="},
I={box:'<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/>',truck:'<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
card:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',bag:'<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>'};
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})}
function rub(v){return String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g," ")+" ₽"}
function svg(k){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+I[k]+'</svg>'}
function pl(n){var a=n%10,h=n%100;return a==1&&h!=11?"вещь":a>=2&&a<=4&&(h<12||h>14)?"вещи":"вещей"}
function b(id,f){var x=document.getElementById(id);x&&x.addEventListener("click",f)}
function r(){var s={};try{s=JSON.parse(W&&W.chatData||"{}")}catch(_){}
var c=s.c||0,done=c>=10,k=s.x?"x":s.w?"w":done?"ok":"",
ik=s.x?"x":s.w?"card":done?"ok":c>=6?"truck":c>=2?"box":"bag",
tt=s.x?"Заказ отменён":s.w?WT[c]||S[c]:S[c],
sb=s.x?"Если это ошибка, напишите менеджеру":s.w?WD[c]||"":[s.d,s.dd&&!done?s.dd:""].filter(Boolean).join(" · "),
o='<div class="top"><div class="ic '+k+'">'+svg(ik)+'</div><div><div class="no">Заказ '+e(s.n)+'</div><div class="tt">'+e(tt)+'</div>'+(sb?'<div class="sub">'+e(sb)+'</div>':"")+'</div></div>';
if(!s.x){var cur=-1;G.forEach(function(g,i){if(c>=g[1]&&!(s.w&&c==g[1]))cur=i});
o+='<div class="stg'+(s.w?" w":"")+'">';G.forEach(function(g,i){var cl=i<=cur?"d":i==cur+1?"c":"";
o+='<div class="sg '+cl+'"><div class="dot"></div>'+g[0]+'</div>'});o+='</div>'}
if(s.p){o+='<div class="bx"><div class="k" style="font-size:12px">К оплате за доставку</div><div class="big">'+rub(s.p.a)+'</div>';
(s.p.l||[]).forEach(function(l){o+='<div class="r"><span class="k">'+e(l[0])+'</span><span>'+rub(l[1])+'</span></div>'});
if(s.p.u)o+='<button class="pay" id="pay">Оплатить '+rub(s.p.a)+'</button>';o+='</div>'}
if(s.tr){o+='<div class="bx"><div class="k" style="font-size:12px"><span class="cb'+(s.tr.c=="pochta"?" p":"")+'">'+e(CN[s.tr.c]||"Трек")+'</span>трек-номер</div><div class="tn">'+e(s.tr.n)+'</div><div class="tk"><button class="g" id="cp">Скопировать</button>'+(TU[s.tr.c]?'<button id="tg">Отследить</button>':"")+'</div></div>'}
var it=s.it||[],cnt=it.length+(s.m||0);
if(cnt){o+='<div class="it"><b>'+e(it[0][0])+'</b> <span class="k">· '+e(it[0][1])+'</span>';
if(cnt>1)o+='<div class="k">и ещё '+(cnt-1)+' '+pl(cnt-1)+'</div>';o+='</div>'}
o+='<div class="ft"><span>'+e(s.dm||"")+'</span>'+(s.t?'<b>'+e(s.t)+'</b>':"")+'</div>';
document.getElementById("a").innerHTML=o;
b("pay",function(){W.openLink(s.p.u)});
b("cp",function(){W.copyText(s.tr.n);W.HapticFeedback&&W.HapticFeedback.notificationOccurred("success");var x=document.getElementById("cp");x.textContent="Скопировано";setTimeout(function(){x.textContent="Скопировать"},1500)});
b("tg",function(){W.openLink(TU[s.tr.c]+encodeURIComponent(s.tr.n))})}
r();if(W){W.onEvent("chatDataChanged",r);W.onEvent("themeChanged",r);W.request("r").catch(function(){})}
</script>`;

/** Collapses the template's line breaks (the code itself is written compact). */
export const ORDER_CARD_HTML = RAW.replace(/\n/g, '');
