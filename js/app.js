import { $, currentMonth, dateKey, loadTransactions, saveTransactions, loadGoldPurchases, saveGoldPurchases, loadGoldContributions, saveGoldContributions } from './modules/data.js';
import { observeAuth, login, loginWithGoogle, loginWithGoogleRedirect, completeGoogleRedirect, logout, sendPasswordReset, observeTransactions, writeTransactions, observeGoldPurchases, writeGoldPurchases, observeGoldContributions, writeGoldContributions, writeGoldContribution, removeGoldContribution } from './modules/firebase.js';
import { getDailyLimitDebtBalance, renderReports } from './modules/reports.js';
import { getFilteredTransactions } from './modules/transactions.js';
import { getMergedContributionMonthGroups, getVisibleContributionColumns, renderGoldFund, saveMergedContributionMonthGroups, saveVisibleContributionColumns } from './modules/gold.js';
import { openModal, closeModal, fillCategories } from './modules/modal.js';
import { initNavigation } from './modules/navigation.js';
import { exportMonthlyReport, readTransactionsFile } from './modules/excel.js';

let transactions = loadTransactions();
let goldPurchases = loadGoldPurchases();
let goldContributions = loadGoldContributions();
let cloudReady = false;
let goldCloudReady = false;
let goldContributionsCloudReady = false;
let stopTransactionListener;
let stopGoldPurchaseListener;
let stopGoldContributionListener;
let editingGoldPurchaseId = null;
const goldContributionColumnPicker = $('goldContributionColumnPicker');
const visibleContributionColumns = getVisibleContributionColumns();
goldContributionColumnPicker.querySelectorAll('[data-contribution-column-toggle]').forEach(input => {
  input.checked = visibleContributionColumns.has(input.dataset.contributionColumnToggle);
});

function render() {
  renderReports(transactions);
  renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
}

function refreshGoldUngroupButton() {
  $('goldUngroupMonths').disabled = getMergedContributionMonthGroups().length === 0;
}

refreshGoldUngroupButton();

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

async function persistGoldPurchases(message) {
  saveGoldPurchases(goldPurchases);
  renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  if (!goldCloudReady) {
    toast('Firebase chưa sẵn sàng; quỹ vàng chỉ được lưu trên thiết bị này.');
    return;
  }
  try {
    await writeGoldPurchases(goldPurchases);
    if (message) toast(message);
  } catch (error) {
    console.error('Không thể lưu quỹ vàng lên Firebase:', error);
    toast('Lưu quỹ vàng lên Firebase thất bại. Dữ liệu vẫn còn trên thiết bị này.');
  }
}

function createGoldContribution(month, id = month, order = 1) {
  return {
    id,
    month,
    order,
    thanhHoaKpi: 0,
    thanhHoaSalary: 0,
    thanhHoaTarget: 0,
    ngocYenKpi: 0,
    ngocYenSalary: 0,
    ngocYenTarget: 0,
    cash: 0,
    fund: 0,
    pig: 0,
    extra: 0,
    debt: 0,
    purchaseDate: '',
    status: 'CHƯA MUA'
  };
}

async function persistGoldContributions(contributions) {
  saveGoldContributions(goldContributions);
  renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  if (!goldContributionsCloudReady) {
    toast('Firebase chưa sẵn sàng; khoản tích góp chỉ được lưu trên thiết bị này.');
    return;
  }
  for (const contribution of contributions) {
    try {
      await writeGoldContribution(contribution);
    } catch (error) {
      console.error('Không thể lưu khoản tích góp lên Firebase:', error);
      if (error.code === 'PERMISSION_DENIED') {
        toast('Firebase từ chối quyền ghi (PERMISSION_DENIED). Hãy publish Database Rules cho nhánh households/quanlygiadinh-94ced.');
        continue;
      }
      const reason = error.code || error.message || 'không rõ nguyên nhân';
      toast(`Lưu Firebase thất bại (${reason}). Dữ liệu vẫn còn trên thiết bị này.`);
    }
  }
}

async function persistGoldContribution(contribution) {
  await persistGoldContributions([contribution]);
}

function openGoldAdjustment(contributionId, adjustmentId = '') {
  const contribution = goldContributions.find(item => item.id === contributionId);
  const adjustments = Array.isArray(contribution?.adjustments) ? contribution.adjustments : [];
  const adjustment = adjustments.find(item => item.id === adjustmentId);
  if (adjustmentId && !adjustment) {
    toast('Không tìm thấy khoản điều chỉnh cần sửa.');
    return;
  }
  const today = dateKey(new Date());
  $('goldAdjustmentForm').reset();
  $('goldAdjustmentContributionId').value = contributionId;
  $('goldAdjustmentId').value = adjustmentId;
  $('goldAdjustmentTitle').textContent = adjustment ? 'Sửa điều chỉnh' : 'Thêm điều chỉnh';
  $('goldAdjustmentType').value = adjustment?.type || 'subtract';
  $('goldAdjustmentAmount').value = adjustment?.amount || '';
  $('goldAdjustmentDate').value = adjustment?.date || today;
  $('goldAdjustmentDate').max = today;
  $('goldAdjustmentNote').value = adjustment?.note || '';
  $('goldAdjustmentBackdrop').classList.add('show');
  $('goldAdjustmentAmount').focus();
}

function closeGoldAdjustment() {
  $('goldAdjustmentBackdrop').classList.remove('show');
  $('goldAdjustmentForm').reset();
}

function openGoldMergeModal() {
  const groupedMonths = new Set(getMergedContributionMonthGroups().flat());
  const months = [...new Set([...$('goldContributionRows').querySelectorAll('tr[data-contribution-month]')]
    .map(row => row.dataset.contributionMonth)
    .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month)))]
    .sort()
    .reverse();
  const options = $('goldMergeMonthOptions');
  options.replaceChildren();
  months.forEach(month => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const monthText = document.createElement('span');
    checkbox.type = 'checkbox';
    checkbox.value = month;
    checkbox.dataset.mergeMonth = month;
    checkbox.disabled = groupedMonths.has(month);
    monthText.textContent = `${month.slice(5, 7)}/${month.slice(0, 4)}`;
    label.classList.toggle('is-disabled', checkbox.disabled);
    label.append(checkbox, monthText);
    options.append(label);
  });
  $('goldMergeBackdrop').classList.add('show');
}

function closeGoldMergeModal() {
  $('goldMergeBackdrop').classList.remove('show');
  $('goldMergeForm').reset();
  $('goldMergeMonthOptions').replaceChildren();
}

function openGoldUngroupModal() {
  const groups = getMergedContributionMonthGroups();
  if (!groups.length) {
    refreshGoldUngroupButton();
    return;
  }
  const options = $('goldUngroupGroupOptions');
  options.replaceChildren();
  groups.forEach((group, index) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    const groupText = document.createElement('span');
    radio.type = 'radio';
    radio.name = 'goldUngroupGroup';
    radio.value = group.join('|');
    radio.required = true;
    radio.checked = index === 0;
    groupText.textContent = group.map(month => `${month.slice(5, 7)}/${month.slice(0, 4)}`).join(' + ');
    label.append(radio, groupText);
    options.append(label);
  });
  $('goldUngroupBackdrop').classList.add('show');
}

function closeGoldUngroupModal() {
  $('goldUngroupBackdrop').classList.remove('show');
  $('goldUngroupForm').reset();
  $('goldUngroupGroupOptions').replaceChildren();
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

function startGoldPurchaseSync() {
  stopGoldPurchaseListener?.();
  goldCloudReady = false;
  $('goldPurchaseSubmit').disabled = true;
  $('goldPurchaseToggle').disabled = true;
  let firstSnapshot = true;
  stopGoldPurchaseListener = observeGoldPurchases(async remotePurchases => {
    if (firstSnapshot) {
      firstSnapshot = false;
      if (remotePurchases === null) {
        const localPurchases = loadGoldPurchases();
        if (localPurchases.length && confirm(`Tìm thấy ${localPurchases.length} giao dịch mua vàng cũ trên thiết bị này. Tải lên Firebase để dùng chung?`)) {
          goldPurchases = localPurchases;
          goldCloudReady = true;
          $('goldPurchaseSubmit').disabled = false;
          $('goldPurchaseToggle').disabled = false;
          await persistGoldPurchases('Đã chuyển quỹ vàng lên Firebase');
          return;
        }
        goldPurchases = [];
      } else {
        goldPurchases = remotePurchases;
      }
      saveGoldPurchases(goldPurchases);
      goldCloudReady = true;
      $('goldPurchaseSubmit').disabled = false;
      $('goldPurchaseToggle').disabled = false;
      renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
      return;
    }

    goldPurchases = remotePurchases || [];
    saveGoldPurchases(goldPurchases);
    renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  }, error => {
    goldCloudReady = false;
    $('goldPurchaseSubmit').disabled = true;
    $('goldPurchaseToggle').disabled = true;
    console.error('Không thể đồng bộ quỹ vàng qua Firebase:', error);
    toast(error.code === 'PERMISSION_DENIED'
      ? 'Firebase từ chối quyền truy cập quỹ vàng. Kiểm tra Database Rules.'
      : 'Không thể đồng bộ quỹ vàng. Kiểm tra kết nối rồi thử lại.');
  });
}

function startGoldContributionSync() {
  stopGoldContributionListener?.();
  goldContributionsCloudReady = false;
  renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  let firstSnapshot = true;
  stopGoldContributionListener = observeGoldContributions(async remoteContributions => {
    if (firstSnapshot) {
      firstSnapshot = false;
      if (remoteContributions === null) {
        const localContributions = loadGoldContributions();
        if (localContributions.length) {
          if (!confirm(`Tìm thấy danh sách tích góp cũ trên thiết bị này (${localContributions.length} tháng). Tải lên Firebase để dùng chung?`)) {
            goldContributions = localContributions;
            saveGoldContributions(goldContributions);
            stopGoldContributionListener?.();
            stopGoldContributionListener = undefined;
            renderGoldFund(goldPurchases, goldContributions, false);
            toast('Danh sách cũ được giữ trên thiết bị này; đăng nhập lại để đồng bộ.');
            return;
          }
          goldContributions = localContributions;
          saveGoldContributions(goldContributions);
          goldContributionsCloudReady = true;
          try {
            await writeGoldContributions(goldContributions);
          } catch (error) {
            goldContributionsCloudReady = false;
            renderGoldFund(goldPurchases, goldContributions, false);
            console.error('Không thể tải danh sách tích góp cũ lên Firebase:', error);
            toast('Không thể chuyển danh sách tích góp lên Firebase. Dữ liệu cũ vẫn còn trên thiết bị này.');
            return;
          }
        } else {
          goldContributions = [];
        }
      } else {
        goldContributions = remoteContributions;
      }
      saveGoldContributions(goldContributions);
      goldContributionsCloudReady = true;
      renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
      return;
    }

    goldContributions = remoteContributions || [];
    saveGoldContributions(goldContributions);
    renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  }, error => {
    goldContributionsCloudReady = false;
    renderGoldFund(goldPurchases, goldContributions, false);
    console.error('Không thể đồng bộ danh sách tích góp qua Firebase:', error);
    toast(error.code === 'PERMISSION_DENIED'
      ? 'Firebase từ chối quyền truy cập danh sách tích góp. Kiểm tra Database Rules.'
      : 'Không thể đồng bộ danh sách tích góp. Kiểm tra kết nối rồi thử lại.');
  });
}

function startTransactionSync(user) {
  stopTransactionListener?.();
  cloudReady = false;
  showApp(user);
  render();
  startGoldPurchaseSync();
  startGoldContributionSync();
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
    const message = error.code === 'PERMISSION_DENIED'
      ? 'Đã đăng nhập nhưng Firebase từ chối quyền đọc dữ liệu. Kiểm tra Realtime Database Rules đã Publish và cho phép người dùng đăng nhập.'
      : 'Đã đăng nhập nhưng không thể đồng bộ dữ liệu Firebase. Kiểm tra kết nối, URL database và thử tải lại trang.';
    toast(message);
  });
}

document.addEventListener('click', event => {
  const duplicate = event.target.closest('[data-duplicate]');
  const edit = event.target.closest('[data-edit]');
  const editGold = event.target.closest('[data-edit-gold]');
  const editGoldMonth = event.target.closest('[data-edit-gold-month]');
  const del = event.target.closest('[data-delete]');
  const deleteGold = event.target.closest('[data-delete-gold]');
  if (duplicate) {
    const transaction = transactions.find(item => item.id === duplicate.dataset.duplicate);
    if (transaction) openModal(transaction, true);
  }
  if (edit) {
    const transaction = transactions.find(item => item.id === edit.dataset.edit);
    if (transaction) openModal(transaction);
  }
  if (del) deleteTransaction(del.dataset.delete);
  if (editGoldMonth) {
    if (!goldCloudReady) {
      toast('Đang tải dữ liệu quỹ vàng. Vui lòng thử lại sau.');
      return;
    }
    const month = editGoldMonth.dataset.editGoldMonth;
    const monthTransactions = goldPurchases.filter(purchase => purchase.date.slice(0, 7) === month);
    if (!monthTransactions.length) return;
    let purchase = monthTransactions[0];
    if (monthTransactions.length > 1) {
      const options = monthTransactions.map((item, index) => {
        const type = item.type === 'withdrawal' ? 'Lấy ra' : 'Mua';
        const note = item.note ? ` — ${item.note}` : '';
        return `${index + 1}. ${type} ${Number(item.quantity).toLocaleString('vi-VN')} chỉ (${item.date.split('-').reverse().join('/')})${note}`;
      }).join('\n');
      const choice = prompt(`Chọn giao dịch cần sửa trong tháng ${Number(month.slice(5))}/${month.slice(0, 4)}:\n${options}`);
      if (choice === null) return;
      const index = Number(choice) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= monthTransactions.length) {
        toast('Lựa chọn giao dịch không hợp lệ.');
        return;
      }
      purchase = monthTransactions[index];
    }
    startEditingGoldPurchase(purchase);
    return;
  }
  if (editGold) {
    if (!goldCloudReady) {
      toast('Đang tải dữ liệu quỹ vàng. Vui lòng thử lại sau.');
      return;
    }
    const purchase = goldPurchases.find(item => item.id === editGold.dataset.editGold);
    if (!purchase) return;
    startEditingGoldPurchase(purchase);
    return;
  }
  if (deleteGold) {
    if (!goldCloudReady) {
      toast('Đang tải dữ liệu quỹ vàng. Vui lòng thử lại sau.');
      return;
    }
    const purchase = goldPurchases.find(item => item.id === deleteGold.dataset.deleteGold);
    const typeLabel = purchase?.type === 'withdrawal' ? 'lấy ra' : 'mua';
    if (purchase && confirm(`Xóa giao dịch ${typeLabel} ${Number(purchase.quantity).toLocaleString('vi-VN')} chỉ vàng?`)) {
      goldPurchases = goldPurchases.filter(item => item.id !== purchase.id);
      if (editingGoldPurchaseId === purchase.id) resetGoldPurchaseForm();
      void persistGoldPurchases('Đã xóa giao dịch vàng');
    }
  }
});

$('goldContributionRows').addEventListener('click', event => {
  const add = event.target.closest('[data-add-contribution]');
  const remove = event.target.closest('[data-delete-contribution]');
  const adjust = event.target.closest('[data-add-contribution-adjustment]');
  if (!add && !remove && !adjust) return;
  if (!goldContributionsCloudReady) {
    toast('Đang tải danh sách tích góp. Vui lòng thử lại sau.');
    return;
  }
  if (adjust) {
    openGoldAdjustment(adjust.dataset.addContributionAdjustment);
    return;
  }
  if (add) {
    const month = add.dataset.addContribution;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    const entries = goldContributions.filter(item => (item.month || item.id.slice(0, 7)) === month);
    const nextOrder = entries.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0) + 1;
    const id = `${month}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const contribution = createGoldContribution(month, id, nextOrder);
    goldContributions = [...goldContributions, contribution];
    void persistGoldContribution(contribution);
    return;
  }

  const id = remove.dataset.deleteContribution;
  const contribution = goldContributions.find(item => item.id === id);
  if (!contribution || !confirm(`Xóa đợt tích góp tháng ${contribution.month || contribution.id.slice(0, 7)}?`)) return;
  goldContributions = goldContributions.filter(item => item.id !== id);
  saveGoldContributions(goldContributions);
  renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  removeGoldContribution(id).catch(error => {
    console.error('Không thể xóa đợt tích góp khỏi Firebase:', error);
    toast('Không thể xóa đợt tích góp khỏi Firebase. Kiểm tra kết nối và quyền database.');
  });
});

$('goldMergeMonths').addEventListener('click', openGoldMergeModal);
$('goldUngroupMonths').addEventListener('click', openGoldUngroupModal);
$('goldMergeForm').addEventListener('submit', event => {
  event.preventDefault();
  const selectedMonths = [...$('goldMergeMonthOptions').querySelectorAll('[data-merge-month]:checked')]
    .map(input => input.value);
  if (selectedMonths.length < 2) {
    toast('Chọn ít nhất hai tháng để gộp.');
    return;
  }
  try {
    saveMergedContributionMonthGroups([...getMergedContributionMonthGroups(), selectedMonths]);
    refreshGoldUngroupButton();
    closeGoldMergeModal();
    renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  } catch (error) {
    console.error('Không thể gộp các tháng:', error);
    toast(error.message || 'Không thể gộp các tháng đã chọn.');
  }
});

$('goldUngroupForm').addEventListener('submit', event => {
  event.preventDefault();
  const selectedGroup = $('goldUngroupGroupOptions').querySelector('[name="goldUngroupGroup"]:checked')?.value;
  if (!selectedGroup) {
    toast('Chọn nhóm tháng cần bỏ gộp.');
    return;
  }
  const groups = getMergedContributionMonthGroups();
  const remainingGroups = groups.filter(group => group.join('|') !== selectedGroup);
  if (remainingGroups.length === groups.length) {
    closeGoldUngroupModal();
    refreshGoldUngroupButton();
    toast('Không tìm thấy nhóm tháng cần bỏ gộp.');
    return;
  }
  try {
    saveMergedContributionMonthGroups(remainingGroups);
    refreshGoldUngroupButton();
    closeGoldUngroupModal();
    renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  } catch (error) {
    console.error('Không thể bỏ gộp tháng:', error);
    toast(error.message || 'Không thể bỏ gộp tháng.');
  }
});

$('goldContributionAdjustmentRows').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-contribution-adjustment]');
  const remove = event.target.closest('[data-delete-contribution-adjustment]');
  if (!edit && !remove) return;
  if (!goldContributionsCloudReady) {
    toast('Đang tải danh sách tích góp. Vui lòng thử lại sau.');
    return;
  }
  const button = edit || remove;
  const contributionId = edit ? edit.dataset.editContributionAdjustment : remove.dataset.deleteContributionAdjustment;
  const contribution = goldContributions.find(item => item.id === contributionId);
  const adjustmentId = button.dataset.adjustmentId;
  const adjustments = Array.isArray(contribution?.adjustments) ? contribution.adjustments : [];
  const adjustment = adjustments.find(item => item.id === adjustmentId);
  if (!contribution || !adjustment) return;
  if (edit) {
    openGoldAdjustment(contribution.id, adjustmentId);
    return;
  }
  const action = adjustment.type === 'subtract' ? 'trừ' : 'cộng';
  if (!confirm(`Xóa khoản ${action} ${new Intl.NumberFormat('vi-VN').format(adjustment.amount)} ₫ khỏi đợt tích góp?`)) return;
  const updatedContribution = {
    ...contribution,
    adjustments: contribution.adjustments.filter(item => item.id !== adjustmentId)
  };
  goldContributions = goldContributions.map(item => item.id === contribution.id ? updatedContribution : item);
  void persistGoldContribution(updatedContribution);
});

goldContributionColumnPicker.addEventListener('change', event => {
  const input = event.target.closest('[data-contribution-column-toggle]');
  if (!input) return;
  const selectedColumns = [...goldContributionColumnPicker.querySelectorAll('[data-contribution-column-toggle]:checked')]
    .map(checkbox => checkbox.dataset.contributionColumnToggle);
  try {
    saveVisibleContributionColumns(selectedColumns);
    renderGoldFund(goldPurchases, goldContributions, goldContributionsCloudReady);
  } catch (error) {
    console.error('Không thể lưu tùy chọn cột tích góp:', error);
    input.checked = !input.checked;
    toast('Không thể lưu tùy chọn cột. Vui lòng kiểm tra bộ nhớ trình duyệt.');
  }
});

$('goldContributionRows').addEventListener('change', event => {
  const input = event.target.closest('[data-contribution]');
  if (!input) return;
  if (!goldContributionsCloudReady) {
    toast('Đang tải danh sách tích góp. Vui lòng thử lại sau.');
    renderGoldFund(goldPurchases, goldContributions, false);
    return;
  }
  const { month, contribution: field, contributionId: id, mergedGroup } = input.dataset;
  if (mergedGroup) {
    const groupMonths = mergedGroup.split('|');
    if (!groupMonths.length || groupMonths.some(groupMonth => !/^\d{4}-(0[1-9]|1[0-2])$/.test(groupMonth))) return;
    if (field !== 'purchaseDate' && field !== 'status') return;
    const groupContributions = groupMonths.flatMap(groupMonth => {
      const entries = goldContributions.filter(item =>
        typeof item.id === 'string' &&
        (item.month || item.id.slice(0, 7)) === groupMonth
      );
      return entries.length ? entries : [createGoldContribution(groupMonth)];
    });
    if (field === 'status') {
      if (!['CHƯA MUA', 'ĐÃ GÓP', 'ĐÃ MUA'].includes(input.value)) return;
      if (input.value === 'ĐÃ MUA' && groupContributions.some(item => !item.purchaseDate)) {
        toast('Nhập ngày mua trước khi chọn trạng thái ĐÃ MUA.');
        renderGoldFund(goldPurchases, goldContributions, true);
        return;
      }
    } else {
      if (input.value && input.value > dateKey(new Date())) {
        toast('Ngày mua không thể ở tương lai.');
        renderGoldFund(goldPurchases, goldContributions, true);
        return;
      }
      if (!input.value && groupContributions.some(item => item.status === 'ĐÃ MUA')) {
        toast('Đổi trạng thái khỏi ĐÃ MUA trước khi xóa ngày mua.');
        renderGoldFund(goldPurchases, goldContributions, true);
        return;
      }
    }

    const updatedContributions = groupContributions.map(item => ({ ...item, [field]: input.value }));
    const existingIds = new Set(goldContributions.map(item => item.id));
    const updatesById = new Map(updatedContributions.map(item => [item.id, item]));
    goldContributions = [
      ...goldContributions.map(item => updatesById.get(item.id) || item),
      ...updatedContributions.filter(item => !existingIds.has(item.id))
    ];
    void persistGoldContributions(updatedContributions);
    return;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
  const amountFields = [
    'thanhHoaKpi', 'thanhHoaSalary',
    'ngocYenKpi', 'ngocYenSalary',
    'fund', 'pig', 'extra', 'debt'
  ];
  if (!amountFields.includes(field) && field !== 'purchaseDate' && field !== 'status') return;
  const current = goldContributions.find(item => item.id === id);
  const contribution = current ? { ...current } : createGoldContribution(month, id);

  if (field === 'status') {
    if (!['CHƯA MUA', 'ĐÃ GÓP', 'ĐÃ MUA'].includes(input.value)) return;
    if (input.value === 'ĐÃ MUA' && !contribution.purchaseDate) {
      toast('Nhập ngày mua trước khi chọn trạng thái ĐÃ MUA.');
      renderGoldFund(goldPurchases, goldContributions, true);
      return;
    }
    contribution.status = input.value;
  } else if (field === 'purchaseDate') {
    if (input.value && input.value > dateKey(new Date())) {
      toast('Ngày mua không thể ở tương lai.');
      renderGoldFund(goldPurchases, goldContributions, true);
      return;
    }
    if (!input.value && contribution.status === 'ĐÃ MUA') {
      toast('Đổi trạng thái khỏi ĐÃ MUA trước khi xóa ngày mua.');
      renderGoldFund(goldPurchases, goldContributions, true);
      return;
    }
    contribution.purchaseDate = input.value;
  } else {
    const digits = input.value.replace(/\D/g, '');
    const amount = digits ? Number(digits) : 0;
    if (!Number.isSafeInteger(amount)) {
      toast('Số tiền vượt quá giới hạn cho phép.');
      renderGoldFund(goldPurchases, goldContributions, true);
      return;
    }
    contribution[field] = amount;
    if (['thanhHoaKpi', 'thanhHoaSalary', 'ngocYenKpi', 'ngocYenSalary'].includes(field)) {
      contribution.cash = 0;
    }
  }

  if (current) {
    goldContributions = goldContributions.map(item => item.id === id ? contribution : item);
  } else {
    goldContributions = [...goldContributions, contribution];
  }
  void persistGoldContribution(contribution);
});

$('goldAdjustmentForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!goldContributionsCloudReady) {
    toast('Đang tải danh sách tích góp. Vui lòng thử lại sau.');
    return;
  }
  const contributionId = $('goldAdjustmentContributionId').value;
  const adjustmentId = $('goldAdjustmentId').value;
  const type = $('goldAdjustmentType').value;
  const date = $('goldAdjustmentDate').value;
  const amount = Number($('goldAdjustmentAmount').value);
  const note = $('goldAdjustmentNote').value.trim();
  const today = dateKey(new Date());
  if (!['add', 'subtract'].includes(type)) {
    toast('Loại điều chỉnh không hợp lệ.');
    return;
  }
  if (!date || date > today || dateKey(new Date(`${date}T12:00:00`)) !== date) {
    toast('Ngày điều chỉnh không hợp lệ hoặc ở tương lai.');
    return;
  }
  if (!Number.isSafeInteger(amount) || amount < 1) {
    toast('Số tiền điều chỉnh phải là số nguyên dương.');
    return;
  }
  if (!note || note.length > 200) {
    toast('Nhập ghi chú điều chỉnh (tối đa 200 ký tự).');
    return;
  }
  const current = goldContributions.find(item => item.id === contributionId);
  const month = current?.month || contributionId.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || (!current && contributionId !== month)) {
    toast('Không tìm thấy đợt tích góp để điều chỉnh.');
    return;
  }
  const contribution = current
    ? { ...current }
    : {
      id: contributionId,
      month,
      order: 1,
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
  const adjustments = Array.isArray(contribution.adjustments) ? [...contribution.adjustments] : [];
  const adjustment = {
    id: adjustmentId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    type,
    amount,
    date,
    note
  };
  if (adjustmentId) {
    const index = adjustments.findIndex(item => item.id === adjustmentId);
    if (index < 0) {
      toast('Không tìm thấy khoản điều chỉnh cần sửa.');
      return;
    }
    adjustments[index] = adjustment;
  } else {
    adjustments.push(adjustment);
  }
  contribution.adjustments = adjustments;
  if (current) {
    goldContributions = goldContributions.map(item => item.id === contributionId ? contribution : item);
  } else {
    goldContributions = [...goldContributions, contribution];
  }
  closeGoldAdjustment();
  void persistGoldContribution(contribution);
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

$('reportMonth').value = currentMonth;
$('reportMonth').addEventListener('change', render);
$('goldPurchaseDate').value = dateKey(new Date());
$('goldPurchaseDate').max = dateKey(new Date());
$('goldPurchaseToggle').addEventListener('click', () => {
  if (editingGoldPurchaseId) return;
  $('goldPurchaseDate').value = dateKey(new Date());
  $('goldTransactionTitle').textContent = 'Ghi nhận giao dịch vàng';
  $('goldTransactionBackdrop').classList.add('show');
  $('goldPurchaseQuantity').focus();
});
$('goldPurchaseForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!goldCloudReady) {
    toast('Đang tải dữ liệu quỹ vàng. Vui lòng thử lại sau.');
    return;
  }
  const date = $('goldPurchaseDate').value;
  if (!date || date > dateKey(new Date())) {
    toast('Ngày giao dịch vàng không thể ở tương lai.');
    return;
  }
  const quantity = Number($('goldPurchaseQuantity').value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    toast('Vui lòng nhập số lượng vàng lớn hơn 0.');
    return;
  }
  const type = $('goldTransactionType').value;
  const purchase = {
    id: editingGoldPurchaseId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    date,
    quantity,
    type,
    note: $('goldPurchaseNote').value.trim()
  };
  if (editingGoldPurchaseId) {
    goldPurchases = goldPurchases.map(item => item.id === editingGoldPurchaseId ? purchase : item);
    editingGoldPurchaseId = null;
    resetGoldPurchaseForm();
    void persistGoldPurchases('Đã cập nhật giao dịch vàng');
    return;
  }
  goldPurchases.push(purchase);
  resetGoldPurchaseForm();
  void persistGoldPurchases(type === 'withdrawal' ? 'Đã ghi nhận lấy vàng ra' : 'Đã ghi nhận mua vàng');
});
function resetGoldPurchaseForm() {
  editingGoldPurchaseId = null;
  $('goldPurchaseForm').reset();
  $('goldPurchaseDate').value = dateKey(new Date());
  $('goldTransactionType').value = 'purchase';
  $('goldPurchaseSubmit').textContent = 'Lưu giao dịch';
  $('goldTransactionTitle').textContent = 'Ghi nhận giao dịch vàng';
  $('goldTransactionBackdrop').classList.remove('show');
  $('goldPurchaseToggle').focus();
}

function startEditingGoldPurchase(purchase) {
  editingGoldPurchaseId = purchase.id;
  $('goldPurchaseDate').value = purchase.date;
  $('goldTransactionType').value = purchase.type === 'withdrawal' ? 'withdrawal' : 'purchase';
  $('goldPurchaseQuantity').value = purchase.quantity;
  $('goldPurchaseNote').value = purchase.note || '';
  $('goldPurchaseSubmit').textContent = 'Lưu thay đổi';
  $('goldTransactionTitle').textContent = 'Sửa giao dịch vàng';
  $('goldTransactionBackdrop').classList.add('show');
  $('goldPurchaseQuantity').focus();
}

$('goldPurchaseCancelEdit').addEventListener('click', resetGoldPurchaseForm);
$('closeGoldTransactionModal').addEventListener('click', resetGoldPurchaseForm);
$('goldTransactionBackdrop').addEventListener('click', event => {
  if (event.target === $('goldTransactionBackdrop')) resetGoldPurchaseForm();
});
$('cancelGoldAdjustment').addEventListener('click', closeGoldAdjustment);
$('closeGoldAdjustmentModal').addEventListener('click', closeGoldAdjustment);
$('goldAdjustmentBackdrop').addEventListener('click', event => {
  if (event.target === $('goldAdjustmentBackdrop')) closeGoldAdjustment();
});
$('cancelGoldMerge').addEventListener('click', closeGoldMergeModal);
$('closeGoldMergeModal').addEventListener('click', closeGoldMergeModal);
$('goldMergeBackdrop').addEventListener('click', event => {
  if (event.target === $('goldMergeBackdrop')) closeGoldMergeModal();
});
$('cancelGoldUngroup').addEventListener('click', closeGoldUngroupModal);
$('closeGoldUngroupModal').addEventListener('click', closeGoldUngroupModal);
$('goldUngroupBackdrop').addEventListener('click', event => {
  if (event.target === $('goldUngroupBackdrop')) closeGoldUngroupModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('goldTransactionBackdrop').classList.contains('show')) {
    resetGoldPurchaseForm();
  }
  if (event.key === 'Escape' && $('goldAdjustmentBackdrop').classList.contains('show')) {
    closeGoldAdjustment();
  }
  if (event.key === 'Escape' && $('goldMergeBackdrop').classList.contains('show')) {
    closeGoldMergeModal();
  }
  if (event.key === 'Escape' && $('goldUngroupBackdrop').classList.contains('show')) {
    closeGoldUngroupModal();
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
function chooseExcelFile() {
  $('excelFileInput').click();
}
$('importReportBtn').addEventListener('click', chooseExcelFile);
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
    console.error('Không thể nhập giao dịch từ file Excel:', error);
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
    stopGoldPurchaseListener?.();
    stopGoldPurchaseListener = undefined;
    stopGoldContributionListener?.();
    stopGoldContributionListener = undefined;
    cloudReady = false;
    goldCloudReady = false;
    goldContributionsCloudReady = false;
    $('goldPurchaseSubmit').disabled = true;
    $('goldPurchaseToggle').disabled = true;
    renderGoldFund(goldPurchases, goldContributions, false);
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
