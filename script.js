(function(){
var KEY='glowup.v7', CIRC=615.75, RE=/^\d{4}-\d{2}-\d{2}$/;
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

function def(){ return {name:'', avatar:'👤', theme:'auto', onb:0, tour:[], week:[2,2,2,2,2,3,3], off:[], goals:[], work:{}, health:{}, weights:[], xp:0, motto:''}; }

function norm(r){
  if(!r||!Array.isArray(r.goals)||!Array.isArray(r.week)||r.week.length!==7)return null;
  r.week=r.week.map(function(v){return Math.min(16,Math.max(0,Number(v)||0))});
  r.goals=r.goals.filter(function(g){return g&&g.id&&g.name}).map(function(g){
    return {id:String(g.id),name:String(g.name).slice(0,40), due:g.due||'', completed:!!g.completed, cat:g.cat||'study', type:g.type||'goal'};
  });
  r.off=Array.isArray(r.off)?r.off.filter(function(d){return RE.test(d)}):[];
  if(!r.work||typeof r.work!=='object')r.work={};
  if(!r.health||typeof r.health!=='object')r.health={};
  if(!Array.isArray(r.weights))r.weights=[];
  r.tour=Array.isArray(r.tour)?r.tour:[];
  return {name:String(r.name||'').slice(0,30), avatar:r.avatar||'👤', theme:r.theme||'auto', onb:r.onb||0, tour:r.tour, week:r.week, off:r.off, goals:r.goals, work:r.work, health:r.health, weights:r.weights, xp:r.xp||0, motto:r.motto||''};
}

function load(){var r=null;try{r=norm(JSON.parse(localStorage.getItem(KEY)))}catch(e){}return r||def()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

var S=load(), view='oggi', edId=null, shT=null, wChart=null, sChart=null;
var tInt=null, tTime=1500, tRun=false;

var CTX = {
  oggi: { i:'🎯', h:'La tua giornata', p:'Completa i compiti per guadagnare XP (Punti Esperienza) e salire di livello!' },
  piano: { i:'📅', h:'Il tuo piano', p:'Gestisci le tue Abitudini giornaliere e i tuoi Obiettivi a lungo termine.' },
  salute: { i:'❤️', h:'Salute e Fitness', p:'Registra l\'acqua e i passi: anche prenderti cura di te stesso ti dà XP!' },
  stats: { i:'📊', h:'Statistiche', p:'Esplora i tuoi miglioramenti nei grafici di Peso e Passi.' }
};

function showToast(msg, icon) {
  var box = $('toast-box');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (icon ? '<span>'+icon+'</span>' : '') + '<span>'+esc(msg)+'</span>';
  box.appendChild(t);
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 400); }, 3000);
}

function applyTheme(){
  document.documentElement.setAttribute('data-theme', S.theme);
  document.querySelectorAll('[data-a="theme"]').forEach(function(b){ b.classList.toggle('active-theme', b.dataset.v === S.theme); });
  if(view === 'stats') renderChart(); 
}
applyTheme();

function baseCap(d){return S.off.indexOf(fmt(d))>=0?0:S.week[(d.getDay()+6)%7]}
function gdone(id){var s=0,k;for(k in S.work)s+=S.work[k][id]||0;return s}

// --- LOGICA GAMIFICATION (XP & LEVEL) ---
function renderLevel(){
  var lvl = Math.floor(Math.sqrt(S.xp/100)) + 1;
  $('lvl-badge').textContent = 'Lvl ' + lvl;
}
function addXP(amount){
  var oldLvl = Math.floor(Math.sqrt(S.xp/100)) + 1;
  S.xp = Math.max(0, S.xp + amount);
  var newLvl = Math.floor(Math.sqrt(S.xp/100)) + 1;
  if(newLvl > oldLvl) showToast('Sei salito al Livello ' + newLvl + '! 🌟', '🚀');
  save(); renderLevel();
}
function renderMotto(){
  $('motto-text').textContent = S.motto ? '"' + S.motto + '"' : 'Qual è il tuo grande perché?';
}

function calcStreak(id){
  var s=0, d=0;
  while(true){
    var k = fmt(addDays(tdy(), -d));
    if(S.work[k] && S.work[k][id] > 0) s++;
    else if(d > 0) break;
    d++;
  }
  return s;
}

function compute(){
  var t=tdy(), tk=fmt(t), plan=[];
  var activeGoals = S.goals.filter(function(g){ return !g.completed && g.type === 'goal'; }).sort(function(a,b){ return diff(parse(a.due), t) - diff(parse(b.due), t); });
  for(var i=0; i<7; i++){ 
    var d = addDays(t, i); var cap = baseCap(d); var pl = {};
    for(var q=0; q<activeGoals.length && cap > 0.001; q++){
      var g = activeGoals[q]; var alloc = Math.min(1, cap);
      pl[g.id] = alloc; cap -= alloc;
    }
    plan.push({date: d, alloc: pl, capLeft: cap, capTotal: baseCap(d)});
  }
  return { t:t, tk:tk, plan:plan, activeGoals:activeGoals };
}

function renderEmpty(title, subtitle, icon, btnText) {
  return '<div class="empty-state"><div class="es-icon">'+icon+'</div><h3>'+title+'</h3><p>'+subtitle+'</p>' + (btnText ? '<button class="btn pri" style="margin-top:12px" data-a="newg">'+btnText+'</button>' : '') + '</div>';
}

function updateBadges(hasPendingOggi, water){
  if($('bdg-oggi')) $('bdg-oggi').hidden = !hasPendingOggi;
  if($('bdg-salute')) $('bdg-salute').hidden = (water >= 2000);
}

function renderToday(){
  var C=compute(), tk=C.tk, todayPlan = C.plan[0];
  var plannedTotal=0, doneTotal=0, pendingCount=0;
  var wt = S.work[tk] || {};
  
  for(var id in todayPlan.alloc) plannedTotal += todayPlan.alloc[id];
  for(var id in wt) if(S.goals.find(g=>g.id===id && g.type==='goal')) doneTotal += wt[id];
  
  var progress = plannedTotal > 0 ? Math.min(1, doneTotal/plannedTotal) : (doneTotal > 0 ? 1 : 0);
  var isDone = plannedTotal > 0 && doneTotal >= plannedTotal;
  
  $('ring').style.strokeDashoffset=CIRC*(1-progress);
  $('orb').style.setProperty('--lit', progress);
  $('orb').classList.toggle('done', isDone);
  
  var rows = [];
  
  C.activeGoals.filter(function(x){return (todayPlan.alloc[x.id]||0)>.001||wt[x.id]>0}).forEach(function(x){
    var assigned = todayPlan.alloc[x.id] || 0;
    var dd = wt[x.id] || 0;
    var done = dd >= assigned && assigned > 0;
    if(!done) pendingCount++;
    var icon = x.cat === 'fitness' ? '🏃‍♂️ ' : '📚 ';
    rows.push({done:done,h:'<button class="task'+(done?' done':'')+'" data-a="task" data-g="'+x.id+'" data-a-val="'+(assigned>0?assigned:1)+'"><span class="tick">'+(done?CHECK:'')+'</span><span class="tx"><span class="nm">'+icon+esc(x.name)+'</span><span class="wkl">Obiettivo: '+(done?'Fatto':(dd>0?'Iniziato ('+fh(dd)+')':'Richiede '+fh(assigned)))+'</span></span></button>'});
  });

  var habits = S.goals.filter(function(g){ return !g.completed && g.type === 'habit'; });
  habits.forEach(function(x){
    var done = wt[x.id] > 0;
    if(!done) pendingCount++;
    var icon = x.cat === 'fitness' ? '🏃‍♂️ ' : '🔁 ';
    var streak = calcStreak(x.id);
    var strHtml = streak > 1 ? '<span class="streak">🔥 '+streak+'</span>' : '';
    rows.push({done:done,h:'<button class="task'+(done?' done':'')+'" data-a="task" data-g="'+x.id+'" data-a-val="1"><span class="tick">'+(done?CHECK:'')+'</span><span class="tx"><span class="nm">'+icon+esc(x.name)+strHtml+'</span><span class="wkl">Abitudine giornaliera</span></span></button>'});
  });

  var hasItems = rows.length > 0;
  $('big').textContent=!hasItems?'Pronto?':plannedTotal>0?(isDone?'Fatto!':fh(plannedTotal-doneTotal)):'Libero';
  $('lbl').textContent=!hasItems?'Niente in programma oggi':plannedTotal>0?(isDone?'ottimo lavoro, riposati':'rimanenti per oggi'):'Solo abitudini oggi';
  $('meta').textContent='';
  
  rows.sort(function(a,b){return a.done-b.done});
  $('tg').innerHTML = !hasItems ? renderEmpty('Nessun impegno', 'Aggiungi un obiettivo o una nuova abitudine.', '🎯', 'Aggiungi') : rows.map(function(r){return r.h}).join('');
  
  var wToday = (S.health[tk] && S.health[tk].water) || 0;
  updateBadges(pendingCount > 0, wToday);
}

function renderPiano(){
  var C=compute();
  var habits = S.goals.filter(function(g){ return !g.completed && g.type === 'habit'; });
  var goals = S.goals.filter(function(g){ return !g.completed && g.type === 'goal'; });
  
  $('hl').innerHTML = !habits.length ? renderEmpty('Nessuna abitudine', 'Aggiungi azioni quotidiane.', '🔁', 'Aggiungi Abitudine')
                    : habits.map(function(x){
                        var icon = x.cat === 'fitness' ? '🏃‍♂️ ' : '🔁 ';
                        var streak = calcStreak(x.id);
                        var strHtml = streak > 0 ? '<span class="streak">🔥 '+streak+' giorni</span>' : '';
                        return '<button class="goal" data-a="editg" data-g="'+x.id+'"><span class="bt"><span class="bn">'+icon+esc(x.name)+strHtml+'</span></span><span class="wkl">Abitudine Giornaliera</span></button>';
                      }).join('');

  $('gl').innerHTML = !goals.length ? renderEmpty('Nessun obiettivo', 'Aggiungi un traguardo.', '🎯', 'Aggiungi Obiettivo')
                    : goals.map(function(x){
                        var dd = gdone(x.id);
                        var icon = x.cat === 'fitness' ? '🏃‍♂️ ' : '📚 ';
                        return '<button class="goal" data-a="editg" data-g="'+x.id+'"><span class="bt"><span class="bn">'+icon+esc(x.name)+'</span></span><span class="wkl">Scadenza: '+dl(parse(x.due))+(dd>0?' • '+fh(dd)+' dedicate':'')+'</span></button>';
                      }).join('');
  
  var comp = S.goals.filter(function(g){ return g.completed; });
  $('sec-comp').hidden = comp.length === 0;
  $('gl-comp').innerHTML = comp.map(function(x){
    var icon = x.type === 'habit' ? '🔁 ' : '🎯 ';
    return '<button class="goal completed" data-a="editg" data-g="'+x.id+'"><span class="bt"><span class="bn">✅ '+icon+esc(x.name)+'</span></span><span class="wkl">Completato!</span></button>';
  }).join('');

  $('ndsec').hidden=!goals.length;
  var nd='';
  for(var i=0; i<7; i++){
    var pl=C.plan[i].alloc, parts=[], tot=0, d=C.plan[i].date;
    for(var id in pl){ parts.push(esc(S.goals.find(g=>g.id===id).name)); tot+=pl[id]; }
    nd+='<div class="dy"><span class="dn">'+(i===0?'Oggi':i===1?'Domani':d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric'}))+'</span><span class="dg">'+(parts.length?parts.join(', '):C.plan[i].capTotal>0?'Niente':'Nessuna ora')+'</span><span class="dt2">'+(tot?fh(tot):'')+'</span></div>';
  }
  $('nd').innerHTML=nd;
}

function renderHealth(){
  var k = fmt(tdy());
  var h = S.health[k] || {water: 0, steps: 0};
  S.health[k] = h;
  var w = h.water || 0;
  $('w-tot').textContent = w;
  var pct = Math.min(100, Math.round(w / 2000 * 100));
  $('w-fill').style.width = pct + '%';
  $('steps-in').value = h.steps || '';
  renderStepsReward(h.steps);
}

function renderStepsReward(s){
  if(!s || s === 0) { $('steps-res').innerHTML = ''; return; }
  var r = '';
  if(s < 3000) r = '💧 Un po\' di idratazione extra';
  else if(s < 6000) r = '☕ Un cappuccino (150 kcal)';
  else if(s < 10000) r = '🍦 Un gelato (300 kcal)';
  else if(s < 15000) r = '🍕 Una bella pizza (700 kcal)';
  else r = '🍔 Un hamburger con patatine (1000+ kcal!)';
  $('steps-res').innerHTML = '<div class="reward-box"><span>'+r+'</span><small>Calcolato su '+s+' passi</small></div>';
}

function renderChart(){
  if(!window.Chart || view !== 'stats') return;
  var color = getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#6366f1';
  var txtColor = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#171717';
  
  // Grafico Peso
  var ctxW = $('weightChart').getContext('2d');
  if(wChart) wChart.destroy();
  var dataW = S.weights.sort(function(a,b){return new Date(a.d) - new Date(b.d)});
  var labelsW = dataW.map(function(x){return new Date(x.d).toLocaleDateString('it-IT', {day:'numeric', month:'short'})});
  var pointsW = dataW.map(function(x){return x.w});
  wChart = new Chart(ctxW, {
    type: 'line',
    data: { labels: labelsW, datasets: [{ label: 'Peso (kg)', data: pointsW, borderColor: color, backgroundColor: color + '33', tension: 0.3, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txtColor } }, y: { ticks: { color: txtColor } } } }
  });

  // Grafico Passi (Barre, ultimi 7 gg)
  var ctxS = $('stepsChart').getContext('2d');
  if(sChart) sChart.destroy();
  var labelsS = [], pointsS = [];
  for(var i=6; i>=0; i--){
    var dStr = fmt(addDays(tdy(), -i));
    labelsS.push(new Date(dStr).toLocaleDateString('it-IT',{weekday:'short'}));
    pointsS.push(S.health[dStr] ? S.health[dStr].steps || 0 : 0);
  }
  sChart = new Chart(ctxS, {
    type: 'bar',
    data: { labels: labelsS, datasets: [{ label: 'Passi', data: pointsS, backgroundColor: color, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: txtColor } }, y: { ticks: { color: txtColor } } } }
  });
}

function renderAnalytics(){
  var totWater = 0;
  for(var i=0; i<7; i++){ var dStr = fmt(addDays(tdy(), -i)); if(S.health[dStr]) totWater += (S.health[dStr].water || 0); }
  $('st-water').textContent = Math.round(totWater / 7) + ' ml';
  
  var habitsCount = S.goals.filter(g => g.type === 'habit' && !g.completed).length;
  var score = 100;
  if(habitsCount > 0){
    var daysActive = 0;
    for(var j=0; j<7; j++) { 
       var dStr = fmt(addDays(tdy(), -j));
       if(S.work[dStr] && Object.keys(S.work[dStr]).some(id => { var g = S.goals.find(x => x.id === id); return g && g.type === 'habit'; })) daysActive++;
    }
    score = Math.round((daysActive / 7) * 100);
  } else if(S.goals.length === 0) { score = 0; }
  $('st-habits').textContent = score + '%';

  var goalsCompleted = S.goals.filter(g => g.type === 'goal' && g.completed).length;
  $('st-goals').textContent = goalsCompleted;
}

function renderSet(){
  $('who-t').textContent = S.avatar + ' ' + (S.name || 'Profilo');
  $('wk').innerHTML=LET.map(function(n,i){return '<label>'+n+'<input class="in" type="number" min="0" max="16" step="0.5" inputmode="decimal" data-wd="'+i+'" value="'+S.week[i]+'" aria-label="Ore libere di '+DOW[i]+'"></label>'}).join('');
  $('off').innerHTML=S.off.map(function(d){return '<button class="chip" data-a="deloff" data-d="'+d+'" aria-label="Rimuovi '+dl(parse(d))+'">'+dl(parse(d))+' ✕</button>'}).join('');
}

function renderAll(){ renderLevel(); renderMotto(); renderToday(); renderPiano(); renderSet(); }

function triggerCtx(t){
  if(CTX[t] && S.tour.indexOf(t) < 0 && S.onb){
    $('ctx-icn').textContent = CTX[t].i; $('ctx-h').textContent = CTX[t].h; $('ctx-p').textContent = CTX[t].p;
    $('ctx-tour').hidden = false;
  }
}

function go(t){
  view=t;
  ['oggi','piano','salute','stats','imp'].forEach(function(n){
    var el = $('v-'+n);
    if(n === t) { el.hidden = false; setTimeout(function(){ el.classList.add('active'); }, 10); } 
    else { el.classList.remove('active'); setTimeout(function(){ if(view !== n) el.hidden = true; }, 300); }
  });
  document.querySelectorAll('.tabs button').forEach(function(b){b.setAttribute('aria-current',String(b.dataset.t===t))});
  $('tt').textContent={oggi:'Oggi',piano:'Piano',salute:'Salute',stats:'Statistiche',imp:'Menu'}[t];
  $('ts').textContent=t==='oggi'?dlong(tdy()):'';$('ts').hidden=t!=='oggi';
  $('addb').hidden=t!=='piano';
  $('v-'+t).scrollTop=0;
  if(t==='piano') renderPiano();
  if(t==='salute') renderHealth();
  if(t==='stats') { renderAnalytics(); setTimeout(renderChart, 150); }
  setTimeout(function(){ triggerCtx(t); }, 350);
}

function openSheet(id){
  edId=id||null; var g=id?S.goals.find(function(x){return x.id===id}):null;
  $('sh-t').textContent=g?'Modifica':'Nuovo Impegno';
  $('sn').value=g?g.name:''; $('sd').value=g&&g.due?g.due:fmt(addDays(tdy(),30));
  $('sd').min = fmt(tdy());
  var cat = g && g.cat ? g.cat : 'study'; var type = g && g.type ? g.type : 'goal';
  $('sg-cat').value = cat; document.querySelectorAll('.cat-btn').forEach(function(btn){ btn.classList.toggle('active', btn.dataset.c === cat); });
  $('sg-type').value = type; document.querySelectorAll('.type-btn').forEach(function(btn){ btn.classList.toggle('active', btn.dataset.t === type); });
  $('wrap-due').style.display = (type === 'goal') ? 'block' : 'none';
  $('sdel').hidden=!g; $('sdel').textContent='Elimina'; delete $('sdel').dataset.armed;
  $('sdone').hidden=!g; $('sdone').textContent=g&&g.completed?'Segna In Corso':'Segna Completato';
  clearTimeout(shT);$('sheet').hidden=false;void $('sheet').offsetWidth;$('sheet').classList.add('open');
}
function closeSheet(){$('sheet').classList.remove('open');clearTimeout(shT);shT=setTimeout(function(){$('sheet').hidden=true},400)}

var O={};
function onbStart(){O={step:0,name:'',av:'👤',wd:2,we:3,gn:'',gd:fmt(addDays(tdy(),30))};$('onb').hidden=false;onbRender()}
function stp(k,l){return '<div class="stp"><span>'+l+'</span><div><button class="btn" data-a="ostep" data-k="'+k+'" data-d="-0.5" aria-label="Meno">−</button><b>'+fh(O[k])+'</b><button class="btn" data-a="ostep" data-k="'+k+'" data-d="0.5" aria-label="Più">+</button></div></div>'}

function onbRender(){
  var s=O.step,h='',f='',d='',i,bk='<button class="btn" data-a="oback">Indietro</button>';
  for(i=0;i<4;i++)d+='<i'+(i<=s?' class="on"':'')+'></i>';
  if(s===0){
    h='<div class="ob-orb"><div class="core" style="--lit:1;inset:0"></div></div><h1 class="ob-h">Fai quello che conta, senza stress</h1><p class="sub">Gestisci abitudini, salute e traguardi. Sali di livello ogni giorno.</p>';
    f='<button class="btn pri" data-a="onext">Inizia</button>';
  }else if(s===1){
    var avs=['👤','👩‍💻','🚀','⚡','🐱'].map(function(x){return '<span class="av-btn '+(O.av===x?'active':'')+'" data-a="selav" data-v="'+x+'">'+x+'</span>'}).join('');
    h='<h1 class="ob-h">Crea il tuo profilo</h1><div class="avatar-sel">'+avs+'</div><input class="in" id="on-n" value="'+esc(O.name)+'" maxlength="30" placeholder="Il tuo nome">';
    f=bk+'<button class="btn pri" data-a="onext">Avanti</button>';
  }else if(s===2){
    h='<h1 class="ob-h">Quanto tempo hai?</h1><p class="sub" style="margin-bottom:20px">Imposta le ore da dedicare ai tuoi Obiettivi a lungo termine.</p>'+stp('wd','Lunedì - Venerdì')+stp('we','Sabato e Domenica');
    f=bk+'<button class="btn pri" data-a="onext">Avanti</button>';
  }else{
    h='<h1 class="ob-h">Il tuo primo traguardo</h1><label><span class="lb">Esame, Progetto o Evento</span><input class="in" id="og-n" value="'+esc(O.gn)+'" maxlength="40" placeholder="Es. Esame di Analisi"></label><label style="margin-top:14px"><span class="lb">Entro quando</span><input class="in" id="og-d" type="date" value="'+O.gd+'"></label>';
    f=bk+'<button class="btn" data-a="oskip">Salta</button><button class="btn pri" data-a="onext">Fine</button>';
  }
  $('onb').innerHTML='<div class="ob-w"><div class="ob-d">'+d+'</div><div class="ob-b">'+h+'</div><p class="err" id="oerr" role="alert"></p><div class="btns ob-f">'+f+'</div></div>';
}

function onbCollect(){ if(O.step===1&&$('on-n'))O.name=$('on-n').value.trim(); if(O.step===3&&$('og-n')){O.gn=$('og-n').value.trim(); O.gd=$('og-d').value} }

function onbAct(a,b){
  if(a==='ostep'){O[b.dataset.k]=Math.min(12,Math.max(0,O[b.dataset.k]+parseFloat(b.dataset.d)));onbRender();return true}
  if(a==='selav'){O.av=b.dataset.v; onbRender(); return true;}
  if(a==='oback'){onbCollect();O.step=Math.max(0,O.step-1);onbRender();return true}
  if(a==='onext'||a==='oskip'){
    onbCollect();
    if(a==='onext'&&O.step===1&&!O.name){$('oerr').textContent='Scrivi il tuo nome per continuare.';return true}
    if(a==='onext'&&O.step===3&&(!O.gn||!O.gd)){$('oerr').textContent='Servono il nome e la data.';return true}
    if(O.step<3){O.step++;onbRender();return true}
    S.name=O.name; S.avatar=O.av; S.week=[O.wd,O.wd,O.wd,O.wd,O.wd,O.we,O.we];
    if(a==='onext') S.goals.push({id:'g'+Date.now().toString(36),name:O.gn,due:O.gd,completed:false,cat:'study',type:'goal'});
    S.onb=1; save(); $('onb').hidden=true; renderAll(); go('oggi'); return true;
  }
  return false;
}

document.addEventListener('click',function(e){
  var b=e.target.closest('[data-a]');if(!b)return;
  var a=b.dataset.a;
  if(onbAct(a,b)) return;
  
  if(a==='tab')go(b.dataset.t);
  else if(a==='theme'){ S.theme = b.dataset.v; save(); applyTheme(); }
  else if(a==='newg')openSheet();
  else if(a==='editg')openSheet(b.dataset.g);
  else if(a==='close')closeSheet();
  else if(a==='selcat'){ document.querySelectorAll('.cat-btn').forEach(function(btn){ btn.classList.remove('active') }); b.classList.add('active'); $('sg-cat').value = b.dataset.c; }
  else if(a==='seltype'){ document.querySelectorAll('.type-btn').forEach(function(btn){ btn.classList.remove('active') }); b.classList.add('active'); $('sg-type').value = b.dataset.t; $('wrap-due').style.display = (b.dataset.t === 'goal') ? 'block' : 'none'; }
  else if(a==='save'){
    var n=$('sn').value.trim(), dd=$('sd').value, cat=$('sg-cat').value, type=$('sg-type').value;
    if(!n || (type === 'goal' && !dd)){ showToast('Compila i campi richiesti.', '⚠️'); return; }
    if(type === 'habit') dd = ''; 
    var g=edId?S.goals.find(function(x){return x.id===edId}):null;
    if(g){g.name=n; g.due=dd; g.cat=cat; g.type=type;} else S.goals.push({id:'g'+Date.now().toString(36),name:n,due:dd,completed:false,cat:cat,type:type});
    save(); closeSheet(); renderAll(); showToast('Salvato!', '✅');
  }
  else if(a==='delg'){
    if(b.dataset.armed){S.goals=S.goals.filter(function(x){return x.id!==edId});save();closeSheet();renderAll(); showToast('Eliminato', '🗑️');}
    else{b.dataset.armed='1';b.textContent='Tocca per confermare';}
  }
  else if(a==='doneg'){
    var g=S.goals.find(function(x){return x.id===edId});
    if(g){ g.completed = !g.completed; if(g.completed) addXP(50); save(); closeSheet(); renderAll(); showToast(g.completed ? 'Obiettivo completato! +50 XP 🎉' : 'Riportato in corso', '✨'); }
  }
  else if(a==='task'){
    var k=fmt(tdy()), w=S.work[k]=S.work[k]||{}, id=b.dataset.g, val=parseFloat(b.dataset.aVal)||1;
    if(!w[id]) { w[id] = val; addXP(20); showToast('Ottimo lavoro! +20 XP', '🔥'); } else { delete w[id]; addXP(-20); }
    save();renderToday();renderPiano();
  }
  else if(a==='addwater'){
    var k=fmt(tdy()), v=parseInt(b.dataset.v); S.health[k].water = (S.health[k].water || 0) + v; 
    addXP(5); save(); renderHealth(); renderToday(); showToast('+'+v+' ml ( +5 XP )', '💧');
  }
  else if(a==='resetwater'){ var k=fmt(tdy()); S.health[k].water = 0; save(); renderHealth(); renderToday(); }
  else if(a==='savesteps'){ 
    var k=fmt(tdy()), v=parseInt($('steps-in').value) || 0; S.health[k].steps = v; 
    var xpEarned = Math.round(v/1000); addXP(xpEarned); save(); renderHealth(); showToast('Passi salvati! +'+xpEarned+' XP', '👟'); 
  }
  else if(a==='saveweight'){
    var v = parseFloat($('weight-in').value); if(!v) return;
    var k = fmt(tdy()), ex = S.weights.find(function(x){return x.d === k});
    if(ex) ex.w = v; else S.weights.push({d: k, w: v});
    save(); showToast('Peso salvato!', '⚖️');
  }
  else if(a==='edit-motto'){
    var m = window.prompt("Qual è il tuo grande obiettivo finale?", S.motto);
    if(m !== null){ S.motto = m.trim(); save(); renderMotto(); if(S.motto) addXP(10); }
  }
  // TIMER POMODORO
  else if(a==='open-timer'){
    tTime = 1500; tRun = false; $('timer-disp').textContent = '25:00'; $('timer-btn').textContent = 'Avvia';
    $('timer-sheet').hidden = false; setTimeout(() => $('timer-sheet').classList.add('open'), 10);
  }
  else if(a==='timer-toggle'){
    if(tRun){ clearInterval(tInt); tRun = false; $('timer-btn').textContent = 'Riprendi'; } 
    else {
      tRun = true; $('timer-btn').textContent = 'Pausa';
      tInt = setInterval(function(){
        tTime--; var min = Math.floor(tTime/60), sec = tTime%60; $('timer-disp').textContent = pad(min)+':'+pad(sec);
        if(tTime <= 0){
          clearInterval(tInt); tRun = false; $('timer-btn').textContent = 'Finito';
          showToast('Focus completato! +50 XP', '🎉'); addXP(50);
        }
      }, 1000);
    }
  }
  else if(a==='close-timer'){ clearInterval(tInt); tRun = false; $('timer-sheet').classList.remove('open'); setTimeout(() => $('timer-sheet').hidden = true, 400); }
  // MENU
  else if(a==='addoff'){var d=$('offd').value;if(d&&S.off.indexOf(d)<0){S.off.push(d);S.off.sort();save();renderAll(); showToast('Giorno aggiunto', '🗓️');}}
  else if(a==='deloff'){S.off=S.off.filter(function(d){return d!==b.dataset.d});save();renderAll();}
  else if(a==='exp'){ var v=JSON.stringify(S);$('bk').value=v;$('bk').select(); try{navigator.clipboard.writeText(v).then(function(){ showToast('Copiato!', '📋'); },function(){})}catch(x){} }
  else if(a==='imp'){ var r=null;try{r=norm(JSON.parse($('bk').value))}catch(x){} if(!r){ showToast('Backup non valido.', '❌'); return; } S=r;save();renderAll();applyTheme(); showToast('Dati importati!', '🚀'); }
  else if(a==='reset'){ if(b.dataset.armed){S=def();save();renderAll(); location.reload(); } else{b.dataset.armed='1';b.textContent='Sicuro?';} }
  else if(a==='reset-tour'){ S.tour=[]; save(); go('oggi'); showToast('Tutorial resettati', '🔄'); }
  else if(a==='ctx-ok'){ S.tour.push(view); save(); $('ctx-tour').hidden=true; }
  else if(a==='share'){ if(navigator.share){ navigator.share({ title: 'Glow Up', text: 'Sto salendo di livello su Glow Up e completando i miei obiettivi! 🔥 Unisciti a me!', url: window.location.href }).catch(function(){}); } else { showToast('Condivisione non supportata', '⚠️'); } }
});

document.addEventListener('change',function(e){
  var t=e.target;
  if(t.dataset&&t.dataset.wd!==undefined){S.week[+t.dataset.wd]=Math.min(16,Math.max(0,parseFloat(t.value)||0));save();renderToday();renderPiano();}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
document.addEventListener('visibilitychange',function(){if(!document.hidden){renderToday();renderPiano();if(view==='oggi')$('ts').textContent=dlong(tdy())}});

renderAll(); go('oggi');
setTimeout(function(){ $('v-oggi').classList.add('active'); }, 50);
if(!S.onb) onbStart();

})();