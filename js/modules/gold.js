import { $, dateKey, escapeHTML, money } from './data.js';

function formatQuantity(quantity) {
    return `${Number(quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} chỉ`;
}

const CONTRIBUTION_FIELDS = [
    'thanhHoaKpi', 'thanhHoaSalary',
    'ngocYenKpi', 'ngocYenSalary',
    'fund', 'pig', 'extra', 'debt'
];
const CONTRIBUTION_STATUSES = ['CHƯA MUA', 'ĐÃ GÓP', 'ĐÃ MUA'];
const CONTRIBUTION_COLUMN_KEYS = [
    'thanhHoaKpi', 'thanhHoaSalary', 'ngocYenKpi', 'ngocYenSalary',
    'cash', 'fund', 'pig', 'extra', 'debt', 'total', 'purchaseDate', 'status'
];
const CONTRIBUTION_COLUMN_WIDTHS = {
    month: 60,
    thanhHoaKpi: 63,
    thanhHoaSalary: 63,
    ngocYenKpi: 63,
    ngocYenSalary: 63,
    cash: 63,
    fund: 63,
    pig: 63,
    extra: 63,
    debt: 63,
    total: 96,
    purchaseDate: 110,
    status: 90,
    actions: 80
};
const CONTRIBUTION_COLUMN_GROUPS = {
    thanhHoa: ['thanhHoaKpi', 'thanhHoaSalary'],
    ngocYen: ['ngocYenKpi', 'ngocYenSalary']
};
const CONTRIBUTION_COLUMN_STORAGE_KEY = 'giadinh_gold_contribution_columns';
const MERGED_MONTH_GROUPS_STORAGE_KEY = 'giadinh_gold_merged_month_groups';
const FIXED_CONTRIBUTION_COLUMNS = ['month', 'actions'];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function loadVisibleContributionColumns() {
    try {
        const saved = JSON.parse(localStorage.getItem(CONTRIBUTION_COLUMN_STORAGE_KEY) || 'null');
        const optionalColumns = Array.isArray(saved)
            ? saved.filter(key => CONTRIBUTION_COLUMN_KEYS.includes(key))
            : CONTRIBUTION_COLUMN_KEYS;
        return new Set([...FIXED_CONTRIBUTION_COLUMNS, ...optionalColumns]);
    } catch (error) {
        console.error('Không thể tải tùy chọn cột tích góp:', error);
        return new Set([...FIXED_CONTRIBUTION_COLUMNS, ...CONTRIBUTION_COLUMN_KEYS]);
    }
}

let visibleContributionColumns = loadVisibleContributionColumns();

function loadMergedContributionMonthGroups() {
    try {
        const saved = JSON.parse(localStorage.getItem(MERGED_MONTH_GROUPS_STORAGE_KEY) || '[]');
        if (!Array.isArray(saved)) return [];
        const usedMonths = new Set();
        return saved.reduce((groups, group) => {
            if (!Array.isArray(group)) return groups;
            const months = [...new Set(group.filter(month => typeof month === 'string' && MONTH_PATTERN.test(month)))].sort();
            if (months.length < 2 || months.some(month => usedMonths.has(month))) return groups;
            months.forEach(month => usedMonths.add(month));
            groups.push(months);
            return groups;
        }, []);
    } catch (error) {
        console.error('Không thể tải nhóm tháng đã gộp:', error);
        return [];
    }
}

let mergedContributionMonthGroups = loadMergedContributionMonthGroups();

export function getVisibleContributionColumns() {
    return new Set(visibleContributionColumns);
}

export function saveVisibleContributionColumns(columns) {
    const optionalColumns = [...new Set(columns)].filter(key => CONTRIBUTION_COLUMN_KEYS.includes(key));
    localStorage.setItem(CONTRIBUTION_COLUMN_STORAGE_KEY, JSON.stringify(optionalColumns));
    visibleContributionColumns = new Set([...FIXED_CONTRIBUTION_COLUMNS, ...optionalColumns]);
}

export function getMergedContributionMonthGroups() {
    return mergedContributionMonthGroups.map(group => [...group]);
}

export function saveMergedContributionMonthGroups(groups) {
    const usedMonths = new Set();
    const normalizedGroups = groups.map(group => {
        if (!Array.isArray(group) || group.length < 2) throw new Error('Mỗi nhóm cần có ít nhất hai tháng.');
        const months = [...new Set(group)].sort();
        if (months.length !== group.length || months.some(month =>
            typeof month !== 'string' || !MONTH_PATTERN.test(month) || usedMonths.has(month)
        )) {
            throw new Error('Không thể gộp tháng không hợp lệ hoặc đã nằm trong nhóm khác.');
        }
        months.forEach(month => usedMonths.add(month));
        return months;
    });
    localStorage.setItem(MERGED_MONTH_GROUPS_STORAGE_KEY, JSON.stringify(normalizedGroups));
    mergedContributionMonthGroups = normalizedGroups;
}

function applyContributionColumnVisibility() {
    const table = $('goldContributionTable');
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    let tableWidth = 0;
    table.querySelectorAll('col[data-column]').forEach(column => {
        const key = column.dataset.column;
        const visible = visibleContributionColumns.has(key);
        column.hidden = !visible;
        if (isDesktop) {
            const width = CONTRIBUTION_COLUMN_WIDTHS[key];
            column.style.width = `${width}px`;
            if (visible) tableWidth += width;
        } else {
            column.style.removeProperty('width');
        }
    });
    table.querySelectorAll('[data-column]').forEach(cell => {
        cell.hidden = !visibleContributionColumns.has(cell.dataset.column);
    });
    Object.entries(CONTRIBUTION_COLUMN_GROUPS).forEach(([group, columns]) => {
        const heading = table.querySelector(`[data-column-group="${group}"]`);
        heading.colSpan = columns.filter(key => visibleContributionColumns.has(key)).length;
        heading.hidden = heading.colSpan === 0;
    });
    const emptyCell = table.querySelector('tbody .empty');
    if (emptyCell) emptyCell.colSpan = visibleContributionColumns.size;

    if (isDesktop) {
        table.style.width = `${tableWidth}px`;
        table.style.minWidth = `${tableWidth}px`;
    } else {
        table.style.removeProperty('width');
        table.style.removeProperty('min-width');
    }
}

window.matchMedia('(min-width: 900px)').addEventListener('change', applyContributionColumnVisibility);
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

function compactMonthLabel(month) {
    return `${month.slice(5, 7)}/${month.slice(0, 4)}`;
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
    const selected = CONTRIBUTION_STATUSES.includes(value) ? value : 'CHƯA MUA';
    return `<select class="gold-contribution-status" aria-label="${monthLabel(month)}, trạng thái" data-month="${month}" data-contribution-id="${escapeHTML(id)}" data-contribution="status"${disabled ? ' disabled' : ''}>${CONTRIBUTION_STATUSES.map(status => `<option${status === selected ? ' selected' : ''}>${status}</option>`).join('')}</select>`;
}

function formatMergedDateInput(value, months, disabled) {
    const date = typeof value === 'string' && dateKey(new Date(`${value}T12:00:00`)) === value ? value : '';
    const monthLabels = months.map(compactMonthLabel).join(', ');
    return `<input class="gold-contribution-date" type="date" aria-label="Ngày mua dùng chung cho ${escapeHTML(monthLabels)}" data-merged-group="${escapeHTML(months.join('|'))}" data-contribution="purchaseDate" value="${date}"${disabled ? ' disabled' : ''}>`;
}

function formatMergedStatusSelect(value, months, disabled, mixed) {
    const monthLabels = months.map(compactMonthLabel).join(', ');
    const commonOption = mixed ? '<option value="" selected disabled>Khác nhau</option>' : '';
    const statusOptions = CONTRIBUTION_STATUSES.map(status => `<option${status === value ? ' selected' : ''}>${status}</option>`).join('');
    return `<select class="gold-contribution-status" aria-label="Trạng thái dùng chung cho ${escapeHTML(monthLabels)}" data-merged-group="${escapeHTML(months.join('|'))}" data-contribution="status"${disabled ? ' disabled' : ''}>${commonOption}${statusOptions}</select>`;
}

function getContributionTotal(contribution, adjustments = getValidContributionAdjustments(contribution)) {
    const baseTotal = getContributionCash(contribution) +
        Number(contribution.fund || 0) +
        Number(contribution.pig || 0) +
        Number(contribution.extra || 0) -
        Number(contribution.debt || 0);
    return baseTotal + adjustments.reduce((total, adjustment) =>
        total + (adjustment.type === 'add' ? adjustment.amount : -adjustment.amount), 0);
}

function getValidContributionAdjustments(contribution, today = dateKey(new Date())) {
    return Array.isArray(contribution.adjustments)
        ? contribution.adjustments.filter(adjustment =>
            adjustment &&
            typeof adjustment.id === 'string' &&
            adjustment.id.length > 0 &&
            ['add', 'subtract'].includes(adjustment.type) &&
            Number.isSafeInteger(adjustment.amount) &&
            adjustment.amount > 0 &&
            typeof adjustment.date === 'string' &&
            adjustment.date <= today &&
            dateKey(new Date(`${adjustment.date}T12:00:00`)) === adjustment.date &&
            typeof adjustment.note === 'string'
        )
        : [];
}

function getContributionCash(contribution) {
    const kpiAndSalary = Number(contribution.thanhHoaKpi || 0) +
        Number(contribution.thanhHoaSalary || 0) +
        Number(contribution.ngocYenKpi || 0) +
        Number(contribution.ngocYenSalary || 0);
    return kpiAndSalary || Number(contribution.cash || 0);
}

function renderMergedTotalCell(total, cumulativeTotal, rowCount) {
    return `<td class="gold-contribution-total gold-merged-total-cell" data-column="total" rowspan="${rowCount}">${money(total)}<small>Dư: ${money(cumulativeTotal)}</small></td>`;
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
    $('goldMonthlyRows').innerHTML = goldMonthlyRows.reverse().join('') || '<tr><td colspan="3" class="empty">Chưa có dữ liệu vàng theo tháng.</td></tr>';
    const cursor = parseMonth(GOLD_START_MONTH);
    const finalMonth = parseMonth(latestMonth) > lastMonth ? parseMonth(latestMonth) : lastMonth;
    const contributionMonthRows = new Map();
    const contributionAdjustmentRows = [];
    const contributionTotalsByMonth = new Map();
    const cumulativeTotalsByMonth = new Map();
    let period = 0;
    let cumulativeTotal = 0;
    const contributionsByMonth = new Map();
    const mergedGroupsByMonth = new Map();
    mergedContributionMonthGroups.forEach(group => {
        group.forEach(month => mergedGroupsByMonth.set(month, group));
    });
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
        const monthRows = [];
        const monthTotals = Object.fromEntries([...CONTRIBUTION_FIELDS, 'cash', 'total'].map(field => [field, 0]));
        entries.sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id));
        entries.forEach(contribution => {
            const id = contribution.id;
            const contributionNumber = ++period;
            const adjustments = getValidContributionAdjustments(contribution, today);
            const totalForEntry = getContributionTotal(contribution, adjustments);
            cumulativeTotal += totalForEntry;
            CONTRIBUTION_FIELDS.forEach(field => {
                monthTotals[field] += Number(contribution[field] || 0);
            });
            monthTotals.cash += getContributionCash(contribution);
            monthTotals.total += totalForEntry;
            adjustments.forEach(adjustment => {
                const date = adjustment.date.split('-').reverse().join('/');
                const amount = `${adjustment.type === 'subtract' ? '−' : '+'}${money(adjustment.amount)}`;
                const type = adjustment.type === 'subtract' ? 'Trừ' : 'Cộng';
                contributionAdjustmentRows.push({
                    date: adjustment.date,
                    html: `<tr><td>${date}</td><td>${compactMonthLabel(month)} · Đợt ${Number(contribution.order) || 1}</td><td>${type}</td><td>${escapeHTML(adjustment.note)}</td><td class="gold-adjustment-amount ${adjustment.type}">${amount}</td><td><div class="actions"><button class="icon-btn" type="button" title="Sửa điều chỉnh" aria-label="Sửa điều chỉnh ${type.toLowerCase()} ${money(adjustment.amount)} ngày ${date}" data-edit-contribution-adjustment="${escapeHTML(id)}" data-adjustment-id="${escapeHTML(adjustment.id)}"${!contributionsReady ? ' disabled' : ''}>✎</button><button class="icon-btn delete" type="button" title="Xóa điều chỉnh" aria-label="Xóa điều chỉnh ${type.toLowerCase()} ${money(adjustment.amount)} ngày ${date}" data-delete-contribution-adjustment="${escapeHTML(id)}" data-adjustment-id="${escapeHTML(adjustment.id)}"${!contributionsReady ? ' disabled' : ''}>⌫</button></div></td></tr>`
                });
            });
            const amountCells = CONTRIBUTION_FIELDS.map(field =>
                `<td data-column="${field}">${formatAmountInput(contribution[field], month, field, id, !contributionsReady)}</td>`
            );
            const cashCell = `<td data-column="cash">${formatCalculatedCash(getContributionCash(contribution), month)}</td>`;
            const dateCell = formatDateInput(contribution.purchaseDate, month, id, !contributionsReady);
            const statusCell = formatStatusSelect(contribution.status, month, id, !contributionsReady);
            const deleteButton = contributions.some(item => item.id === id)
                ? `<button class="icon-btn delete" type="button" title="Xóa đợt góp" aria-label="Xóa đợt góp tháng ${monthLabel(month)}, đợt ${Number(contribution.order) || 1}" data-delete-contribution="${escapeHTML(id)}"${!contributionsReady ? ' disabled' : ''}>⌫</button>`
                : '';
            const adjustmentButton = `<button class="icon-btn" type="button" title="Thêm khoản điều chỉnh" aria-label="Thêm khoản điều chỉnh cho ${monthLabel(month)}" data-add-contribution-adjustment="${escapeHTML(id)}"${!contributionsReady ? ' disabled' : ''}>±</button>`;
            monthRows.push(`<tr data-contribution-month="${month}" data-contribution-order="${Number(contribution.order) || 1}"><td data-column="month">${compactMonthLabel(month)}</td>${amountCells.slice(0, 4).join('')}${cashCell}${amountCells.slice(4).join('')}<td class="gold-contribution-total" data-column="total" data-group-total-placeholder>${money(totalForEntry)}<small>Dư: ${money(cumulativeTotal)}</small></td><td data-column="purchaseDate" data-group-date-placeholder>${dateCell}<small>${movement.purchased ? `Đã mua ${formatQuantity(movement.purchased)}` : ''}${movement.withdrawn ? `Đã lấy ra ${formatQuantity(movement.withdrawn)}` : ''}</small></td><td data-column="status" data-group-status-placeholder>${statusCell}</td><td data-column="actions" data-group-actions-placeholder><div class="actions"><button class="icon-btn" type="button" title="Thêm đợt cùng tháng" aria-label="Thêm đợt cùng tháng ${monthLabel(month)}" data-add-contribution="${month}"${!contributionsReady ? ' disabled' : ''}>＋</button>${adjustmentButton}${deleteButton}<span data-merged-ungroup-placeholder></span></div></td></tr>`);
        });
        contributionMonthRows.set(month, monthRows);
        contributionTotalsByMonth.set(month, monthTotals);
        cumulativeTotalsByMonth.set(month, cumulativeTotal);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const renderedContributionRows = [];
    [...contributionMonthRows.keys()].sort().reverse().forEach(month => {
        const group = mergedGroupsByMonth.get(month);
        if (!group) {
            renderedContributionRows.push(...contributionMonthRows.get(month).map(row =>
                row
                    .replace(' data-group-total-placeholder', '')
                    .replace(' data-group-date-placeholder', '')
                    .replace(' data-group-status-placeholder', '')
                    .replace(' data-group-actions-placeholder', '')
                    .replace('<span data-merged-ungroup-placeholder></span>', '')
            ));
            return;
        }
        if (month !== group[group.length - 1]) return;

        const groupTotals = Object.fromEntries([...CONTRIBUTION_FIELDS, 'cash', 'total'].map(field => [field, 0]));
        group.forEach(groupMonth => {
            const monthTotals = contributionTotalsByMonth.get(groupMonth);
            if (!monthTotals) return;
            Object.keys(groupTotals).forEach(field => {
                groupTotals[field] += monthTotals[field];
            });
        });
        const groupRows = group.slice().reverse().flatMap(groupMonth =>
            (contributionMonthRows.get(groupMonth) || []).map(row => ({ month: groupMonth, row }))
        );
        if (!groupRows.length) return;
        const monthLabels = group.map(compactMonthLabel).join(', ');
        const groupEntries = group.flatMap(groupMonth =>
            contributionsByMonth.get(groupMonth) || [{ ...EMPTY_CONTRIBUTION, id: groupMonth, month: groupMonth }]
        );
        const groupDates = groupEntries.map(contribution =>
            typeof contribution.purchaseDate === 'string' &&
                dateKey(new Date(`${contribution.purchaseDate}T12:00:00`)) === contribution.purchaseDate
                ? contribution.purchaseDate
                : ''
        );
        const uniqueDates = [...new Set(groupDates)];
        const mixedDate = uniqueDates.length > 1;
        const sharedDate = mixedDate ? '' : uniqueDates[0];
        const groupStatuses = groupEntries.map(contribution =>
            CONTRIBUTION_STATUSES.includes(contribution.status) ? contribution.status : 'CHƯA MUA'
        );
        const uniqueStatuses = [...new Set(groupStatuses)];
        const mixedStatus = uniqueStatuses.length > 1;
        const sharedStatus = mixedStatus ? '' : uniqueStatuses[0];
        const groupMovement = group.reduce((totals, groupMonth) => {
            const movement = monthPurchases.get(groupMonth) || { purchased: 0, withdrawn: 0 };
            totals.purchased += movement.purchased;
            totals.withdrawn += movement.withdrawn;
            return totals;
        }, { purchased: 0, withdrawn: 0 });
        const movementNotes = [
            groupMovement.purchased ? `Đã mua ${formatQuantity(groupMovement.purchased)}` : '',
            groupMovement.withdrawn ? `Đã lấy ra ${formatQuantity(groupMovement.withdrawn)}` : ''
        ].filter(Boolean).join(' · ');
        const mergedDateCell = `<td data-column="purchaseDate" rowspan="${groupRows.length}">${formatMergedDateInput(sharedDate, group, !contributionsReady)}${mixedDate ? '<small class="gold-merged-value-note">Ngày mua khác nhau</small>' : ''}${movementNotes ? `<small>${movementNotes}</small>` : ''}</td>`;
        const mergedStatusCell = `<td data-column="status" rowspan="${groupRows.length}">${formatMergedStatusSelect(sharedStatus, group, !contributionsReady, mixedStatus)}</td>`;
        const ungroupButton = `<button class="icon-btn gold-inline-ungroup" type="button" title="Bỏ gộp tháng" aria-label="Bỏ gộp các tháng ${escapeHTML(monthLabels)}" data-ungroup-months="${escapeHTML(group.join('|'))}">−</button>`;
        const mergedActions = groupRows.map(({ month: groupMonth, row }, index) => {
            const actionContent = row.match(/<td data-column="actions" data-group-actions-placeholder>([\s\S]*?)<\/td>/)?.[1] || '';
            const order = row.match(/data-contribution-order="(\d+)"/)?.[1] || '1';
            const actions = actionContent.replace(
                '<span data-merged-ungroup-placeholder></span>',
                index === 0 ? ungroupButton : ''
            );
            return `<div class="gold-merged-action-item"><small>${compactMonthLabel(groupMonth)} · Đợt ${order}</small>${actions}</div>`;
        }).join('');
        const mergedActionsCell = `<td data-column="actions" class="gold-merged-actions-cell" rowspan="${groupRows.length}"><div class="gold-merged-actions">${mergedActions}</div></td>`;
        groupRows.forEach(({ row }, index) => {
            const totalCell = index === 0
                ? renderMergedTotalCell(groupTotals.total, cumulativeTotalsByMonth.get(month) || 0, groupRows.length)
                : '';
            renderedContributionRows.push(row
                .replace(/<td class="gold-contribution-total" data-column="total" data-group-total-placeholder>[\s\S]*?<\/td>/, totalCell)
                .replace(/<td data-column="purchaseDate" data-group-date-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedDateCell : '')
                .replace(/<td data-column="status" data-group-status-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedStatusCell : '')
                .replace(/<td data-column="actions" data-group-actions-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedActionsCell : ''));
        });
    });

    $('goldContributionTotal').textContent = money(cumulativeTotal);
    $('goldContributionRows').innerHTML = renderedContributionRows.join('') || '<tr><td colspan="14" class="empty">Chưa có đợt tích góp.</td></tr>';
    $('goldContributionAdjustmentRows').innerHTML = contributionAdjustmentRows
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(row => row.html)
        .join('') || '<tr><td colspan="6" class="empty">Chưa có khoản điều chỉnh.</td></tr>';
    applyContributionColumnVisibility();
    $('goldPurchaseRows').innerHTML = validPurchases.length
        ? validPurchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map(purchase => {
            const date = purchase.date.split('-').reverse().join('/');
            const type = purchase.type === 'withdrawal' ? 'Lấy ra' : 'Mua';
            const quantity = `${purchase.type === 'withdrawal' ? '−' : '+'}${formatQuantity(purchase.quantity)}`;
            const note = escapeHTML(purchase.note || '—');
            const mobileDetails = `<details class="gold-purchase-details"><summary>Xem thêm</summary><div class="gold-purchase-details-info"><span>Loại</span><strong>${type}</strong><span>Ghi chú</span><strong>${note}</strong></div></details>`;
            return `<tr><td>${date}${mobileDetails}</td><td>${type}</td><td>${quantity}</td><td>${note}</td><td><div class="actions"><button class="icon-btn" type="button" title="Sửa giao dịch vàng" aria-label="Sửa giao dịch vàng ngày ${date}" data-edit-gold="${escapeHTML(purchase.id)}">Sửa</button><button class="icon-btn delete" type="button" title="Xóa giao dịch vàng" aria-label="Xóa giao dịch vàng" data-delete-gold="${escapeHTML(purchase.id)}">⌫</button></div></td></tr>`;
        }).join('')
        : '<tr><td colspan="5" class="empty">Chưa có giao dịch vàng.</td></tr>';
}
