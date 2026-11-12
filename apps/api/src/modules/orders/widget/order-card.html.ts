/**
 * Live order card — a Telegram chat widget (Bot API 10.4). Fixed code; the
 * bot only changes `chat_data` (CardState as JSON) and the card redraws.
 * Limits: 32 KB of HTML and 4096 bytes after zlib, no network, no form
 * controls, no web fonts (system ones only), no scrolling (height ≤ 600 px).
 * Styled like the mini app: dark surface, teal accent #29C3C5.
 *
 * State keys (chat_data ≤ 1024 bytes):
 *   n  order number      c  step (0 оформлен … 10 доставлен, see STEPS in the service)
 *   w  1 = the client has to pay this step     x  1 = cancelled
 *   d  date of the current step («12 нояб»)    a  1 = parcel is being assembled
 *   e  expected delivery («~5 дек») or days («19–20 дн.») before shipping
 *   p  delivery bill {a: rubles, l: [[name, rubles], …], u: pay url}
 *   tr track {c: cdek | pochta, n: number}
 *   id order id (opens it in the mini app)    lg data: URI of the brand logo the card shows
 *
 * The scale shows 5 stages; a stage is current while the parcel is in it:
 * Оплата (c<1) · Выкуп (c<2) · Китай (c<6) · В пути (c<10) · Получен.
 */
const RAW = `<style>
*{box-sizing:border-box;margin:0}body{margin:0;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f5}
.c{padding:14px;background:linear-gradient(150deg,#123c3d,#1e1f21 62%);border-radius:inherit}
.hd{display:flex;align-items:center;gap:11px}
.ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(41,195,197,.16);color:#29c3c5}
.ic.w{background:rgba(255,176,32,.16);color:#ffb020}.ic.x{background:rgba(255,92,92,.16);color:#ff5c5c}.ic svg{width:23px;height:23px}
.br{font-size:11px;font-weight:800;letter-spacing:.9px;color:#29c3c5;text-transform:uppercase}
.tt{font-size:17px;font-weight:800;letter-spacing:-.2px;line-height:1.2}
.sb{font-size:12px;color:#9a9da3;margin-top:1px}
.st{display:flex;margin:15px 0 0}.sg{flex:1;text-align:center;position:relative;font-size:11px;color:#7d8087}
.sg:before{content:"";position:absolute;top:5px;left:-50%;right:50%;height:2px;background:#3a3c40}.sg:first-child:before{display:none}
.sg.d:before,.sg.c2:before{background:#29c3c5}
.dt{width:12px;height:12px;border-radius:50%;margin:0 auto 4px;position:relative;background:#1e1f21;border:2px solid #4a4c51}
.sg.d .dt{background:#29c3c5;border-color:#29c3c5}.sg.c2{color:#f2f4f5;font-weight:700}
.sg.c2 .dt{border-color:#29c3c5;animation:p 1.6s ease-in-out infinite}.w .sg.c2 .dt{border-color:#ffb020}
@keyframes p{50%{box-shadow:0 0 0 4px rgba(41,195,197,.22)}}
.bx{margin-top:13px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07)}
.row{display:flex;align-items:center;gap:10px}.mu{color:#9a9da3;font-size:12px}.b{font-weight:700}
.r{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-top:4px}
.big{font:800 21px/1.2 ui-monospace,"JetBrains Mono",monospace;margin-top:2px}
.tn{font:700 16px/1.2 ui-monospace,"JetBrains Mono",monospace;letter-spacing:.4px}
button{border:0;font:inherit;width:100%;cursor:pointer;display:block;text-align:center;border-radius:12px;padding:9px;font-weight:700;font-size:14px;background:#29c3c5;color:#052a2b}
button.g{background:rgba(255,255,255,.1);color:#f2f4f5}.bt{display:flex;gap:8px;margin-top:10px}
.lg{width:32px;height:32px;border-radius:9px;flex-shrink:0;display:block}
.ti{width:30px;height:30px;border-radius:9px}.ti svg{width:17px;height:17px}
.ss{display:flex;gap:4px;margin-top:9px}.ss div{flex:1;font-size:10px;color:#7d8087}.ss i{display:block;height:4px;border-radius:2px;background:#3a3c40;margin-bottom:4px}.ss .d i{background:#29c3c5}.ss .d{color:#c9cbcf}
</style><div class="c" id="a"></div><script>
var W=window.TelegramWidget,
T=["Заказ оформлен","Заказ оплачен","Выкуплен на Poizon","На складе в Китае","Доставка оплачена","Пошлина оплачена","Отправлен в Россию","На таможне","На складе в России","В пути по России","Получен"],
G=[["Оплата",1],["Выкуп",2],["Китай",6],["В пути",10],["Получен",11]],
WT={1:"Оплатите заказ",4:"Оплатите доставку",5:"Оплатите пошлину"},
SS=["Отправлен","Таможня","Склад РФ","Доставка"],
TU={cdek:"https://www.cdek.ru/ru/tracking?order_id=",pochta:"https://www.pochta.ru/tracking?barcode="},
L={cdek:1,pochta:1},
I={card:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',box:'<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
truck:'<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
x:'<path d="M6 6l12 12M18 6 6 18"/>',bag:'<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>',paid:'<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16 9.6"/>',plane:'<path d="M3 13l18-7-5 15-4-6zM12 15l9-9"/>'};
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})}
function rub(v){return String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g," ")+" ₽"}
function ic(k){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+I[k]+'</svg>'}
function lg(k){return D.lg?'<img class="lg" src="'+D.lg+'">':t(k=="poizon"?"bag":"truck")}
function bx(k,a,b){return'<div class="bx"><div class="row">'+k+'<div><div class="b">'+a+'</div>'+(b?'<div class="mu">'+b+'</div>':"")+'</div></div></div>'}
function t(k,w){return'<div class="ic ti'+(w?" w":"")+'">'+ic(k)+'</div>'}
function b(id,f){var x=document.getElementById(id);x&&x.addEventListener("click",f)}
var D={};
function r(){var s={};try{s=JSON.parse(W&&W.chatData||"{}")}catch(_){}D=s;
var c=s.c||0,k=s.x?"x":s.w?"w":"",
ik=s.x?"x":s.w?"card":c>=10?"ok":c>=6?"plane":c>=2?"box":"paid",
tt=s.x?"Заказ отменён":s.w?WT[c]:s.a?"Собираем посылку":T[c],
sb=s.x?"Если это ошибка, напишите менеджеру":[s.d,c>=4&&c<10&&s.e?"ожидаем "+s.e:""].filter(Boolean).join(" · "),
o='<div class="hd"><div class="ic '+k+'">'+ic(ik)+'</div><div><div class="br">LH POIZON · '+e(s.n)+'</div><div class="tt">'+e(tt)+'</div>'+(sb?'<div class="sb">'+e(sb)+'</div>':"")+'</div></div>';
if(s.x){a(o+'<div class="bt"><button class="g" id="mg">Написать менеджеру</button></div>');b("mg",function(){W.openTelegramLink("https://t.me/lh_poizonmanager")});return}
var cur=0;while(cur<4&&c>=G[cur][1])cur++;if(s.w)cur=c==1?0:c==4?2:3;
o+='<div class="st'+(s.w?" w":"")+'">';G.forEach(function(g,i){o+='<div class="sg '+(i<cur||c>=10?"d":i==cur?"c2":"")+'"><div class="dt"></div>'+g[0]+'</div>'});o+='</div>';
var tk=s.tr&&L[s.tr.c]&&c<10?'<div class="bx"><div class="row">'+lg(s.tr.c)+'<div><div class="mu">Трек-номер</div><div class="tn">'+e(s.tr.n)+'</div></div></div><div class="bt"><button class="g" id="cp">Скопировать</button><button id="tg">Отследить</button></div></div>':"";
if(s.p){o+='<div class="bx"><div class="mu">К оплате за доставку</div><div class="big">'+rub(s.p.a)+'</div>';
(s.p.l||[]).forEach(function(l){o+='<div class="r"><span class="mu">'+e(l[0])+'</span><span>'+rub(l[1])+'</span></div>'});
if(s.p.u)o+='<div class="bt"><button id="pay">Оплатить '+rub(s.p.a)+'</button></div>';o+='</div>'}
else if(s.w&&c==1)o+=bx(lg("poizon"),"Выкупим сразу после оплаты","Оплатить можно в приложении");
else if(s.w)o+=bx(t("card",1),"Посылку выпустят после оплаты","Сумму пришлём отдельным сообщением");
else if(c<2)o+=bx(lg("poizon"),"Выкупаем на Poizon","Обычно 1–2 дня");
else if(c<3)o+=bx(t("box"),"Едет на склад в Китае","Обычно 3–7 дней");
else if(c<4)o+=bx(t("box"),s.a?"Упаковываем вещи вместе":"Ждём все вещи на складе",s.a?"Цену доставки пришлём через 4–6 часов":"Потом соберём их в одну посылку");
else if(c<6)o+=tk||bx(t("plane"),"Скоро отправим в Россию",s.e?"В пути около "+e(s.e):"");
else if(c<10){var j=Math.min(c-6,3);o+='<div class="bx"><div class="row">'+t("truck")+'<div class="b">'+["Летит в Россию","Проходит таможню","На складе в России","Едет к вам"][j]+'</div></div><div class="ss">';
SS.forEach(function(n,i){o+='<div class="'+(i<=j?"d":"")+'"><i></i>'+n+'</div>'});o+='</div></div>'+tk}
else o+=bx(t("ok"),"Спасибо, что выбрали нас!","Будем рады отзыву — напишите менеджеру");
var pay=s.w&&c==1;o+='<div class="bt">'+(s.id?'<button id="op"'+(pay?"":' class="g"')+'>'+(pay?"Оплатить заказ":"Открыть заказ")+'</button>':"")+'<button class="g" id="mg">Менеджер</button></div>';
a(o);
b("op",function(){W.openTelegramLink("https://t.me/lh_poizonbot?startapp=o_"+s.id)});
b("mg",function(){W.openTelegramLink("https://t.me/lh_poizonmanager")});
b("pay",function(){W.openLink(s.p.u)});
b("cp",function(){W.copyText(s.tr.n);W.HapticFeedback&&W.HapticFeedback.notificationOccurred("success");var x=document.getElementById("cp");x.textContent="Скопировано";setTimeout(function(){x.textContent="Скопировать"},1500)});
b("tg",function(){W.openLink(TU[s.tr.c]+encodeURIComponent(s.tr.n))})}
function a(o){document.getElementById("a").innerHTML=o}
r();if(W){W.onEvent("chatDataChanged",r);W.request("r").catch(function(){})}
</script>`;

/** Collapses the template's line breaks (the code itself is written compact). */
export const ORDER_CARD_HTML = RAW.replace(/\n/g, '');
