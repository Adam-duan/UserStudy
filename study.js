'use strict';
(async () => {
const $ = id => document.getElementById(id);
async function readJSON(url) {
 const response = await fetch(url, {cache:'no-store'});
 if (!response.ok) throw new Error('无法加载问卷，请刷新重试。');
 return response.json();
}
const bundle = await readJSON('study.json');
const config = await readJSON('config.json');
// The collector may be on the same server or an independently deployed endpoint.
const endpoint = config.submit_url ? new URL(config.submit_url, location.href).href : '';
const key = 'instruction-study-v1-' + bundle.version;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds = {bg:'背景控制', fg:'前景控制', mixed:'混合控制'};
function randomInt(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(items) { const a = items.slice(); for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
function identifier() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a,x=>x.toString(16).padStart(2,'0')).join(''); }
function freshState() {
 const base = shuffle([0,1,2]);
 // Positions are balanced for the same hidden methods, not for video IDs.
 // Public study data contains a per-case opaque mapping to a balanced form.
 const forms = shuffle(bundle.cases.map((_,i)=>i%3));
 const order = shuffle(bundle.cases.map(c=>c.id));
 const assignments = {};
 order.forEach((id,i)=>{
  const c=bundle.cases.find(c=>c.id===id);
  const slots=c.balance_order;
  assignments[id]=base.map(j=>slots[(j+forms[i])%3]);
 });
 return {participant:identifier(),started_at:new Date().toISOString(),index:0,order,assignments,ratings:{},view_seconds:{},play_seconds:{},revision:0,finished:false,submitted_revision:null};
}
let state, storageOK=true;
try {state=JSON.parse(localStorage.getItem(key));} catch(e) {storageOK=false;}
if (!state) state=freshState();
if (!state.order || state.order.length!==bundle.cases.length || new Set(state.order).size!==bundle.cases.length || !state.order.every(id=>bundle.cases.some(c=>c.id===id)) || !state.order.every(id=>{
 const ids=state.assignments?.[id], c=bundle.cases.find(c=>c.id===id);
 return ids?.length===3 && new Set(ids).size===3 && ids.every(v=>c.videos.some(x=>x.id===v));
})) throw new Error('浏览器保存的问卷顺序不完整。请保留现有记录，并联系问卷提供者。');
const cases=state.order.map(id=>bundle.cases.find(c=>c.id===id));
state.index=Math.max(0,Math.min(cases.length-1,Number(state.index)||0));
let sync=false, sending=false, enteredAt=performance.now(), clockAt=performance.now(), wasVisible=document.visibilityState==='visible';
function orderedVideos(c) {return state.assignments[c.id].map(id=>c.videos.find(v=>v.id===id));}
function videoNodes() {return Array.from(document.querySelectorAll('#cards video'));}
function validScore(value) {return [1,2,3,4,5,'uncertain'].includes(value);}
function complete(c) {return c.videos.every(v=>validScore(state.ratings[c.id]?.[v.id]));}
function allComplete() {return cases.every(complete);}
function recordTime() {
 const now=performance.now(), c=cases[state.index];
 if (!$('survey').hidden && wasVisible) state.view_seconds[c.id]=(state.view_seconds[c.id]||0)+(now-enteredAt)/1000;
 enteredAt=now;
}
function save() {
 try {localStorage.setItem(key,JSON.stringify(state));storageOK=true;} catch(e) {storageOK=false;}
 $('status').textContent=storageOK?'已保存到当前浏览器':'本地保存失败，请导出评分备份。';
 progress();
}
function progress() {
 const n=cases.reduce((n,c)=>n+c.videos.filter(v=>validScore(state.ratings[c.id]?.[v.id])).length,0);
 $('progress').textContent=`已评分 ${n} / ${cases.length*3}`;
 $('next').disabled=!complete(cases[state.index]);
 $('next').textContent=state.index===cases.length-1?'完成并提交':'下一组';
 const frontier=cases.findIndex(c=>!complete(c));
 Array.from($('jump').options).forEach((o,i)=>o.disabled=frontier>=0 && i>frontier);
}
function stop() {sync=false;videoNodes().forEach(v=>v.pause());}
function updateKeyboard(frame) {
 const c=cases[state.index], visible=c.kind==='bg' && Boolean(c.control_segments?.length);
 $('keyboardGuide').hidden=!visible; if(!visible) return;
 const f=Math.max(0,Math.min(80,Math.floor(frame+1e-6))), segment=c.control_segments.find(s=>f>=s.start&&f<=s.end);
 document.querySelectorAll('#keyboardGuide .keycap').forEach(k=>k.classList.toggle('active',Boolean(segment && segment.control[Number(k.dataset.axis)]===Number(k.dataset.value))));
 $('currentControl').textContent=segment?segment.label:(f===0?'起始画面':'无运动指令');
 $('controlRange').textContent=segment?`帧 ${segment.start}–${segment.end} · 当前帧 ${f}`:`当前帧 ${f}`;
}
function render() {
 stop(); $('error').textContent=''; $('survey').hidden=false; $('done').hidden=true;
 const c=cases[state.index]; $('jump').value=state.index; $('target').textContent='任务指令：'+c.target;
 $('counter').textContent=`${state.index+1} / ${cases.length}`; $('prev').disabled=state.index===0;
 $('commands').hidden=!c.control_segments; $('commands').open=false;
 $('timeline').textContent=(c.control_segments||[]).map(s=>`帧 ${s.start}–${s.end}：${s.label}`).join('； ');
 $('reference').innerHTML='';
 $('cards').innerHTML=orderedVideos(c).map((v,i)=>`<section class="card"><h2>${String.fromCharCode(65+i)}</h2><video controls playsinline muted preload="metadata" data-id="${v.id}" data-fps="${v.fps}"><source src="${esc(v.webm)}" type="video/webm"><source src="${esc(v.url)}" type="video/mp4"></video><div class="rating">指令完成度<div class="choices">${[1,2,3,4,5,'uncertain'].map(s=>`<label><input type="radio" name="${v.id}" data-id="${v.id}" value="${s}" ${state.ratings[c.id]?.[v.id]===s?'checked':''}>${s==='uncertain'?'无法判断':s}</label>`).join('')}</div></div></section>`).join('');
 $('scrub').value=0; $('frame').textContent='帧 0 / 80'; updateKeyboard(0); enteredAt=performance.now(); progress();
 document.querySelectorAll('input[type=radio]').forEach(r=>r.addEventListener('change',()=>{
  state.ratings[c.id]??={}; state.ratings[c.id][r.dataset.id]=r.value==='uncertain'?'uncertain':Number(r.value);
  state.revision++; state.finished=false; state.finished_at=null; recordTime(); save();
  if(allComplete()) finish();
 }));
 videoNodes().forEach(v=>v.addEventListener('error',()=>{$('error').textContent='视频加载失败，请刷新重试。已有评分会保留。';}));
}
async function play(reset) {
 const vs=videoNodes();
 if(reset) vs.forEach(v=>v.currentTime=0);
 else {const f=vs[0].currentTime*Number(vs[0].dataset.fps);vs.forEach(v=>v.currentTime=f/Number(v.dataset.fps));}
 const result=await Promise.allSettled(vs.map(v=>v.play()));
 sync=result.every(r=>r.status==='fulfilled');
 if(!sync){stop();$('error').textContent='播放未能启动，请等待视频加载后重试。';}
}
function payload() {
 return {schema:bundle.schema,version:bundle.version,participant:state.participant,revision:state.revision,
 started_at:state.started_at,finished_at:state.finished_at||null,exported_at:new Date().toISOString(),
 order:state.order,assignments:state.assignments,ratings:state.ratings,view_seconds:state.view_seconds,play_seconds:state.play_seconds};
}
async function submit() {
 if(sending || !allComplete()) return;
 if(state.submitted_revision===state.revision){$('submitStatus').textContent='评分已成功提交，谢谢！';$('retry').hidden=true;return;}
 if(!endpoint){$('submitStatus').textContent='评分已保存在当前浏览器。请点击“导出我的评分”，将文件发给问卷提供者。';$('retry').hidden=true;return;}
 sending=true; $('retry').disabled=true; $('review').disabled=true; $('submitStatus').textContent='正在提交评分，请稍候…';
 const revision=state.revision, controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
 try {
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload()),signal:controller.signal});
  const result=await response.json();
  if(!response.ok || result.ok!==true || result.participant!==state.participant || result.revision!==revision) throw new Error('未收到有效的保存确认');
  state.submitted_revision=revision; save(); $('submitStatus').textContent='评分已成功提交，谢谢！'; $('retry').hidden=true;
 } catch(e) {
  $('submitStatus').textContent='暂未确认提交成功。评分仍保存在当前浏览器，可以重试，或导出文件发给问卷提供者。'; $('retry').hidden=false;
 } finally {clearTimeout(timeout);sending=false;$('retry').disabled=false;$('review').disabled=false;}
}
function finish() {
 if(!allComplete()) return;
 recordTime();stop();state.finished=true;state.finished_at??=new Date().toISOString();save();
 $('survey').hidden=true;$('done').hidden=false;submit();
}
function go(i) {
 if(i<0 || i>=cases.length || (i>state.index && cases.slice(0,i).some(c=>!complete(c)))) return;
 recordTime();stop();state.index=i;save();render();
}
$('jump').innerHTML=cases.map((c,i)=>`<option value="${i}">${i+1}. ${kinds[c.kind]}</option>`).join('');
$('jump').onchange=()=>go(Number($('jump').value));$('prev').onclick=()=>go(state.index-1);
$('next').onclick=()=>{if(!complete(cases[state.index]))return;state.index===cases.length-1?finish():go(state.index+1);};
$('play').onclick=()=>play(false);$('restart').onclick=()=>play(true);$('pause').onclick=stop;
$('scrub').oninput=()=>{stop();videoNodes().forEach(v=>v.currentTime=Number($('scrub').value)/Number(v.dataset.fps));$('frame').textContent=`帧 ${$('scrub').value} / 80`;updateKeyboard(Number($('scrub').value));};
$('retry').onclick=submit;$('review').onclick=()=>{state.finished=false;save();render();};
$('export').onclick=()=>{
 recordTime();save();const blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='video_ratings_'+state.participant+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
setInterval(()=>{
 const now=performance.now(),dt=Math.min((now-clockAt)/1000,.5);clockAt=now;
 const vs=videoNodes();if(!vs.length || $('survey').hidden)return;
 if(document.visibilityState==='visible')vs.forEach(v=>{if(!v.paused&&!v.ended&&!v.seeking&&v.readyState>=2)state.play_seconds[v.dataset.id]=(state.play_seconds[v.dataset.id]||0)+dt;});
 const first=vs[0],f=first.currentTime*Number(first.dataset.fps);
 if(sync){if(first.paused||first.ended)stop();else vs.slice(1).forEach(v=>{const t=f/Number(v.dataset.fps);if(Math.abs(v.currentTime-t)>.15)v.currentTime=t;});}
 $('scrub').value=Math.min(80,Math.floor(f+1e-6));$('frame').textContent=`帧 ${Math.min(80,Math.floor(f+1e-6))} / 80`;updateKeyboard(f);
},150);
document.addEventListener('visibilitychange',()=>{recordTime();stop();wasVisible=document.visibilityState==='visible';enteredAt=performance.now();save();});
window.addEventListener('pagehide',()=>{recordTime();save();});
render();save();if(allComplete()) finish();
})().catch(error=>{document.getElementById('error').textContent=error.message;document.getElementById('next').disabled=true;});
