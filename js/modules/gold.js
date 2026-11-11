import { $, dateKey, escapeHTML, money } from './data.js';

function formatQuantity(quantity) {
    return `${Number(quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} chỉ`;
}

const CONTRIBUTION_FIELDS = [
    'thanhHoaKpi', 'thanhHoaSalary', 'thanhHoaTarget',
    'ngocYenKpi', 'ngocYenSalary', 'ngocYenTarget',
    'cash', 'fund', 'pig', 'extra', 'debt'
];
const GOLD_START_MONTH = '2025-09';

function monthLabel(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return `Tháng ${monthNumber}/${year}`;
}

function parseMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1, 12);
}

function formatAmountInput(value, month, field, disabled) {
    const amount = Math.max(0, Math.trunc(Number(value) || 0));
    return `<input class="gold-contribution-input" type="text" inputmode="numeric" autocomplete="off" aria-label="${monthLabel(month)}, ${field}" data-month="${month}" data-contribution="${field}" value="${amount ? amount.toLocaleString('vi-VN') : ''}"${disabled ? ' disabled' : ''}>`;
}

function formatCalculatedCash(value, month) {
    const amount = Math.max(0, Math.trunc(Number(value) || 0));
    return `<input class="gold-contribution-input" type="text" aria-label="${monthLabel(month)}, tiền tự tính từ KPI và lương" value="${amount ? amount.toLocaleString('vi-VN') : ''}" readonly>`;
}

function formatDateInput(value, month, disabled) {
    const date = typeof value === 'string' && dateKey(new Date(`${value}T12:00:00`)) === value ? value : '';
    return `<input class="gold-contribution-date" type="date" aria-label="${monthLabel(month)}, ngày mua" data-month="${month}" data-contribution="purchaseDate" value="${date}"${disabled ? ' disabled' : ''}>`;
}

function formatStatusSelect(value, month, disabled) {
    const statuses = ['CHƯA MUA', 'ĐÃ GÓP', 'ĐÃ MUA'];
    const selected = statuses.includes(value) ? value : 'CHƯA MUA';
    return `<select class="gold-contribution-status" aria-label="${monthLabel(month)}, trạng thái" data-month="${month}" data-contribution="status"${disabled ? ' disabled' : ''}>${statuses.map(status => `<option${status === selected ? ' selected' : ''}>${status}</option>`).join('')}</select>`;
}

function getContributionTotal(contribution) {
    return getContributionCash(contribution) +
        Number(contribution.fund || 0) +
        Number(contribution.pig || 0) +
        Number(contribution.extra || 0) -
        Number(contribution.debt || 0);
}

function getContributionCash(contribution) {
    const kpiAndSalary = Number(contribution.thanhHoaKpi || 0) +
        Number(contribution.thanhHoaSalary || 0) +
        Number(contribution.ngocYenKpi || 0) +
        Number(contribution.ngocYenSalary || 0);
    return kpiAndSalary || Number(contribution.cash || 0);
}

export function renderGoldFund(purchases, contributions = [], contributionsReady = true) {
    const today = dateKey(new Date());
    const validPurchases = purchases.filter(purchase =>
        purchase &&
        typeof purchase.date === 'string' &&
        purchase.date <= today &&
        dateKey(new Date(`${purchase.date}T12:00:00`)) === purchase.date &&
        Number.isFinite(Number(purchase.quantity)) &&
        Number(purchase.quantity) > 0
    );
    const total = validPurchases.reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
    $('goldTotal').textContent = formatQuantity(total);
    $('goldTotalPurchased').textContent = `Đã mua ${formatQuantity(total)}`;
    $('goldPurchaseCount').textContent = `${validPurchases.length} lần mua`;
    const validContributions = contributions.filter(contribution =>
        contribution &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(contribution.id) &&
        CONTRIBUTION_FIELDS.every(field => Number.isFinite(Number(contribution[field] || 0)) && Number(contribution[field] || 0) >= 0)
    );
    const contributionByMonth = new Map(validContributions.map(contribution => [contribution.id, contribution]));
    const monthPurchases = new Map();
    validPurchases.forEach(purchase => {
        const month = purchase.date.slice(0, 7);
        monthPurchases.set(month, (monthPurchases.get(month) || 0) + Number(purchase.quantity));
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const months = [...contributionByMonth.keys(), ...monthPurchases.keys()].sort();
    const latestMonth = months[months.length - 1] || currentMonth;
    const purchaseMonths = [...monthPurchases.keys()].sort();
    const earliestGoldMonth = purchaseMonths[0] && purchaseMonths[0] < GOLD_START_MONTH
        ? purchaseMonths[0]
        : GOLD_START_MONTH;
    const goldCursor = parseMonth(earliestGoldMonth);
    const goldFinalMonth = parseMonth(purchaseMonths[purchaseMonths.length - 1] || currentMonth) > lastMonth
        ? parseMonth(purchaseMonths[purchaseMonths.length - 1])
        : lastMonth;
    const goldMonthlyRows = [];
    let monthlyGoldTotal = 0;
    while (goldCursor <= goldFinalMonth) {
        const month = `${goldCursor.getFullYear()}-${String(goldCursor.getMonth() + 1).padStart(2, '0')}`;
        const bought = monthPurchases.get(month) || 0;
        monthlyGoldTotal += bought;
        goldMonthlyRows.push(`<tr><td>${monthLabel(month)}</td><td>${formatQuantity(bought)}</td><td><strong>${formatQuantity(monthlyGoldTotal)}</strong></td></tr>`);
        goldCursor.setMonth(goldCursor.getMonth() + 1);
    }
    $('goldMonthlyRows').innerHTML = goldMonthlyRows.join('') || '<tr><td colspan="3" class="empty">Chưa có dữ liệu vàng theo tháng.</td></tr>';
    const cursor = parseMonth(GOLD_START_MONTH);
    const finalMonth = parseMonth(latestMonth) > lastMonth ? parseMonth(latestMonth) : lastMonth;
    const contributionRows = [];
    let period = 0;
    let cumulativeTotal = 0;

    while (cursor <= finalMonth) {
        const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const contribution = contributionByMonth.get(month) || {};
        const bought = monthPurchases.get(month) || 0;
        const totalForMonth = getContributionTotal(contribution);
        cumulativeTotal += totalForMonth;
        const contributedByThanhHoa = Number(contribution.thanhHoaKpi || 0) + Number(contribution.thanhHoaSalary || 0);
        const contributedByNgocYen = Number(contribution.ngocYenKpi || 0) + Number(contribution.ngocYenSalary || 0);
        const amountCells = CONTRIBUTION_FIELDS.map(field => {
            const input = field === 'cash'
                ? formatCalculatedCash(getContributionCash(contribution), month)
                : formatAmountInput(contribution[field], month, field, !contributionsReady);
            return `<td>${input}${field === 'thanhHoaTarget' ? `<small>Đã góp ${money(contributedByThanhHoa)} / ${money(contribution.thanhHoaTarget || 0)}</small>` : field === 'ngocYenTarget' ? `<small>Đã góp ${money(contributedByNgocYen)} / ${money(contribution.ngocYenTarget || 0)}</small>` : ''}</td>`;
        }).join('');
        const dateCell = formatDateInput(contribution.purchaseDate, month, !contributionsReady);
        const statusCell = formatStatusSelect(contribution.status, month, !contributionsReady);
        contributionRows.push(`<tr><td>${++period}</td><td>${monthLabel(month)}</td>${amountCells}<td class="gold-contribution-total">${money(totalForMonth)}<small>Dư: ${money(cumulativeTotal)}</small></td><td>${dateCell}<small>${bought ? `Đã mua ${formatQuantity(bought)}` : ''}</small></td><td>${statusCell}</td></tr>`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    $('goldContributionTotal').textContent = money(cumulativeTotal);
    $('goldContributionRows').innerHTML = contributionRows.join('') || '<tr><td colspan="16" class="empty">Chưa có đợt tích góp.</td></tr>';
    $('goldPurchaseRows').innerHTML = validPurchases.length
        ? validPurchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map(purchase => {
            const date = purchase.date.split('-').reverse().join('/');
            return `<tr><td>${date}</td><td>${formatQuantity(purchase.quantity)}</td><td>${escapeHTML(purchase.note || '—')}</td><td><div class="actions"><button class="icon-btn delete" type="button" title="Xóa giao dịch mua vàng" aria-label="Xóa giao dịch mua vàng" data-delete-gold="${escapeHTML(purchase.id)}">⌫</button></div></td></tr>`;
        }).join('')
        : '<tr><td colspan="4" class="empty">Chưa có giao dịch mua vàng.</td></tr>';
}
