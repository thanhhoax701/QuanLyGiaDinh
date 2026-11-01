import { $, COLORS, DAILY_HUSBAND_ALLOWANCE, dateKey, monthKey, pad, money, sum, expenses, incomes, txDate } from './data.js';
import { getFilteredTransactions, renderRows } from './transactions.js';
function renderMonthlyReport(transactions){
 const month=getFilteredTransactions(transactions),ex=expenses(month),inc=incomes(month),now=new Date(),currentMonthKey=monthKey(now),reportMonth=$('reportMonth').value||currentMonthKey,[year,monthNumber]=reportMonth.split('-').map(Number),monthDayCount=new Date(year,monthNumber,0).getDate(),lastDayToShow=reportMonth===currentMonthKey?now.getDate():reportMonth<currentMonthKey?monthDayCount:0,days=Array.from({length:lastDayToShow},(_,index)=>`${reportMonth}-${String(index+1).padStart(2,'0')}`),husbandSpendingByDay={};
 transactions.filter(t=>t.type==='expense'&&t.person==='Chồng'&&monthKey(txDate(t))===reportMonth).forEach(t=>{const day=dateKey(txDate(t));husbandSpendingByDay[day]=(husbandSpendingByDay[day]||0)+Number(t.amount)});
 let husbandRemainingTotal=0,husbandDebtTotal=0,husbandSpentTotal=0;
 const husbandDebtByDay={};
 days.forEach(day=>{
  const spent=husbandSpendingByDay[day]||0,dailyDebt=Math.max(spent-DAILY_HUSBAND_ALLOWANCE,0),remaining=Math.max(DAILY_HUSBAND_ALLOWANCE-spent,0);
  husbandSpentTotal+=spent;
  husbandRemainingTotal+=remaining;
  husbandDebtTotal+=dailyDebt;
  husbandDebtByDay[day]={spent,remaining,dailyDebt,debtTotal:husbandDebtTotal};
 });
 $('reportIncome').textContent=money(sum(inc));$('reportExpense').textContent=money(sum(ex));$('reportBalance').textContent=money(sum(inc)-sum(ex));$('reportHusbandSpent').textContent=money(husbandSpentTotal);$('reportHusbandRemaining').textContent=money(husbandRemainingTotal);$('reportHusbandDebt').textContent=money(husbandDebtTotal);$('reportRowCount').textContent=`${month.length} giao dịch`;
 const dailyGroups={};
 month.forEach(t=>{const key=dateKey(txDate(t));(dailyGroups[key]??=[]).push(t)});
 $('reportRows').innerHTML=days.filter(day=>!$('reportDateFilter').value||day===$('reportDateFilter').value).reverse().map(day=>{
  const daily=dailyGroups[day]||[],date=day.split('-').reverse().join('/'),husbandDebt=husbandDebtByDay[day];
  return `<tr class="report-day-row"><td colspan="7"><details class="report-day"><summary><span class="report-day-date">${date}</span><span class="report-day-count">${daily.length} giao dịch</span><span class="report-day-total ${husbandDebt.debtTotal?'red':'green'}"><span>Chi ngày ${money(husbandDebt.spent)}</span><span>Nợ ngày ${money(husbandDebt.dailyDebt)}</span><span>Dư của ngày ${money(husbandDebt.remaining)}</span><span>Tổng nợ ${money(husbandDebt.debtTotal)}</span></span></summary><div class="table-wrap"><table><thead><tr><th>Ngày giờ</th><th>Nội dung</th><th>Danh mục</th><th>Số tiền</th><th>Người thực hiện</th><th>Nguồn tiền</th><th>Thao tác</th></tr></thead><tbody>${daily.length?renderRows(daily,{mobileDetails:true}):'<tr><td colspan="7" class="empty">Không có giao dịch trong ngày này.</td></tr>'}</tbody></table></div></details></td></tr>`;
 }).join('')||'<tr><td colspan="7" class="empty">Không có ngày phù hợp bộ lọc.</td></tr>';
}
function renderFunds(transactions){const defaults=['Tiền chung','Lương vợ','Lương chồng','Tiền tiết kiệm','Nguồn khác'],funds=[...new Set([...defaults,...transactions.map(t=>t.fund)])];$('fundList').innerHTML=funds.map((f,i)=>{const list=transactions.filter(t=>t.fund===f),net=sum(incomes(list))-sum(expenses(list));return `<div class="category-row"><span class="dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="cat-name">${f}<div class="eyebrow">${list.length} giao dịch</div></span><span class="cat-amount ${net<0?'red':'green'}">${money(net)}<div class="cat-percent">Thu trừ chi đã ghi</div></span></div>`}).join('');}
export function renderReports(transactions){renderMonthlyReport(transactions);renderFunds(transactions);}
