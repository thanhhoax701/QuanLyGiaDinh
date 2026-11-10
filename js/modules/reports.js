import { $, COLORS, DAILY_HUSBAND_ALLOWANCE, dateKey, monthKey, money, sum, txDate, escapeHTML } from './data.js';
import { getFilteredTransactions, renderRows } from './transactions.js';

function calculateDailyLimitDebtByDay(transactions, throughDay) {
    const spendingByDay = {}, paymentsByDay = {};
    transactions.forEach(transaction => {
        const day = dateKey(txDate(transaction));
        if (transaction.type === 'expense') spendingByDay[day] = (spendingByDay[day] || 0) + Number(transaction.amount);
        if (transaction.type === 'debtPayment') paymentsByDay[day] = (paymentsByDay[day] || 0) + Number(transaction.amount);
    });
    const expenseDays = Object.keys(spendingByDay).sort();
    if (!expenseDays.length || throughDay < expenseDays[0]) return new Map();
    const balances = new Map();
    let balance = 0;
    const date = new Date(`${expenseDays[0]}T12:00:00`), lastDate = new Date(`${throughDay}T12:00:00`);
    while (date <= lastDate) {
        const day = dateKey(date), spent = spendingByDay[day] || 0;
        balance += spent - DAILY_HUSBAND_ALLOWANCE;
        if (balance > 0) balance = Math.max(balance - (paymentsByDay[day] || 0), 0);
        balances.set(day, balance);
        date.setDate(date.getDate() + 1);
    }
    return balances;
}

export function getDailyLimitDebtBalance(transactions, throughDay) {
    const balances = calculateDailyLimitDebtByDay(transactions, throughDay);
    return Math.max(balances.get(throughDay) || 0, 0);
}

function calculateDebtPaymentBalances(transactions) {
    const spendingByDay = {}, paymentsByDay = {};
    transactions.forEach(transaction => {
        const day = dateKey(txDate(transaction));
        if (transaction.type === 'expense') spendingByDay[day] = (spendingByDay[day] || 0) + Number(transaction.amount);
        if (transaction.type === 'debtPayment') (paymentsByDay[day] ||= []).push(transaction);
    });
    const days = [...new Set([...Object.keys(spendingByDay), ...Object.keys(paymentsByDay)])].sort();
    const balances = new Map();
    let balance = 0;
    if (!days.length) return balances;
    const date = new Date(`${days[0]}T12:00:00`), lastDate = new Date(`${days[days.length - 1]}T12:00:00`);
    while (date <= lastDate) {
        const day = dateKey(date), spent = spendingByDay[day] || 0;
        balance += spent - DAILY_HUSBAND_ALLOWANCE;
        (paymentsByDay[day] || []).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(payment => {
            if (balance > 0) balance = Math.max(balance - Number(payment.amount), 0);
            balances.set(payment, Math.max(balance, 0));
        });
        date.setDate(date.getDate() + 1);
    }
    return balances;
}

function renderMonthlyReport(transactions) {
    const month = getFilteredTransactions(transactions), now = new Date(), currentMonthKey = monthKey(now), reportMonth = $('reportMonth').value || currentMonthKey, [year, monthNumber] = reportMonth.split('-').map(Number), monthDayCount = new Date(year, monthNumber, 0).getDate(), lastDayToShow = reportMonth === currentMonthKey ? now.getDate() : reportMonth < currentMonthKey ? monthDayCount : 0, days = Array.from({ length: lastDayToShow }, (_, index) => `${reportMonth}-${String(index + 1).padStart(2, '0')}`), asOfDay = lastDayToShow ? days[days.length - 1] : dateKey(now), debtByDay = calculateDailyLimitDebtByDay(transactions, asOfDay);
    const dailyLimitSpendingByDay = {}, dailyLimitPaymentsByDay = {};
    transactions.forEach(t => {
        const day = dateKey(txDate(t));
        if (t.type === 'expense') dailyLimitSpendingByDay[day] = (dailyLimitSpendingByDay[day] || 0) + Number(t.amount);
        if (t.type === 'debtPayment') dailyLimitPaymentsByDay[day] = (dailyLimitPaymentsByDay[day] || 0) + Number(t.amount);
    });
    const dailyLimitDebtByDay = {};
    const firstDay = debtByDay.keys().next().value;
    if (firstDay) {
        const date = new Date(`${firstDay}T12:00:00`), lastDate = new Date(`${asOfDay}T12:00:00`);
        while (date <= lastDate) {
            const day = dateKey(date), spent = dailyLimitSpendingByDay[day] || 0, dailyDebt = Math.max(spent - DAILY_HUSBAND_ALLOWANCE, 0), remaining = Math.max(DAILY_HUSBAND_ALLOWANCE - spent, 0);
            if (monthKey(date) === reportMonth) {
                dailyLimitDebtByDay[day] = { spent, remaining, dailyDebt, debtTotal: debtByDay.get(day) || 0, paid: dailyLimitPaymentsByDay[day] || 0 };
            }
            date.setDate(date.getDate() + 1);
        }
    }
    days.forEach(day => { dailyLimitDebtByDay[day] ||= { spent: 0, remaining: DAILY_HUSBAND_ALLOWANCE, dailyDebt: 0, debtTotal: debtByDay.get(day) || 0, paid: dailyLimitPaymentsByDay[day] || 0 } });
    $('reportRowCount').textContent = `${month.length} giao dịch`;
    const dailyGroups = {};
    month.forEach(t => { const key = dateKey(txDate(t)); (dailyGroups[key] ??= []).push(t) });
    $('reportRows').innerHTML = days.filter(day => !$('reportDateFilter').value || day === $('reportDateFilter').value).reverse().map(day => {
        const daily = dailyGroups[day] || [], date = day.split('-').reverse().join('/'), dailyLimit = dailyLimitDebtByDay[day];
        const endingBalance = dailyLimit.debtTotal, endingBalanceLabel = endingBalance > 0 ? `Nợ cuối ${money(endingBalance)}` : `Dư cuối ${money(Math.abs(endingBalance))}`;
        const debtPaymentTooltip = dailyLimit.paid > 0 ? ` title="Đã xóa nợ: ${money(dailyLimit.paid)}"` : '';
        const endingBalanceClass = `report-day-debt-total${dailyLimit.paid > 0 ? ' has-debt-payment' : ''}${endingBalance <= 0 ? ' has-daily-surplus' : ''}`;
        return `<tr class="report-day-row"><td colspan="7"><details class="report-day"><summary><span class="report-day-date">${date}</span><span class="report-day-count">${daily.length} giao dịch</span><span class="report-day-total"><span class="report-day-spent">Chi ngày ${money(dailyLimit.spent)}</span><span class="report-day-daily-debt">Nợ ngày ${money(dailyLimit.dailyDebt)}</span><span class="report-day-remaining">Dư của ngày ${money(dailyLimit.remaining)}</span><span class="${endingBalanceClass}"${debtPaymentTooltip}>${endingBalanceLabel}</span></span></summary><div class="table-wrap"><table><thead><tr><th>Ngày giờ</th><th>Nội dung</th><th>Danh mục</th><th>Số tiền</th><th>Người thực hiện</th><th>Nguồn tiền</th><th>Thao tác</th></tr></thead><tbody>${daily.length ? renderRows(daily, { mobileDetails: true }) : '<tr><td colspan="7" class="empty">Không có giao dịch trong ngày này.</td></tr>'}</tbody></table></div></details></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">Không có ngày phù hợp bộ lọc.</td></tr>';
    renderDebtPaymentHistory(transactions, reportMonth);
}

function renderDebtPaymentHistory(transactions, reportMonth) {
    const payments = transactions
        .filter(transaction => transaction.type === 'debtPayment' && (!reportMonth || monthKey(txDate(transaction)) === reportMonth))
        .sort((a, b) => b.date.localeCompare(a.date));
    const balances = calculateDebtPaymentBalances(transactions);
    $('debtPaymentHistoryTotal').textContent = `${payments.length} lần · ${money(sum(payments))}`;
    $('debtPaymentHistoryRows').innerHTML = payments.length ? payments.map(payment => {
        const date = dateKey(txDate(payment)).split('-').reverse().join('/');
        return `<tr><td>${date}</td><td class="amount debt-payment">${money(payment.amount)}</td><td>${money(balances.get(payment) || 0)}</td><td>${payment.note ? escapeHTML(payment.note) : '—'}</td><td><div class="actions"><button class="icon-btn delete" title="Xóa khoản xóa nợ" aria-label="Xóa khoản xóa nợ" data-delete="${escapeHTML(payment.id)}">⌫</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="empty">Chưa có khoản xóa nợ trong tháng này.</td></tr>';
}

function renderFunds(transactions) { const defaults = ['Tiền chung', 'Lương vợ', 'Lương chồng', 'Tiền tiết kiệm', 'Nguồn khác'], funds = [...new Set([...defaults, ...transactions.map(t => t.fund)])]; $('fundList').innerHTML = funds.map((f, i) => { const list = transactions.filter(t => t.fund === f), net = sum(incomes(list)) - sum(expenses(list)); return `<div class="category-row"><span class="dot" style="background:${COLORS[i % COLORS.length]}"></span><span class="cat-name">${f}<div class="eyebrow">${list.length} giao dịch</div></span><span class="cat-amount ${net < 0 ? 'red' : 'green'}">${money(net)}<div class="cat-percent">Thu trừ chi đã ghi</div></span></div>` }).join(''); }
export function renderReports(transactions) { renderMonthlyReport(transactions); renderFunds(transactions); }
