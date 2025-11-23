(()=>{
  const tabs=document.querySelectorAll('.tab');
  const views=document.querySelectorAll('.view');
  const topmeta=document.getElementById('topmeta');
  const examForm=document.getElementById('examForm');
  const examTitle=document.getElementById('examTitle');
  const examDuration=document.getElementById('examDuration');
  const examPassing=document.getElementById('examPassing');
  const examSubject=document.getElementById('examSubject');
  const clearExam=document.getElementById('clearExam');
  const questionForm=document.getElementById('questionForm');
  const qText=document.getElementById('qText');
  const qType=document.getElementById('qType');
  const qPoints=document.getElementById('qPoints');
  const mcqBlock=document.getElementById('mcqBlock');
  const tfBlock=document.getElementById('tfBlock');
  const opt1=document.getElementById('opt1');
  const opt2=document.getElementById('opt2');
  const opt3=document.getElementById('opt3');
  const opt4=document.getElementById('opt4');
  const mcqCorrect=document.getElementById('mcqCorrect');
  const tfCorrect=document.getElementById('tfCorrect');
  const qCount=document.getElementById('qCount');
  const questionsList=document.getElementById('questionsList');
  const displayTitle=document.getElementById('displayTitle');
  const displaySubject=document.getElementById('displaySubject');
  const startExam=document.getElementById('startExam');
  const timerEl=document.getElementById('timer');
  const quizArea=document.getElementById('quizArea');
  const questionBox=document.getElementById('questionBox');
  const prevBtn=document.getElementById('prev');
  const nextBtn=document.getElementById('next');
  const markBtn=document.getElementById('mark');
  const showPalette=document.getElementById('showPalette');
  const paletteArea=document.getElementById('paletteArea');
  const submitBtn=document.getElementById('submit');
  const resultSummary=document.getElementById('resultSummary');
  const reviewBtn=document.getElementById('reviewBtn');
  const retakeBtn=document.getElementById('retakeBtn');
  const reviewArea=document.getElementById('reviewArea');

  let exam=null;
  let userAnswers=[];
  let marked=[];
  let currentIndex=0;
  let timerInterval=null;
  let timeLeft=0;
  let lastResult=null;

  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    tabs.forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const view=tab.dataset.view;
    views.forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if(view==='student') refreshStudentView();
    if(view==='results') renderResultView();
  }));

  function escapeHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function nowTime(){return new Date().toLocaleTimeString();}

  examForm.addEventListener('submit',e=>{
    e.preventDefault();
    const title=examTitle.value.trim();
    const duration=Number(examDuration.value);
    const passing=Number(examPassing.value);
    const subject=examSubject.value.trim();
    if(!title||!duration||isNaN(passing)){alert('Please fill title, duration and passing%');return;}
    exam={title,duration,passing,subject,questions:[]};
    topmeta.textContent=`${exam.title} • ${exam.subject||'—'} • ${exam.duration} min • Pass ${exam.passing}%`;
    qCount.textContent='0 questions';
    questionsList.innerHTML='—';
    alert('Exam created — now add questions.');
  });

  clearExam.addEventListener('click',()=>{
    if(!confirm('Clear exam and questions?'))return;
    exam=null;
    topmeta.textContent='No exam';
    qCount.textContent='No questions';
    questionsList.innerHTML='—';
  });

  qType.addEventListener('change',()=>{
    if(qType.value==='mcq'){mcqBlock.style.display='';tfBlock.style.display='none';}
    else{mcqBlock.style.display='none';tfBlock.style.display='';}
  });

  questionForm.addEventListener('submit',e=>{
    e.preventDefault();
    if(!exam){alert('Create exam first');return;}
    const text=qText.value.trim();
    const type=qType.value;
    const points=Number(qPoints.value)||1;
    if(!text){alert('Question text required');return;}
    const id=exam.questions.length+1;
    const qobj={id,text,type,points};
    if(type==='mcq'){
      const opts=[opt1.value.trim(),opt2.value.trim(),opt3.value.trim(),opt4.value.trim()];
      if(opts.some(o=>!o)){alert('All 4 options required');return;}
      const correctIdx=Number(mcqCorrect.value)-1;
      if(isNaN(correctIdx)||correctIdx<0||correctIdx>3){alert('Correct option 1-4');return;}
      qobj.options=opts;qobj.correct=correctIdx;
    }else{
      qobj.correct=tfCorrect.value==='true';
    }
    exam.questions.push(qobj);
    qText.value='';opt1.value='';opt2.value='';opt3.value='';opt4.value='';mcqCorrect.value=1;qPoints.value=1;
    qCount.textContent=`${exam.questions.length} question(s)`;
    renderQuestionsPreview();
  });

  function renderQuestionsPreview(){
    if(!exam||exam.questions.length===0){questionsList.innerHTML='—';return;}
    questionsList.innerHTML=exam.questions.map(q=>{
      return `<div style="padding:8px;border-bottom:1px dashed rgba(255,255,255,0.03)"><strong>#${q.id}</strong> ${escapeHtml(q.text)} <div class="meta">${q.type.toUpperCase()} • ${q.points}pt</div></div>`;
    }).join('');
  }

  function refreshStudentView(){
    if(!exam){displayTitle.textContent='No exam';displaySubject.textContent='Create exam in Admin';startExam.disabled=true;return;}
    displayTitle.textContent=exam.title;
    displaySubject.textContent=`${exam.subject||'—'} • ${exam.questions.length} Q • ${exam.duration} min`;
    startExam.disabled=exam.questions.length===0;
  }

  startExam.addEventListener('click',()=>{
    if(!exam||exam.questions.length===0){alert('No exam/questions');return;}
    userAnswers=Array(exam.questions.length).fill(null);
    marked=Array(exam.questions.length).fill(false);
    currentIndex=0;
    timeLeft=exam.duration*60;
    quizArea.style.display='';
    startTimer();
    renderQuestion(currentIndex);
    buildPalette();
    topmeta.textContent=`${exam.title} • ${exam.questions.length} Q`;
  });

  function startTimer(){
    clearInterval(timerInterval);
    timerEl.textContent=formatTime(timeLeft);
    timerInterval=setInterval(()=>{
      timeLeft--;
      timerEl.textContent=formatTime(timeLeft);
      if(timeLeft<=0){clearInterval(timerInterval);alert('Time finished — submitting');submitExam();}
    },1000);
  }
  function formatTime(s){const m=Math.floor(s/60).toString().padStart(2,'0');const sec=(s%60).toString().padStart(2,'0');return`${m}:${sec}`;}

  function renderQuestion(i){
    const q=exam.questions[i];
    questionBox.innerHTML='';
    const wrapper=document.createElement('div');
    wrapper.className='question';
    wrapper.innerHTML=`<div class="qhead">Q${q.id} • ${q.points}pt</div><div>${escapeHtml(q.text)}</div>`;
    const opts=document.createElement('div');opts.className='options';

    if(q.type==='mcq'){
      q.options.forEach((op,idx)=>{
        const d=document.createElement('div');
        d.className='option';
        d.textContent=op;
        if(userAnswers[i]===idx)d.classList.add('selected');
        d.addEventListener('click',()=>{selectOption(i,idx);});
        opts.appendChild(d);
      });
    }else{
      ['True','False'].forEach(val=>{
        const sval=val.toLowerCase();
        const d=document.createElement('div');
        d.className='option';
        d.textContent=val;
        if(String(userAnswers[i])===sval)d.classList.add('selected');
        d.addEventListener('click',()=>{selectOption(i,sval);});
        opts.appendChild(d);
      });
    }

    wrapper.appendChild(opts);
    questionBox.appendChild(wrapper);
    prevBtn.disabled=i===0;
    nextBtn.disabled=i===exam.questions.length-1;
    markBtn.textContent=marked[i]?'Unmark':'Mark';
    highlightPalette(i);
  }

  function selectOption(qIdx,val){
    userAnswers[qIdx]=val;
    renderQuestion(qIdx);
    updatePaletteState(qIdx);
  }

  prevBtn.addEventListener('click',()=>{if(currentIndex>0){currentIndex--;renderQuestion(currentIndex);}});
  nextBtn.addEventListener('click',()=>{if(currentIndex<exam.questions.length-1){currentIndex++;renderQuestion(currentIndex);}});
  markBtn.addEventListener('click',()=>{marked[currentIndex]=!marked[currentIndex];renderQuestion(currentIndex);updatePaletteState(currentIndex);});

  showPalette.addEventListener('click',()=>{paletteArea.style.display=paletteArea.style.display==='none'?'':'none';});

  function buildPalette(){
    paletteArea.innerHTML='';
    exam.questions.forEach((q,idx)=>{
      const b=document.createElement('button');
      b.className='pbtn';
      b.textContent=idx+1;
      b.addEventListener('click',()=>{currentIndex=idx;renderQuestion(idx);});
      paletteArea.appendChild(b);
    });
    updateAllPaletteStates();
  }

  function updateAllPaletteStates(){for(let i=0;i<exam.questions.length;i++)updatePaletteState(i);}
  function updatePaletteState(i){
    const b=paletteArea.children[i];if(!b)return;
    b.className='pbtn';
    if(userAnswers[i]!==null)b.classList.add('answered');
    if(marked[i])b.classList.add('marked');
    if(i===currentIndex)b.classList.add('current');
  }
  function highlightPalette(i){
    for(let k=0;k<paletteArea.children.length;k++){paletteArea.children[k].classList.remove('current');}
    if(paletteArea.children[i])paletteArea.children[i].classList.add('current');
  }

  submitBtn.addEventListener('click',()=>{if(confirm('Submit exam now?'))submitExam();});

  function submitExam(){
    clearInterval(timerInterval);
    const results=exam.questions.map((q,idx)=>{
      const ua=userAnswers[idx];
      let correct=false;
      if(q.type==='mcq')correct=(ua!==null&&Number(ua)===Number(q.correct));
      else correct=(ua!==null&&String(ua)===String(q.correct));
      return{qid:q.id,correct,points:q.points,userAnswer:ua,correctAnswer:q.correct};
    });

    const totalScore=results.filter(r=>r.correct).reduce((s,r)=>s+r.points,0);
    const totalPoints=exam.questions.reduce((s,q)=>s+q.points,0);
    const percent=Math.round((totalScore/totalPoints)*100)||0;
    const pass=percent>=exam.passing;

    lastResult={results,totalScore,totalPoints,percent,pass};
    renderResultView();
    tabs.forEach(t=>t.classList.remove('active'));
    document.querySelector('.tab[data-view="results"]').classList.add('active');
    views.forEach(v=>v.classList.remove('active'));
    document.getElementById('view-results').classList.add('active');
  }

  function renderResultView(){
    if(!lastResult){resultSummary.innerHTML='<div class="meta">No results yet</div>';return;}
    const r=lastResult;
    resultSummary.innerHTML=`
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="card result-block"><strong>Score</strong><div>${r.totalScore} / ${r.totalPoints}</div></div>
        <div class="card result-block"><strong>Percent</strong><div>${r.percent}%</div></div>
        <div class="card result-block"><strong>Status</strong><div style="color:${r.pass?'var(--neon)':'var(--danger)'}">${r.pass?'PASS':'FAIL'}</div></div>
        <div class="card result-block"><strong>Correct</strong><div>${r.results.filter(x=>x.correct).length} / ${r.results.length}</div></div>
      </div>
    `;
    reviewArea.innerHTML='';
  }

  reviewBtn.addEventListener('click',()=>{
    if(!lastResult)return alert('No results to review');
    const html=lastResult.results.map(item=>{
      const q=exam.questions[item.qid-1];
      const userText=item.userAnswer===null?'<em>Not answered</em>':(q.type==='mcq'?escapeHtml(q.options[item.userAnswer]):escapeHtml(String(item.userAnswer)));
      const correctText=q.type==='mcq'?escapeHtml(q.options[q.correct]):escapeHtml(String(q.correct));
      return `<div class="card" style="margin-top:10px;padding:10px"><strong>Q${q.id}</strong><div class="meta">${escapeHtml(q.text)}</div><div class="meta">Your: ${userText} • Correct: ${correctText}</div><div style="color:${item.correct?'var(--neon)':'var(--danger)'}">${item.correct?'Correct':'Incorrect'}</div></div>`;
    }).join('');
    reviewArea.innerHTML=html;
  });

  retakeBtn.addEventListener('click',()=>{
    if(!exam)return;
    if(!confirm('Retake will clear your previous answers. Continue?'))return;
    userAnswers=Array(exam.questions.length).fill(null);
    marked=Array(exam.questions.length).fill(false);
    currentIndex=0;
    timeLeft=exam.duration*60;
    tabs.forEach(t=>t.classList.remove('active'));
    document.querySelector('.tab[data-view="student"]').classList.add('active');
    views.forEach(v=>v.classList.remove('active'));
    document.getElementById('view-student').classList.add('active');
    renderQuestion(currentIndex);buildPalette();startTimer();
  });

  (function init(){
    qCount.textContent='No questions';
    questionsList.innerHTML='—';
  })();
})();
