import { $, money, escapeHTML, formatDate } from './data.js';
export function renderRows(list, { mobileDetails = false } = {}) {
    if (!list.length) return '<tr><td colspan="7" class="empty">Chưa có giao dịch. Nhấn “Thêm khoản chi” để bắt đầu.</td></tr>';
    return list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(t => {
        const isDebtPayment = t.type === 'debtPayment', personName = t.person === 'Vợ' ? 'Nọc Ín' : t.person === 'Chồng' ? 'Tks Hòe' : t.person;
        const actions = isDebtPayment
            ? `<button class="icon-btn delete" title="Xóa khoản xóa nợ" aria-label="Xóa khoản xóa nợ" data-delete="${t.id}">⌫</button>`
            : `<button class="icon-btn" title="Nhân bản giao dịch" aria-label="Nhân bản giao dịch" data-duplicate="${t.id}">⧉</button><button class="icon-btn" title="Sửa" data-edit="${t.id}">✎</button><button class="icon-btn delete" title="Xóa" data-delete="${t.id}">⌫</button>`;
        return `<tr><td>${formatDate(t.date)}</td><td><strong>${escapeHTML(t.title)}</strong>${t.note ? `<div class="eyebrow">${escapeHTML(t.note)}</div>` : ''}${mobileDetails ? `<details class="mobile-transaction-details"><summary>Xem thêm</summary><div class="mobile-transaction-info"><span>Ngày giờ</span><strong>${formatDate(t.date)}</strong><span>Danh mục</span><strong>${escapeHTML(t.category)}</strong><span>Người chi</span><strong>${escapeHTML(personName)}</strong><span>Nguồn tiền</span><strong>${escapeHTML(t.fund)}</strong>${t.note ? `<span>Ghi chú</span><strong>${escapeHTML(t.note)}</strong>` : ''}</div></details>` : ''}</td><td><span class="tag">${escapeHTML(t.category)}</span></td><td class="amount ${isDebtPayment ? 'debt-payment' : t.type === 'income' ? 'green' : 'red'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td><td><span class="person"><span class="mini-avatar">${t.person === 'Vợ' ? 'N' : 'T'}</span>${escapeHTML(personName)}</span></td><td>${escapeHTML(t.fund)}</td><td><div class="actions">${actions}</div></td></tr>`;
    }).join('');
}
export function getFilteredTransactions(transactions) {
    const month = $('reportMonth').value;
    return transactions.filter(transaction => !month || transaction.date.slice(0, 7) === month);
}
