export const EXPENSE_CATEGORIES = ['Ăn uống','Đi lại','Mua sắm','Tiền nhà','Hóa đơn','Sức khỏe','Giải trí','Khác'];
export const INCOME_CATEGORIES = ['Lương','Thưởng','Kinh doanh','Được tặng','Thu nhập khác'];
export const DAILY_HUSBAND_ALLOWANCE = 100000;
export const COLORS = ['#ff9e45','#3993ff','#bd7bf2','#25b8a5','#f05f83','#8b91f5','#efc14b','#8c9aaa'];
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2,'0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
export const currentMonth = monthKey(new Date());
export const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
export const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const txDate = t => new Date(t.date);
export const sum = list => list.reduce((a,t)=>a+Number(t.amount||0),0);
export const expenses = list => list.filter(t=>t.type==='expense');
export const incomes = list => list.filter(t=>t.type==='income');
export const monthTransactions = (list,m) => list.filter(t=>monthKey(txDate(t))===m);
export function loadTransactions(){try{return JSON.parse(localStorage.getItem('giadinh_transactions')||'[]')}catch{return []}}
export function saveTransactions(list){localStorage.setItem('giadinh_transactions',JSON.stringify(list))}
export function formatDate(s){const d=new Date(s);return isNaN(d)?'—':`${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
