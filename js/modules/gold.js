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
const FIXED_CONTRIBUTION_COLUMNS = ['month', 'actions'];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MERGED_ENTRY_PREFIX = 'entry:';

function defaultVisibleContributionColumns() {
    return new Set([...FIXED_CONTRIBUTION_COLUMNS, ...CONTRIBUTION_COLUMN_KEYS]);
}

let visibleContributionColumns = defaultVisibleContributionColumns();

let mergedContributionMonthGroups = [];

export function getVisibleContributionColumns() {
    return new Set(visibleContributionColumns);
}

export function saveVisibleContributionColumns(columns = CONTRIBUTION_COLUMN_KEYS) {
    const optionalColumns = [...new Set(columns)].filter(key => CONTRIBUTION_COLUMN_KEYS.includes(key));
    visibleContributionColumns = new Set([...FIXED_CONTRIBUTION_COLUMNS, ...optionalColumns]);
}

export function getMergedContributionMonthGroups() {
    return mergedContributionMonthGroups.map(group => [...group]);
}

export function saveMergedContributionMonthGroups(groups) {
    const usedTokens = new Set();
    const normalizedGroups = groups.map(group => {
        if (!Array.isArray(group) || group.length < 2) throw new Error('Mỗi nhóm cần có ít nhất hai đợt.');
        const tokens = [...new Set(group)].sort();
        const kinds = new Set(tokens.map(token => {
            if (typeof token !== 'string') return 'invalid';
            if (MONTH_PATTERN.test(token)) return 'month';
            if (token.startsWith(MERGED_ENTRY_PREFIX) && token.length > MERGED_ENTRY_PREFIX.length) return 'entry';
            return 'invalid';
        }));
        if (tokens.length !== group.length || kinds.size !== 1 || kinds.has('invalid') ||
            tokens.some(token => usedTokens.has(token))) {
            throw new Error('Không thể gộp tháng hoặc đợt không hợp lệ, hay đã nằm trong nhóm khác.');
        }
        tokens.forEach(token => usedTokens.add(token));
        return tokens;
    });
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
    $('goldContributionCards').querySelectorAll('[data-column]').forEach(cell => {
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
    const tools = table.closest('.gold-fund-section')?.querySelector('.gold-section-tools');
    if (tools) {
        if (isDesktop) tools.style.setProperty('--gold-contribution-table-width', `${tableWidth}px`);
        else tools.style.removeProperty('--gold-contribution-table-width');
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

function formatMergedDateInput(value, groupTokens, groupLabel, disabled) {
    const date = typeof value === 'string' && dateKey(new Date(`${value}T12:00:00`)) === value ? value : '';
    return `<input class="gold-contribution-date" type="date" aria-label="Ngày mua dùng chung cho ${escapeHTML(groupLabel)}" data-merged-group="${escapeHTML(JSON.stringify(groupTokens))}" data-contribution="purchaseDate" value="${date}"${disabled ? ' disabled' : ''}>`;
}

function formatMergedStatusSelect(value, groupTokens, groupLabel, disabled, mixed) {
    const commonOption = mixed ? '<option value="" selected disabled>Khác nhau</option>' : '';
    const statusOptions = CONTRIBUTION_STATUSES.map(status => `<option${status === value ? ' selected' : ''}>${status}</option>`).join('');
    return `<select class="gold-contribution-status" aria-label="Trạng thái dùng chung cho ${escapeHTML(groupLabel)}" data-merged-group="${escapeHTML(JSON.stringify(groupTokens))}" data-contribution="status"${disabled ? ' disabled' : ''}>${commonOption}${statusOptions}</select>`;
}

function renderPlainContributionRow(contributionRow) {
    return contributionRow.row
        .replace(' data-group-total-placeholder', '')
        .replace(' data-group-date-placeholder', '')
        .replace(' data-group-status-placeholder', '')
        .replace(' data-group-actions-placeholder', '');
}

function renderMergedContributionRows(contributionRows, groupTokens, monthPurchases, contributionsReady) {
    const orderedRows = contributionRows.slice().sort((a, b) =>
        b.month.localeCompare(a.month) || b.order - a.order || b.id.localeCompare(a.id)
    );
    if (orderedRows.length < 2) return orderedRows.map(renderPlainContributionRow);

    const chronologicalRows = contributionRows.slice().sort((a, b) =>
        a.month.localeCompare(b.month) || a.order - b.order || a.id.localeCompare(b.id)
    );
    const groupTotal = orderedRows.reduce((total, row) => total + row.total, 0);
    const cumulativeTotal = chronologicalRows[chronologicalRows.length - 1].cumulativeTotal;
    const groupEntries = orderedRows.map(row => row.contribution);
    const groupLabel = orderedRows
        .map(row => `${compactMonthLabel(row.month)} · Đợt ${row.order}`)
        .join(', ');
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
    const groupMovement = [...new Set(orderedRows.map(row => row.month))]
        .reduce((totals, month) => {
            const movement = monthPurchases.get(month) || { purchased: 0, withdrawn: 0 };
            totals.purchased += movement.purchased;
            totals.withdrawn += movement.withdrawn;
            return totals;
        }, { purchased: 0, withdrawn: 0 });
    const movementNotes = [
        groupMovement.purchased ? `Đã mua ${formatQuantity(groupMovement.purchased)}` : '',
        groupMovement.withdrawn ? `Đã lấy ra ${formatQuantity(groupMovement.withdrawn)}` : ''
    ].filter(Boolean).join(' · ');
    const mergedDateCell = `<td class="gold-merged-shared-cell" data-column="purchaseDate" rowspan="${orderedRows.length}">${formatMergedDateInput(sharedDate, groupTokens, groupLabel, !contributionsReady)}${mixedDate ? '<small class="gold-merged-value-note">Ngày mua khác nhau</small>' : ''}${movementNotes ? `<small>${movementNotes}</small>` : ''}</td>`;
    const mergedStatusCell = `<td class="gold-merged-shared-cell" data-column="status" rowspan="${orderedRows.length}">${formatMergedStatusSelect(sharedStatus, groupTokens, groupLabel, !contributionsReady, mixedStatus)}</td>`;
    const mergedActions = orderedRows.map(({ month, order, row }) => {
        const actionContent = row.match(/<td data-column="actions" data-group-actions-placeholder>([\s\S]*?)<\/td>/)?.[1] || '';
        return `<div class="gold-merged-action-item" title="${escapeHTML(`${compactMonthLabel(month)} · Đợt ${order}`)}">${actionContent}</div>`;
    }).join('');
    const mergedActionsCell = `<td data-column="actions" class="gold-merged-actions-cell" rowspan="${orderedRows.length}"><div class="gold-merged-actions">${mergedActions}</div></td>`;

    return orderedRows.map(({ row }, index) => {
        const totalCell = index === 0
            ? renderMergedTotalCell(groupTotal, cumulativeTotal, orderedRows.length)
            : '';
        return row
            .replace(/<td class="gold-contribution-total" data-column="total" data-group-total-placeholder>[\s\S]*?<\/td>/, totalCell)
            .replace(/<td data-column="purchaseDate" data-group-date-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedDateCell : '')
            .replace(/<td data-column="status" data-group-status-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedStatusCell : '')
            .replace(/<td data-column="actions" data-group-actions-placeholder>[\s\S]*?<\/td>/, index === 0 ? mergedActionsCell : '');
    });
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

function renderMobileContributionCard(contributionRow, monthPurchases, contributionsReady, groupRows, groupTokens) {
    const { id, month, order, contribution, total, cumulativeTotal, row } = contributionRow;
    const disabled = !contributionsReady;
    const fields = [
        ['Thanh Hòa', 'thanhHoaKpi', 'KPI'],
        ['Thanh Hòa', 'thanhHoaSalary', 'Lương'],
        ['Ngọc Yến', 'ngocYenKpi', 'KPI'],
        ['Ngọc Yến', 'ngocYenSalary', 'Lương']
    ];
    const personFields = person => fields
        .filter(([name]) => name === person)
        .map(([, field, label]) => `<label class="gold-contribution-card-field" data-column="${field}"><span>${label}</span>${formatAmountInput(contribution[field], month, field, id, disabled)}</label>`)
        .join('');
    const groupedRows = groupRows || [contributionRow];
    const tokens = groupTokens || [];
    const groupLabel = groupedRows.map(item => `${compactMonthLabel(item.month)} · Đợt ${item.order}`).join(', ');
    const groupContributions = groupedRows.map(item => item.contribution);
    const groupDates = groupContributions.map(item =>
        typeof item.purchaseDate === 'string' &&
            dateKey(new Date(`${item.purchaseDate}T12:00:00`)) === item.purchaseDate
            ? item.purchaseDate
            : ''
    );
    const uniqueDates = [...new Set(groupDates)];
    const groupStatuses = groupContributions.map(item =>
        CONTRIBUTION_STATUSES.includes(item.status) ? item.status : 'CHƯA MUA'
    );
    const uniqueStatuses = [...new Set(groupStatuses)];
    const installmentLabel = row.match(/<small>Đợt (\d+)<\/small>/)?.[0] || '';
    const movement = monthPurchases.get(month) || { purchased: 0, withdrawn: 0 };
    const movementNotes = [
        movement.purchased ? `Đã mua ${formatQuantity(movement.purchased)}` : '',
        movement.withdrawn ? `Đã lấy ra ${formatQuantity(movement.withdrawn)}` : ''
    ].filter(Boolean).join(' · ');
    const dateInput = groupTokens
        ? formatMergedDateInput(uniqueDates.length > 1 ? '' : uniqueDates[0], tokens, groupLabel, disabled)
        : formatDateInput(contribution.purchaseDate, month, id, disabled);
    const statusInput = groupTokens
        ? formatMergedStatusSelect(uniqueStatuses.length > 1 ? '' : uniqueStatuses[0], tokens, groupLabel, disabled, uniqueStatuses.length > 1)
        : formatStatusSelect(contribution.status, month, id, disabled);
    const actions = row.match(/<td data-column="actions" data-group-actions-placeholder>([\s\S]*?)<\/td>/)?.[1] || '';
    const amountFields = [
        ['fund', 'Quỹ'],
        ['pig', 'Heo'],
        ['extra', 'Bù'],
        ['debt', 'Nợ']
    ].map(([field, label]) => `<label class="gold-contribution-card-field" data-column="${field}"><span>${label}</span>${formatAmountInput(contribution[field], month, field, id, disabled)}</label>`).join('');

    return `<article class="gold-contribution-card" data-contribution-id="${escapeHTML(id)}" data-contribution-existing="${Boolean(row.match(/data-contribution-existing="true"/))}" data-contribution-month="${month}" data-contribution-order="${order}">
      <header class="gold-contribution-card-header" data-column="month">
        <strong>${compactMonthLabel(month)}${installmentLabel}</strong>
        <div class="actions" data-column="actions">${actions.replace(/^<div class="actions">|<\/div>$/g, '')}</div>
      </header>
      <section class="gold-contribution-card-person">
        <h3>Thanh Hòa</h3>
        <div>${personFields('Thanh Hòa')}</div>
      </section>
      <section class="gold-contribution-card-person">
        <h3>Ngọc Yến</h3>
        <div>${personFields('Ngọc Yến')}</div>
      </section>
      <div class="gold-contribution-card-total" data-column="total">
        <span>Tổng tiền</span>
        <strong>${money(total)}</strong>
        <small>Dư lũy kế: ${money(cumulativeTotal)}</small>
      </div>
      <details class="gold-contribution-card-more">
        <summary>Khoản khác và trạng thái</summary>
        <div class="gold-contribution-card-extra">
          <section class="gold-contribution-card-money">
            <label class="gold-contribution-card-field" data-column="cash"><span>Tiền</span>${formatCalculatedCash(getContributionCash(contribution), month)}</label>
            ${amountFields}
          </section>
          <div class="gold-contribution-card-meta">
            <label class="gold-contribution-card-field" data-column="purchaseDate"><span>Ngày mua</span>${dateInput}${movementNotes ? `<small>${movementNotes}</small>` : ''}</label>
            <label class="gold-contribution-card-field" data-column="status"><span>Trạng thái</span>${statusInput}</label>
          </div>
        </div>
      </details>
    </article>`;
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
    const contributionRowsById = new Map();
    const contributionAdjustmentRows = [];
    let cumulativeTotal = 0;
    const contributionsByMonth = new Map();
    const mergedGroupsByMonth = new Map();
    const mergedGroupsByEntryId = new Map();
    mergedContributionMonthGroups.forEach(group => {
        if (group.every(token => MONTH_PATTERN.test(token))) {
            group.forEach(month => mergedGroupsByMonth.set(month, group));
        } else {
            group.forEach(token => mergedGroupsByEntryId.set(token.slice(MERGED_ENTRY_PREFIX.length), group));
        }
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
        entries.sort((a, b) => Number(b.order || 0) - Number(a.order || 0) || b.id.localeCompare(a.id));
        const totalsById = new Map();
        let monthCumulativeTotal = cumulativeTotal;
        entries.slice().reverse().forEach(contribution => {
            const adjustments = getValidContributionAdjustments(contribution, today);
            const total = getContributionTotal(contribution, adjustments);
            monthCumulativeTotal += total;
            totalsById.set(contribution.id, {
                adjustments,
                total,
                cumulativeTotal: monthCumulativeTotal
            });
        });
        cumulativeTotal = monthCumulativeTotal;
        entries.forEach((contribution, index) => {
            const id = contribution.id;
            const order = entries.length - index;
            const { adjustments, total: totalForEntry, cumulativeTotal: entryCumulativeTotal } = totalsById.get(id);
            adjustments.forEach(adjustment => {
                const date = adjustment.date.split('-').reverse().join('/');
                const amount = `${adjustment.type === 'subtract' ? '−' : '+'}${money(adjustment.amount)}`;
                const type = adjustment.type === 'subtract' ? 'Trừ' : 'Cộng';
                const actionButtons = `<div class="actions"><button class="icon-btn" type="button" title="Sửa điều chỉnh" aria-label="Sửa điều chỉnh ${type.toLowerCase()} ${money(adjustment.amount)} ngày ${date}" data-edit-contribution-adjustment="${escapeHTML(id)}" data-adjustment-id="${escapeHTML(adjustment.id)}"${!contributionsReady ? ' disabled' : ''}>✎</button><button class="icon-btn delete" type="button" title="Xóa điều chỉnh" aria-label="Xóa điều chỉnh ${type.toLowerCase()} ${money(adjustment.amount)} ngày ${date}" data-delete-contribution-adjustment="${escapeHTML(id)}" data-adjustment-id="${escapeHTML(adjustment.id)}"${!contributionsReady ? ' disabled' : ''}>⌫</button></div>`;
                contributionAdjustmentRows.push({
                    date: adjustment.date,
                    html: `<tr><td>${date}</td><td>${compactMonthLabel(month)} · Đợt ${order}</td><td>${type}</td><td>${escapeHTML(adjustment.note)}</td><td class="gold-adjustment-amount ${adjustment.type}">${amount}</td><td>${actionButtons}</td></tr>`,
                    cardHtml: `<article class="gold-adjustment-card"><header><strong>${date}</strong>${actionButtons}</header><div class="gold-adjustment-card-summary"><span class="gold-adjustment-type ${adjustment.type}">${type}</span><strong class="gold-adjustment-amount ${adjustment.type}">${amount}</strong></div><div class="gold-adjustment-card-period">${compactMonthLabel(month)} · Đợt ${order}</div><p>${escapeHTML(adjustment.note) || '—'}</p></article>`
                });
            });
            const amountCells = CONTRIBUTION_FIELDS.map(field =>
                `<td data-column="${field}">${formatAmountInput(contribution[field], month, field, id, !contributionsReady)}</td>`
            );
            const cashCell = `<td data-column="cash">${formatCalculatedCash(getContributionCash(contribution), month)}</td>`;
            const dateCell = formatDateInput(contribution.purchaseDate, month, id, !contributionsReady);
            const statusCell = formatStatusSelect(contribution.status, month, id, !contributionsReady);
            const contributionExists = contributions.some(item => item.id === id);
            const deleteButton = contributionExists
                ? `<button class="icon-btn delete" type="button" title="Xóa đợt góp" aria-label="Xóa đợt góp tháng ${monthLabel(month)}, đợt ${order}" data-delete-contribution="${escapeHTML(id)}"${!contributionsReady ? ' disabled' : ''}>⌫</button>`
                : '';
            const adjustmentButton = `<button class="icon-btn" type="button" title="Thêm khoản điều chỉnh" aria-label="Thêm khoản điều chỉnh cho ${monthLabel(month)}" data-add-contribution-adjustment="${escapeHTML(id)}"${!contributionsReady ? ' disabled' : ''}>±</button>`;
            const installmentLabel = entries.length > 1 ? `<small>Đợt ${order}</small>` : '';
            const row = `<tr data-contribution-id="${escapeHTML(id)}" data-contribution-existing="${contributionExists}" data-contribution-month="${month}" data-contribution-order="${order}"><td data-column="month">${compactMonthLabel(month)}${installmentLabel}</td>${amountCells.slice(0, 4).join('')}${cashCell}${amountCells.slice(4).join('')}<td class="gold-contribution-total" data-column="total" data-group-total-placeholder>${money(totalForEntry)}<small>Dư: ${money(entryCumulativeTotal)}</small></td><td data-column="purchaseDate" data-group-date-placeholder>${dateCell}<small>${movement.purchased ? `Đã mua ${formatQuantity(movement.purchased)}` : ''}${movement.withdrawn ? `Đã lấy ra ${formatQuantity(movement.withdrawn)}` : ''}</small></td><td data-column="status" data-group-status-placeholder>${statusCell}</td><td data-column="actions" data-group-actions-placeholder><div class="actions"><button class="icon-btn" type="button" title="Thêm đợt cùng tháng" aria-label="Thêm đợt cùng tháng ${monthLabel(month)}" data-add-contribution="${month}"${!contributionsReady ? ' disabled' : ''}>＋</button>${adjustmentButton}${deleteButton}</div></td></tr>`;
            const contributionRow = {
                id,
                month,
                order,
                row,
                total: totalForEntry,
                cumulativeTotal: entryCumulativeTotal,
                contribution
            };
            monthRows.push(contributionRow);
            contributionRowsById.set(id, contributionRow);
        });
        contributionMonthRows.set(month, monthRows);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const renderedContributionRows = [];
    const renderedContributionCards = [];
    const renderedGroups = new Set();
    [...contributionMonthRows.keys()].sort().reverse().forEach(month => {
        const monthGroup = mergedGroupsByMonth.get(month);
        if (monthGroup) {
            const groupKey = JSON.stringify(monthGroup);
            if (renderedGroups.has(groupKey)) return;
            renderedGroups.add(groupKey);
            const groupRows = monthGroup.slice().reverse().flatMap(groupMonth =>
                contributionMonthRows.get(groupMonth) || []
            );
            renderedContributionRows.push(...renderMergedContributionRows(groupRows, monthGroup, monthPurchases, contributionsReady));
            renderedContributionCards.push(...groupRows.map(row =>
                renderMobileContributionCard(row, monthPurchases, contributionsReady, groupRows, monthGroup)
            ));
            return;
        }

        contributionMonthRows.get(month).forEach(row => {
            const entryGroup = mergedGroupsByEntryId.get(row.id);
            if (!entryGroup) {
                renderedContributionRows.push(renderPlainContributionRow(row));
                renderedContributionCards.push(renderMobileContributionCard(row, monthPurchases, contributionsReady));
                return;
            }
            const groupKey = JSON.stringify(entryGroup);
            if (renderedGroups.has(groupKey)) return;
            renderedGroups.add(groupKey);
            const groupRows = entryGroup
                .map(token => contributionRowsById.get(token.slice(MERGED_ENTRY_PREFIX.length)))
                .filter(Boolean);
            renderedContributionRows.push(...renderMergedContributionRows(groupRows, entryGroup, monthPurchases, contributionsReady));
            renderedContributionCards.push(...groupRows.map(groupRow =>
                renderMobileContributionCard(groupRow, monthPurchases, contributionsReady, groupRows, entryGroup)
            ));
        });
    });

    $('goldContributionTotal').textContent = money(cumulativeTotal);
    $('goldContributionRows').innerHTML = renderedContributionRows.join('') || '<tr><td colspan="14" class="empty">Chưa có đợt tích góp.</td></tr>';
    const contributionCards = $('goldContributionCards');
    const expandedCardIds = new Set([...contributionCards.querySelectorAll('.gold-contribution-card')]
        .filter(card => card.querySelector('.gold-contribution-card-more[open]'))
        .map(card => card.dataset.contributionId));
    contributionCards.innerHTML = renderedContributionCards.join('');
    contributionCards.querySelectorAll('.gold-contribution-card').forEach(card => {
        if (expandedCardIds.has(card.dataset.contributionId)) {
            card.querySelector('.gold-contribution-card-more').open = true;
        }
    });
    const sortedAdjustmentRows = contributionAdjustmentRows.sort((a, b) => b.date.localeCompare(a.date));
    $('goldContributionAdjustmentRows').innerHTML = sortedAdjustmentRows
        .map(row => row.html)
        .join('') || '<tr><td colspan="6" class="empty">Chưa có khoản điều chỉnh.</td></tr>';
    $('goldContributionAdjustmentCards').innerHTML = sortedAdjustmentRows
        .map(row => row.cardHtml)
        .join('') || '<p class="empty">Chưa có khoản điều chỉnh.</p>';
    applyContributionColumnVisibility();
    const renderedPurchases = validPurchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map(purchase => {
            const date = purchase.date.split('-').reverse().join('/');
            const type = purchase.type === 'withdrawal' ? 'Lấy ra' : 'Mua';
            const quantity = `${purchase.type === 'withdrawal' ? '−' : '+'}${formatQuantity(purchase.quantity)}`;
            const note = escapeHTML(purchase.note || '');
            const displayNote = note || '—';
            const actions = `<div class="actions"><button class="icon-btn" type="button" title="Sửa giao dịch vàng" aria-label="Sửa giao dịch vàng ngày ${date}" data-edit-gold="${escapeHTML(purchase.id)}">Sửa</button><button class="icon-btn delete" type="button" title="Xóa giao dịch vàng" aria-label="Xóa giao dịch vàng" data-delete-gold="${escapeHTML(purchase.id)}">⌫</button></div>`;
            return {
                row: `<tr><td>${date}</td><td>${type}</td><td>${quantity}</td><td>${displayNote}</td><td>${actions}</td></tr>`,
                card: `<article class="gold-purchase-card"><header><strong>${date}</strong>${actions}</header><div class="gold-purchase-card-summary"><span class="gold-purchase-type ${purchase.type === 'withdrawal' ? 'withdrawal' : 'purchase'}">${type}</span><strong class="${purchase.type === 'withdrawal' ? 'withdrawal' : 'purchase'}">${quantity}</strong></div>${note ? `<p>${note}</p>` : ''}</article>`
            };
        });
    $('goldPurchaseRows').innerHTML = renderedPurchases.map(purchase => purchase.row).join('')
        || '<tr><td colspan="5" class="empty">Chưa có giao dịch vàng.</td></tr>';
    $('goldPurchaseCards').innerHTML = renderedPurchases.map(purchase => purchase.card).join('')
        || '<p class="empty">Chưa có giao dịch vàng.</p>';
}
