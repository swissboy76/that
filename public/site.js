(()=>{
 const hero=document.querySelector('.hero-slides');
 if(hero){
  const slides=[...hero.querySelectorAll('.hero-slide')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,timer,busy=false;
  const advance=async()=>{if(busy||slides.length<2)return;busy=true;const next=(index+1)%slides.length,img=slides[next].querySelector('img');try{await img.decode();if(document.hidden||reduced.matches)return;const old=slides[index];old.classList.add('is-leaving');old.classList.remove('is-active');old.setAttribute('aria-hidden','true');slides[next].classList.add('is-active');slides[next].removeAttribute('aria-hidden');index=next;setTimeout(()=>old.classList.remove('is-leaving'),1900);}catch{}finally{busy=false;}};
  const schedule=()=>{clearInterval(timer);hero.style.animationPlayState=document.hidden?'paused':'running';hero.querySelectorAll('img').forEach(img=>img.style.animationPlayState=document.hidden?'paused':'running');if(!document.hidden&&!reduced.matches&&slides.length>1)timer=setInterval(advance,8000);};
  document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);schedule();
 }
 const dialog=document.querySelector('#lightbox');
 document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{dialog.querySelector('img').src=button.dataset.photo;dialog.querySelector('img').alt=button.querySelector('img').alt;dialog.querySelector('p').textContent=button.dataset.caption;dialog.showModal();}));
 dialog?.querySelector('button').addEventListener('click',()=>dialog.close());
 const form=document.querySelector('#application, #member-login');if(!form)return;
 const status=form.querySelector('.status'),submit=form.querySelector('button'),member=form.id==='member-login';let token='',widget;
 function show(message,error=false){status.textContent=message;status.className='status '+(error?'error':'');}
 fetch('/api/config').then(r=>{if(!r.ok)throw Error();return r.json();}).then(config=>{
  if(!(member?config.membersReady:config.applicationsReady)){show(member?'Member sign-in is not open yet. Please check back soon.':'Applications are not open yet. Please check back soon.');return;}
  window.thatTurnstileReady=()=>{widget=turnstile.render(form.querySelector('.turnstile-slot'),{sitekey:config.siteKey,action:member?'members':'application',callback:value=>{token=value;submit.disabled=false;show('');},'expired-callback':()=>{token='';submit.disabled=true;show('Please complete the security check again.');},'error-callback':()=>{token='';submit.disabled=true;show('The security check could not load. Please refresh and try again.',true);}});};
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=thatTurnstileReady&render=explicit';script.async=true;script.onerror=()=>show('The security check could not load. Please refresh and try again.',true);document.head.append(script);show('Please complete the security check.');
 }).catch(()=>show('We couldn’t load the form. Please refresh and try again.',true));
 form.addEventListener('submit',async event=>{event.preventDefault();if(!token)return;const fields=new FormData(form);const data=member?{password:fields.get('password'),token}:{name:fields.get('name'),email:fields.get('email'),phone:fields.get('phone'),experience:fields.get('experience'),interests:fields.getAll('interests'),website:fields.get('website'),consent:fields.has('consent'),token};if(!member&&!data.interests.length){show('Please choose at least one interest.',true);return;}submit.disabled=true;show(member?'Signing in…':'Sending application…');try{const res=await fetch(member?'/api/members/login':'/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.error||'Please try again.');if(member){location.assign('/members/');return;}form.reset();show(result.message);status.classList.add('success');submit.textContent='Application received';form.querySelectorAll('input,textarea').forEach(x=>x.disabled=true);if(widget!==undefined)turnstile.remove(widget);}catch(error){show(error.message||'We couldn’t send that. Please try again.',true);token='';if(widget!==undefined)turnstile.reset(widget);}});
})();
