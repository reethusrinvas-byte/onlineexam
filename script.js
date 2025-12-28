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

 
function getDB() {
  return JSON.parse(localStorage.getItem("DB")) || {
    users: [],
    exams: [],
    bank: [],
    history: [],
    settings: {}
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
 

function getActivity() {
  return JSON.parse(localStorage.getItem("EXAM_ACTIVITY")) || {};
}

function saveActivity(a) {
  localStorage.setItem("EXAM_ACTIVITY", JSON.stringify(a));
}
(function applySavedTheme() {
  const savedTheme = localStorage.getItem("THEME");
  if (savedTheme === "light") {
    document.body.classList.add("light");
  }
})();


 
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
function login() {
  const username = authUser.value.trim();
  const role = authRole.value;

  if (!username) {
    alert("Enter username");
    return;
  }

  session = {
    user: username,
    role: role,
    loginTime: Date.now()
  };

  localStorage.setItem("SESSION", JSON.stringify(session));

  const db = getDB();
  db.users = db.users || [];

   
  const exists = db.users.some(
    u => u.username === username && u.role === role
  );

  if (!exists) {
    db.users.push({
      username: username,
      role: role,
      createdAt: Date.now()
    });
  }

  saveDB(db);

   
  const activity = getActivity();
  activity[username] = {
    user: username,
    role: role,
    loginTime: session.loginTime,
    exam: null,
    examStart: null,
    examEnd: null,
    status: "Logged In"
  };
  saveActivity(activity);

  authModal.style.display = "none";
  updateNav();

  document.querySelectorAll(".tab,.view").forEach(e =>
    e.classList.remove("active")
  );
  document.querySelector(`[data-view="${role}"]`).classList.add("active");
  document.getElementById("view-" + role).classList.add("active");

  renderDashboard();
}

 
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll(".tab,.view").forEach(e=>e.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("view-"+tab.dataset.view).classList.add("active");
    if(tab.dataset.view==="admin") renderAdmin();
    if(tab.dataset.view==="student") renderStudent();
    if(tab.dataset.view==="results") renderResults();  
    if(tab.dataset.view==="instructor") renderInstructorDashboard();  
  };
});

 
function renderAdmin() {

  if (!session || session.role !== "admin") {
    viewAdmin.innerHTML = "<h3>Admin login required</h3>";
    return;
  }

  const db = getDB();
  const activity = getActivity();

  const rows = Object.values(activity).length
    ? Object.values(activity).map(a => `
        <tr>
          <td>${a.user}</td>
          <td>${a.exam || "-"}</td>
          <td>${a.loginTime ? new Date(a.loginTime).toLocaleTimeString() : "-"}</td>
          <td>${a.examStart ? new Date(a.examStart).toLocaleTimeString() : "-"}</td>
          <td>${a.examEnd ? new Date(a.examEnd).toLocaleTimeString() : "-"}</td>
          <td>${a.status || "-"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="6">No activity</td></tr>`;

  viewAdmin.innerHTML = `<h2>Live Exam Activity</h2>
  <table border="1" cellpadding="6" cellspacing="0" width="100%">
  <tr>
    <th>User</th>
    <th>Exam</th>
    <th>Login Time</th>
    <th>Exam Start</th>
    <th>Exam End</th>
    <th>Status</th>
  </tr>
  ${rows}
 </table>

<hr>

<h2>Import / Export</h2>
<button onclick="exportJSON()">Export JSON</button>
<input type="file" onchange="importJSON(this.files[0])">
<button onclick="exportCSV()">Export Results</button>

<h2>Question Bank</h2>
<div id="editorTools">
  <button onclick="formatText('bold')"><b>B</b></button>
  <button onclick="formatText('italic')"><i>I</i></button>
  <button onclick="formatText('insertUnorderedList')">• List</button>
</div>

<div id="qText" contenteditable="true" class="rich-input">
  <placeholder>Type your question here...</placeholder>
</div>

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

<button onclick="saveQuestion()">${editQ ? "Update" : "Add"} Question</button>

${db.bank.map(x => `
  <div class="exam-card">
    ${x.text} (+${x.marks}/-${x.negative})
    <button onclick="editQuestion(${x.id})">Edit</button>
    <button onclick="deleteQuestion(${x.id})">Delete</button>
  </div>
`).join("")}

<h2>Create Exam</h2>
<input id="etopic" placeholder="Exam Topic ">
<select id="ediff">
  <option value="easy">Easy</option>
  <option value="medium">Medium</option>
  <option value="hard">Hard</option>
</select>

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

<button onclick="saveExam()">${editExam ? "Update" : "Create"} Exam</button>

${db.exams.map(e => `
  <div class="exam-card">
    ${e.title}
    <button onclick="editExamFn(${e.id})">Edit</button>
    <button onclick="deleteExam(${e.id})">Delete</button>
  </div>
`).join("")}
`;
}

 
function saveQuestion() {
  const db = getDB();

  const qText = document.getElementById("qText").innerHTML.trim();

  if (!qText) {
    alert("Question text is required");
    return;
  }

  const obj = {
    id: editQ || Date.now(),
    text: qText,
    type: qt.value,
    options:
      qt.value === "mcq"
        ? [a1.value, a2.value, a3.value, a4.value]
        : qt.value === "tf"
        ? ["True", "False"]
        : [],
    correct: qc.value,
    marks: +qm.value || 1,
    negative: +qnm.value || 0
  };

  if (editQ) {
    db.bank = db.bank.map(q => (q.id === editQ ? obj : q));
  } else {
    db.bank.push(obj);
  }

  editQ = null;
  saveDB(db);
  renderAdmin();
}

function editQuestion(id) {
  const q = getDB().bank.find(x => x.id === id);
  if (!q) return;

  document.getElementById("qText").innerHTML = q.text;
  qt.value = q.type;
  qc.value = q.correct;
  qm.value = q.marks;
  qnm.value = q.negative;

   
  if (q.type === "mcq") {
    a1.value = q.options[0] || "";
    a2.value = q.options[1] || "";
    a3.value = q.options[2] || "";
    a4.value = q.options[3] || "";
  } else {
    a1.value = a2.value = a3.value = a4.value = "";
  }

  editQ = id;
}

function deleteQuestion(id){
  const db=getDB(); db.bank=db.bank.filter(x=>x.id!==id);
  saveDB(db); renderAdmin();
}

 
function saveExam() {
  const db = getDB();

  if (!et.value || !etopic.value) {
    alert("Exam title and topic are required");
    return;
  }

  const exam = {
    id: editExam || Date.now(),
    title: et.value,
    topic: etopic.value,         
    difficulty: ediff.value,     
    start: new Date(es.value).getTime(),
    end: new Date(ee.value).getTime() + 86400000,
    duration: +ed.value,
    mode: em.value,
    passMarks: +ep.value || 0
  };

  if (editExam) {
    db.exams = db.exams.map(e => e.id === editExam ? exam : e);
  } else {
    db.exams.push(exam);
  }

  editExam = null;
  saveDB(db);
  renderAdmin();
  renderStudent();
}

function editExamFn(id) {
  const e = getDB().exams.find(x => x.id === id);
  if (!e) return;

  et.value = e.title;
  etopic.value = e.topic;           
  ediff.value = e.difficulty;

  es.value = new Date(e.start).toISOString().split("T")[0];
  ee.value = new Date(e.end - 86400000).toISOString().split("T")[0];
  ed.value = e.duration;
  em.value = e.mode;
  ep.value = e.passMarks;

  editExam = id;
}

function deleteExam(id){
  const db=getDB(); db.exams=db.exams.filter(x=>x.id!==id);
  saveDB(db); renderAdmin(); renderStudent();
}

 
function renderStudent() {
  if (!session || session.role !== "student") {
    examList.innerHTML = "<h3>Student login required</h3>";
    return;
  }

  const db = getDB();
  const now = Date.now();

  const upcoming = db.exams.filter(e => now < e.start);
  const ongoing  = db.exams.filter(e => now >= e.start && now <= e.end);
  const ended    = db.exams.filter(e => now > e.end);

  const renderCard = (e, showStart) => `
    <div class="exam-card">
      <strong>${e.title}</strong><br>
      <small>
        Topic: <b>${e.topic || "Not specified"}</b><br>
        Difficulty: <b>${(e.difficulty || "easy").toUpperCase()}</b>
      </small>
      ${showStart ? `<br><button onclick="startExam(${e.id})">Start</button>` : ""}
    </div>
  `;

  examList.innerHTML = `
    <h3>Upcoming</h3>
    ${upcoming.length ? upcoming.map(e => renderCard(e, false)).join("") : "None"}

    <h3>Ongoing</h3>
    ${ongoing.length ? ongoing.map(e => renderCard(e, true)).join("") : "None"}

    <h3>Ended</h3>
    ${ended.length ? ended.map(e => renderCard(e, false)).join("") : "None"}
  `;
}

async function studentAnalytics() {
  const db = getDB();
  const mine = db.history.filter(h => h.user === session.user);

  let total = mine.reduce((s, r) => s + r.score, 0);
  let avg = mine.length ? (total / mine.length).toFixed(2) : 0;
  examList.innerHTML += await studentAnalytics();

  return `
    <h3>Performance Analytics</h3>
    <p>Total Attempts: ${mine.length}</p>
    <p>Average Score: ${avg}</p>
    <p>Certificates: ${avg >= 60 ? "✔ Earned" : "❌ Not yet"}</p>
  `;

}



 
function startExam(id){
  requestNotificationPermission();
  const db = getDB();

  currentExam = db.exams.find(e => e.id === id);
  const activity = getActivity();

  activity[session.user] = {
    ...activity[session.user],
    exam: currentExam.title,
    examStart: Date.now(),
    examEnd: null,
    status: "In Progress"
  };

  saveActivity(activity);


  questions = shuffle(db.bank)
    .map(q => ({ ...q, options: shuffle(q.options || []) }));

  answers = new Array(questions.length).fill(null);
  marked = new Array(questions.length).fill(false);

  qIndex = 0;

  examList.style.display = "none";
  examArea.style.display = "block";

   
  clearInterval(timerInt);

   
  if (currentExam.mode === "timed") {
  timeLeft = currentExam.duration * 60;
  timer.style.display = "block";

  timerInt = setInterval(() => {
    const min = Math.floor(timeLeft / 60);
    const sec = String(timeLeft % 60).padStart(2, "0");
    timer.innerText = `Time: ${min}:${sec}`;

    if (Notification.permission === "granted") {
      if (timeLeft === 300) new Notification("⏰ 5 Minutes Remaining");
      if (timeLeft === 120) new Notification("⏰ 2 Minutes Remaining");
    }

    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timerInt);
      submitExam();
    }
  }, 1000);
} else {
    timer.style.display = "none";
  }

  showQuestion();
}
 
function showQuestion() {
  const q = questions[qIndex];

  let html = `
    <h4>Question ${qIndex + 1} of ${questions.length}</h4>

    <div class="student-question">
      ${q.text}
    </div>

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
      <div id="studentFormatBar">
        <button onclick="formatText('bold')"><b>B</b></button>
        <button onclick="formatText('italic')"><i>I</i></button>
        <button onclick="formatText('insertUnorderedList')">• List</button>
      </div>

      <div id="studentAnswer"
           class="rich-input"
           contenteditable="true"
           oninput="answers[qIndex]=this.innerHTML">
        ${answers[qIndex] || ""}
      </div>
    `;
  }

  html += `
    <div style="margin-top:10px">
    <button onclick="prevQ()">Prev</button>
    <button onclick="toggleMark()">Mark</button>
    <button onclick="nextQ()">Next</button>
    <button onclick="printExam()">Print</button>
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

  document.getElementById("questionBox").innerHTML = html;

}



function prevQ(){ if(currentExam.mode!=="strict"&&qIndex>0){qIndex--;showQuestion();}}
function nextQ(){ if(qIndex<questions.length-1){qIndex++;showQuestion();}}

 
function submitExam(){
  const activity = getActivity();

  if (activity[session.user]) {
    activity[session.user].examEnd = Date.now();
    activity[session.user].status = "Completed";
    saveActivity(activity);
  }

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
  renderResults();  
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
if(session) renderDashboard();



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
 function renderDashboard() {
  if (!session) return;

  if (session.role === "student") renderStudent();
  if (session.role === "admin") renderAdmin();
  if (session.role === "instructor") {
  renderInstructorDashboard();
}

}
function formatText(cmd) {
  document.execCommand(cmd, false, null);
}
themeToggle.onclick = () => {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem("THEME", isLight ? "light" : "dark");
};

function exportCSV() {
  const db = getDB();
  let csv = "User,Exam,Score,Passed\n";

  db.history.forEach(r => {
    csv += `${r.user},${r.exam},${r.score},${r.passed}\n`;
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "results.csv";
  a.click();
}
function printExam() {
  if (!currentExam || !questions.length) {
    alert("No exam to print");
    return;
  }

  let html = `
    <html>
    <head>
      <title>${currentExam.title}</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h2 { text-align: center; }
        .q { margin-bottom: 15px; }
        .opt { margin-left: 20px; }
      </style>
    </head>
    <body>
      <h2>${currentExam.title}</h2>
  `;

  questions.forEach((q, i) => {
    html += `
      <div class="q">
        <strong>${i + 1}. ${q.text}</strong>
    `;

    if (q.options && q.options.length) {
      q.options.forEach(o => {
        html += `<div class="opt">- ${o}</div>`;
      });
    }

    html += `</div>`;
  });

  html += `
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

function setAnnouncement(msg) {
  localStorage.setItem("ANNOUNCEMENT", msg);
  announcementBar.innerText = msg;
}

announcementBar.innerText =
  localStorage.getItem("ANNOUNCEMENT") || "Welcome to Exam System";
function loadParent() {
  const db = getDB();
  parentResults.innerHTML = db.history
    .filter(r => r.user === parentStudent.value)
    .map(r => `<div>${r.exam}: ${r.score}</div>`)
    .join("") || "No records";
}
 

function openParent() {
  document.getElementById("parentModal").style.display = "block";
  document.getElementById("parentStudent").value = "";
  document.getElementById("parentResults").innerHTML = "";
}

function loadParent() {
  const student = document.getElementById("parentStudent").value.trim();

  if (!student) {
    parentResults.innerText = "Please enter student username";
    return;
  }

  const db = JSON.parse(localStorage.getItem("DB")) || {};
  const history = db.history || [];

   
  const records = history.filter(r =>
    r.username === student ||
    r.user === student ||
    r.student === student
  );

  if (records.length === 0) {
    parentResults.innerText = "No records found for this student";
    return;
  }

  parentResults.innerHTML = records.map(r => `
    <div class="card">
      <strong>${r.examTitle || r.exam}</strong><br>
      Marks: ${r.marks ?? r.score}
    </div>
  `).join("");
}
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}
  

function renderInstructorDashboard() {
  if (!session || session.role !== "instructor") return;

  const db = getDB();
  const view = document.getElementById("view-instructor");

  view.innerHTML = `
    <h2>Instructor Dashboard</h2>

    <!-- ANALYTICS -->
    <h3>Analytics & Reports</h3>

    <canvas id="examScoreChart" width="800" height="300"></canvas>
    <br>
    <canvas id="passFailChart" width="600" height="300"></canvas>


    <!-- USER MANAGEMENT -->
    <h3>User Management</h3>
    ${(db.users || []).map((u, i) => `
      <div class="exam-card">
        <strong>${u.username}</strong> — ${u.role}
        ${
          u.role !== "admin"
            ? `<button onclick="removeUser(${i})">Remove</button>`
            : `<em> (protected)</em>`
        }
      </div>
    `).join("") || "<p>No users found</p>"}

    <hr>

    <!-- SYSTEM SETTINGS -->
    <h3>System Settings</h3>
    <label>
      <input type="checkbox" id="insDarkMode"
        ${db.settings?.dark ? "checked" : ""}>
      Enable Dark Mode
    </label>
    <br><br>
    <button onclick="instructorSaveSettings()">Save Settings</button>

    <hr>

    <!-- ALL EXAMS OVERVIEW -->
    <h3>All Exams Overview</h3>
${(db.exams || []).map(e => `
  <div class="exam-card">
    <strong>${e.title}</strong><br>
    Topic: ${e.topic || "Not specified"}<br>
    Difficulty: ${(e.difficulty || "easy").toUpperCase()}<br>
    Duration: ${e.duration} min
  </div>
`).join("") || "<p>No exams available</p>"}

  `;
  setTimeout(renderInstructorCharts, 100);

}


 

function instructorCreateExam() {
  const db = getDB();
  db.exams = db.exams || [];

  db.exams.push({
    id: Date.now(),
    title: insExamTitle.value,
    date: insExamDate.value,
    duration: insExamDuration.value
  });

  saveDB(db);
  renderInstructorDashboard();
}

function instructorAddQuestion() {
  const db = getDB();
  db.bank = db.bank || [];

  db.bank.push({ text: insQuestionText.value });
  saveDB(db);
  renderInstructorDashboard();
}

function instructorAddUser() {
  const db = getDB();
  db.users = db.users || [];

  if (!insUserName.value) {
    alert("Enter username");
    return;
  }

  db.users.push({
    username: insUserName.value,
    role: insUserRole.value
  });

  saveDB(db);
  renderInstructorDashboard();
}

function instructorSaveSettings() {
  const db = getDB();
  db.settings = db.settings || {};
  db.settings.dark = insDarkMode.checked;

  saveDB(db);
  alert("System settings saved");
}
function removeUser(index) {
  const db = getDB();

  if (!db.users[index]) return;

  if (!confirm("Are you sure you want to remove this user?")) return;

  db.users.splice(index, 1);
  saveDB(db);
  renderInstructorDashboard();
}
function renderInstructorCharts() {
  const db = getDB();
  const history = db.history || [];

  if (!history.length) return;

   
  const examMap = {};

  history.forEach(h => {
    if (!examMap[h.exam]) {
      examMap[h.exam] = { total: 0, count: 0 };
    }
    examMap[h.exam].total += h.score;
    examMap[h.exam].count++;
  });

  const examNames = Object.keys(examMap);
  const avgScores = examNames.map(
    e => (examMap[e].total / examMap[e].count).toFixed(2)
  );

  const ctx1 = document.getElementById("examScoreChart");
  if (ctx1) {
    new Chart(ctx1, {
      type: "bar",
      data: {
        labels: examNames,
        datasets: [{
          label: "Average Score",
          data: avgScores
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false
      }
    });

  }

   
  const passed = history.filter(h => h.passed).length;
  const failed = history.length - passed;

  const ctx2 = document.getElementById("passFailChart");
  if (ctx2) {
    new Chart(ctx2, {
      type: "pie",
      data: {
        labels: ["Passed", "Failed"],
        datasets: [{
          data: [passed, failed]
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false
  }
});

  }
}
