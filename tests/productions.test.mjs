import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {ticketSection,bookingURL,isPast,productionDetail} from '../src/productions.mjs';
test('all eight archive pages have posters, dates and credits, but no active ticket links',async()=>{
 const files=(await readdir('content/productions')).filter(f=>f.endsWith('.json'));
 assert.equal(files.length,8);
 const index=await readFile('dist/productions/index.html','utf8');
 for(const file of files){const p=JSON.parse(await readFile('content/productions/'+file));assert.equal(p.status,'past');assert.ok(p.dates&&p.credits);await access('dist'+p.cover);const slug=file.slice(0,-5);assert.ok(index.includes('/productions/'+slug+'/'));const page=await readFile('dist/productions/'+slug+'/index.html','utf8');assert.ok(page.includes(p.cover));assert.match(page,/This production has finished/);assert.doesNotMatch(page,/Book tickets ↗/);}
});
test('ticket sales require a non-archived production, explicit enablement and HTTPS',()=>{
 const p={title:'Test show',status:'current',ticketsOnSale:true,ticketUrl:'https://tickets.example/show'};
 assert.match(ticketSection(p),/Book tickets/);
 for(const change of [{status:'past'},{ticketsOnSale:false},{ticketUrl:'javascript:alert(1)'},{ticketUrl:'http://tickets.example'}])assert.doesNotMatch(ticketSection({...p,...change}),/Book tickets/);
 assert.equal(bookingURL('https://user:pass@example.com'),'');
 assert.equal(isPast({}),true);
 assert.match(productionDetail({title:'<script>',status:'upcoming',description:'<script>'}),/&lt;script&gt;/);
});
test('homepage has ten full-screen slideshow photos without controls and upcoming page exists',async()=>{
 const html=await readFile('dist/index.html','utf8');
 assert.match(html,/hero-dynamic/);assert.equal((html.match(/class="hero-slide(?: is-active)?"/g)||[]).length,10);assert.match(html,/DSC_5617.jpg/);assert.match(html,/DSC_5608.jpg/);assert.match(html,/DSC_5492.jpg/);assert.doesNotMatch(html,/Pause slideshow|data-hero-prev|hero-controls/);
 assert.ok(html.indexOf('/style.css')<html.indexOf('/productions.css'));
 assert.match(await readFile('dist/whats-on/index.html','utf8'),/Current &amp; upcoming productions/);
});
