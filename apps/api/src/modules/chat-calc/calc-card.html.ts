/**
 * «Расчёт» card — the multi-link price calculation in the chat (Telegram
 * widget, Bot API 10.4). Same look as the order card. The bot owns the
 * state (chat_data JSON); every tap is a query (≤ 64 bytes) the server
 * applies and answers after re-rendering. Telegram clips widgets at 600 px,
 * so the list shows 5 lines a page and choosing a size switches to a
 * one-line view.
 *
 * State:
 *   s   status: o = open, c = added to cart, d = order created, x = closed
 *   n   lines in total        pg / pc  page / pages (5 lines per page)
 *   L   lines of the page: [index, title, size | "", qty, price text, flag 0 ok · 1 counting · 2 error]
 *   X   expanded line {i, k: chosen size index | -1, s: [[size, price]], p: spuId} (+ its row in L)
 *   T   totals {g: goods, d: delivery, c: city, u: duty}
 *   m   note under the title        ok  1 = every line has a size
 *   on / oi  created order number / id
 * Queries: e<i> open / close a line · s<i>.<k> size · q<i>+ / q<i>- qty · a<i> another size
 *          x<i> remove · p<n> page · c cart · o order now · n new calculation
 */
const RAW = `<style>
*{box-sizing:border-box;margin:0}body{margin:0;font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f4f5}
#a{padding:12px;background:linear-gradient(150deg,#123c3d,#1e1f21 62%);border-radius:inherit;transition:opacity .2s}#a.b{opacity:.55}
.hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.ic{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(41,195,197,.16);color:#29c3c5}.ic svg{width:20px;height:20px}
.br{font-size:10px;font-weight:800;letter-spacing:.8px;color:#29c3c5;text-transform:uppercase}
.tt{font-size:16px;font-weight:800;line-height:1.2}.mu{color:#9a9da3;font-size:12px}.wn{color:#ffb020}
.ln{display:flex;align-items:center;gap:8px;padding:7px 6px 7px 9px;border-radius:11px;background:rgba(255,255,255,.05);margin-top:5px;cursor:pointer}
.ln.x{background:rgba(41,195,197,.13)}
.nb{width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.09);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tl{flex:1;min-width:0}.tl b,.tl span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl b{font-size:13px;font-weight:600}.tl span{font-size:11px}
.pr{font:700 12px ui-monospace,"JetBrains Mono",monospace;white-space:nowrap}
.dl{width:24px;height:24px;flex-shrink:0;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#9a9da3;font-size:16px;line-height:1}
.pn{margin-top:6px}
.gr{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
button{border:0;font:inherit;cursor:pointer;border-radius:9px;padding:7px 4px;font-weight:700;font-size:13px;background:#29c3c5;color:#052a2b;width:100%}
button.g{background:rgba(255,255,255,.1);color:#f2f4f5}button.on{background:#29c3c5;color:#052a2b}
.gr button{padding:5px 1px;font-size:12px;line-height:1.1}.gr i{display:block;font-style:normal;font-size:10px;font-weight:500;opacity:.75}
.rw{display:flex;gap:5px;margin-top:6px;align-items:center}.rw b{min-width:18px;text-align:center}.sq{width:34px;flex-shrink:0}
.ft{margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07)}
.r{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px}.big{font:800 17px ui-monospace,"JetBrains Mono",monospace}
.dis{opacity:.4}
</style><div id="a"></div><script>
var W=window.TelegramWidget,S={};
var IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h7"/></svg>';
function e(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})}
function q(d){var a=document.getElementById("a");a.className="b";W.request(d).catch(function(){}).then(function(){a.className=""})}
function bt(cls,d,t){return'<button class="'+cls+'" data-q="'+d+'">'+t+'</button>'}
function row(l,x){return'<div class="ln'+(x?" x":"")+'" data-q="e'+l[0]+'"><div class="nb">'+(l[0]+1)+'</div><div class="tl"><b>'+e(l[1])+'</b><span class="mu'+(l[5]==2||!l[2]&&!l[5]?" wn":"")+'">'+(l[5]==1?"считаю…":l[5]==2?e(l[4]):l[2]?"размер "+e(l[2])+(l[3]>1?" · ×"+l[3]:""):"выберите размер")+'</span></div><div class="pr">'+(l[5]?"":e(l[4]))+'</div>'+(l[5]==1?"":'<div class="dl" data-q="x'+l[0]+'">×</div>')+'</div>'}
function r(){try{S=JSON.parse(W&&W.chatData||"{}")}catch(_){S={}}
var s=S,n=s.n||0,X=s.X,o='<div class="hd"><div class="ic">'+IC+'</div><div><div class="br">LH POIZON · РАСЧЁТ</div><div class="tt">'+(s.s=="d"?"Заказ "+e(s.on)+" оформлен":s.s=="c"?"Добавлено в корзину":s.s=="x"?"Расчёт закрыт":n+" "+pl(n))+'</div>'+(s.m?'<div class="mu'+(s.ok?"":" wn")+'">'+e(s.m)+'</div>':"")+'</div></div>';
if(s.s=="o"){var L=s.L||[];
if(X){var l=L.filter(function(z){return z[0]==X.i})[0];if(l)o+=row(l,1);
o+='<div class="pn"><div class="gr">';X.s.forEach(function(z,k){o+='<button class="'+(k==X.k?"on":"g")+'" data-q="s'+X.i+"."+k+'">'+e(z[0])+'<i>'+e(z[1])+'</i></button>'});
o+='</div><div class="rw">'+bt("g sq","q"+X.i+"-","−")+'<b>'+(l?l[3]:1)+'</b>'+bt("g sq","q"+X.i+"+","+")+bt("g","a"+X.i,"+ размер")+(X.p?'<button class="g" data-o="p_'+X.p+'">Товар ↗</button>':"")+'</div><div class="rw">'+bt("g","e"+X.i,"← К списку")+'</div></div>'}
else{L.forEach(function(l){o+=row(l,0)});
if(s.pc>1)o+='<div class="rw">'+bt("g sq"+(s.pg?"":" dis"),"p"+(s.pg-1),"‹")+'<span class="mu" style="flex:1;text-align:center">'+(s.pg+1)+" / "+s.pc+'</span>'+bt("g sq"+(s.pg<s.pc-1?"":" dis"),"p"+(s.pg+1),"›")+'</div>'}
var T=s.T;if(T)o+='<div class="ft"><div class="r"><span class="mu">Товары</span><span class="big">'+e(T.g)+'</span></div><div class="r"><span class="mu">Доставка до '+e(T.c)+(T.u?" · пошлина":"")+'</span><span>≈ '+e(T.d)+(T.u?" + "+e(T.u):"")+'</span></div><div class="rw">'+bt("g"+(s.ok?"":" dis"),"c","В корзину")+bt(s.ok?"":"dis","o","Оформить")+'</div></div>'}
else if(s.s!="x")o+='<div class="rw">'+(s.s=="d"?'<button data-o="o_'+e(s.oi)+'">Открыть заказ</button>':'<button data-o="cart">Открыть корзину</button>')+bt("g","n","Новый расчёт")+'</div>';
var a=document.getElementById("a");a.innerHTML=o;
a.querySelectorAll("[data-q]").forEach(function(x){x.addEventListener("click",function(ev){ev.stopPropagation();if(x.className.indexOf("dis")<0)q(x.getAttribute("data-q"))})});
a.querySelectorAll("[data-o]").forEach(function(x){x.addEventListener("click",function(ev){ev.stopPropagation();W.openTelegramLink("https://t.me/lh_poizonbot?startapp="+x.getAttribute("data-o"))})})}
function pl(n){var a=n%10,h=n%100;return a==1&&h!=11?"позиция":a>=2&&a<=4&&(h<12||h>14)?"позиции":"позиций"}
r();if(W)W.onEvent("chatDataChanged",r);
</script>`;

export const CALC_CARD_HTML = RAW.replace(/\n/g, '');
