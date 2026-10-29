import { $, currentMonth, dateKey, loadTransactions, saveTransactions, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './modules/data.js';
import { observeAuth, login, logout, observeTransactions, writeTransactions } from './modules/firebase.js';
import { renderReports } from './modules/reports.js';
import { renderDailySummary } from './modules/transactions.js';
import { openModal, closeModal, fillCategories } from './modules/modal.js';
import { initNavigation } from './modules/navigation.js';

let transactions = loadTransactions();
let cloudReady = false;
let stopTransactionListener;

function render() {
  renderReports(transactions);
  renderDailySummary(transactions);
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
  if (transaction && confirm(`Xóa giao dịch "${transaction.title}"?`)) {
    transactions = transactions.filter(item => item.id !== id);
    void persist('Đã xóa giao dịch');
  }
}

function startTransactionSync(user) {
  stopTransactionListener?.();
  cloudReady = false;
  let firstSnapshot = true;
  stopTransactionListener = observeTransactions(async remoteTransactions => {
    if (firstSnapshot) {
      firstSnapshot = false;
      if (remoteTransactions === null) {
        const localTransactions = loadTransactions();
        if (localTransactions.length && confirm(`Tìm thấy ${localTransactions.length} giao dịch cũ trên thiết bị này. Tải những giao dịch đó lên Firebase để dùng chung?`)) {
          transactions = localTransactions;
          showApp(user);
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
    showAuthError('Không đọc được dữ liệu Firebase. Kiểm tra URL database và Realtime Database Rules, sau đó tải lại trang.');
    $('authScreen').hidden = false;
    $('appShell').hidden = true;
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

$('signOutBtn').addEventListener('click', async () => {
  try {
    await logout();
  } catch (error) {
    console.error('Đăng xuất Firebase thất bại:', error);
    toast('Đăng xuất không thành công. Vui lòng thử lại.');
  }
});

$('addBtn').onclick = () => openModal();
$('closeModal').onclick = $('cancelModal').onclick = closeModal;
$('modalBackdrop').addEventListener('click', event => {
  if (event.target === $('modalBackdrop')) closeModal();
});
$('txType').addEventListener('change', () => fillCategories());

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

$('reportSearchInput').addEventListener('input', render);
['reportTypeFilter', 'reportCategoryFilter', 'reportPersonFilter', 'reportDateFilter'].forEach(id => $(id).addEventListener('change', render));
$('dayPicker').value = dateKey(new Date());
$('reportMonth').value = currentMonth;
$('dayPicker').addEventListener('change', () => renderDailySummary(transactions));
$('reportMonth').addEventListener('change', render);
$('reportCategoryFilter').innerHTML = '<option value="all">Tất cả danh mục</option>' +
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(category => `<option>${category}</option>`).join('');

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
$('clearAll').onclick = $('resetBtn').onclick = clearData;

initNavigation();
observeAuth(user => {
  showAuthError('');
  if (!user) {
    stopTransactionListener?.();
    stopTransactionListener = undefined;
    cloudReady = false;
    $('appShell').hidden = true;
    $('authScreen').hidden = false;
    $('loginPassword').value = '';
    return;
  }
  startTransactionSync(user);
}, error => {
  console.error('Không thể kiểm tra trạng thái đăng nhập Firebase:', error);
  showAuthError('Không kết nối được Firebase Authentication. Kiểm tra mạng và thử tải lại trang.');
});
