const TRANSACTION_HEADERS = ['ID', 'Loại giao dịch', 'Ngày giờ', 'Nội dung', 'Số tiền', 'Danh mục', 'Người thực hiện', 'Nguồn tiền', 'Ghi chú', 'Ghi chú chi tiết'];

function getXLSX() {
  if (!window.XLSX) throw new Error('Không tải được thư viện Excel. Kiểm tra kết nối mạng rồi tải lại trang.');
  return window.XLSX;
}

function transactionRows(transactions) {
  return transactions.map(transaction => ({
    ID: transaction.id,
    'Loại giao dịch': transaction.type,
    'Ngày giờ': transaction.date,
    'Nội dung': transaction.title,
    'Số tiền': Number(transaction.amount),
    'Danh mục': transaction.category,
    'Người thực hiện': transaction.person,
    'Nguồn tiền': transaction.fund,
    'Ghi chú': transaction.note || '',
    'Ghi chú chi tiết': transaction.details || ''
  }));
}

function addTransactionSheet(workbook, transactions) {
  const XLSX = getXLSX();
  const sheet = XLSX.utils.json_to_sheet(transactionRows(transactions), { header: TRANSACTION_HEADERS });
  sheet['!cols'] = [18, 18, 22, 32, 14, 18, 20, 20, 28, 40].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Giao dịch');
}

export function exportMonthlyReport(transactions, reportMonth) {
  const XLSX = getXLSX();
  const workbook = XLSX.utils.book_new();
  const expenses = transactions.filter(transaction => transaction.type === 'expense');
  const incomes = transactions.filter(transaction => transaction.type === 'income');
  const totalExpense = expenses.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const totalIncome = incomes.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const totalDebtPayment = transactions.filter(transaction => transaction.type === 'debtPayment').reduce((total, transaction) => total + Number(transaction.amount), 0);
  const summary = [
    ['Tháng', reportMonth],
    ['Số giao dịch', transactions.length],
    ['Tổng thu nhập', totalIncome],
    ['Tổng chi tiêu', totalExpense],
    ['Chênh lệch', totalIncome - totalExpense],
    ['Đã thanh toán nợ', totalDebtPayment]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([['Chỉ tiêu', 'Giá trị'], ...summary]);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng hợp');
  const dailyTotals = new Map();
  transactions.forEach(transaction => {
    const date = transaction.date.slice(0, 10);
    const daily = dailyTotals.get(date) || { date, count: 0, income: 0, expense: 0, debtPayment: 0 };
    daily.count += 1;
    daily[transaction.type] += Number(transaction.amount);
    dailyTotals.set(date, daily);
  });
  const dailySheet = XLSX.utils.json_to_sheet([...dailyTotals.values()].map(day => ({
    'Ngày': day.date,
    'Số giao dịch': day.count,
    'Tổng thu nhập': day.income,
    'Tổng chi tiêu': day.expense,
    'Thanh toán nợ': day.debtPayment,
    'Chênh lệch': day.income - day.expense
  })));
  dailySheet['!cols'] = [16, 16, 20, 20, 20, 18].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Theo ngày');
  addTransactionSheet(workbook, transactions);
  XLSX.writeFile(workbook, `bao-cao-thang-${reportMonth}.xlsx`);
}

function normalizeDate(value, rowNumber) {
  let normalized;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    normalized = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    normalized = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  } else {
    const text = String(value ?? '').trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2})?)?$/);
    const localMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (isoMatch) normalized = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4] || '00'}:${isoMatch[5] || '00'}`;
    else if (localMatch) normalized = `${localMatch[3]}-${localMatch[2].padStart(2, '0')}-${localMatch[1].padStart(2, '0')}T${(localMatch[4] || '00').padStart(2, '0')}:${localMatch[5] || '00'}`;
  }
  const dateMatch = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!dateMatch) throw new Error(`Ngày giờ không hợp lệ ở dòng ${rowNumber}.`);
  const [year, month, day, hour, minute] = dateMatch.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59) {
    throw new Error(`Ngày giờ không hợp lệ ở dòng ${rowNumber}.`);
  }
  return normalized;
}

function normalizeTransaction(row, rowNumber) {
  const typeValue = String(row['Loại giao dịch'] ?? '').trim().toLowerCase();
  const type = typeValue === 'expense' || typeValue === 'chi tiêu' ? 'expense' : typeValue === 'income' || typeValue === 'thu nhập' ? 'income' : typeValue === 'debtpayment' || typeValue === 'thanh toán nợ' || typeValue === 'xóa nợ' ? 'debtPayment' : '';
  const title = String(row['Nội dung'] ?? '').trim();
  const category = String(row['Danh mục'] ?? '').trim();
  const personValue = String(row['Người thực hiện'] ?? '').trim();
  const person = personValue === 'Nọc Ín' ? 'Vợ' : personValue === 'Tks Hòe' ? 'Chồng' : personValue;
  const fund = String(row['Nguồn tiền'] ?? '').trim();
  const rawAmount = row['Số tiền'];
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? '').replace(/[^\d-]/g, ''));
  if (!type || !title || !category || !['Vợ', 'Chồng'].includes(person) || !fund || !Number.isSafeInteger(amount) || amount < 1) {
    throw new Error(`Dữ liệu không hợp lệ ở dòng ${rowNumber}. Kiểm tra loại giao dịch, nội dung, số tiền, danh mục, người thực hiện và nguồn tiền.`);
  }
  const id = String(row.ID ?? '').trim() || (crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}-${rowNumber}`);
  return {
    id,
    type,
    date: normalizeDate(row['Ngày giờ'], rowNumber),
    title,
    amount,
    category,
    person,
    fund,
    note: String(row['Ghi chú'] ?? '').trim(),
    details: String(row['Ghi chú chi tiết'] ?? '').trim()
  };
}

export async function readTransactionsFile(file) {
  const XLSX = getXLSX();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = workbook.Sheets['Giao dịch'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('File Excel không có sheet dữ liệu.');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  if (!rows.length) throw new Error('File Excel không có giao dịch để nhập.');
  const requiredHeaders = TRANSACTION_HEADERS.slice(1, 8);
  const headers = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}.`);
  return rows.map((row, index) => normalizeTransaction(row, index + 2));
}
