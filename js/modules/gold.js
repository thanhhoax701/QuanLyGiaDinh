import { $, dateKey, escapeHTML, money } from './data.js';

function formatQuantity(quantity) {
    return `${Number(quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} chỉ`;
}

const CONTRIBUTION_FIELDS = [
    'thanhHoaKpi', 'thanhHoaSalary',
    'ngocYenKpi', 'ngocYenSalary',
    'fund', 'pig', 'extra', 'debt'
];
const GOLD_START_MONTH = '2025-09';
const EMPTY_CONTRIBUTION = {
    thanhHoaKpi: 0,
    thanhHoaSalary: 0,
    ngocYenKpi: 0,
    ngocYenSalary: 0,
    cash: 0,
    fund: 0,
    pig: 0,
    extra: 0,
    debt: 0,
    purchaseDate: '',
    status: 'CHƯA MUA'
};

function monthLabel(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return `Tháng ${monthNumber}/${year}`;
}

function parseMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1, 12);
}

function formatAmountInput(value, month, field, id, disabled) {
    const amount = Math.max(0, Math.trunc(Number(value) || 0));
    return `<input class="gold-contribution-input" type="text" inputmode="numeric" autocomplete="off" aria-label="${monthLabel(month)}, ${field}" data-month="${month}" data-contribution-id="${escapeHTML(id)}" data-contribution="${field}" value="${amount ? amount.toLocaleString('vi-VN') : ''}"${disabled ? ' disabled' : ''}>`;
}

function formatCalculatedCash(value, month) {
    const amount = Math.max(0, Math.trunc(Number(value) || 0));
    return `<input class="gold-contribution-input" type="text" aria-label="${monthLabel(month)}, tiền tự tính từ KPI và lương" value="${amount ? amount.toLocaleString('vi-VN') : ''}" readonly>`;
}

function formatDateInput(value, month, id, disabled) {
    const date = typeof value === 'string' && dateKey(new Date(`${value}T12:00:00`)) === value ? value : '';
    return `<input class="gold-contribution-date" type="date" aria-label="${monthLabel(month)}, ngày mua" data-month="${month}" data-contribution-id="${escapeHTML(id)}" data-contribution="purchaseDate" value="${date}"${disabled ? ' disabled' : ''}>`;
}

function formatStatusSelect(value, month, id, disabled) {
    const statuses = ['CHƯA MUA', 'ĐÃ GÓP', 'ĐÃ MUA'];
    const selected = statuses.includes(value) ? value : 'CHƯA MUA';
    return `<select class="gold-contribution-status" aria-label="${monthLabel(month)}, trạng thái" data-month="${month}" data-contribution-id="${escapeHTML(id)}" data-contribution="status"${disabled ? ' disabled' : ''}>${statuses.map(status => `<option${status === selected ? ' selected' : ''}>${status}</option>`).join('')}</select>`;
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
        Number(purchase.quantity) > 0 &&
        (!purchase.type || ['purchase', 'withdrawal'].includes(purchase.type))
    );
    const goldDelta = purchase => purchase.type === 'withdrawal' ? -Number(purchase.quantity) : Number(purchase.quantity);
    const total = validPurchases.reduce((sum, purchase) => sum + goldDelta(purchase), 0);
    const totalPurchased = validPurchases
        .filter(purchase => purchase.type !== 'withdrawal')
        .reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
    const totalWithdrawn = validPurchases
        .filter(purchase => purchase.type === 'withdrawal')
        .reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
    $('goldTotal').textContent = formatQuantity(total);
    $('goldTotalPurchased').textContent = `Đã mua ${formatQuantity(totalPurchased)} · Đã lấy ra ${formatQuantity(totalWithdrawn)}`;
    $('goldPurchaseCount').textContent = `${validPurchases.length} giao dịch`;
    const validContributions = contributions.filter(contribution =>
        contribution &&
        typeof contribution.id === 'string' &&
        (/^\d{4}-(0[1-9]|1[0-2])$/.test(contribution.id) ||
            /^\d{4}-(0[1-9]|1[0-2])$/.test(contribution.month || '')) &&
        CONTRIBUTION_FIELDS.every(field => Number.isFinite(Number(contribution[field] || 0)) && Number(contribution[field] || 0) >= 0)
    );
    const monthPurchases = new Map();
    validPurchases.forEach(purchase => {
        const month = purchase.date.slice(0, 7);
        const totals = monthPurchases.get(month) || { purchased: 0, withdrawn: 0 };
        totals[purchase.type === 'withdrawal' ? 'withdrawn' : 'purchased'] += Number(purchase.quantity);
        monthPurchases.set(month, totals);
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const contributionMonths = validContributions.map(contribution => contribution.month || contribution.id.slice(0, 7));
    const months = [...new Set([...contributionMonths, ...monthPurchases.keys()])].sort();
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
        const movement = monthPurchases.get(month) || { purchased: 0, withdrawn: 0 };
        monthlyGoldTotal += movement.purchased - movement.withdrawn;
        const monthTransactions = validPurchases.filter(purchase => purchase.date.slice(0, 7) === month);
        const editButton = monthTransactions.length
            ? `<button class="icon-btn" type="button" title="Sửa giao dịch vàng ${monthLabel(month)}" aria-label="Sửa giao dịch vàng trong ${monthLabel(month)}" data-edit-gold-month="${month}">✎</button>`
            : '—';
        const monthlyDetails = `<details class="gold-month-details"><summary>Xem thêm</summary><div class="gold-month-details-info"><span>Đã mua trong tháng</span><strong>${formatQuantity(movement.purchased)}</strong><span>Đã lấy ra trong tháng</span><strong>${formatQuantity(movement.withdrawn)}</strong></div></details>`;
        goldMonthlyRows.push(`<tr><td>${monthLabel(month)}${monthlyDetails}</td><td class="gold-month-movement">${formatQuantity(movement.purchased)}</td><td class="gold-month-movement">${formatQuantity(movement.withdrawn)}</td><td><strong>${formatQuantity(monthlyGoldTotal)}</strong></td><td><div class="actions">${editButton}</div></td></tr>`);
        goldCursor.setMonth(goldCursor.getMonth() + 1);
    }
    $('goldMonthlyRows').innerHTML = goldMonthlyRows.join('') || '<tr><td colspan="3" class="empty">Chưa có dữ liệu vàng theo tháng.</td></tr>';
    const cursor = parseMonth(GOLD_START_MONTH);
    const finalMonth = parseMonth(latestMonth) > lastMonth ? parseMonth(latestMonth) : lastMonth;
    const contributionRows = [];
    let period = 0;
    let cumulativeTotal = 0;
    const contributionsByMonth = new Map();
    validContributions.forEach(contribution => {
        const month = contribution.month || contribution.id.slice(0, 7);
        const entries = contributionsByMonth.get(month) || [];
        entries.push(contribution);
        contributionsByMonth.set(month, entries);
    });

    while (cursor <= finalMonth) {
        const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const entries = contributionsByMonth.get(month) || [{ ...EMPTY_CONTRIBUTION, id: month }];
        const movement = monthPurchases.get(month) || { purchased: 0, withdrawn: 0 };
        entries.sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id));
        entries.forEach(contribution => {
            const id = contribution.id;
            const totalForEntry = getContributionTotal(contribution);
            cumulativeTotal += totalForEntry;
            const amountCells = CONTRIBUTION_FIELDS.map(field =>
                `<td>${formatAmountInput(contribution[field], month, field, id, !contributionsReady)}</td>`
            );
            const cashCell = `<td>${formatCalculatedCash(getContributionCash(contribution), month)}</td>`;
            const dateCell = formatDateInput(contribution.purchaseDate, month, id, !contributionsReady);
            const statusCell = formatStatusSelect(contribution.status, month, id, !contributionsReady);
            const deleteButton = contributions.some(item => item.id === id)
                ? `<button class="icon-btn delete" type="button" title="Xóa đợt góp" aria-label="Xóa đợt góp ${period + 1}" data-delete-contribution="${escapeHTML(id)}"${!contributionsReady ? ' disabled' : ''}>⌫</button>`
                : '';
            contributionRows.push(`<tr><td>${++period}</td><td>${monthLabel(month)}</td>${amountCells.slice(0, 4).join('')}${cashCell}${amountCells.slice(4).join('')}<td class="gold-contribution-total">${money(totalForEntry)}<small>Dư: ${money(cumulativeTotal)}</small></td><td>${dateCell}<small>${movement.purchased ? `Đã mua ${formatQuantity(movement.purchased)}` : ''}${movement.withdrawn ? `Đã lấy ra ${formatQuantity(movement.withdrawn)}` : ''}</small></td><td>${statusCell}</td><td><div class="actions"><button class="icon-btn" type="button" title="Thêm đợt cùng tháng" aria-label="Thêm đợt cùng tháng ${monthLabel(month)}" data-add-contribution="${month}"${!contributionsReady ? ' disabled' : ''}>＋</button>${deleteButton}</div></td></tr>`);
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    $('goldContributionTotal').textContent = money(cumulativeTotal);
    $('goldContributionRows').innerHTML = contributionRows.join('') || '<tr><td colspan="15" class="empty">Chưa có đợt tích góp.</td></tr>';
    $('goldPurchaseRows').innerHTML = validPurchases.length
        ? validPurchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map(purchase => {
            const date = purchase.date.split('-').reverse().join('/');
            const type = purchase.type === 'withdrawal' ? 'Lấy ra' : 'Mua';
            const quantity = `${purchase.type === 'withdrawal' ? '−' : '+'}${formatQuantity(purchase.quantity)}`;
            return `<tr><td>${date}</td><td>${type}</td><td>${quantity}</td><td>${escapeHTML(purchase.note || '—')}</td><td><div class="actions"><button class="icon-btn" type="button" title="Sửa giao dịch vàng" aria-label="Sửa giao dịch vàng ngày ${date}" data-edit-gold="${escapeHTML(purchase.id)}">Sửa</button><button class="icon-btn delete" type="button" title="Xóa giao dịch vàng" aria-label="Xóa giao dịch vàng" data-delete-gold="${escapeHTML(purchase.id)}">⌫</button></div></td></tr>`;
        }).join('')
        : '<tr><td colspan="5" class="empty">Chưa có giao dịch vàng.</td></tr>';
}
