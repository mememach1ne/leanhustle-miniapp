/**
 * /start menu — a Telegram widget (Bot API 10.4) in the chat with the bot,
 * same look as the order card. Sub-screens (download, guide, reviews, other
 * marketplaces, how to copy a link) switch inside the widget, no new
 * messages. The bot only sets the client's active orders.
 *
 * State: o [[number, stage, orderId, 1 = waiting for payment]], lg Poizon icon (data: URI)
 */
const RAW = `<style>
*{box-sizing:border-box;margin:0}body{margin:0;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f5}
#a{padding:14px;background:linear-gradient(150deg,#123c3d,#1e1f21 62%);border-radius:inherit}
.hd{display:flex;align-items:center;gap:11px;margin-bottom:12px}
.ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(41,195,197,.16);color:#29c3c5}.ic svg{width:22px;height:22px}
.br{font-size:11px;font-weight:800;letter-spacing:.9px;color:#29c3c5;text-transform:uppercase}
.tt{font-size:17px;font-weight:800;line-height:1.2}.mu{color:#9a9da3;font-size:12px}
.bx{margin-top:8px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07)}
.od{display:flex;align-items:center;gap:8px;padding:7px 0;cursor:pointer}.od+.od{border-top:1px solid rgba(255,255,255,.07)}
.od b{font:700 13px ui-monospace,"JetBrains Mono",monospace}.od span{flex:1;font-size:13px}.od i{font-style:normal;color:#9a9da3}
.w{color:#ffb020}
.gr{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
button{border:0;font:inherit;cursor:pointer;border-radius:12px;padding:10px 8px;font-weight:700;font-size:13px;background:rgba(255,255,255,.08);color:#f2f4f5;width:100%;display:flex;align-items:center;gap:8px;text-align:left;line-height:1.2}
button.p{background:#29c3c5;color:#052a2b;justify-content:center;font-size:14px}button.c{justify-content:center}
button svg,button img{width:20px;height:20px;flex-shrink:0;border-radius:6px}button svg{color:#29c3c5}button.p svg{color:#052a2b}
.st{margin-top:10px}.st div{display:flex;gap:9px;margin-top:7px;font-size:13px}.st b{width:20px;height:20px;border-radius:7px;background:rgba(41,195,197,.16);color:#29c3c5;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ch{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.ch span{padding:4px 9px;border-radius:8px;background:rgba(255,255,255,.08);font-size:12px;font-weight:600}
</style><div id="a"></div><script>
var W=window.TelegramWidget,S={},P="m",
I={app:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>',book:'<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h10"/>',
star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',cn:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
chat:'<path d="M4 5h16v11H9l-5 4z"/>',dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',play:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>',bag:'<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>',link:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
home:'<path d="M3 11l9-7 9 7M5 10v10h14V10"/>'};
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})}
function ic(k){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+I[k]+'</svg>'}
function B(cls,go,icon,t){return'<button class="'+cls+'" data-g="'+go+'">'+icon+'<span>'+t+'</span></button>'}
function hd(k,t,s){return'<div class="hd"><div class="ic">'+ic(k)+'</div><div><div class="br">LH POIZON</div><div class="tt">'+t+'</div>'+(s?'<div class="mu">'+s+'</div>':"")+'</div></div>'}
var BK=B("c","m","","← Назад");
function lg(){return S.lg?'<img src="'+S.lg+'">':ic("bag")}
var V={
m:function(){var o=hd("home","Главное меню","Заказы с Poizon в Россию"),O=S.o||[];
if(O.length){o+='<div class="bx"><div class="mu">Мои заказы</div>';O.forEach(function(z){o+='<div class="od" data-g="o_'+e(z[2])+'"><b>'+e(z[0])+'</b><span class="'+(z[3]?"w":"")+'">'+e(z[1])+'</span><i>›</i></div>'});o+='</div>'}
o+='<div class="bx" data-g="cp" style="cursor:pointer"><div style="font-weight:700;font-size:13px">Пришлите ссылки Poizon — посчитаю сразу</div><div class="mu">Можно несколько в одном сообщении · Как скопировать ссылку ›</div></div>';
o+='<div class="gr" style="grid-template-columns:1fr">'+B("p","app",ic("app"),"Открыть MiniApp")+'</div><div class="gr">'+B("","dw",lg(),"Скачать POIZON")+B("","gd",ic("book"),"Инструкция")+B("","rv",ic("star"),"Отзывы")+B("","mk",ic("cn"),"Другие маркетплейсы")+'</div><div class="gr" style="grid-template-columns:1fr">'+B("c","mg",ic("chat"),"Связаться с менеджером")+'</div>';return o},
dw:function(){return hd("dl","Приложение POIZON","Выберите свою платформу")+'<div class="gr">'+B("","L:https://apps.apple.com/app/id1012871328",lg(),"iOS")+B("","L:https://china.leanhustle.net/poizon.apk",lg(),"Android")+'</div><div class="gr" style="grid-template-columns:1fr">'+BK+'</div>'},
gd:function(){return hd("book","Инструкция по заказу","Выберите формат")+'<div class="gr">'+B("","L:https://youtu.be/dwVmtQGWVa8",ic("play"),"Видео")+B("","L:https://telegra.ph/KAK-ZAKAZYVAT-s-POIZON-v-ROSSII-05-24",ic("doc"),"Текст")+'</div><div class="gr" style="grid-template-columns:1fr">'+BK+'</div>'},
rv:function(){return hd("star","Отзывы и выкупы","Реальные отзывы клиентов и примеры выкупленных заказов")+'<div class="gr">'+B("","T:lh_poizonreviews",ic("star"),"Отзывы")+B("","T:lh_poizonpurchases",ic("bag"),"Выкупы")+'</div><div class="gr" style="grid-template-columns:1fr">'+BK+'</div>'},
mk:function(){return hd("cn","Другие маркетплейсы","Доставим с любого китайского маркетплейса")+'<div class="ch"><span>Taobao</span><span>1688</span><span>95</span><span>Goofish</span><span>Pinduoduo</span><span>и другие</span></div><div class="bx mu" style="font-size:13px">Напишите, что вам нужно, — менеджер найдёт самое выгодное предложение среди сотен магазинов в Китае.</div><div class="gr" style="grid-template-columns:1fr">'+B("p","mg",ic("chat"),"Связаться с менеджером")+BK+'</div>'},
cp:function(){return hd("link","Как скопировать ссылку","")+'<div class="bx st"><div><b>1</b>Откройте товар в приложении POIZON</div><div><b>2</b>Нажмите «Поделиться» вверху справа</div><div><b>3</b>Выберите «Скопировать ссылку»</div><div><b>4</b>Вставьте ссылку в этот чат — можно сразу несколько</div></div><div class="gr" style="grid-template-columns:1fr">'+BK+'</div>'}};
function go(g){if(V[g]){P=g;r()}else if(g=="app")W.openTelegramLink("https://t.me/lh_poizonbot?startapp");else if(g=="mg")W.openTelegramLink("https://t.me/lh_poizonmanager");
else if(g.indexOf("o_")==0)W.openTelegramLink("https://t.me/lh_poizonbot?startapp="+g);else if(g.indexOf("T:")==0)W.openTelegramLink("https://t.me/"+g.slice(2));else if(g.indexOf("L:")==0)W.openLink(g.slice(2))}
function r(){try{S=JSON.parse(W&&W.chatData||"{}")}catch(_){S={}}var a=document.getElementById("a");a.innerHTML=V[P]();
a.querySelectorAll("[data-g]").forEach(function(x){x.addEventListener("click",function(ev){ev.stopPropagation();go(x.getAttribute("data-g"))})})}
r();if(W){W.onEvent("chatDataChanged",r);W.request("r").catch(function(){})}
</script>`;

export const MENU_CARD_HTML = RAW.replace(/\n/g, '');
