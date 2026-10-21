(function(){
var KEY='glowup.v4', CIRC=615.75, RE=/^\d{4}-\d{2}-\d{2}$/;
var DOW=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'], LET=['L','M','M','G','V','S','D'];
var CHECK='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

function $(id){return document.getElementById(id)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function pad(n){return String(n).padStart(2,'0')}
function fmt(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parse(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function diff(a,b){return Math.round((a-b)/864e5)}
function tdy(){var x=new Date();x.setHours(0,0,0,0);return x}
function dl(d){return d.toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
function dlong(d){var s=d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});return s.charAt(0).toUpperCase()+s.slice(1)}
function fh(h){var m=Math.round(h*60);if(m<60)return m+' min';var r=m%60;return Math.floor(m/60)+' h'+(r?' '+r+' min':'')}

function def(){ return {name:'', theme:'auto', onb:0, tour:0, week:[2,2,2,2,2,3,3], off:[], goals:[], work:{}}; }

function norm(r){
  if(!r||!Array.isArray(r.goals)||!Array.isArray(r.week)||r.week.length!==7)return null;
  r.week=r.week.map(function(v){return Math.min(16,Math.max(0,Number(v)||0))});
  r.goals=r.goals.filter(function(g){return g&&g.id&&g.name&&RE.test(g.due)}).map(function(g){return {id:String(g.id),name:String(g.name).slice(0,40), due:g.due, completed:!!g.completed}});
  r.off=Array.isArray(r.off)?r.off.filter(function(d){return RE.test(d)}):[];
  if(!r.work||typeof r.work!=='object')r.work={};
  return {name:String(r.name||'').slice(0,30), theme:r.theme||'auto', onb:r.onb||0, tour:r.tour||0, week:r.week, off:r.off, goals:r.goals, work:r.work};
}

function load(){var r=null;try{r=norm(JSON.parse(localStorage.getItem(KEY)))}catch(e){}return r||def()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

var S=load(), view='oggi', edId=null, shT=null;

function showToast(msg, icon) {
  var box = $('toast-box');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (icon ? '<span>'+icon+'</span>' : '') + '<span>'+esc(msg)+'</span>';
  box.appendChild(t);
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(function(){
    t.classList.remove('show');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 400);
  }, 3000);
}

function applyTheme(){
  document.documentElement.setAttribute('data-theme', S.theme);
  document.querySelectorAll('[data-a="theme"]').forEach(function(b){
    b.classList.toggle('active-theme', b.dataset.v === S.theme);
  });
}
applyTheme();

function baseCap(d){return S.off.indexOf(fmt(d))>=0?0:S.week[(d.getDay()+6)%7]}
function gdone(id){var s=0,k;for(k in S.work)s+=S.work[k][id]||0;return s}

function compute(){
  var t=tdy(), tk=fmt(t), plan=[];
  var activeGoals = S.goals.filter(function(g){ return !g.completed; }).sort(function(a,b){ return diff(parse(a.due), t) - diff(parse(b.due), t); });

  for(var i=0; i<7; i++){ 
    var d = addDays(t, i);
    var cap = baseCap(d);
    var pl = {};
    for(var q=0; q<activeGoals.length && cap > 0.001; q++){
      var g = activeGoals[q];
      var alloc = Math.min(1, cap);
      pl[g.id] = alloc;
      cap -= alloc;
    }
    plan.push({date: d, alloc: pl, capLeft: cap, capTotal: baseCap(d)});
  }
  return { t:t, tk:tk, plan:plan, active:activeGoals };
}

function renderEmpty(title, subtitle, icon, btnText) {
  return '<div class="empty-state"><div class="es-icon">'+icon+'</div><h3>'+title+'</h3><p>'+subtitle+'</p>' + (btnText ? '<button class="btn pri" style="margin-top:12px" data-a="newg">'+btnText+'</button>' : '') + '</div>';
}

function renderToday(){
  var C=compute(), tk=C.tk, todayPlan = C.plan[0];
  var plannedTotal=0, doneTotal=0, hasGoals=S.goals.length>0;
  
  var wt = S.work[tk] || {};
  for(var id in todayPlan.alloc) plannedTotal += todayPlan.alloc[id];
  for(var id in wt) doneTotal += wt[id];
  
  var progress = plannedTotal > 0 ? Math.min(1, doneTotal/plannedTotal) : (doneTotal > 0 ? 1 : 0);
  var isDone = plannedTotal > 0 && doneTotal >= plannedTotal;
  
  $('ring').style.strokeDashoffset=CIRC*(1-progress);
  $('orb').style.setProperty('--lit', progress);
  $('orb').classList.toggle('done', isDone);
  
  $('big').textContent=!hasGoals?'Pronto?':plannedTotal>0?(isDone?'Fatto!':fh(plannedTotal-doneTotal)):'Libero';
  $('lbl').textContent=!hasGoals?'Aggiungi un obiettivo':plannedTotal>0?(isDone?'ottimo lavoro, riposati':'rimanenti per oggi'):'niente in programma oggi';
  $('meta').textContent=hasGoals?(plannedTotal>0? 'Piano del giorno completato al '+Math.round(progress*100)+'%' : 'Goditi il tempo libero!') : '';
  
  var rows = C.active.filter(function(x){return (todayPlan.alloc[x.id]||0)>.001||wt[x.id]>0}).map(function(x){
    var assigned = todayPlan.alloc[x.id] || 0;
    var dd = wt[x.id] || 0;
    var done = dd >= assigned && assigned > 0;
    return {done:done,h:'<button class="task'+(done?' done':'')+'" data-a="task" data-g="'+x.id+'" data-a-val="'+(assigned>0?assigned:1)+'" aria-pressed="'+done+'"><span class="tick">'+(done?CHECK:'')+'</span><span class="tx"><span class="nm">'+esc(x.name)+'</span><span class="wkl">'+(done?'Completato per oggi':(dd>0?'Iniziato ('+fh(dd)+')':'Richiede '+fh(assigned)))+'</span></span></button>'};
  }).sort(function(a,b){return a.done-b.done});
  
  $('tg').innerHTML = !hasGoals ? renderEmpty('Nessun obiettivo', 'Aggiungi il tuo primo traguardo, ci penso io a dirti cosa fare.', '🎯', 'Nuovo Obiettivo') 
                    : rows.length ? rows.map(function(r){return r.h}).join('') 
                    : renderEmpty('Tutto libero', 'Nessuna priorità per oggi. Dedica questo tempo a te stesso.', '☕️');
}

function renderPiano(){
  var C=compute(), t=C.t;
  var tips = [];
  if(!S.goals.length) tips.push('Aggiungi i tuoi obiettivi. Glow Up bilancerà il tuo tempo per farti arrivare sereno.');
  else if(C.active.length === 0) tips.push('Hai completato tutto! Sei incredibile. 🎉');
  else {
    tips.push('Hai '+C.active.length+' obiettivi in corso.');
    if(C.plan[0].capTotal === 0) tips.push('Oggi non hai ore libere, riposati. Riprenderemo domani.');
    else if(Object.keys(C.plan[0].alloc).length > 0) {
      tips.push('Oggi hai '+fh(C.plan[0].capTotal)+' libere. La priorità va a: <b>' + Object.keys(C.plan[0].alloc).map(id => esc(C.active.find(g=>g.id===id).name)).join(', ') + '</b>.');
    }
  }
  $('vd').innerHTML=tips.map(function(s){return '<p class="tip">'+s+'</p>'}).join('');
  
  $('gl').innerHTML = !C.active.length && !S.goals.length ? renderEmpty('Piano vuoto', 'Inizia creando il tuo primo progetto.', '✨', 'Aggiungi')
                    : (C.active.length ? C.active.map(function(x){
                        var dd = gdone(x.id);
                        return '<button class="goal" data-a="editg" data-g="'+x.id+'"><span class="bt"><span class="bn">'+esc(x.name)+'</span></span><span class="wkl">Scadenza: '+dl(parse(x.due))+(dd>0?' • '+fh(dd)+' dedicate':'')+'</span></button>';
                      }).join('') : renderEmpty('Nessun obiettivo in corso', 'Hai completato tutto.', '🏆'));
  
  var comp = S.goals.filter(function(g){ return g.completed; });
  $('sec-comp').hidden = comp.length === 0;
  $('gl-comp').innerHTML = comp.map(function(x){
    return '<button class="goal completed" data-a="editg" data-g="'+x.id+'"><span class="bt"><span class="bn">✅ '+esc(x.name)+'</span></span><span class="wkl">Completato! ('+fh(gdone(x.id))+' dedicate in totale)</span></button>';
  }).join('');

  $('ndsec').hidden=!S.goals.length;
  var nd='';
  for(var i=0; i<7; i++){
    var pl=C.plan[i].alloc, parts=[], tot=0, d=C.plan[i].date;
    for(var id in pl){ parts.push(esc(S.goals.find(g=>g.id===id).name)); tot+=pl[id]; }
    nd+='<div class="dy"><span class="dn">'+(i===0?'Oggi':i===1?'Domani':d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric'}))+'</span><span class="dg">'+(parts.length?parts.join(', '):C.plan[i].capTotal>0?'Niente':'Nessuna ora')+'</span><span class="dt2">'+(tot?fh(tot):'')+'</span></div>';
  }
  $('nd').innerHTML=nd;
}

function renderSet(){
  $('who').textContent=(S.name?'Ciao, '+S.name+'. ':'')+'I tuoi dati restano sul dispositivo.';
  $('wk').innerHTML=LET.map(function(n,i){return '<label>'+n+'<input class="in" type="number" min="0" max="16" step="0.5" inputmode="decimal" data-wd="'+i+'" value="'+S.week[i]+'" aria-label="Ore libere di '+DOW[i]+'"></label>'}).join('');
  $('off').innerHTML=S.off.map(function(d){return '<button class="chip" data-a="deloff" data-d="'+d+'" aria-label="Rimuovi '+dl(parse(d))+'">'+dl(parse(d))+' ✕</button>'}).join('');
}
function renderAll(){renderToday();renderPiano();renderSet()}

function go(t){
  view=t;
  ['oggi','piano','imp'].forEach(function(n){
    var el = $('v-'+n);
    if(n === t) {
      el.hidden = false;
      setTimeout(function(){ el.classList.add('active'); }, 10);
    } else {
      el.classList.remove('active');
      setTimeout(function(){ if(view !== n) el.hidden = true; }, 300);
    }
  });
  
  document.querySelectorAll('.tabs button').forEach(function(b){b.setAttribute('aria-current',String(b.dataset.t===t))});
  $('tt').textContent={oggi:'Oggi',piano:'Piano',imp:'Menu'}[t];
  $('ts').textContent=t==='oggi'?dlong(tdy()):'';$('ts').hidden=t!=='oggi';
  $('addb').hidden=t!=='piano';
  $('v-'+t).scrollTop=0;
  if(t==='piano')renderPiano();
}

function openSheet(id){
  edId=id||null; var g=id?S.goals.find(function(x){return x.id===id}):null;
  $('sh-t').textContent=g?'Modifica obiettivo':'Nuovo obiettivo';
  $('sn').value=g?g.name:''; $('sd').value=g?g.due:fmt(addDays(tdy(),30));
  $('sd').min = fmt(tdy());
  
  $('sdel').hidden=!g; $('sdel').textContent='Elimina'; delete $('sdel').dataset.armed;
  $('sdone').hidden=!g; $('sdone').textContent=g&&g.completed?'Segna In Corso':'Segna Completato';
  
  clearTimeout(shT);$('sheet').hidden=false;void $('sheet').offsetWidth;$('sheet').classList.add('open');
}

function closeSheet(){$('sheet').classList.remove('open');clearTimeout(shT);shT=setTimeout(function(){$('sheet').hidden=true},400)}

// TOUR GUIDATO (Ripristinato)
var TOUR=[
  {t:'oggi',el:'.hero',h:'La sfera',p:'Mostra il tuo progresso giornaliero sulle priorità.'},
  {t:'oggi',el:'#tg',h:'Priorità',p:'L\'app ti dice su cosa focalizzarti oggi (massimo 1 ora a materia). Tocca quando hai fatto.'},
  {t:'piano',el:'#vd',h:'Piano',p:'Qui vedi le tue scadenze e i consigli per organizzarti.'},
  {t:'imp',el:'#wk',h:'Le tue ore libere',p:'Cambia le ore quando la tua settimana cambia, il sistema ricalcolerà tutto.'}
], TI=0, O={};

function tourClear(){document.querySelectorAll('.spot').forEach(function(e){e.classList.remove('spot')})}
function tourShow(){
  var s=TOUR[TI];go(s.t);tourClear();document.body.classList.add('touring');
  var el=document.querySelector(s.el);
  if(el){el.classList.add('spot');if(el.closest('.view'))setTimeout(function(){el.scrollIntoView({block:'start',behavior:'smooth'})},80)}
  $('tr-h').textContent=s.h;$('tr-p').textContent=s.p;$('tr-n').textContent=(TI+1)+' di '+TOUR.length;
  $('tnext').textContent=TI===TOUR.length-1?'Ho capito':'Avanti';$('tour').hidden=false;
}
function tourStart(){TI=0;tourShow()}
function tourEnd(){tourClear();$('tour').hidden=true;document.body.classList.remove('touring');S.tour=1;save();go('oggi')}

// ONBOARDING (Ripristinato)
function stp(k,l){return '<div class="stp"><span>'+l+'</span><div><button class="btn" data-a="ostep" data-k="'+k+'" data-d="-0.5" aria-label="Meno">−</button><b>'+fh(O[k])+'</b><button class="btn" data-a="ostep" data-k="'+k+'" data-d="0.5" aria-label="Più">+</button></div></div>'}
function onbStart(){O={step:0,name:'',wd:2,we:3,gn:'',gd:fmt(addDays(tdy(),30))};$('onb').hidden=false;onbRender()}

function onbRender(){
  var s=O.step,h='',f='',d='',i,bk='<button class="btn" data-a="oback">Indietro</button>';
  for(i=0;i<4;i++)d+='<i'+(i<=s?' class="on"':'')+'></i>';
  if(s===0){
    h='<div class="ob-orb"><div class="core" style="--lit:1;inset:0"></div></div><h1 class="ob-h">Fai quello che conta, senza stress</h1><p class="sub">Scrivi i tuoi esami o progetti. Glow Up decide per te le priorità del giorno (massimo 1h a materia) per farti arrivare sereno alla scadenza.</p>';
    f='<button class="btn pri" data-a="onext">Inizia</button>';
  }else if(s===1){
    h='<h1 class="ob-h">Come ti chiami?</h1><input class="in" id="on-n" value="'+esc(O.name)+'" maxlength="30" placeholder="Il tuo nome" autocomplete="given-name"><p class="sub" style="margin-top:14px">I tuoi dati restano al sicuro su questo dispositivo.</p>';
    f=bk+'<button class="btn pri" data-a="onext">Avanti</button>';
  }else if(s===2){
    h='<h1 class="ob-h">Quanto tempo hai?</h1><p class="sub" style="margin-bottom:20px">Conta solo le ore davvero libere da dedicare ai tuoi obiettivi. Potrai cambiarle giorno per giorno.</p>'+stp('wd','Da lunedì a venerdì')+stp('we','Sabato e domenica');
    f=bk+'<button class="btn pri" data-a="onext">Avanti</button>';
  }else{
    h='<h1 class="ob-h">Il tuo primo obiettivo</h1><label><span class="lb">Cosa vuoi ottenere</span><input class="in" id="og-n" value="'+esc(O.gn)+'" maxlength="40" placeholder="Es. Preparare l’esame di Analisi"></label><label style="margin-top:14px"><span class="lb">Entro quando</span><input class="in" id="og-d" type="date" value="'+O.gd+'"></label>';
    f=bk+'<button class="btn" data-a="oskip">Salta</button><button class="btn pri" data-a="onext">Fine</button>';
  }
  $('onb').innerHTML='<div class="ob-w"><div class="ob-d">'+d+'</div><div class="ob-b">'+h+'</div><p class="err" id="oerr" role="alert"></p><div class="btns ob-f">'+f+'</div></div>';
}

function onbCollect(){
  if(O.step===1&&$('on-n'))O.name=$('on-n').value.trim();
  if(O.step===3&&$('og-n')){O.gn=$('og-n').value.trim(); O.gd=$('og-d').value}
}

function onbAct(a,b){
  if(a==='ostep'){O[b.dataset.k]=Math.min(12,Math.max(0,O[b.dataset.k]+parseFloat(b.dataset.d)));onbRender();return true}
  if(a==='oback'){onbCollect();O.step=Math.max(0,O.step-1);onbRender();return true}
  if(a==='onext'||a==='oskip'){
    onbCollect();
    if(a==='onext'&&O.step===1&&!O.name){$('oerr').textContent='Scrivi il tuo nome per continuare.';return true}
    if(a==='onext'&&O.step===3&&(!O.gn||!O.gd)){$('oerr').textContent='Servono il nome e la data, oppure salta.';return true}
    if(O.step<3){O.step++;onbRender();return true}
    
    S.name=O.name; S.week=[O.wd,O.wd,O.wd,O.wd,O.wd,O.we,O.we];
    if(a==='onext') S.goals.push({id:'g'+Date.now().toString(36),name:O.gn,due:O.gd,completed:false});
    
    S.onb=1; save(); $('onb').hidden=true; renderAll(); go('oggi'); tourStart(); return true;
  }
  if(a==='tour'){tourStart();return true}
  if(a==='tnext'){if(TI<TOUR.length-1){TI++;tourShow()}else tourEnd();return true}
  if(a==='tskip'){tourEnd();return true}
  return false;
}

// Listeners principali
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-a]');if(!b)return;
  var a=b.dataset.a;
  
  if(onbAct(a,b)) return;
  
  if(a==='tab')go(b.dataset.t);
  else if(a==='theme'){ S.theme = b.dataset.v; save(); applyTheme(); }
  else if(a==='newg')openSheet();
  else if(a==='editg')openSheet(b.dataset.g);
  else if(a==='close')closeSheet();
  else if(a==='save'){
    var n=$('sn').value.trim(), dd=$('sd').value;
    if(!n||!dd){ showToast('Inserisci nome e data.', '⚠️'); return; }
    var g=edId?S.goals.find(function(x){return x.id===edId}):null;
    if(g){g.name=n; g.due=dd} else S.goals.push({id:'g'+Date.now().toString(36),name:n,due:dd,completed:false});
    save(); closeSheet(); renderAll(); showToast('Salvato correttamente', '✅');
  }
  else if(a==='delg'){
    if(b.dataset.armed){S.goals=S.goals.filter(function(x){return x.id!==edId});save();closeSheet();renderAll(); showToast('Eliminato', '🗑️');}
    else{b.dataset.armed='1';b.textContent='Tocca per eliminare';}
  }
  else if(a==='doneg'){
    var g=S.goals.find(function(x){return x.id===edId});
    if(g){ g.completed = !g.completed; save(); closeSheet(); renderAll(); showToast(g.completed ? 'Completato! 🎉' : 'Riportato in corso', '✨'); }
  }
  else if(a==='task'){
    var k=fmt(tdy()), w=S.work[k]=S.work[k]||{}, id=b.dataset.g, val=parseFloat(b.dataset.aVal)||1;
    if(!w[id]) { w[id] = val; showToast('Ottimo lavoro!', '🔥'); }
    else delete w[id];
    save();renderToday();renderPiano();
  }
  else if(a==='addoff'){var d=$('offd').value;if(d&&S.off.indexOf(d)<0){S.off.push(d);S.off.sort();save();renderAll(); showToast('Giorno aggiunto', '🗓️');}}
  else if(a==='deloff'){S.off=S.off.filter(function(d){return d!==b.dataset.d});save();renderAll();}
  else if(a==='exp'){
    var v=JSON.stringify(S);$('bk').value=v;$('bk').select();
    try{navigator.clipboard.writeText(v).then(function(){ showToast('Copiato negli appunti!', '📋'); },function(){})}catch(x){}
  }
  else if(a==='imp'){
    var r=null;try{r=norm(JSON.parse($('bk').value))}catch(x){}
    if(!r){ showToast('Backup non valido.', '❌'); return; }
    S=r;save();renderAll();applyTheme(); showToast('Dati importati!', '🚀');
  }
  else if(a==='reset'){
    if(b.dataset.armed){S=def();save();renderAll();delete b.dataset.armed;b.textContent='Ricomincia da capo'; location.reload(); }
    else{b.dataset.armed='1';b.textContent='Sicuro?';}
  }
});

document.addEventListener('change',function(e){
  var t=e.target;
  if(t.dataset&&t.dataset.wd!==undefined){S.week[+t.dataset.wd]=Math.min(16,Math.max(0,parseFloat(t.value)||0));save();renderToday();renderPiano();}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
document.addEventListener('visibilitychange',function(){if(!document.hidden){renderToday();renderPiano();if(view==='oggi')$('ts').textContent=dlong(tdy())}});

// Avvio
renderAll(); 
go('oggi');
setTimeout(function(){ $('v-oggi').classList.add('active'); }, 50);

if(!S.onb) onbStart();
else if(!S.tour) tourStart();

})();