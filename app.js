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

let CU=null, pickIdx=-1, statPeriod="week";
let timerInterval=null, timerStart=null;
let unsubFiles=null;
let newAvatarB64=null, newBannerB64=null, selEmoji=null, selBanner=null;

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
const dateStr=d=>d.toISOString().slice(0,10);
const todayStr=()=>dateStr(new Date());
const DOW=["일","월","화","수","목","금","토"];
const MONTHS=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function fmtSec(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;}
function fmtDur(s){if(!s||s<=0)return"0분";if(s<60)return s+"초";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?`${h}시간 ${String(m).padStart(2,"0")}분`:`${m}분`;}
function weekStart(off=0){const d=new Date();d.setHours(0,0,0,0);const day=d.getDay();const diff=day===0?-6:1-day;d.setDate(d.getDate()+diff+off*7);return d;}
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}
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
  updateChipAvatar();
  $("pwInput").value="";
  switchTab("timer");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector(".nav-btn[data-tab='timer']")?.classList.add("active");
  checkActiveTimer();
  renderTimerStats();
  renderStats();
  subscribeFiles();
  renderCalMonths();
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
    if(btn.dataset.tab==="files")renderCalMonths();
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
  if(duration<5){timerStart=null;resetTimerUI();return;}
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
  if(statPeriod==="month"){const m=new Date();m.setDate(1);m.setHours(0,0,0,0);const mStr=dateStr(m);filtered=all.filter(s=>s.date>=mStr);}
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

// ════ CALENDAR (월별 그리드) ════
const TYPE_ICONS={gdrive:"ti-brand-google-drive",gdoc:"ti-file-text",gsheet:"ti-table",gslide:"ti-presentation",notion:"ti-note",paper:"ti-file-description",github:"ti-brand-github",etc:"ti-link"};

const CAL_START={y:2026,m:0}; // 2026년 1월부터
const CAL_END={y:2027,m:2};   // 2027년 3월까지

function subscribeFiles(){if(unsubFiles)unsubFiles();unsubFiles=onSnapshot(collection(db,"fileItems"),()=>{renderCalMonths();if(currentDayDate)renderDayDetail(currentDayDate);});}

let currentDayDate=null;
let currentDayMember=null;
let dayFolders=[];
let dayFiles=[];
let openFolderIds=new Set();

async function renderCalMonths(){
  if(!CU)return;
  const items=await getFileItems();
  const container=$("calMonthsContainer");
  // 날짜별 자료 수 맵
  const dateCount={};
  items.forEach(it=>{dateCount[it.date]=(dateCount[it.date]||0)+1;});
  const todayS=todayStr();
  const months=[];
  let y=CAL_START.y,m=CAL_START.m;
  while(y<CAL_END.y||(y===CAL_END.y&&m<=CAL_END.m)){months.push({y,m});m++;if(m>11){m=0;y++;}}

  container.innerHTML=months.map(({y,m})=>{
    const firstDay=new Date(y,m,1).getDay(); // 0=일
    const totalDays=new Date(y,m+1,0).getDate();
    const startOffset=(firstDay+6)%7; // 월요일 시작
    let cells="";
    for(let i=0;i<startOffset;i++)cells+=`<div class="cal-cell empty"></div>`;
    for(let d=1;d<=totalDays;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cnt=dateCount[ds]||0;
      const isToday=ds===todayS;
      cells+=`<div class="cal-cell${isToday?' cal-today':''}" data-date="${ds}">
        <span class="cal-day-num">${d}</span>
        ${cnt>0?`<span class="cal-dot-count">${cnt}</span>`:''}
      </div>`;
    }
    return`<div class="cal-month-block">
      <div class="cal-month-title">${y}년 ${MONTHS[m]}</div>
      <div class="cal-month-grid">
        <div class="cal-dow-row"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>
        <div class="cal-cells">${cells}</div>
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll(".cal-cell[data-date]").forEach(cell=>{
    cell.addEventListener("click",()=>openDayPage(cell.dataset.date));
  });
  // 오늘로 스크롤
  const todayCell=container.querySelector(".cal-today");
  if(todayCell)setTimeout(()=>todayCell.scrollIntoView({behavior:"smooth",block:"center"}),100);
}

// ════ DAY DETAIL PAGE ════
async function openDayPage(dateStr){
  currentDayDate=dateStr;
  currentDayMember=CU.id;
  const [y,mo,d]=dateStr.split('-');
  $("dayDetailTitle").textContent=`${y}년 ${mo}월 ${d}일`;
  await loadDayData();
  switchTab("day");
}

async function loadDayData(){
  if(!currentDayDate)return;
  const items=await getFileItems();
  // folders: fileItems where isFolder=true, date=currentDayDate
  dayFolders=items.filter(it=>it.isFolder&&it.date===currentDayDate&&it.authorId===currentDayMember).sort((a,b)=>(a.order||0)-(b.order||0));
  dayFiles=items.filter(it=>!it.isFolder&&it.date===currentDayDate&&it.authorId===currentDayMember).sort((a,b)=>(a.order||0)-(b.order||0));
  renderDayMemberTabs();
  renderDayFileList();
  renderFolderSelect();
}

function renderDayDetail(dateStr){
  if(!$("tab-day").classList.contains("active"))return;
  loadDayData();
}

function renderDayMemberTabs(){
  $("dayMemberTabs").innerHTML=USERS.map(u=>`
    <button class="day-member-tab${u.id===currentDayMember?' active':''}" data-uid="${u.id}" style="${u.id===currentDayMember?`border-color:${u.color};color:${u.color}`:''}">
      <span class="dmt-av" style="background:${u.bg};color:${u.color}">${u.avatar||u.initial}</span>
      ${u.name}
    </button>`).join("");
  $("dayMemberTabs").querySelectorAll(".day-member-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{currentDayMember=btn.dataset.uid;loadDayData();});
  });
}

function canEditCurrentDay(){
  return CU && currentDayMember === CU.id;
}

function rootItemsSorted(){
  return [...dayFiles.filter(f=>!f.folderId), ...dayFolders].sort((a,b)=>(a.order||0)-(b.order||0));
}

function folderFilesSorted(folderId){
  return dayFiles.filter(f=>f.folderId===folderId).sort((a,b)=>(a.order||0)-(b.order||0));
}

function maxOrder(items){
  return items.length ? Math.max(...items.map(it=>Number(it.order)||0)) : -1;
}

function setEditPanelEnabled(enabled){
  const right=$("tab-day")?.querySelector(".day-right");
  if(!right)return;
  right.style.display=enabled?"":"none";
}

function renderDayFileList(){
  const list=$("dayFileList");
  const editable=canEditCurrentDay();
  setEditPanelEnabled(editable);
  if(!dayFolders.length&&!dayFiles.length){list.innerHTML=`<div class="day-empty">자료가 없습니다</div>`;return;}

  const rootItems=rootItemsSorted();
  list.innerHTML="";
  rootItems.forEach(item=>{
    if(item.isFolder){
      const folderFiles=folderFilesSorted(item.id);
      const isOpen=openFolderIds.has(item.id);
      const folderEl=document.createElement("div");
      folderEl.className="day-folder";
      folderEl.dataset.id=item.id;
      folderEl.dataset.type="folder";
      folderEl.dataset.folderId="";

      const rowEl=document.createElement("div");
      rowEl.className="day-folder-row";
      rowEl.dataset.id=item.id;
      rowEl.dataset.type="folder";
      rowEl.dataset.folderId="";
      rowEl.draggable=editable;
      rowEl.innerHTML=`
        <i class="ti ti-grip-vertical drag-handle" style="color:rgba(255,255,255,.2);font-size:13px;cursor:${editable?'grab':'default'}"></i>
        <i class="ti ti-folder day-folder-icon"></i>
        <span class="day-folder-name">${esc(item.title)}</span>
        <span class="day-folder-count">${folderFiles.length}개</span>
        ${editable?`<button class="day-folder-del" data-id="${item.id}" title="폴더 삭제"><i class="ti ti-trash"></i></button>`:''}
        <button class="day-folder-toggle" data-id="${item.id}"><i class="ti ${isOpen?'ti-chevron-up':'ti-chevron-down'}"></i></button>`;
      folderEl.appendChild(rowEl);

      const childrenEl=document.createElement("div");
      childrenEl.className="day-folder-children";
      childrenEl.id=`fc-${item.id}`;
      childrenEl.dataset.folderId=item.id;
      childrenEl.style.display=isOpen?"flex":"none";
      if(isOpen){childrenEl.style.flexDirection="column";childrenEl.style.gap="4px";}

      if(folderFiles.length){
        folderFiles.forEach(f=>childrenEl.appendChild(makeFileEl(f,item.id,editable)));
      } else {
        childrenEl.innerHTML=`<div class="day-empty-folder">비어있음</div>`;
      }
      folderEl.appendChild(childrenEl);
      list.appendChild(folderEl);
    } else {
      list.appendChild(makeFileEl(item,null,editable));
    }
  });

  list.querySelectorAll(".day-folder-toggle").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const ch=$(`fc-${btn.dataset.id}`);
      const open=ch.style.display!=="none";
      if(open){
        openFolderIds.delete(btn.dataset.id);
        ch.style.display="none";
      }else{
        openFolderIds.add(btn.dataset.id);
        ch.style.display="flex";
        ch.style.flexDirection="column";
        ch.style.gap="4px";
      }
      btn.querySelector("i").className=`ti ${open?"ti-chevron-down":"ti-chevron-up"}`;
    });
  });

  list.querySelectorAll(".day-folder-del").forEach(btn=>{
    btn.addEventListener("click",async e=>{
      e.stopPropagation();
      const folderId=btn.dataset.id;
      const folderFiles=dayFiles.filter(f=>f.folderId===folderId);
      if(!confirm(folderFiles.length>0?`폴더 안의 파일 ${folderFiles.length}개가 폴더 밖으로 이동됩니다. 삭제할까요?`:"빈 폴더를 삭제할까요?"))return;
      const base=maxOrder(rootItemsSorted())+1;
      await Promise.all(folderFiles.map((f,i)=>updateDoc(doc(db,"fileItems",f.id),{folderId:null,order:base+i})));
      await deleteDoc(doc(db,"fileItems",folderId));
      openFolderIds.delete(folderId);
      showToast("폴더가 삭제됐습니다");loadDayData();
    });
  });

  if(editable)setupDragDrop(list);
}

function makeFileEl(f, folderId, editable=canEditCurrentDay()){
  const icon=TYPE_ICONS[f.type]||"ti-link";
  const canDel=editable && CU&&f.authorId===CU.id;
  const el=document.createElement("div");
  el.className="day-file-row";
  el.dataset.id=f.id;
  el.dataset.type="file";
  el.dataset.folderId=folderId||"";
  el.dataset.url=f.url||"";
  el.draggable=editable;
  el.innerHTML=`
    <i class="ti ti-grip-vertical drag-handle" style="color:rgba(255,255,255,.2);font-size:13px;flex-shrink:0;cursor:${editable?'grab':'default'}"></i>
    <i class="ti ${icon} day-file-icon"></i>
    <span class="day-file-name" data-url="${esc(f.url||'')}">${esc(f.title)}</span>
    ${f.note?`<span class="day-file-note">${esc(f.note)}</span>`:''}
    ${canDel?`<button class="day-file-del" data-id="${f.id}"><i class="ti ti-trash"></i></button>`:''}`;
  const nameEl=el.querySelector(".day-file-name");
  if(nameEl&&f.url){
    nameEl.addEventListener("click",e=>{e.stopPropagation();window.open(f.url,"_blank");});
  }
  const delBtn=el.querySelector(".day-file-del");
  if(delBtn){
    delBtn.addEventListener("click",async e=>{
      e.stopPropagation();
      if(!confirm("삭제할까요?"))return;
      await deleteDoc(doc(db,"fileItems",delBtn.dataset.id));
      showToast("삭제됐습니다");loadDayData();
    });
  }
  return el;
}

function setupDragDrop(list){
  let dragId=null, dragType=null, dragFromFolder=null, dragSourceEl=null;
  const editable=canEditCurrentDay();
  if(!editable)return;

  const ignoreDragSelector="button,.day-folder-toggle,.day-folder-del,.day-file-del";

  function clearHL(){
    list.classList.remove("drag-over-folder","drop-root-empty");
    list.querySelectorAll(".drag-over-item,.drag-over-folder,.drop-before,.drop-after,.drop-inside").forEach(x=>{
      x.classList.remove("drag-over-item","drag-over-folder","drop-before","drop-after","drop-inside");
      delete x.dataset.dropPos;
    });
  }

  function startDragFrom(el,e){
    if(e.target.closest(ignoreDragSelector)){e.preventDefault();return false;}
    dragId=el.dataset.id;
    dragType=el.dataset.type;
    dragFromFolder=el.dataset.folderId||null;
    dragSourceEl=el;
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",dragId);
    setTimeout(()=>el.classList.add("dragging"),0);
    return true;
  }

  function finishDrag(){
    if(dragSourceEl)dragSourceEl.classList.remove("dragging");
    clearHL();
    dragId=null;dragType=null;dragFromFolder=null;dragSourceEl=null;
  }

  function posByMouse(el,e,allowInside=false){
    const r=el.getBoundingClientRect();
    const y=e.clientY-r.top;
    if(allowInside){
      if(y<r.height*.35)return "before";
      if(y>r.height*.65)return "after";
      return "inside";
    }
    return y>r.height/2 ? "after" : "before";
  }

  async function rewriteFolderOrder(folderId,pool){
    await Promise.all(pool.map((it,i)=>updateDoc(doc(db,"fileItems",it.id),{folderId,order:i})));
  }

  function insertAt(pool,movedId,targetId,pos){
    const si=pool.findIndex(x=>x.id===movedId);
    let moved;
    if(si>=0)moved=pool.splice(si,1)[0];
    else moved=dayFiles.find(f=>f.id===movedId)||dayFolders.find(f=>f.id===movedId);
    if(!moved)return null;
    let ti=pool.findIndex(x=>x.id===targetId);
    if(ti<0)ti=pool.length;
    if(pos==="after")ti++;
    pool.splice(ti,0,moved);
    return pool;
  }

  async function dropToRoot(targetId=null,pos="after"){
    if(dragType==="folder" && dragFromFolder)return;
    let pool=rootItemsSorted();
    let next;
    if(targetId) next=insertAt(pool,dragId,targetId,pos);
    else{
      const moved=dragType==="file"?dayFiles.find(f=>f.id===dragId):dayFolders.find(f=>f.id===dragId);
      if(!moved)return;
      next=pool.filter(it=>it.id!==dragId);
      next.push(moved);
    }
    if(!next)return;
    const updates=next.map((it,i)=>{
      const data={order:i};
      if(it.id===dragId && dragType==="file")data.folderId=null;
      return updateDoc(doc(db,"fileItems",it.id),data);
    });
    await Promise.all(updates);
  }

  async function dropToFolder(folderId,targetId=null,pos="after"){
    if(dragType!=="file")return;
    let pool=folderFilesSorted(folderId);
    let next;
    if(targetId) next=insertAt(pool,dragId,targetId,pos);
    else{
      const moved=dayFiles.find(f=>f.id===dragId);
      if(!moved)return;
      next=pool.filter(f=>f.id!==dragId);
      next.push(moved);
    }
    await rewriteFolderOrder(folderId,next);
    openFolderIds.add(folderId);
  }

  function markLine(el,pos){
    el.dataset.dropPos=pos;
    el.classList.add(pos==="after"?"drop-after":"drop-before");
  }

  // 파일은 행 전체가 드래그 대상
  list.querySelectorAll(".day-file-row").forEach(el=>{
    el.addEventListener("dragstart",e=>{e.stopPropagation();startDragFrom(el,e);});
    el.addEventListener("dragend",e=>{e.stopPropagation();finishDrag();});
    el.addEventListener("dragover",e=>{
      if(!dragId||el.dataset.id===dragId)return;
      const targetFolder=el.dataset.folderId||null;
      if(dragType==="folder" && targetFolder)return;
      e.preventDefault();e.stopPropagation();clearHL();
      const pos=posByMouse(el,e,false);
      markLine(el,pos);
    });
    el.addEventListener("dragleave",e=>{if(!el.contains(e.relatedTarget))clearHL();});
    el.addEventListener("drop",async e=>{
      e.preventDefault();e.stopPropagation();
      const targetId=el.dataset.id;
      const targetFolder=el.dataset.folderId||null;
      const pos=el.dataset.dropPos||posByMouse(el,e,false);
      clearHL();
      if(!dragId||targetId===dragId)return;
      if(targetFolder){
        if(dragType!=="file")return;
        await dropToFolder(targetFolder,targetId,pos);
      }else{
        await dropToRoot(targetId,pos);
      }
      loadDayData();
    });
  });

  // 폴더도 행 전체가 드래그 대상이며, 화살표/삭제 버튼은 제외
  list.querySelectorAll(".day-folder-row").forEach(row=>{
    row.addEventListener("dragstart",e=>{e.stopPropagation();startDragFrom(row,e);});
    row.addEventListener("dragend",e=>{e.stopPropagation();finishDrag();});
  });

  list.querySelectorAll(".day-folder").forEach(folderEl=>{
    const row=folderEl.querySelector(".day-folder-row");
    row.addEventListener("dragover",e=>{
      if(!dragId||folderEl.dataset.id===dragId)return;
      e.preventDefault();e.stopPropagation();clearHL();
      const pos=posByMouse(row,e,dragType==="file");
      folderEl.dataset.dropPos=pos;
      if(dragType==="file" && pos==="inside")folderEl.classList.add("drop-inside");
      else markLine(folderEl,pos);
    });
    row.addEventListener("dragleave",e=>{if(!folderEl.contains(e.relatedTarget))clearHL();});
    row.addEventListener("drop",async e=>{
      e.preventDefault();e.stopPropagation();
      const pos=folderEl.dataset.dropPos||posByMouse(row,e,dragType==="file");
      clearHL();
      if(!dragId||folderEl.dataset.id===dragId)return;
      if(dragType==="file" && pos==="inside"){
        await dropToFolder(folderEl.dataset.id,null,"after");
        showToast("폴더 안으로 이동됐습니다");
      }else{
        await dropToRoot(folderEl.dataset.id,pos==="after"?"after":"before");
      }
      loadDayData();
    });
  });

  // 열린 폴더의 빈 공간/아래쪽으로 드롭하면 그 폴더 맨 아래로 이동
  list.querySelectorAll(".day-folder-children").forEach(ch=>{
    ch.addEventListener("dragover",e=>{
      if(!dragId||dragType!=="file")return;
      if(e.target.closest(".day-file-row"))return;
      e.preventDefault();e.stopPropagation();clearHL();
      ch.classList.add("drop-inside");
    });
    ch.addEventListener("dragleave",e=>{if(!ch.contains(e.relatedTarget))clearHL();});
    ch.addEventListener("drop",async e=>{
      if(e.target.closest(".day-file-row"))return;
      e.preventDefault();e.stopPropagation();
      const folderId=ch.dataset.folderId;
      clearHL();
      if(!dragId||dragType!=="file")return;
      await dropToFolder(folderId,null,"after");
      showToast("폴더 안으로 이동됐습니다");loadDayData();
    });
  });

  // 목록의 빈 공간으로 드롭하면 루트 맨 아래로 이동
  list.addEventListener("dragover",e=>{
    if(!dragId)return;
    if(e.target.closest(".day-file-row,.day-folder-row,.day-folder-children"))return;
    e.preventDefault();clearHL();
    list.classList.add("drop-root-empty");
  });
  list.addEventListener("dragleave",e=>{if(!list.contains(e.relatedTarget))clearHL();});
  list.addEventListener("drop",async e=>{
    if(e.target.closest(".day-file-row,.day-folder-row,.day-folder-children"))return;
    e.preventDefault();
    clearHL();
    if(!dragId)return;
    await dropToRoot(null,"after");
    loadDayData();
  });
}

function renderFolderSelect(){
  const sel=$("dfFolder");
  sel.innerHTML=`<option value="">선택 안함</option>`+dayFolders.map(f=>`<option value="${f.id}">${esc(f.title)}</option>`).join("");
}

// 뒤로가기
$("dayBackBtn").addEventListener("click",()=>{
  currentDayDate=null;
  switchTab("files");
  document.querySelector(".nav-btn[data-tab='files']")?.classList.add("active");
  renderCalMonths();
});

// 폴더 만들기
$("folderNewBtn").addEventListener("click",()=>{
  $("folderCreateForm").style.display=$("folderCreateForm").style.display==="none"?"block":"none";
  $("folderNameInput").value="";
});
$("folderCreateCancel").addEventListener("click",()=>{$("folderCreateForm").style.display="none";});
$("folderCreateSave").addEventListener("click",async()=>{
  const name=$("folderNameInput").value.trim();if(!name)return;
  const order=maxOrder(rootItemsSorted())+1;
  await addDoc(collection(db,"fileItems"),{isFolder:true,title:name,date:currentDayDate,authorId:CU.id,order,createdAt:serverTimestamp()});
  $("folderCreateForm").style.display="none";showToast("폴더가 만들어졌습니다");loadDayData();
});

// 자료 추가
$("dfSave").addEventListener("click",async()=>{
  const url=$("dfUrl").value.trim(),title=$("dfTitle").value.trim();
  if(!url||!title){showToast("URL과 제목을 입력해주세요");return;}
  $("dfSave").disabled=true;
  const folderId=$("dfFolder").value||null;
  const order=folderId ? maxOrder(folderFilesSorted(folderId))+1 : maxOrder(rootItemsSorted())+1;
  await addDoc(collection(db,"fileItems"),{
    isFolder:false,type:$("dfType").value,title,url,
    note:$("dfNote").value.trim(),
    folderId,
    authorId:CU.id,date:currentDayDate,
    order,
    comments:[],createdAt:serverTimestamp()
  });
  $("dfUrl").value="";$("dfTitle").value="";$("dfNote").value="";$("dfFolder").value="";
  $("dfSave").disabled=false;
  showToast("자료가 추가됐습니다 🔗");loadDayData();
});


// ════ PROFILE ════
const ANIMAL_EMOJIS=['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦋','🐢','🦖','🐬','🦈','🐙'];
const OTHER_EMOJIS=['🔬','🧮','📐','🧠','⚡','🌌','🔭','🧪','📊','🎯','🚀','💡','🏆','🎲','🌠','🔮'];

function updateChipAvatar(){
  if(!CU)return;
  const el=$("chipAvatar");
  if(CU.avatarImg){el.style.backgroundImage=`url(${CU.avatarImg})`;el.style.backgroundSize="cover";el.textContent="";}
  else{el.style.backgroundImage="";el.textContent=CU.avatar||CU.initial;}
}

function applyProfileDisplay(){
  const img=$("profileAvatarImg"), emoji=$("profileAvatarEmoji");
  if(CU.avatarImg){img.src=CU.avatarImg;img.style.display="";emoji.style.display="none";}
  else{img.style.display="none";emoji.style.display="";emoji.textContent=CU.avatar||"🔬";}
  if(CU.bannerImg)$("profileBanner").style.background=`url(${CU.bannerImg}) center/cover`;
  else $("profileBanner").style.background=CU.banner||BANNERS[0];
}

function openProfile(){
  if(!CU)return;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  $("profileEditForm").style.display="none";
  $("avatarPickPanel").style.display="none";
  $("bannerPickPanel").style.display="none";
  $("bioEditForm").style.display="none";
  newAvatarB64=null; newBannerB64=null; selEmoji=null; selBanner=null;
  applyProfileDisplay();
  $("profileName").textContent=CU.name;
  $("profileRole").textContent=CU.role||"Researcher";
  if(CU.bio){$("profileBio").textContent=CU.bio;$("profileBio").classList.remove("empty");}
  else{$("profileBio").textContent="소개를 작성해보세요";$("profileBio").classList.add("empty");}
  renderProfileStats();
  switchTab("profile");
}

async function renderProfileStats(){
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

$("profileBackBtn").addEventListener("click",()=>{
  switchTab("timer");
  document.querySelector(".nav-btn[data-tab='timer']")?.classList.add("active");
});

// 배너 클릭 → 배너 선택 패널
$("profileBanner").addEventListener("click", e=>{
  if(e.target.closest(".profile-back-btn")) return;
  const panel=$("bannerPickPanel");
  const isOpen=panel.style.display!=="none";
  $("avatarPickPanel").style.display="none";
  $("profileEditForm").style.display="none";
  if(isOpen){ panel.style.display="none"; return; }
  // 배너 프리셋 렌더
  selBanner=CU.banner||BANNERS[0];
  $("bannerPresets").innerHTML=BANNERS.map((b,i)=>`
    <div class="banner-preset-btn${b===selBanner?' selected':''}" data-i="${i}" style="background:${b}"></div>`).join("");
  $("bannerPresets").querySelectorAll(".banner-preset-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selBanner=BANNERS[+btn.dataset.i];
      $("bannerPresets").querySelectorAll(".banner-preset-btn").forEach(b=>b.classList.toggle("selected",b===btn));
      newBannerB64=null; $("pefBannerPreview").style.display="none";
      $("profileBanner").style.background=selBanner;
    });
  });
  $("pefBannerPreview").style.display="none";
  panel.style.display="flex";
});

// 배너 업로드
$("bannerUploadBtn").addEventListener("click",()=>$("bannerFileInput").click());
$("bannerFileInput").addEventListener("change",()=>{
  const f=$("bannerFileInput").files[0]; if(!f)return;
  Object.assign(new FileReader(),{onload:e=>{newBannerB64=e.target.result;$("profileBanner").style.background=`url(${newBannerB64}) center/cover`;$("pefBannerPreviewImg").src=newBannerB64;$("pefBannerPreview").style.display="flex";selBanner=null;$("bannerPresets").querySelectorAll(".banner-preset-btn").forEach(b=>b.classList.remove("selected"));}}).readAsDataURL(f);
});
$("clearBannerBtn").addEventListener("click",()=>{newBannerB64=null;$("pefBannerPreview").style.display="none";$("bannerFileInput").value="";applyProfileDisplay();});
$("bannerPickCancel").addEventListener("click",()=>{$("bannerPickPanel").style.display="none";newBannerB64=null;selBanner=null;applyProfileDisplay();});
$("bannerPickSave").addEventListener("click",async()=>{
  const update={};
  if(newBannerB64){update.bannerImg=newBannerB64;CU.bannerImg=newBannerB64;delete CU.banner;}
  else if(selBanner){update.bannerImg=null;update.banner=selBanner;CU.banner=selBanner;CU.bannerImg=null;}
  if(Object.keys(update).length){await setDoc(doc(db,"profiles",CU.id),update,{merge:true});}
  $("bannerPickPanel").style.display="none";newBannerB64=null;selBanner=null;applyProfileDisplay();
});

// 아바타 클릭 → 아바타 선택 패널
$("profileAvatar").addEventListener("click",()=>{
  const panel=$("avatarPickPanel");
  const isOpen=panel.style.display!=="none";
  $("bannerPickPanel").style.display="none";
  $("profileEditForm").style.display="none";
  if(isOpen){panel.style.display="none";return;}
  selEmoji=CU.avatar||null;
  $("animalEmojiGrid").innerHTML=ANIMAL_EMOJIS.map(e=>`<button class="emoji-btn${e===selEmoji?' selected':''}" data-e="${e}">${e}</button>`).join("");
  $("otherEmojiGrid").innerHTML=OTHER_EMOJIS.map(e=>`<button class="emoji-btn${e===selEmoji?' selected':''}" data-e="${e}">${e}</button>`).join("");
  [$("animalEmojiGrid"),$("otherEmojiGrid")].forEach(grid=>{
    grid.querySelectorAll(".emoji-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        selEmoji=btn.dataset.e; newAvatarB64=null;
        $("pefAvatarPreview").style.display="none"; $("avatarFileInput").value="";
        document.querySelectorAll(".emoji-btn").forEach(b=>b.classList.toggle("selected",b===btn));
        $("profileAvatarEmoji").textContent=selEmoji; $("profileAvatarImg").style.display="none"; $("profileAvatarEmoji").style.display="";
      });
    });
  });
  $("pefAvatarPreview").style.display="none";
  panel.style.display="flex";
});

// 아바타 업로드
$("avatarUploadBtn").addEventListener("click",()=>$("avatarFileInput").click());
$("avatarFileInput").addEventListener("change",()=>{
  const f=$("avatarFileInput").files[0]; if(!f)return;
  Object.assign(new FileReader(),{onload:e=>{newAvatarB64=e.target.result;selEmoji=null;$("profileAvatarImg").src=newAvatarB64;$("profileAvatarImg").style.display="";$("profileAvatarEmoji").style.display="none";$("pefAvatarPreviewImg").src=newAvatarB64;$("pefAvatarPreview").style.display="flex";document.querySelectorAll(".emoji-btn").forEach(b=>b.classList.remove("selected"));}}).readAsDataURL(f);
});
$("clearAvatarBtn").addEventListener("click",()=>{newAvatarB64=null;selEmoji=null;$("pefAvatarPreview").style.display="none";$("avatarFileInput").value="";applyProfileDisplay();});
$("avatarPickCancel").addEventListener("click",()=>{$("avatarPickPanel").style.display="none";newAvatarB64=null;selEmoji=null;applyProfileDisplay();});
$("avatarPickSave").addEventListener("click",async()=>{
  const update={};
  if(newAvatarB64){update.avatarImg=newAvatarB64;CU.avatarImg=newAvatarB64;delete CU.avatar;}
  else if(selEmoji){update.avatar=selEmoji;update.avatarImg=null;CU.avatar=selEmoji;CU.avatarImg=null;}
  if(Object.keys(update).length){await setDoc(doc(db,"profiles",CU.id),update,{merge:true});}
  const idx=USERS.findIndex(u=>u.id===CU.id);
  if(idx>=0){if(CU.avatarImg)USERS[idx].avatarImg=CU.avatarImg;if(CU.avatar)USERS[idx].avatar=CU.avatar;}
  $("avatarPickPanel").style.display="none";newAvatarB64=null;selEmoji=null;applyProfileDisplay();updateChipAvatar();
});

// 소개 편집
$("bioEditBtn").addEventListener("click",()=>{
  $("bioEditForm").style.display="flex";
  $("bioInput").value=CU.bio||"";
  setTimeout(()=>$("bioInput").focus(),50);
});
$("bioCancelBtn").addEventListener("click",()=>{$("bioEditForm").style.display="none";});
$("bioSaveBtn").addEventListener("click",async()=>{
  const bio=$("bioInput").value.trim();
  await setDoc(doc(db,"profiles",CU.id),{bio},{merge:true});
  CU.bio=bio;
  if(bio){$("profileBio").textContent=bio;$("profileBio").classList.remove("empty");}
  else{$("profileBio").textContent="소개를 작성해보세요";$("profileBio").classList.add("empty");}
  $("bioEditForm").style.display="none";
});

// 이름/비번 편집
$("profileNameEditBtn").addEventListener("click",()=>{
  $("pefName").value=CU.name||"";
  $("pefPw").value="";
  $("pefMsg").textContent="";
  $("profileEditForm").style.display="flex";
  setTimeout(()=>$("pefName").focus(),50);
});
$("pefCancel").addEventListener("click",()=>{$("profileEditForm").style.display="none";});
$("pefSave").addEventListener("click",async()=>{
  const name=$("pefName").value.trim(), pw=$("pefPw").value.trim();
  if(!name){$("pefMsg").style.color="#f87171";$("pefMsg").textContent="이름을 입력해주세요";return;}
  const update={name}; if(pw)update.pw=pw;
  await setDoc(doc(db,"profiles",CU.id),update,{merge:true});
  CU.name=name; if(pw)CU.pw=pw;
  const idx=USERS.findIndex(u=>u.id===CU.id);
  if(idx>=0){USERS[idx].name=name;if(pw)USERS[idx].pw=pw;}
  $("chipName").textContent=name; $("profileName").textContent=name;
  updateChipAvatar();
  const nameEl=$(`mpName${idx}`); if(nameEl)nameEl.textContent=name;
  $("pefMsg").style.color="#10b981";$("pefMsg").textContent="저장됐습니다 ✓";
  setTimeout(()=>$("profileEditForm").style.display="none",1000);
});

// ════ INIT ════// ════ INIT ════

// Canvas 배경
const canvas = document.getElementById('bgCanvas');
if(canvas){
  const ctx=canvas.getContext('2d');
  let W,H,particles=[];
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize(); window.addEventListener('resize',resize);
  class Particle{constructor(){this.reset(true);}reset(init){this.x=Math.random()*W;this.y=init?Math.random()*H:Math.random()*H;this.r=Math.random()*1.1+0.2;this.alpha=Math.random()*0.4+0.08;this.vx=(Math.random()-.5)*.25;this.vy=(Math.random()-.5)*.25;this.life=Math.random()*300+100;this.maxLife=this.life;}update(){this.x+=this.vx;this.y+=this.vy;this.life--;if(this.life<=0||this.x<0||this.x>W||this.y<0||this.y>H)this.reset(false);}draw(){const f=this.life/this.maxLife;ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${this.alpha*f})`;ctx.fill();}}
  for(let i=0;i<100;i++)particles.push(new Particle());
  function animate(){ctx.clearRect(0,0,W,H);const g=ctx.createRadialGradient(W/2,H*.25,0,W/2,H*.25,W*.8);g.addColorStop(0,'rgba(24,24,28,1)');g.addColorStop(1,'rgba(6,6,8,1)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;for(let x=0;x<W;x+=56){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=56){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}particles.forEach(p=>{p.update();p.draw();});requestAnimationFrame(animate);}
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
