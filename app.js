import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDocs,
  setDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtGyFpjU2BnYqNxfWxhI0IqCNDWUFnkjo",
  authDomain: "ugrp-math.firebaseapp.com",
  projectId: "ugrp-math",
  storageBucket: "ugrp-math.firebasestorage.app",
  messagingSenderId: "884208822382",
  appId: "1:884208822382:web:a147ad0470b2bc6a049e7f"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const BASE_USERS = [
  { id:"minjun",  name:"김민준", pw:"1234", initial:"김", bg:"rgba(16,185,129,0.15)", color:"#10b981", role:"Researcher A" },
  { id:"seoyeon", name:"이서연", pw:"1234", initial:"이", bg:"rgba(59,130,246,0.15)",  color:"#3b82f6", role:"Researcher B" },
  { id:"jiho",    name:"박지호", pw:"1234", initial:"박", bg:"rgba(139,92,246,0.15)", color:"#8b5cf6", role:"Researcher C" },
];
let USERS = BASE_USERS.map(u=>({...u}));

let CU=null, pickIdx=-1, weekOff=0, addDate=null;
let viewItem=null, timerInterval=null, timerStart=null, statPeriod="week";
let unsubFiles=null;
let newAvatarB64=null, newBannerB64=null;

const BANNERS=[
  'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
  'linear-gradient(135deg,#0f2318,#1a3d2b,#0d4a2f)',
  'linear-gradient(135deg,#1a0a2e,#2d1060,#1a0a2e)',
  'linear-gradient(135deg,#111,#2a2a2a,#111)',
  'linear-gradient(135deg,#2e0a0a,#5c1010,#2e0a0a)',
  'linear-gradient(135deg,#0a2e2e,#0f5555,#0a2e2e)',
];

const $=id=>document.getElementById(id);
const esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const dateStr=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10);};
const todayStr=()=>dateStr(new Date());
const DOW=["일","월","화","수","목","금","토"];
const MONTHS=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function fmtSec(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;}
function fmtDur(s){if(!s||s<=0)return"0분";if(s<60)return s+"초";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?`${h}시간 ${String(m).padStart(2,"0")}분`:`${m}분`;}
function weekStart(off=0){const d=new Date();d.setHours(0,0,0,0);const day=d.getDay();const diff=day===0?-6:1-day;d.setDate(d.getDate()+diff+off*7);return d;}
function showToast(msg){const t=$("toast");if(!t)return;t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}
function switchTab(name){document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));const el=$(`tab-${name}`);if(el)el.classList.add("active");}

async function getSessions(){const snap=await getDocs(query(collection(db,"sessions"),orderBy("start","desc")));return snap.docs.map(d=>({id:d.id,...d.data()}));}
async function getActiveTimers(){const snap=await getDocs(collection(db,"activeTimers"));const obj={};snap.docs.forEach(d=>{obj[d.id]=d.data();});return obj;}
async function getFileItems(){const snap=await getDocs(query(collection(db,"fileItems"),orderBy("createdAt","asc")));return snap.docs.map(d=>({id:d.id,...d.data()}));}

// ════ 프로필 로드 ════
async function loadAllProfiles(){
  try{
    const snap=await getDocs(collection(db,"profiles"));
    snap.docs.forEach(d=>{
      const p=d.data(), idx=USERS.findIndex(u=>u.id===d.id);
      if(idx<0)return;
      if(p.name)     USERS[idx].name=p.name;
      if(p.pw)       USERS[idx].pw=p.pw;
      if(p.avatar)   USERS[idx].avatar=p.avatar;
      if(p.bio)      USERS[idx].bio=p.bio;
      if(p.banner)   USERS[idx].banner=p.banner;
      if(p.avatarImg)USERS[idx].avatarImg=p.avatarImg;
      if(p.bannerImg)USERS[idx].bannerImg=p.bannerImg;
    });
    USERS.forEach((u,i)=>{
      const nameEl=$(`mpName${i}`), avEl=$(`mpAv${i}`);
      if(nameEl)nameEl.textContent=u.name;
      if(avEl){
        if(u.avatarImg)avEl.innerHTML=`<img src="${u.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        else avEl.textContent=u.avatar||u.initial;
      }
    });
  }catch(e){}
}

// ════ LOGIN ════
function pickUser(i){
  pickIdx=i;
  $("mpMembers").style.display="none";
  $("pwSection").style.display="block";
  $("pwInput").focus();
  $("pwErr").textContent="";
}

function doLogin(){
  if(pickIdx<0)return;
  const u=USERS[pickIdx];
  if($("pwInput").value!==u.pw){$("pwErr").textContent="비밀번호가 틀렸습니다";return;}
  CU={...u};
  $("memberOverlay").style.display="none";
  $("loginPage").style.display="none";
  $("appPage").style.display="flex";
  $("chipName").textContent=CU.name;
  $("pwInput").value="";
  checkActiveTimer();
  renderTimerStats();
  renderStats();
  subscribeFiles();
  renderCal();
};

$("logoutBtn").addEventListener("click",()=>{
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  if(unsubFiles){unsubFiles();unsubFiles=null;}
  CU=null;pickIdx=-1;
  $("appPage").style.display="none";
  $("loginPage").style.display="flex";
  $("mpMembers").style.display="flex";
  $("pwSection").style.display="none";
  resetTimerUI();
  switchTab("timer");
  document.querySelector(".nav-btn[data-tab='timer']")?.classList.add("active");
});

// ════ NAV ════
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    switchTab(btn.dataset.tab);
    if(btn.dataset.tab==="stats")renderStats();
    if(btn.dataset.tab==="files")renderCal();
  });
});

$("userChip").addEventListener("click",openProfile);

// ════ TIMER ════
async function checkActiveTimer(){
  const active=await getActiveTimers();
  if(active[CU.id]){timerStart=active[CU.id].start;startTick();$("startBtn").style.display="none";$("stopBtn").style.display="";$("timerNote").style.display="";$("timerLabel").textContent="연구 진행 중 🔬";}
}
function startTick(){if(timerInterval)clearInterval(timerInterval);timerInterval=setInterval(()=>{$("timerClock").textContent=fmtSec(Math.floor((Date.now()-timerStart)/1000));},1000);}
function resetTimerUI(){$("startBtn").style.display="";$("stopBtn").style.display="none";$("timerNote").style.display="none";$("timerClock").textContent="00:00:00";$("timerLabel").textContent="대기 중";}

$("startBtn").addEventListener("click",async()=>{
  timerStart=Date.now();
  await setDoc(doc(db,"activeTimers",CU.id),{start:timerStart,userId:CU.id});
  $("startBtn").style.display="none";$("stopBtn").style.display="";$("timerNote").style.display="";
  $("timerLabel").textContent="연구 진행 중 🔬";startTick();
});

$("stopBtn").addEventListener("click",async()=>{
  if(!timerStart)return;
  clearInterval(timerInterval);timerInterval=null;
  const end=Date.now(),duration=Math.floor((end-timerStart)/1000);
  if(duration<5){await deleteDoc(doc(db,"activeTimers",CU.id));timerStart=null;$("timerNote").value="";resetTimerUI();return;}
  await addDoc(collection(db,"sessions"),{userId:CU.id,start:timerStart,end,duration,note:$("timerNote").value.trim(),date:todayStr(),createdAt:serverTimestamp()});
  await deleteDoc(doc(db,"activeTimers",CU.id));
  timerStart=null;$("timerNote").value="";
  resetTimerUI();renderTimerStats();renderStats();
  showToast(`${fmtDur(duration)} 기록됐습니다 ✅`);
});

async function renderTimerStats(){
  if(!CU)return;
  const sessions=await getSessions();
  const mine=sessions.filter(s=>s.userId===CU.id);
  const today=mine.filter(s=>s.date===todayStr());
  const todaySec=today.reduce((a,s)=>a+s.duration,0);
  const wStartStr=dateStr(weekStart());
  const week=mine.filter(s=>s.date>=wStartStr);
  const weekSec=week.reduce((a,s)=>a+s.duration,0);
  const weekD=new Set(week.map(s=>s.date)).size;
  const totalSec=mine.reduce((a,s)=>a+s.duration,0);
  $("todayTime").textContent=fmtDur(todaySec);$("todaySess").textContent=`세션 ${today.length}회`;
  $("weekTime").textContent=fmtDur(weekSec);$("weekDays").textContent=`${weekD}일 연구`;
  $("totalTime").textContent=fmtDur(totalSec);$("totalSess").textContent=`총 ${mine.length}회`;
  const recent=[...mine].sort((a,b)=>b.start-a.start).slice(0,8);
  $("logList").innerHTML=recent.length?recent.map(s=>`
    <div class="log-item">
      <div class="log-left"><span>${s.date}</span>${s.note?`<span class="log-note">${esc(s.note.substring(0,30))}</span>`:""}</div>
      <span class="log-dur">${fmtDur(s.duration)}</span>
    </div>`).join(""):`<div class="empty-msg">아직 기록이 없습니다</div>`;
}

// ════ STATS ════
document.querySelectorAll(".period-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{document.querySelectorAll(".period-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");statPeriod=btn.dataset.p;renderStats();});
});

async function renderStats(){
  if(!CU)return;
  const all=await getSessions();
  let filtered=all;
  if(statPeriod==="week")filtered=all.filter(s=>s.date>=dateStr(weekStart()));
  if(statPeriod==="month"){const m=new Date();m.setDate(1);m.setHours(0,0,0,0);filtered=all.filter(s=>s.start>=m.getTime());}
  const byUser={};USERS.forEach(u=>{byUser[u.id]={sec:0,days:new Set(),cnt:0};});
  filtered.forEach(s=>{if(byUser[s.userId]){byUser[s.userId].sec+=s.duration;byUser[s.userId].days.add(s.date);byUser[s.userId].cnt++;}});
  const ranked=USERS.map(u=>({u,sec:byUser[u.id].sec,days:byUser[u.id].days.size})).sort((a,b)=>b.sec-a.sec);
  const totalSec=ranked.reduce((a,r)=>a+r.sec,0);
  const active=ranked.filter(r=>r.sec>0).length;
  const avg=active>0?Math.round(totalSec/active):0;
  const allDays=new Set(filtered.map(s=>s.date)).size;
  $("metricsRow").innerHTML=`
    <div class="metric-card"><div class="mc-lbl">팀 총 연구시간</div><div class="mc-val">${fmtDur(totalSec)}</div></div>
    <div class="metric-card"><div class="mc-lbl">1인 평균</div><div class="mc-val">${fmtDur(avg)}</div></div>
    <div class="metric-card"><div class="mc-lbl">연구 진행일</div><div class="mc-val">${allDays}일</div></div>`;
  const medals=["🥇","🥈","🥉"];const maxSec=ranked[0]?.sec||1;
  $("rankList").innerHTML=ranked.map((r,i)=>`
    <div class="rank-row">
      <div class="rank-num">${medals[i]||i+1}</div>
      <div class="rank-av" style="background:${r.u.bg};color:${r.u.color}">${r.u.avatar||r.u.initial}</div>
      <div class="rank-name">${r.u.name}</div>
      <div class="rank-bar-wrap"><div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.round(r.sec/maxSec*100)}%"></div></div></div>
      <div class="rank-time">${fmtDur(r.sec)}</div>
    </div>`).join("");
  const days=[...new Set(filtered.map(s=>s.date))].sort().reverse().slice(0,7);
  const dayMaxSec=days.length?Math.max(...days.map(d=>USERS.reduce((a,u)=>a+filtered.filter(s=>s.date===d&&s.userId===u.id).reduce((x,s)=>x+s.duration,0),0)),1):1;
  $("dailyLog").innerHTML=days.length?days.map(d=>`
    <div class="daily-row"><div class="daily-date">${d}</div>
    <div>${USERS.map(u=>{const sec=filtered.filter(s=>s.date===d&&s.userId===u.id).reduce((a,s)=>a+s.duration,0);
      return`<div class="daily-user-row"><span class="daily-uname">${u.avatar||u.initial}</span><div class="daily-bar-bg"><div class="daily-bar-fill" style="width:${Math.round(sec/dayMaxSec*100)}%;background:${u.color}"></div></div><span class="daily-time">${sec?fmtDur(sec):"-"}</span></div>`;
    }).join("")}</div></div>`).join(""):`<div class="empty-msg">기록 없음</div>`;
}

// ════ CALENDAR ════
const TYPE_ICONS={gdrive:"ti-brand-google-drive",gdoc:"ti-file-text",gsheet:"ti-table",gslide:"ti-presentation",notion:"ti-note",paper:"ti-file-description",github:"ti-brand-github",etc:"ti-link"};
const TYPE_COLORS={gdrive:["#E6F1FB","#185FA5"],gdoc:["#E6F1FB","#185FA5"],gsheet:["#E1F5EE","#0F6E56"],gslide:["#FAEEDA","#854F0B"],notion:["#F1EFE8","#444"],paper:["#FEF3C7","#92400E"],github:["#F1EFE8","#444"],etc:["#F3E8FF","#6D28D9"]};

function subscribeFiles(){if(unsubFiles)unsubFiles();unsubFiles=onSnapshot(collection(db,"fileItems"),()=>renderCal());}
$("calPrev").addEventListener("click",()=>{weekOff--;renderCal();});
$("calNext").addEventListener("click",()=>{weekOff++;renderCal();});
$("calToday").addEventListener("click",()=>{weekOff=0;renderCal();});
$("fabAdd").addEventListener("click",()=>{addDate=todayStr();openAddModal();});

async function renderCal(){
  if(!CU)return;
  const days=getWeekDays();const f=days[0],l=days[6];
  $("calTitle").textContent=f.getMonth()===l.getMonth()?`${f.getFullYear()}년 ${MONTHS[f.getMonth()]} ${f.getDate()}일 — ${l.getDate()}일`:`${f.getFullYear()}년 ${MONTHS[f.getMonth()]} ${f.getDate()}일 — ${MONTHS[l.getMonth()]} ${l.getDate()}일`;
  const items=await getFileItems();const row=$("calRow");row.innerHTML="";
  days.forEach(d=>{
    const ds=dateStr(d),isToday=ds===todayStr();
    const dayItems=items.filter(it=>it.date===ds);
    const col=document.createElement("div");col.className="day-col";
    col.innerHTML=`<div class="day-hd${isToday?" today":""}"><div class="day-dow">${DOW[d.getDay()]}</div><div class="day-dom">${d.getDate()}</div></div>
      <div class="day-body">${dayItems.map(it=>chipHtml(it)).join("")}<button class="add-chip-btn" data-date="${ds}"><i class="ti ti-plus" style="font-size:11px"></i> 추가</button></div>`;
    row.appendChild(col);
  });
  row.querySelectorAll(".add-chip-btn").forEach(btn=>{btn.addEventListener("click",()=>{addDate=btn.dataset.date;openAddModal();});});
  row.querySelectorAll(".file-chip").forEach(chip=>{chip.addEventListener("click",()=>openViewer(chip.dataset.id));});
  if(weekOff===0)setTimeout(()=>{const tc=row.querySelector(`[data-date="${todayStr()}"]`);if(tc)tc.closest(".day-col")?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});},60);
}
function getWeekDays(){const mon=weekStart(weekOff);return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});}
function chipHtml(it){
  const u=USERS.find(x=>x.id===it.authorId);const icon=TYPE_ICONS[it.type]||"ti-link";const nc=(it.comments||[]).length;
  return`<div class="file-chip" data-id="${it.id}"><i class="ti ${icon} chip-ico"></i><span class="chip-name" title="${esc(it.title)}">${esc(it.title)}</span>${nc>0?`<span class="chip-nc"><i class="ti ti-message-circle" style="font-size:10px"></i>${nc}</span>`:""}<div class="chip-author" style="background:${u?u.bg:"#333"};color:${u?u.color:"#fff"}">${u?(u.avatar||u.initial):"?"}</div></div>`;
}

// ADD MODAL
function openAddModal(){$("addModalTitle").textContent=`자료 추가 — ${addDate}`;$("fUrl").value="";$("fTitle").value="";$("fNote").value="";$("addModal").style.display="flex";}
$("addClose").addEventListener("click",()=>$("addModal").style.display="none");
$("addCancel").addEventListener("click",()=>$("addModal").style.display="none");
$("addSave").addEventListener("click",async()=>{
  const url=$("fUrl").value.trim(),title=$("fTitle").value.trim();
  if(!url||!title){showToast("URL과 제목을 입력해주세요");return;}
  $("addSave").disabled=true;
  await addDoc(collection(db,"fileItems"),{type:$("fType").value,title,url,note:$("fNote").value.trim(),authorId:CU.id,date:addDate,comments:[],createdAt:serverTimestamp()});
  $("addModal").style.display="none";$("addSave").disabled=false;
  showToast("자료가 추가됐습니다 🔗");renderCal();
});

// VIEWER
async function openViewer(id){
  const items=await getFileItems();viewItem=items.find(it=>it.id===id);if(!viewItem)return;
  const u=USERS.find(x=>x.id===viewItem.authorId);
  $("vTitle").textContent=viewItem.title;
  $("vMeta").textContent=`${u?u.name:"?"} · ${viewItem.date}${viewItem.note?" · "+viewItem.note:""}`;
  $("vOpenLink").href=viewItem.url;
  const tc=TYPE_COLORS[viewItem.type]||["#E6F1FB","#185FA5"];const ico=TYPE_ICONS[viewItem.type]||"ti-link";
  $("vTypeIcon").style.background=tc[0];$("vTypeIcon").innerHTML=`<i class="ti ${ico}" style="color:${tc[1]}"></i>`;
  $("vDeleteBtn").style.display=(CU&&viewItem.authorId===CU.id)?"":"none";
  const embed=getEmbedUrl(viewItem.url);
  $("viewerPane").innerHTML=embed?`<iframe src="${esc(embed)}" allow="autoplay"></iframe>`:`<div class="no-preview"><i class="ti ti-external-link"></i><p>미리보기 미지원</p><a href="${esc(viewItem.url)}" target="_blank" rel="noopener">원본 열기</a></div>`;
  renderComments();$("viewerModal").style.display="flex";
}
function getEmbedUrl(url){
  const df=url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);if(df)return`https://drive.google.com/file/d/${df[1]}/preview`;
  const do2=url.match(/drive\.google\.com\/open\?id=([^&]+)/);if(do2)return`https://drive.google.com/file/d/${do2[1]}/preview`;
  const gdoc=url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?]+)/);if(gdoc)return url.replace(/\/(edit|pub|view).*$/,"/preview");
  return null;
}
$("viewerClose").addEventListener("click",()=>$("viewerModal").style.display="none");
$("vDeleteBtn").addEventListener("click",async()=>{
  if(!viewItem||!CU||viewItem.authorId!==CU.id)return;
  if(!confirm("이 자료를 삭제할까요?"))return;
  await deleteDoc(doc(db,"fileItems",viewItem.id));
  $("viewerModal").style.display="none";renderCal();showToast("삭제됐습니다");
});

function renderComments(){
  if(!viewItem)return;
  const comments=viewItem.comments||[];
  if(!comments.length){$("commentsList").innerHTML=`<div class="cs-empty">아직 코멘트가 없습니다</div>`;return;}
  $("commentsList").innerHTML=comments.map(c=>{
    const u=USERS.find(x=>x.id===c.userId);const canDel=CU&&c.userId===CU.id;
    return`<div class="comment-item"><div class="ci-meta"><div class="ci-av" style="background:${u?u.bg:"#333"};color:${u?u.color:"#fff"}">${u?(u.avatar||u.initial):"?"}</div><span class="ci-name">${u?u.name:"?"}</span><span class="ci-date">${c.date}</span></div><div class="ci-text">${esc(c.text)}${canDel?`<button class="ci-del" data-cid="${c.id}"><i class="ti ti-x"></i></button>`:""}</div></div>`;
  }).join("");
  $("commentsList").scrollTop=$("commentsList").scrollHeight;
  $("commentsList").querySelectorAll(".ci-del").forEach(btn=>btn.addEventListener("click",()=>delComment(btn.dataset.cid)));
}
$("commentSend").addEventListener("click",postComment);
$("commentInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();postComment();}});
async function postComment(){
  if(!CU||!viewItem)return;const text=$("commentInput").value.trim();if(!text)return;
  const newC=[...(viewItem.comments||[]),{id:uid(),userId:CU.id,text,date:todayStr()}];
  await updateDoc(doc(db,"fileItems",viewItem.id),{comments:newC});
  viewItem.comments=newC;$("commentInput").value="";renderComments();renderCal();
}
async function delComment(cid){
  if(!viewItem)return;const newC=(viewItem.comments||[]).filter(c=>c.id!==cid);
  await updateDoc(doc(db,"fileItems",viewItem.id),{comments:newC});
  viewItem.comments=newC;renderComments();renderCal();
}

// ════ PROFILE ════
const ANIMAL_EMOJIS=['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦋','🐢','🦖','🐬','🦈','🐙'];
const OTHER_EMOJIS=['🔬','🧮','📐','🧠','⚡','🌌','🔭','🧪','📊','🎯','🚀','💡','🏆','🎲','🌠','🔮'];
let selEmoji=null, selBanner=null;

function setDisplay(el, display){if(el)el.style.display=display;}
function setText(el, text){if(el)el.textContent=text;}
function hideIfExists(id){const el=$(id);if(el)el.style.display="none";}
function updateUserCache(update){
  if(!CU)return;
  Object.assign(CU, update);
  const idx=USERS.findIndex(u=>u.id===CU.id);
  if(idx>=0)Object.assign(USERS[idx], update);
}
function updateMemberAvatar(){
  const idx=USERS.findIndex(u=>CU&&u.id===CU.id);
  if(idx<0)return;
  const avEl=$(`mpAv${idx}`);
  if(!avEl)return;
  if(CU.avatarImg)avEl.innerHTML=`<img src="${CU.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  else avEl.textContent=CU.avatar||CU.initial;
}
function applyProfileDisplay(){
  if(!CU)return;
  const img=$("profileAvatarImg"), emoji=$("profileAvatarEmoji"), banner=$("profileBanner");
  if(img&&emoji){
    if(CU.avatarImg){img.src=CU.avatarImg;img.style.display="";emoji.style.display="none";}
    else{img.removeAttribute("src");img.style.display="none";emoji.style.display="";emoji.textContent=CU.avatar||"🔬";}
  }
  if(banner)banner.style.background=CU.bannerImg?`url(${CU.bannerImg}) center/cover`:(CU.banner||BANNERS[0]);
}

function readImageFile(input, cb){
  const file=input?.files?.[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){showToast("이미지 파일만 업로드할 수 있습니다");input.value="";return;}
  const reader=new FileReader();
  reader.onload=e=>cb(e.target.result);
  reader.readAsDataURL(file);
}

function openProfile(){
  if(!CU)return;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  hideIfExists("profileEditForm");
  hideIfExists("avatarPickPanel");
  hideIfExists("bannerPickPanel");
  hideIfExists("bioEditForm");
  newAvatarB64=null; newBannerB64=null; selEmoji=null; selBanner=null;
  applyProfileDisplay();
  setText($("profileName"),CU.name);
  setText($("profileRole"),CU.role||"Researcher");
  if(CU.bio){setText($("profileBio"),CU.bio);$("profileBio")?.classList.remove("empty");}
  else{setText($("profileBio"),"소개를 작성해보세요");$("profileBio")?.classList.add("empty");}
  renderProfileStats();
  switchTab("profile");
}

async function renderProfileStats(){
  if(!CU)return;
  const sessions=await getSessions();
  const mine=sessions.filter(s=>s.userId===CU.id);
  const totalSec=mine.reduce((a,s)=>a+s.duration,0);
  const days=new Set(mine.map(s=>s.date)).size;
  const weekSec=mine.filter(s=>s.date>=dateStr(weekStart())).reduce((a,s)=>a+s.duration,0);
  $("profileStats").innerHTML=`
    <div class="ps-item"><div class="ps-val">${fmtDur(totalSec)}</div><div class="ps-lbl">총 연구</div></div>
    <div class="ps-item"><div class="ps-val">${days}일</div><div class="ps-lbl">연구일수</div></div>
    <div class="ps-item"><div class="ps-val">${fmtDur(weekSec)}</div><div class="ps-lbl">이번 주</div></div>`;
  const recent=[...mine].sort((a,b)=>b.start-a.start).slice(0,5);
  $("profileRecent").innerHTML=`<div class="pr-title">최근 연구 기록</div>`+(recent.length?recent.map(s=>`
    <div class="pr-item"><div><div class="pr-date">${s.date}</div>${s.note?`<div class="pr-note">${esc(s.note.substring(0,30))}</div>`:""}</div><div class="pr-dur">${fmtDur(s.duration)}</div></div>`).join(""):`<div class="pr-empty">아직 기록이 없습니다</div>`);
}

$("profileBackBtn")?.addEventListener("click",()=>{
  switchTab("timer");
  document.querySelector(".nav-btn[data-tab='timer']")?.classList.add("active");
});

$("bannerEditOverlay")?.addEventListener("click",e=>{e.stopPropagation();$("bannerFileInput")?.click();});
$("profileBanner")?.addEventListener("click",e=>{
  if(e.target.closest(".profile-back-btn"))return;
  if(e.target.closest("#bannerEditOverlay"))return;
});

$("bannerFileInput")?.addEventListener("change",async e=>{
  readImageFile(e.currentTarget, async data=>{
    newBannerB64=data;
    $("pefBannerPreviewImg")&&( $("pefBannerPreviewImg").src=data );
    setDisplay($("pefBannerPreview"),"flex");
    updateUserCache({bannerImg:data,banner:null});
    await setDoc(doc(db,"profiles",CU.id),{bannerImg:data,banner:null},{merge:true});
    applyProfileDisplay();
    showToast("배경 사진이 저장됐습니다");
  });
});

$("avatarEditOverlay")?.addEventListener("click",e=>{e.stopPropagation();$("avatarFileInput")?.click();});
$("profileAvatar")?.addEventListener("click",()=>$("avatarFileInput")?.click());
$("avatarFileInput")?.addEventListener("change",async e=>{
  readImageFile(e.currentTarget, async data=>{
    newAvatarB64=data;
    $("pefAvatarPreviewImg")&&( $("pefAvatarPreviewImg").src=data );
    setDisplay($("pefAvatarPreview"),"flex");
    updateUserCache({avatarImg:data,avatar:null});
    await setDoc(doc(db,"profiles",CU.id),{avatarImg:data,avatar:null},{merge:true});
    applyProfileDisplay();
    updateMemberAvatar();
    showToast("프로필 사진이 저장됐습니다");
  });
});

window.clearAvatarPreview=()=>{newAvatarB64=null;setDisplay($("pefAvatarPreview"),"none");const input=$("avatarFileInput");if(input)input.value="";applyProfileDisplay();};
window.clearBannerPreview=()=>{newBannerB64=null;setDisplay($("pefBannerPreview"),"none");const input=$("bannerFileInput");if(input)input.value="";applyProfileDisplay();};

$("bioEditBtn")?.addEventListener("click",()=>{
  setDisplay($("bioEditForm"),"block");
  $("bioInput").value=CU.bio||"";
  $("bioInput").focus();
});
$("bioCancelBtn")?.addEventListener("click",()=>setDisplay($("bioEditForm"),"none"));
$("bioSaveBtn")?.addEventListener("click",async()=>{
  const bio=$("bioInput").value.trim();
  await setDoc(doc(db,"profiles",CU.id),{bio},{merge:true});
  updateUserCache({bio});
  if(bio){setText($("profileBio"),bio);$("profileBio")?.classList.remove("empty");}
  else{setText($("profileBio"),"소개를 작성해보세요");$("profileBio")?.classList.add("empty");}
  setDisplay($("bioEditForm"),"none");
});

[$("pefCancel"),$("pefSave")].forEach(el=>el?.addEventListener("click",async e=>{
  if(e.currentTarget.id==="pefCancel"){setDisplay($("profileEditForm"),"none");return;}
  const name=$("pefName")?.value.trim()||CU.name;
  const pw=$("pefPw")?.value.trim();
  if(!name){$("pefMsg").style.color="#f87171";$("pefMsg").textContent="이름을 입력해주세요";return;}
  const update={name}; if(pw)update.pw=pw;
  await setDoc(doc(db,"profiles",CU.id),update,{merge:true});
  updateUserCache(update);
  setText($("chipName"),name); setText($("profileName"),name);
  const idx=USERS.findIndex(u=>u.id===CU.id);
  const nameEl=$(`mpName${idx}`); if(nameEl)nameEl.textContent=name;
  if($("pefMsg")){$("pefMsg").style.color="#10b981";$("pefMsg").textContent="저장됐습니다 ✓";}
  setTimeout(()=>setDisplay($("profileEditForm"),"none"),1000);
}));

// ════ INIT ════

// Canvas 배경
const canvas = document.getElementById('bgCanvas');
if(canvas){
  const ctx=canvas.getContext('2d');
  let W,H,particles=[];
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize(); window.addEventListener('resize',resize);
  class Particle{constructor(){this.reset(true);}reset(init){this.x=Math.random()*W;this.y=init?Math.random()*H:Math.random()*H;this.r=Math.random()*1.1+0.2;this.alpha=Math.random()*0.4+0.08;this.vx=(Math.random()-.5)*.25;this.vy=(Math.random()-.5)*.25;this.life=Math.random()*300+100;this.maxLife=this.life;}update(){this.x+=this.vx;this.y+=this.vy;this.life--;if(this.life<=0||this.x<0||this.x>W||this.y<0||this.y>H)this.reset(false);}draw(){const f=this.life/this.maxLife;ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${this.alpha*f})`;ctx.fill();}}
  for(let i=0;i<100;i++)particles.push(new Particle());
  function animate(){ctx.clearRect(0,0,W,H);const g=ctx.createRadialGradient(W/2,H*.25,0,W/2,H*.25,W*.8);g.addColorStop(0,'rgba(24,24,28,1)');g.addColorStop(1,'rgba(6,6,8,1)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(255,255,255,0.028)';ctx.lineWidth=1;for(let x=0;x<W;x+=56){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=56){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}particles.forEach(p=>{p.update();p.draw();});requestAnimationFrame(animate);}
  animate();
}

// 로그인 이벤트
$("loginBtn").addEventListener("click", ()=>{ $("memberOverlay").style.display="flex"; });
$("mpClose").addEventListener("click", ()=>{ $("memberOverlay").style.display="none"; $("pwSection").style.display="none"; $("mpMembers").style.display="flex"; });
$("memberOverlay").addEventListener("click", e=>{ if(e.target===$("memberOverlay")){ $("memberOverlay").style.display="none"; $("pwSection").style.display="none"; $("mpMembers").style.display="flex"; }});

// 멤버 버튼
document.querySelectorAll(".mp-member").forEach(btn=>{
  btn.addEventListener("click", ()=>pickUser(+btn.dataset.idx));
});
$("pwBack").addEventListener("click", ()=>{ pickIdx=-1; $("mpMembers").style.display="flex"; $("pwSection").style.display="none"; });
$("pwInput").addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });
$("pwBtn").addEventListener("click", doLogin);

loadAllProfiles();
