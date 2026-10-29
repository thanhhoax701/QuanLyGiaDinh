import { $ } from './data.js';
export function initNavigation(){
 const titles={overview:'Tổng quan tài chính',transactions:'Sổ chi tiêu',reports:'Báo cáo tháng',funds:'Nguồn tiền',settings:'Cài đặt'};
 function go(page){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+page).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('pageTitle').textContent=titles[page]||'Gia Đình';}
 $('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)go(b.dataset.page)});document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
}
