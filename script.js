async function apiGet(endpoint){
  return new Promise(resolve=>{
    const db=getDB();
    if(endpoint==="/questions") resolve(db.bank);
    if(endpoint==="/exams") resolve(db.exams);
    if(endpoint.startsWith("/results")){
      const u=endpoint.split("=")[1];
      resolve(db.history.filter(h=>h.user===u));
    }
  });
}
async function apiPost(endpoint,data){
  return new Promise(resolve=>{
    const db=getDB();
    if(endpoint==="/questions") db.bank.push(data);
    if(endpoint==="/exams") db.exams.push(data);
    if(endpoint==="/results") db.history.push(data);
    saveDB(db);
    resolve({success:true});
  });
}

 
function getDB(){
  return JSON.parse(localStorage.getItem("DB")) || {
    bank:[], exams:[], history:[]
  };
}
function saveDB(db){
  localStorage.setItem("DB",JSON.stringify(db));
}

 
function shuffle(arr){
  return arr.map(v=>({v,r:Math.random()}))
    .sort((a,b)=>a.r-b.r)
    .map(x=>x.v);
}

 
let session = JSON.parse(localStorage.getItem("SESSION"));
let editQ=null, editExam=null;
let currentExam=null, questions=[], answers=[];
let qIndex=0, timerInt=null, timeLeft=0;
let marked = [];

 
const viewAdmin=document.getElementById("view-admin");
const viewStudent=document.getElementById("view-student");
const viewResults=document.getElementById("view-results");
const examArea=document.getElementById("examArea");
const examList=document.getElementById("examList");
 
function updateNav(){
  sessionInfo.innerText=session?`${session.user} (${session.role})`:"";
  loginBtnNav.style.display=session?"none":"inline";
  logoutBtnNav.style.display=session?"inline":"none";
}
function openLogin(){authModal.style.display="block";}
function logout(){
  localStorage.removeItem("SESSION");
  location.reload();
}
function login(){
  session={user:authUser.value,role:authRole.value};
  localStorage.setItem("SESSION",JSON.stringify(session));
  authModal.style.display="none";
  updateNav();
  document.querySelectorAll(".tab,.view").forEach(e=>e.classList.remove("active"));
  document.querySelector(`[data-view="${session.role}"]`).classList.add("active");
  document.getElementById("view-"+session.role).classList.add("active");
  session.role==="admin"?renderAdmin():renderStudent();
}

 
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll(".tab,.view").forEach(e=>e.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("view-"+tab.dataset.view).classList.add("active");
    if(tab.dataset.view==="admin") renderAdmin();
    if(tab.dataset.view==="student") renderStudent();
    if(tab.dataset.view==="results") renderResults(); // ✅ FIX
  };
});

 
function renderAdmin(){
  if(!session||session.role!=="admin"){
    viewAdmin.innerHTML="<h3>Admin login required</h3>";
    return;
  }
  const db=getDB();
  viewAdmin.innerHTML=`
<h2>Import / Export</h2>
<button onclick="exportJSON()">Export JSON</button>
<input type="file" onchange="importJSON(this.files[0])">

<h2>Question Bank</h2>
<input id="q" placeholder="Question">
<select id="qt">
<option value="mcq">MCQ</option>
<option value="tf">True / False</option>
<option value="text">Text</option>
</select>
<input id="a1" placeholder="Option 1">
<input id="a2" placeholder="Option 2">
<input id="a3" placeholder="Option 3">
<input id="a4" placeholder="Option 4">
<input id="qc" placeholder="Correct Answer">
<input id="qm" type="number" step="0.25" placeholder="Marks">
<input id="qnm" type="number" step="0.25" placeholder="Negative">
<button onclick="saveQuestion()">${editQ?"Update":"Add"} Question</button>

${db.bank.map(x=>`
<div class="exam-card">
${x.text} (+${x.marks}/-${x.negative})
<button onclick="editQuestion(${x.id})">Edit</button>
<button onclick="deleteQuestion(${x.id})">Delete</button>
</div>`).join("")}

<h2>Create Exam</h2>
<input id="et" placeholder="Title">
<input type="date" id="es">
<input type="date" id="ee">
<input id="ed" type="number" placeholder="Duration (min)">
<input id="ep" type="number" placeholder="Pass Marks">
<select id="em">
<option value="timed">Timed</option>
<option value="practice">Practice</option>
<option value="strict">Strict</option>
</select>
<button onclick="saveExam()">${editExam?"Update":"Create"} Exam</button>

${db.exams.map(e=>`
<div class="exam-card">
${e.title}
<button onclick="editExamFn(${e.id})">Edit</button>
<button onclick="deleteExam(${e.id})">Delete</button>
</div>`).join("")}
`;
}

 
function saveQuestion(){
  const db=getDB();
  const obj={
    id:editQ||Date.now(),
    text:q.value,
    type:qt.value,
    options:qt.value==="mcq"?[a1.value,a2.value,a3.value,a4.value]:
            qt.value==="tf"?["True","False"]:[],
    correct:qc.value,
    marks:+qm.value||1,
    negative:+qnm.value||0
  };
  editQ?db.bank=db.bank.map(x=>x.id===editQ?obj:x):db.bank.push(obj);
  editQ=null; saveDB(db); renderAdmin();
}
function editQuestion(id){
  const x=getDB().bank.find(q=>q.id===id);
  q.value=x.text; qt.value=x.type; qc.value=x.correct;
  qm.value=x.marks; qnm.value=x.negative; editQ=id;
}
function deleteQuestion(id){
  const db=getDB(); db.bank=db.bank.filter(x=>x.id!==id);
  saveDB(db); renderAdmin();
}

 
function saveExam(){
  const db=getDB();
  const e={
    id:editExam||Date.now(),
    title:et.value,
    start:new Date(es.value).getTime(),
    end:new Date(ee.value).getTime()+86400000,
    duration:+ed.value,
    mode:em.value,
    passMarks:+ep.value||0
  };
  editExam?db.exams=db.exams.map(x=>x.id===editExam?e:x):db.exams.push(e);
  editExam=null; saveDB(db); renderAdmin(); renderStudent();
}
function editExamFn(id){
  const e=getDB().exams.find(x=>x.id===id);
  et.value=e.title;
  es.value=new Date(e.start).toISOString().split("T")[0];
  ee.value=new Date(e.end-86400000).toISOString().split("T")[0];
  ed.value=e.duration; em.value=e.mode; ep.value=e.passMarks;
  editExam=id;
}
function deleteExam(id){
  const db=getDB(); db.exams=db.exams.filter(x=>x.id!==id);
  saveDB(db); renderAdmin(); renderStudent();
}

 
function renderStudent(){
  if(!session||session.role!=="student"){
    examList.innerHTML="<h3>Student login required</h3>"; return;
  }
  const db=getDB(), now=Date.now();
  const upcoming=db.exams.filter(e=>now<e.start);
  const ongoing=db.exams.filter(e=>now>=e.start&&now<=e.end);
  const ended=db.exams.filter(e=>now>e.end);

  examList.innerHTML=`
<h3>Upcoming</h3>${upcoming.map(e=>`<div class="exam-card">${e.title}</div>`).join("")||"None"}
<h3>Ongoing</h3>${ongoing.map(e=>`
<div class="exam-card">${e.title}
<button onclick="startExam(${e.id})">Start</button></div>`).join("")||"None"}
<h3>Ended</h3>${ended.map(e=>`<div class="exam-card">${e.title}</div>`).join("")||"None"}
`;
}

 
function startExam(id){
  const db=getDB();
  currentExam=db.exams.find(e=>e.id===id);
  questions=shuffle(db.bank).map(q=>({...q,options:shuffle(q.options||[])}));
  answers=new Array(questions.length).fill(null);
  marked = new Array(questions.length).fill(false);

  qIndex=0;
  examList.style.display="none";
  examArea.style.display="block";
  if(currentExam.mode==="timed"){
    timeLeft=currentExam.duration*60;
    timerInt = setInterval(()=>{
  timer.innerText = "Time: " + timeLeft;

  if(timeLeft === 300){
    new Notification("⏰ 5 Minutes Remaining");
  }
  if(timeLeft === 120){
    new Notification("⏰ 2 Minutes Remaining");
  }

  timeLeft--;

  if(timeLeft < 0){
    submitExam();
  }
},1000);

  }
  showQuestion();
}

 
function showQuestion() {
  const q = questions[qIndex];

  let html = `
    <h4>Question ${qIndex + 1} of ${questions.length}</h4>
    <h3>${q.text}</h3>
    <small>+${q.marks} / -${q.negative}</small>
  `;

  
  if (q.type === "mcq" || q.type === "tf") {
    q.options.forEach(o => {
      html += `
        <div class="option ${answers[qIndex] === o ? 'selected' : ''}"
             onclick="answers[qIndex]='${o}'; showQuestion();">
          ${o}
        </div>
      `;
    });
  }

   
  if (q.type === "text") {
    html += `
      <textarea
        onchange="answers[qIndex]=this.value"
        placeholder="Type your answer here"
      >${answers[qIndex] || ""}</textarea>
    `;
  }

   
  html += `
    <div style="margin-top:10px">
      <button onclick="prevQ()">Prev</button>
      <button onclick="toggleMark()">Mark</button>
      <button onclick="nextQ()">Next</button>
      <button onclick="submitExam()">Submit</button>
    </div>
  `;

   
  html += `<div id="palette" class="palette">`;
  questions.forEach((_, i) => {
    let cls = "p-unanswered";
    if (answers[i] !== null) cls = "p-answered";
    if (marked[i]) cls = "p-marked";
    if (i === qIndex) cls += " p-current";

    html += `
      <button class="palette-btn ${cls}"
              onclick="qIndex=${i}; showQuestion();">
        ${i + 1}
      </button>
    `;
  });
  html += `</div>`;

  examArea.innerHTML = html;
}


function prevQ(){ if(currentExam.mode!=="strict"&&qIndex>0){qIndex--;showQuestion();}}
function nextQ(){ if(qIndex<questions.length-1){qIndex++;showQuestion();}}

 
function submitExam(){
  clearInterval(timerInt);
  let score=0, details=[];
  questions.forEach((q,i)=>{
    let d=0;
    if(answers[i]===q.correct) d=q.marks;
    else if(answers[i]!=null) d=-q.negative;
    score+=d; details.push({q,ans:answers[i],delta:d});
  });
  const passed=score>=currentExam.passMarks;
  const db=getDB();
  db.history.push({user:session.user,exam:currentExam.title,score,passed,details});
  saveDB(db);
  renderResults(); // ✅ FIX
  if(passed) generateCertificate(score);
  examArea.innerHTML=`<h2>Score: ${score}</h2>
<h3>${passed?"PASSED":"FAILED"}</h3>
<button onclick="finishExam()">Back</button>`;
}
function finishExam(){
  examArea.style.display="none";
  examList.style.display="block";
  renderStudent();
}

 
function renderResults(){
  if(!session){
    viewResults.innerHTML = "Login required";
    return;
  }

  const db = getDB();
  const attempts = db.history.filter(h => h.user === session.user);

  viewResults.innerHTML = `
    <h2>Results</h2>

    <h3>Leaderboard</h3>
    <div id="leaderboard"></div>

    <h3>Your Attempts</h3>
    <div id="resultsList">
      ${attempts.map((h,i)=>`
        <div class="exam-card">
          <strong>${h.exam}</strong> — ${h.score.toFixed(2)}
          <button onclick="reviewAttempt(${i})">Review</button>
        </div>
      `).join("") || "No attempts"}
    </div>

    <h3>Performance Chart</h3>
    <canvas id="resultChart" width="300" height="150"></canvas>
  `;

  renderLeaderboard();

  const passed = attempts.filter(a => a.passed).length;
  const failed = attempts.length - passed;

  if(attempts.length){
    new Chart(document.getElementById("resultChart"), {
      type: "pie",
      data: {
        labels: ["Passed", "Failed"],
        datasets: [{
          data: [passed, failed],
          backgroundColor: ["#4caf50", "#f44336"]
        }]
      },
      options: { responsive: false }
    });
  }
}
function renderLeaderboard(){
  const db = getDB();
  const el = document.getElementById("leaderboard");
  if(!el) return;

  const bestScores = {};

  db.history.forEach(h => {
    if(!bestScores[h.user] || h.score > bestScores[h.user]){
      bestScores[h.user] = h.score;
    }
  });

  const sorted = Object.entries(bestScores)
    .sort((a,b)=>b[1]-a[1]);

  el.innerHTML = sorted.length
    ? sorted.map((x,i)=>`
        <div class="leader-row">
          <span>#${i+1}</span>
          <span>${x[0]}</span>
          <span>${x[1].toFixed(2)}</span>
        </div>
      `).join("")
    : "No leaderboard data";
}




function reviewAttempt(i){
  const h=getDB().history.filter(x=>x.user===session.user)[i];
  viewResults.innerHTML=`<h2>${h.exam}</h2>
${h.details.map((d,j)=>`
<div class="exam-card">
${j+1}. ${d.q.text}<br>
Your: ${d.ans??"NA"}<br>
Correct: ${d.q.correct}<br>
Marks: ${d.delta}
</div>`).join("")}
<button onclick="renderResults()">Back</button>`;
}

 
function generateCertificate(score){
  const t=`CERTIFICATE\n${session.user}\n${currentExam.title}\nScore:${score}`;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([t],{type:"text/plain"}));
  a.download="certificate.txt"; a.click();
}

 
function exportJSON(){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(getDB(),null,2)],{type:"application/json"}));
  a.download="backup.json"; a.click();
}
function importJSON(file){
  const r=new FileReader();
  r.onload=e=>{saveDB(JSON.parse(e.target.result));renderAdmin();renderStudent();};
  r.readAsText(file);
}

 
updateNav();
if(session){session.role==="admin"?renderAdmin():renderStudent();}
function renderLeaderboard(){
  const db = getDB();
  const el = document.getElementById("leaderboard");
  if(!el) return;

  const best = {};

  db.history.forEach(h=>{
    if(!best[h.user] || h.score > best[h.user]){
      best[h.user] = h.score;
    }
  });

  const sorted = Object.entries(best).sort((a,b)=>b[1]-a[1]);

  el.innerHTML = `
    <h3>Leaderboard</h3>
    ${sorted.map((x,i)=>`
      <div class="leader-row">
        <span>#${i+1}</span>
        <span>${x[0]}</span>
        <span>${x[1].toFixed(2)}</span>
      </div>
    `).join("") || "No data"}
  `;
}
if ("Notification" in window) {
  Notification.requestPermission();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentExam) {
    new Notification("Warning", {
      body: "Tab switch detected during exam"
    });
  }
});
function renderPalette() {
  const p = document.getElementById("palette");
  if (!p) return;

  p.innerHTML = "";

  questions.forEach((q, i) => {
    const btn = document.createElement("button");
    btn.innerText = i + 1;
    btn.className = "palette-btn";

    if (i === qIndex) btn.classList.add("p-current");
    else if (marked[i]) btn.classList.add("p-marked");
    else if (answers[i] !== null) btn.classList.add("p-answered");
    else btn.classList.add("p-unanswered");

    btn.onclick = () => {
      qIndex = i;
      showQuestion();
    };

    p.appendChild(btn);
  });
}
function toggleMark() {
  marked[qIndex] = !marked[qIndex];
  showQuestion();
}
