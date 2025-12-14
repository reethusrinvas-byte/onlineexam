(() => {

const LS = {
  BANK:'bank', EXAMS:'exams', USERS:'users',
  SESSION:'session', HISTORY:'history'
};

const $ = id => document.getElementById(id);
const shuffle = a => [...a].sort(()=>Math.random()-0.5);

let bank = JSON.parse(localStorage.getItem(LS.BANK)||'[]');
let exams = JSON.parse(localStorage.getItem(LS.EXAMS)||'[]');
let users = JSON.parse(localStorage.getItem(LS.USERS)||'{}');
let session = JSON.parse(localStorage.getItem(LS.SESSION)||'null');
let history = JSON.parse(localStorage.getItem(LS.HISTORY)||'[]');

let currentExam, idx=0, answers=[], timer, timeLeft;

 
document.querySelectorAll('.tab').forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    tab.classList.add('active');
    $('view-'+tab.dataset.view).classList.add('active');
    if(tab.dataset.view==='admin') renderBank();
    if(tab.dataset.view==='student') renderExamList();
  };
});

 
addQ.onclick=()=>{
  const opts=[...document.querySelectorAll('.opt')].map(o=>o.value.trim());
  bank.push({
    id:Date.now(), text:qText.value,
    subject:qSubject.value,
    difficulty:qDiff.value,
    options:opts, correct:+correctInput.value-1
  });
  localStorage.setItem(LS.BANK,JSON.stringify(bank));
  renderBank();
};

function renderBank(){
  bankList.innerHTML=bank.map(q=>
    `<div>${q.text} (${q.subject} • ${q.difficulty})</div>`
  ).join('');
}
renderBank();

 
createExam.onclick=()=>{
  let qs=JSON.parse(JSON.stringify(bank));
  if(randQ.checked) qs=shuffle(qs);
  if(randOpt.checked) qs.forEach(q=>q.options=shuffle(q.options));

  exams.push({
    id:Date.now(), title:examTitle.value,
    duration:+examDuration.value,
    mode:examMode.value,
    neg:+negMark.value||0,
    questions:qs
  });
  localStorage.setItem(LS.EXAMS,JSON.stringify(exams));
  alert('Exam Created');
};

 
function renderExamList(){
  examList.innerHTML=exams.map(e=>
    `<div>${e.title} (${e.mode})
     <button onclick="startExam(${e.id})">Start</button></div>`
  ).join('');
}

window.startExam=id=>{
  currentExam=exams.find(e=>e.id===id);
  if(!session) authModal.style.display='block';
  else beginExam();
};

 
loginBtn.onclick=()=>{
  if(users[authUser.value]!==authPass.value){
    authMsg.textContent='Invalid login'; return;
  }
  session=authUser.value;
  localStorage.setItem(LS.SESSION,JSON.stringify(session));
  authModal.style.display='none';
  beginExam();
};

registerBtn.onclick=()=>{
  users[authUser.value]=authPass.value;
  localStorage.setItem(LS.USERS,JSON.stringify(users));
  authMsg.textContent='Registered. Login now.';
};

 
function beginExam(){
  idx=0; answers=[];
  examArea.style.display='block';
  examTitleDisplay.textContent=currentExam.title;

  if(currentExam.mode==='timed'){
    timeLeft=currentExam.duration*60;
    timer=setInterval(()=>{
      timer.innerText=`${Math.floor(timeLeft/60)}:${timeLeft%60}`;
      if(--timeLeft<=0) submitExam();
    },1000);
  }
  renderQuestion();
}

function renderQuestion(){
  const q=currentExam.questions[idx];
  questionBox.innerHTML=`<h3>${q.text}</h3>`;
  q.options.forEach((o,i)=>{
    const d=document.createElement('div');
    d.className='option';
    if(answers[idx]===i) d.classList.add('selected');
    d.textContent=o;
    d.onclick=()=>{
      answers[idx]=i;
      if(currentExam.mode==='practice')
        alert(i===q.correct?'Correct':'Wrong');
      renderQuestion();
    };
    questionBox.appendChild(d);
  });
}

prev.onclick=()=>{ if(idx>0){idx--;renderQuestion();} };
next.onclick=()=>{ if(idx<currentExam.questions.length-1){idx++;renderQuestion();} };
submit.onclick=submitExam;

 
function submitExam(){
  clearInterval(timer);
  let score=0, topics={};

  currentExam.questions.forEach((q,i)=>{
    const ok=answers[i]===q.correct;
    if(ok) score++;
    else score-=currentExam.neg;

    topics[q.subject]=topics[q.subject]||{c:0,t:0};
    topics[q.subject].t++;
    if(ok) topics[q.subject].c++;
  });

  history.push({student:session,score,topics});
  localStorage.setItem(LS.HISTORY,JSON.stringify(history));

  resultSummary.innerHTML=
    `Score: ${score}<hr>`+
    Object.keys(topics).map(t=>`${t}: ${topics[t].c}/${topics[t].t}`).join('<br>');
}

})();
