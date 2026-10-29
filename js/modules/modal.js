import { $, pad, dateKey, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './data.js';
export function fillCategories(selected){const list=$('txType').value==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES;$('txCategory').innerHTML=list.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('');}
export function openModal(tx,duplicate=false){
 $('transactionForm').reset();$('txId').value=duplicate?'':tx?.id||'';$('modalTitle').textContent=duplicate?'Nhân bản giao dịch':tx?'Sửa giao dịch':'Thêm khoản chi';$('txType').value=tx?.type||'expense';
 const now=new Date();$('txDate').value=tx?.date||`${dateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;$('txTitle').value=tx?.title||'';$('txAmount').value=tx?.amount||'';$('txPerson').value=tx?.person||'Vợ';$('txFund').value=tx?.fund||'Tiền chung';$('txNote').value=tx?.note||'';$('txDetails').value=tx?.details||'';fillCategories(tx?.category);$('modalBackdrop').classList.add('show');
}
export function closeModal(){$('modalBackdrop').classList.remove('show')}
