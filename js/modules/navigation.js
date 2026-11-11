import { $ } from './data.js';
export function initNavigation(){
 const titles={reports:'Báo cáo tháng',gold:'Quỹ vàng',funds:'Nguồn tiền',settings:'Cài đặt'};
 function go(page){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+page).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('pageTitle').textContent=titles[page]||'Gia Đình';$('reportCurrentBalanceCard').hidden=page!=='reports';$('appTopbar').classList.toggle('report-mode',page==='reports');$('addBtn').hidden=page==='gold';$('goldPurchaseToggle').hidden=page!=='gold';}
 $('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)go(b.dataset.page)});document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
}
