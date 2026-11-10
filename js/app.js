import { $, currentMonth, dateKey, loadTransactions, saveTransactions } from './modules/data.js';
import { observeAuth, login, loginWithGoogle, loginWithGoogleRedirect, completeGoogleRedirect, logout, sendPasswordReset, observeTransactions, writeTransactions } from './modules/firebase.js';
import { getDailyLimitDebtBalance, renderReports } from './modules/reports.js';
import { getFilteredTransactions, renderDailySummary } from './modules/transactions.js';
import { openModal, closeModal, fillCategories } from './modules/modal.js';
import { initNavigation } from './modules/navigation.js';
import { exportLedger, exportMonthlyReport, readTransactionsFile } from './modules/excel.js';

let transactions = loadTransactions();
let cloudReady = false;
let stopTransactionListener;

function render() {
  renderReports(transactions);
  renderDailySummary(transactions);
}

function selectLatestTransactionDay() {
  const latestTransaction = transactions.reduce((latest, transaction) =>
    !latest || transaction.date.localeCompare(latest.date) > 0 ? transaction : latest, null);
  if (latestTransaction) $('dayPicker').value = dateKey(new Date(latestTransaction.date));
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 3500);
}

function showAuthError(message) {
  $('authError').textContent = message;
  $('authError').hidden = !message;
}

function showAuthNotice(message) {
  $('authNotice').textContent = message;
  $('authNotice').hidden = !message;
}

function googleAuthErrorMessage(error) {
  const messages = {
    'auth/account-exists-with-different-credential': 'Email này đã được đăng ký bằng phương thức đăng nhập khác. Hãy đăng nhập bằng phương thức đó.',
    'auth/cancelled-popup-request': 'Một cửa sổ đăng nhập khác đang được mở. Vui lòng thử lại.',
    'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép popup cho trang này rồi thử lại.',
    'auth/popup-closed-by-user': 'Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.',
    'auth/operation-not-allowed': 'Firebase Authentication chưa bật phương thức đăng nhập bằng Google.',
    'auth/unauthorized-domain': 'Tên miền hiện tại chưa được cho phép trong Firebase Authentication.',
    'auth/network-request-failed': 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.',
    'auth/invalid-api-key': 'Cấu hình Firebase không hợp lệ. Kiểm tra API key của ứng dụng.',
    'auth/web-storage-unsupported': 'Trình duyệt đang chặn bộ nhớ cần thiết để đăng nhập. Hãy bật cookie/bộ nhớ trang web rồi thử lại.'
  };
  const message = messages[error.code] || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.';
  return error.code ? `${message} (mã lỗi: ${error.code})` : message;
}

function showApp(user) {
  $('signedInEmail').textContent = user.email || 'Đã đăng nhập';
  $('authScreen').hidden = true;
  $('appShell').hidden = false;
}

async function persist(message) {
  saveTransactions(transactions);
  render();
  if (!cloudReady) {
    toast('Firebase chưa sẵn sàng; thay đổi hiện chỉ được lưu trên thiết bị này.');
    return;
  }
  try {
    await writeTransactions(transactions);
    if (message) toast(message);
  } catch (error) {
    console.error('Không thể lưu giao dịch lên Firebase:', error);
    toast('Lưu Firebase thất bại. Dữ liệu vẫn còn trên thiết bị này; hãy kiểm tra kết nối và quyền database.');
  }
}

function deleteTransaction(id) {
  const transaction = transactions.find(item => item.id === id);
  const prompt = transaction?.type === 'debtPayment'
    ? `Xóa khoản thanh toán nợ ${new Intl.NumberFormat('vi-VN').format(transaction.amount)} ₫? Nợ lũy kế sẽ được tính lại.`
    : `Xóa giao dịch "${transaction?.title}"?`;
  if (transaction && confirm(prompt)) {
    transactions = transactions.filter(item => item.id !== id);
    void persist('Đã xóa giao dịch');
  }
}

function startTransactionSync(user) {
  stopTransactionListener?.();
  cloudReady = false;
  showApp(user);
  render();
  let firstSnapshot = true;
  stopTransactionListener = observeTransactions(async remoteTransactions => {
    if (firstSnapshot) {
      firstSnapshot = false;
      if (remoteTransactions === null) {
        const localTransactions = loadTransactions();
        if (localTransactions.length && confirm(`Tìm thấy ${localTransactions.length} giao dịch cũ trên thiết bị này. Tải những giao dịch đó lên Firebase để dùng chung?`)) {
          transactions = localTransactions;
          showApp(user);
          selectLatestTransactionDay();
          render();
          cloudReady = true;
          await persist('Đã chuyển dữ liệu cũ lên Firebase');
          return;
        }
        transactions = [];
      } else {
        transactions = remoteTransactions;
        saveTransactions(transactions);
      }
      selectLatestTransactionDay();
      cloudReady = true;
      showApp(user);
      render();
      return;
    }

    transactions = remoteTransactions || [];
    saveTransactions(transactions);
    render();
  }, error => {
    cloudReady = false;
    console.error('Không thể đồng bộ Firebase Realtime Database:', error);
    const message = error.code === 'PERMISSION_DENIED'
      ? 'Đã đăng nhập nhưng Firebase từ chối quyền đọc dữ liệu. Kiểm tra Realtime Database Rules đã Publish và cho phép người dùng đăng nhập.'
      : 'Đã đăng nhập nhưng không thể đồng bộ dữ liệu Firebase. Kiểm tra kết nối, URL database và thử tải lại trang.';
    toast(message);
  });
}

document.addEventListener('click', event => {
  const duplicate = event.target.closest('[data-duplicate]');
  const edit = event.target.closest('[data-edit]');
  const del = event.target.closest('[data-delete]');
  if (duplicate) {
    const transaction = transactions.find(item => item.id === duplicate.dataset.duplicate);
    if (transaction) openModal(transaction, true);
  }
  if (edit) {
    const transaction = transactions.find(item => item.id === edit.dataset.edit);
    if (transaction) openModal(transaction);
  }
  if (del) deleteTransaction(del.dataset.delete);
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('loginButton');
  button.disabled = true;
  showAuthError('');
  showAuthNotice('');
  try {
    await login($('loginEmail').value.trim(), $('loginPassword').value);
  } catch (error) {
    console.error('Đăng nhập Firebase thất bại:', error);
    const messages = {
      'auth/configuration-not-found': 'Firebase Authentication chưa bật phương thức Email/Password. Bật phương thức này trong Firebase Console rồi thử lại.',
      'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
      'auth/invalid-email': 'Email không hợp lệ.',
      'auth/too-many-requests': 'Đăng nhập tạm bị khóa do thử quá nhiều lần. Hãy thử lại sau.',
      'auth/network-request-failed': 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.'
    };
    showAuthError(messages[error.code] || 'Đăng nhập thất bại. Kiểm tra tài khoản và cấu hình Firebase.');
  } finally {
    button.disabled = false;
  }
});

$('googleLoginButton').addEventListener('click', () => {
  const button = $('googleLoginButton');
  let loginAttempt;
  try {
    loginAttempt = loginWithGoogle();
  } catch (error) {
    console.error('Đăng nhập Firebase bằng Google thất bại:', error);
    showAuthError(googleAuthErrorMessage(error));
    return;
  }
  button.disabled = true;
  showAuthError('');
  showAuthNotice('');
  loginAttempt
    .catch(error => {
      console.error('Đăng nhập Firebase bằng Google thất bại:', error);
      if (error.code === 'auth/popup-blocked') {
        return loginWithGoogleRedirect().catch(redirectError => {
          console.error('Không thể chuyển sang đăng nhập Google bằng chuyển hướng:', redirectError);
          showAuthError(googleAuthErrorMessage(redirectError));
        });
      }
      showAuthError(googleAuthErrorMessage(error));
    })
    .finally(() => {
      button.disabled = false;
    });
});

$('forgotPasswordButton').addEventListener('click', () => {
  $('resetEmail').value = $('loginEmail').value.trim();
  showAuthError('');
  showAuthNotice('');
  $('resetPasswordError').hidden = true;
  $('resetPasswordNotice').hidden = true;
  $('loginView').hidden = true;
  $('forgotPasswordView').hidden = false;
  $('resetEmail').focus();
});

$('backToLoginButton').addEventListener('click', () => {
  $('forgotPasswordView').hidden = true;
  $('loginView').hidden = false;
  $('resetPasswordError').hidden = true;
  $('resetPasswordNotice').hidden = true;
  $('loginEmail').focus();
});

$('resetPasswordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('resetEmail').value.trim();
  const button = $('sendResetEmailButton');
  $('resetPasswordError').textContent = '';
  $('resetPasswordError').hidden = true;
  $('resetPasswordNotice').textContent = '';
  $('resetPasswordNotice').hidden = true;
  button.disabled = true;
  try {
    await sendPasswordReset(email);
    $('resetPasswordNotice').textContent = 'Nếu email này đã đăng ký, Firebase sẽ gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác.';
    $('resetPasswordNotice').hidden = false;
  } catch (error) {
    console.error('Không thể gửi email đặt lại mật khẩu Firebase:', error);
    const messages = {
      'auth/invalid-email': 'Email không hợp lệ.',
      'auth/too-many-requests': 'Đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
      'auth/network-request-failed': 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.',
      'auth/operation-not-allowed': 'Firebase Authentication chưa bật chức năng đặt lại mật khẩu.',
      'auth/unauthorized-continue-uri': 'Tên miền ứng dụng chưa được cho phép trong Firebase Authentication.',
      'auth/invalid-continue-uri': 'Đường dẫn đặt lại mật khẩu trong Firebase chưa hợp lệ.'
    };
    $('resetPasswordError').textContent = messages[error.code] || 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.';
    $('resetPasswordError').hidden = false;
  } finally {
    button.disabled = false;
  }
});

$('signOutBtn').addEventListener('click', async () => {
  try {
    await logout();
  } catch (error) {
    console.error('Đăng xuất Firebase thất bại:', error);
    toast('Đăng xuất không thành công. Vui lòng thử lại.');
  }
});

$('closeModal').onclick = $('cancelModal').onclick = closeModal;
$('addBtn').onclick = () => openModal();
$('modalBackdrop').addEventListener('click', event => {
  if (event.target === $('modalBackdrop')) closeModal();
});
$('txType').addEventListener('change', () => fillCategories());

function updateDebtPaymentBalance() {
  const day = $('debtPaymentDate').value;
  const balance = day ? getDailyLimitDebtBalance(transactions, day) : 0;
  $('debtPaymentBalance').textContent = `Nợ còn lại tính đến ngày ${day ? day.split('-').reverse().join('/') : 'đã chọn'}: ${new Intl.NumberFormat('vi-VN').format(balance)} ₫`;
  $('debtPaymentAmount').max = String(balance);
  $('fillDebtPaymentAmount').disabled = balance < 1;
  $('debtPaymentError').hidden = true;
  return balance;
}

$('reportDebtPaymentBtn').addEventListener('click', () => {
  $('debtPaymentForm').reset();
  $('debtPaymentDate').value = dateKey(new Date());
  $('debtPaymentError').hidden = true;
  updateDebtPaymentBalance();
  $('debtPaymentBackdrop').classList.add('show');
});
function closeDebtPaymentModal() {
  $('debtPaymentBackdrop').classList.remove('show');
}
$('closeDebtPaymentModal').addEventListener('click', closeDebtPaymentModal);
$('cancelDebtPayment').addEventListener('click', closeDebtPaymentModal);
$('debtPaymentBackdrop').addEventListener('click', event => {
  if (event.target === $('debtPaymentBackdrop')) closeDebtPaymentModal();
});
$('debtPaymentDate').addEventListener('change', updateDebtPaymentBalance);
$('fillDebtPaymentAmount').addEventListener('click', () => {
  $('debtPaymentAmount').value = updateDebtPaymentBalance();
});
$('debtPaymentForm').addEventListener('submit', event => {
  event.preventDefault();
  const date = $('debtPaymentDate').value;
  const amount = Number($('debtPaymentAmount').value);
  const balance = updateDebtPaymentBalance();
  if (!Number.isSafeInteger(amount) || amount < 1) {
    $('debtPaymentError').textContent = 'Vui lòng nhập số tiền thanh toán hợp lệ.';
    $('debtPaymentError').hidden = false;
    return;
  }
  if (amount > balance) {
    $('debtPaymentError').textContent = `Số tiền thanh toán không thể lớn hơn số nợ ${new Intl.NumberFormat('vi-VN').format(balance)} ₫ tính đến ngày đã chọn.`;
    $('debtPaymentError').hidden = false;
    return;
  }
  transactions.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: 'debtPayment',
    date: `${date}T12:00`,
    title: 'Thanh toán nợ hạn mức',
    amount,
    category: 'Xóa nợ',
    person: 'Chồng',
    fund: 'Tiền chung',
    note: $('debtPaymentNote').value.trim(),
    details: ''
  });
  closeDebtPaymentModal();
  void persist('Đã ghi nhận thanh toán nợ');
});

$('transactionForm').addEventListener('submit', event => {
  event.preventDefault();
  const id = $('txId').value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const transaction = {
    id,
    type: $('txType').value,
    date: $('txDate').value,
    title: $('txTitle').value.trim(),
    amount: Number($('txAmount').value),
    category: $('txCategory').value,
    person: $('txPerson').value,
    fund: $('txFund').value,
    note: $('txNote').value.trim(),
    details: $('txDetails').value.trim()
  };
  if (!transaction.title || !transaction.amount || transaction.amount < 1) return;
  const index = transactions.findIndex(item => item.id === id);
  if (index >= 0) transactions[index] = transaction;
  else transactions.push(transaction);
  closeModal();
  void persist(index >= 0 ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch');
});

$('dayPicker').value = dateKey(new Date());
$('reportMonth').value = currentMonth;
$('dayPicker').addEventListener('change', () => renderDailySummary(transactions));
$('reportMonth').addEventListener('change', render);
$('exportLedgerBtn').addEventListener('click', () => {
  try {
    exportLedger(transactions);
    toast('Đã xuất toàn bộ giao dịch ra Excel.');
  } catch (error) {
    console.error('Không thể xuất sổ thu chi ra Excel:', error);
    toast(error.message || 'Xuất Excel thất bại.');
  }
});
$('exportReportBtn').addEventListener('click', () => {
  try {
    exportMonthlyReport(getFilteredTransactions(transactions), $('reportMonth').value);
    toast('Đã xuất báo cáo tháng ra Excel.');
  } catch (error) {
    console.error('Không thể xuất báo cáo tháng ra Excel:', error);
    toast(error.message || 'Xuất Excel thất bại.');
  }
});
let importTarget = 'ledger';
function chooseExcelFile(target) {
  importTarget = target;
  $('excelFileInput').click();
}
$('importLedgerBtn').addEventListener('click', () => chooseExcelFile('ledger'));
$('importReportBtn').addEventListener('click', () => chooseExcelFile('report'));
$('excelFileInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const importedTransactions = await readTransactionsFile(file);
    const existingIds = new Set(transactions.map(transaction => transaction.id));
    const seenIds = new Set();
    const additions = importedTransactions.filter(transaction => {
      if (existingIds.has(transaction.id) || seenIds.has(transaction.id)) return false;
      seenIds.add(transaction.id);
      return true;
    });
    if (!additions.length) {
      toast(`Không có giao dịch mới; đã bỏ qua ${importedTransactions.length} giao dịch trùng ID.`);
      return;
    }
    transactions = [...transactions, ...additions];
    void persist(`Đã nhập ${additions.length} giao dịch; bỏ qua ${importedTransactions.length - additions.length} giao dịch trùng ID.`);
  } catch (error) {
    console.error(`Không thể nhập file Excel (${importTarget}):`, error);
    toast(error.message || 'Nhập Excel thất bại.');
  } finally {
    event.target.value = '';
  }
});
$('saveSettings').onclick = () => {
  const name = $('familyName').value.trim() || 'Gia Đình';
  $('brandName').textContent = name;
  localStorage.setItem('giadinh_family_name', name);
  toast('Đã lưu tên sổ trên giao diện');
};
$('familyName').value = localStorage.getItem('giadinh_family_name') || 'Gia Đình';
$('brandName').textContent = $('familyName').value;

$('manageFunds').onclick = () => {
  const name = prompt('Nhập tên nguồn tiền mới:');
  if (name?.trim()) {
    const select = $('txFund');
    if (![...select.options].some(option => option.value === name.trim())) select.add(new Option(name.trim(), name.trim()));
    toast('Đã thêm nguồn tiền vào biểu mẫu');
  }
};

function clearData() {
  if (confirm('Bạn chắc chắn muốn xóa toàn bộ giao dịch đã lưu trên Firebase và thiết bị này?')) {
    transactions = [];
    void persist('Đã xóa toàn bộ giao dịch');
  }
}
$('clearAll').onclick = clearData;

initNavigation();
completeGoogleRedirect().catch(error => {
  console.error('Đăng nhập Google bằng chuyển hướng thất bại:', error);
  showAuthError(googleAuthErrorMessage(error));
});
observeAuth(user => {
  if (!user) {
    stopTransactionListener?.();
    stopTransactionListener = undefined;
    cloudReady = false;
    $('appShell').hidden = true;
    $('authScreen').hidden = false;
    $('loginPassword').value = '';
    return;
  }
  showAuthError('');
  startTransactionSync(user);
}, error => {
  console.error('Không thể kiểm tra trạng thái đăng nhập Firebase:', error);
  showAuthError('Không kết nối được Firebase Authentication. Kiểm tra mạng và thử tải lại trang.');
});
