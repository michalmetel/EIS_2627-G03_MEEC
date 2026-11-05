// Mobile menu
const menuToggle=document.getElementById('menuToggle'),mainNav=document.getElementById('mainNav');
menuToggle.addEventListener('click',()=>{const o=mainNav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(o));});

// Search: an order number goes to tracking, words go to the page they belong to
const SEARCH_PAGES=[
  {url:'#trackTitle',words:['track','tracking','shipment','status']},
  {url:'client.html',words:['ship','send','parcel','order','client','map','coordinates']},
  {url:'#services',words:['service','services','delivery','vehicle','how','works','proof']},
  {url:'login.html',words:['login','log in','sign in','account','password']},
  {url:'login.html#register',words:['register','sign up','create']},
  {url:'CourierPage.html',words:['courier','couriers','driver','cockpit']},
  {url:'StaffPage.html',words:['staff','approval','approvals','insurance','inspection']},
  {url:'admin.html',words:['admin','dashboard','statistics','kpi']},
  {url:'TeamPage.html',words:['team','about','members','students','group']},
  {url:'support.html',words:['support','help','contact','faq','question']},
  {url:'HomePage.html',words:['home','start']}
];
const searchInput=document.getElementById('searchInput'),searchMsg=document.getElementById('searchMsg');
searchInput.addEventListener('input',()=>{searchMsg.textContent='';});
document.getElementById('searchForm').addEventListener('submit',e=>{
  e.preventDefault();
  const term=searchInput.value.trim().toLowerCase();
  if(term==='')return;
  if(/^#?\d{4}$/.test(term)){
    trackInput.value=term;
    document.getElementById('trackForm').requestSubmit();
    document.getElementById('trackTitle').scrollIntoView();
    return;
  }
  const page=term.length>=3&&SEARCH_PAGES.find(p=>p.words.some(w=>w.startsWith(term)||term.includes(w)));
  if(page)location.href=page.url;
  else searchMsg.textContent='Nothing found for "'+searchInput.value.trim()+'".';
});

// Reduced motion: stop the background dot
const reduceMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
if(reduceMotion){const s=document.getElementById('routeSvg');if(s.pauseAnimations)s.pauseAnimations();}

// Tracking. Sample data: the orders shown on the client and courier pages, plus new ones
const SAMPLE_ORDERS={2038:'Completed',2039:'Completed',2040:'Completed',2041:'In Progress',2042:'Initiated',2043:'Initiated',2044:'Initiated',2045:'Initiated'};
const TRACK_STEPS=['Initiated','In Progress','Completed'];
cmsRead('cms.orders',[]).forEach(o=>{SAMPLE_ORDERS[o.id]=o.status;});
const trackResult=document.getElementById('trackResult'),tlFill=document.getElementById('tlFill'),
      tlSteps=[...document.querySelectorAll('.tl-steps li')],trackBtn=document.querySelector('.track-row button'),
      trackInput=document.getElementById('trackingNumber'),trackRow=document.querySelector('.track-row'),
      trackMsg=document.getElementById('trackMsg'),trackStatus=document.getElementById('trackStatus');
let tlTimers=[];

function resetTracking(){
  tlTimers.forEach(clearTimeout);tlTimers=[];
  tlSteps.forEach(li=>li.className='');tlFill.style.width='0%';
  trackStatus.textContent='';trackBtn.textContent='Track';
}
function trackError(text){
  resetTracking();
  trackResult.classList.remove('show');
  trackMsg.textContent=text;
  trackRow.classList.add('invalid');
  trackInput.setAttribute('aria-invalid','true');
  trackInput.focus();
}
trackInput.addEventListener('input',()=>{
  trackMsg.textContent='';
  trackRow.classList.remove('invalid');
  trackInput.removeAttribute('aria-invalid');
});

document.getElementById('trackForm').addEventListener('submit',e=>{
  e.preventDefault();
  const value=trackInput.value.trim();
  if(value===''){trackError('Please enter your order number.');return;}
  // same format as the Order ID on the client page: 4 digits, with or without the #
  if(!/^#?\d{4}$/.test(value)){trackError('Order numbers have 4 digits, for example #2041.');return;}
  const id=value.replace('#',''),status=SAMPLE_ORDERS[id];
  if(!status){trackError('We can\'t find order #'+id+'. Check the number and try again.');return;}

  trackInput.dispatchEvent(new Event('input'));
  resetTracking();
  trackResult.classList.add('show');trackBtn.textContent='Tracking…';
  const stage=TRACK_STEPS.indexOf(status),at=(ms,fn)=>tlTimers.push(setTimeout(fn,ms));
  const finish=()=>{trackStatus.textContent='Order #'+id+': '+status;trackBtn.textContent='Track';};
  at(150,()=>tlSteps[0].classList.add('on'));
  if(stage>=1)at(1000,()=>{tlSteps[0].className='done';tlSteps[1].classList.add('on');tlFill.style.width='50%';});
  if(stage>=2)at(2100,()=>{tlSteps[1].className='done';tlSteps[2].classList.add('on');tlFill.style.width='100%';});
  if(stage===2)at(3100,()=>{tlSteps[2].className='done';finish();});
  else at(stage===1?1500:500,finish);
});

// Counters: count up from 0 as soon as the page loads
const counters=document.querySelectorAll('[data-count]');
function animateCount(el){
  const target=Number(el.dataset.count),duration=2400,start=performance.now();
  (function tick(now){
    const p=Math.min((now-start)/duration,1),eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*eased).toLocaleString('en-US')+'+';
    if(p<1)requestAnimationFrame(tick);
  })(start);
}
if(!reduceMotion){
  counters.forEach(c=>{c.textContent='0+';});
  setTimeout(()=>counters.forEach(animateCount),450);
}

// Scroll reveal
const reveals=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){
  const ro=new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target);}}),{threshold:.15});
  reveals.forEach(el=>ro.observe(el));
}else{reveals.forEach(el=>el.classList.add('visible'));}
