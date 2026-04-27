const token = localStorage.getItem("token");
const API = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
const adminStatus = document.getElementById("adminStatus");
const adminIdentity = document.getElementById("adminIdentity");
const adminSidebarRole = document.getElementById("adminSidebarRole");
const adminSidebarIdentity = document.getElementById("adminSidebarIdentity");
const winnerHeadline = document.getElementById("winnerHeadline");
const winnerProofHint = document.getElementById("winnerProofHint");
const usersList = document.getElementById("users");
const kycList = document.getElementById("kycList");
const rewardTransactionsList = document.getElementById("rewardTransactions");
const fairnessDrawsList = document.getElementById("fairnessDraws");
const supportTicketsList = document.getElementById("supportTickets");
const chartInstances = {};
let currentAdmin = null;

if (!token) {
  window.location.href = "login.html";
} else {
  verifyAdminAccess();
}

function setAdminStatus(message, isError = true) {
  adminStatus.textContent = message;
  adminStatus.className = isError ? "status-message dashboard-toast error" : "status-message dashboard-toast success";
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: "Bearer " + token
  };

  const response = await fetch(API + path, {
    ...options,
    headers
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message = data && (data.message || data.error) ? data.message || data.error : "Request failed";
    throw new Error(message);
  }

  return data;
}

async function verifyAdminAccess() {
  try {
    const user = await apiFetch("/me");

    if (user.role !== "admin") {
      setAdminStatus("Admin access required. Redirecting...", true);
      window.location.href = "dashboard.html";
      return;
    }

    currentAdmin = user;
  adminIdentity.textContent = `${user.name} | ${user.email} | Role: ${user.role}`;
  setAdminStatus("Admin access verified.", false);
  await Promise.all([
  loadAnalytics(),
  loadUsers(),
  loadKYC(),
      loadRewardTransactions(),
      loadSupportTickets(),
      loadFairnessProof()
    ]);
  } catch (error) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

async function loadUsers() {
  try {
    const users = await apiFetch("/users");
    usersList.innerHTML = "";

    users.forEach((user) => {
      const li = document.createElement("li");
      li.className = "participant-card admin-user-card";
      li.innerHTML = `
        <span class="participant-rank">${(user.entries || 0) + (user.bonusEntries || 0)}</span>
        <div>
          <strong>${user.name}</strong>
          <p>${user.email}</p>
          <p>Role: ${user.role} | Wallet: ${user.walletAddress || "Not linked"}</p>
        </div>
      `;

  const btn = document.createElement("button");
  btn.innerText = "Delete";
  btn.className = "btn btn-small";
  btn.onclick = () => deleteUser(user._id);

  li.appendChild(btn);
  usersList.appendChild(li);
    });

    if (users.length === 0) {
      usersList.innerHTML = '<li class="empty-state-card">No users found.</li>';
    }
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function deleteUser(id) {
  try {
    await apiFetch(`/users/${id}`, {
      method: "DELETE"
    });

    setAdminStatus("User deleted.", false);
    await Promise.all([loadUsers(), loadAnalytics()]);
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function pickWinner() {
  try {
    const data = await apiFetch("/winner");
    winnerHeadline.textContent = data.name || data.winnerName || "Winner selected";
    winnerProofHint.textContent = data.draw
      ? `Proof ${data.draw.proofHash.slice(0, 12)}... | pool size ${data.draw.poolSize}`
  : "Winner draw completed.";
    setAdminStatus("Winner draw recorded.", false);
    await Promise.all([loadFairnessProof(), loadAnalytics()]);
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function loadKYC() {
  try {
    const data = await apiFetch("/kyc");
    kycList.innerHTML = "";
    document.getElementById("pendingKycValue").textContent = data.filter((item) => item.status === "pending").length;

    data.forEach((item) => {
      const li = document.createElement("li");
      li.className = "activity-item";

      const details = document.createElement("div");
      details.className = "admin-kyc-details";
      details.innerHTML = `
        <strong>${item.idType || "Government ID"} ${item.idNumberMasked || ""}</strong>
        <p>User: ${item.userId}</p>
        <p>Status: ${item.status}</p>
        ${item.rejectionReason ? `<p>Reason: ${item.rejectionReason}</p>` : ""}
      `;

      const assetLinks = document.createElement("div");
      assetLinks.className = "admin-kyc-links";
      if (item.documentUrl) {
        const documentLink = document.createElement("a");
        documentLink.href = API + item.documentUrl;
        documentLink.target = "_blank";
        documentLink.rel = "noreferrer";
        documentLink.textContent = "View government ID";
        assetLinks.appendChild(documentLink);
      }
      if (item.selfieUrl) {
        const selfieLink = document.createElement("a");
        selfieLink.href = API + item.selfieUrl;
        selfieLink.target = "_blank";
        selfieLink.rel = "noreferrer";
        selfieLink.textContent = "View selfie";
        assetLinks.appendChild(selfieLink);
      }
      details.appendChild(assetLinks);

      const reviewControls = document.createElement("div");
      reviewControls.className = "admin-kyc-review";

      const originalLabel = document.createElement("label");
      originalLabel.className = "admin-checkbox-row";
      const originalCheckbox = document.createElement("input");
      originalCheckbox.type = "checkbox";
      originalCheckbox.checked = Boolean(item.documentOriginalChecked);
      originalLabel.appendChild(originalCheckbox);
      originalLabel.append("Government ID looks original");

      const faceLabel = document.createElement("label");
      faceLabel.className = "admin-checkbox-row";
      const faceCheckbox = document.createElement("input");
      faceCheckbox.type = "checkbox";
      faceCheckbox.checked = Boolean(item.faceMatchedChecked);
      faceLabel.appendChild(faceCheckbox);
      faceLabel.append("Face matches the ID");

      reviewControls.appendChild(originalLabel);
      reviewControls.appendChild(faceLabel);

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn btn-small";
      const rejectionInput = document.createElement("textarea");
      rejectionInput.className = "admin-rejection-input";
      rejectionInput.placeholder = "Reason for rejection";
      rejectionInput.value = item.rejectionReason || "";
      if (item.status === "approved") {
        approveBtn.innerText = item.reviewedByName ? `Approved by ${item.reviewedByName}` : "Approved";
        approveBtn.disabled = true;
        originalCheckbox.disabled = true;
        faceCheckbox.disabled = true;
        rejectionInput.disabled = true;
      } else if (item.status === "rejected") {
        approveBtn.innerText = item.reviewedByName ? `Rejected by ${item.reviewedByName}` : "Rejected";
        approveBtn.disabled = true;
        originalCheckbox.disabled = true;
        faceCheckbox.disabled = true;
        rejectionInput.disabled = true;
      } else {
        approveBtn.innerText = "Approve";
        approveBtn.onclick = () => approveKYC(item._id, originalCheckbox.checked, faceCheckbox.checked);
      }
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn btn-small btn-secondary";
      rejectBtn.textContent = "Reject";
      rejectBtn.disabled = item.status !== "pending";
      rejectBtn.onclick = () => rejectKYC(item._id, rejectionInput.value);
      reviewControls.appendChild(rejectionInput);
      reviewControls.appendChild(approveBtn);
      reviewControls.appendChild(rejectBtn);

      li.appendChild(details);
      li.appendChild(reviewControls);
      kycList.appendChild(li);
    });

    if (data.length === 0) {
      kycList.innerHTML = '<li class="empty-state-card">No KYC requests found.</li>';
    }
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function approveKYC(id, documentOriginalChecked, faceMatchedChecked) {
  try {
    await apiFetch(`/kyc/${id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ documentOriginalChecked, faceMatchedChecked })
    });

    setAdminStatus("KYC request approved.", false);
    await Promise.all([loadKYC(), loadAnalytics()]);
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function rejectKYC(id, rejectionReason) {
  try {
    await apiFetch(`/kyc/${id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rejectionReason })
    });

    setAdminStatus("KYC request rejected.", false);
    await Promise.all([loadKYC(), loadAnalytics()]);
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function loadRewardTransactions() {
  try {
    const data = await apiFetch("/transactions/admin");
    rewardTransactionsList.innerHTML = "";
    document.getElementById("pendingRewardsValue").textContent = data.filter((item) => item.status !== "confirmed").length;

    data.forEach((item) => {
      const li = document.createElement("li");
      li.className = "transaction-item";
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown time";
      li.innerHTML = `
        <div>
          <strong>${item.type}</strong>
          <p>${item.userName || item.userId}${item.userEmail ? ` | ${item.userEmail}` : ""}</p>
          <p>${item.walletAddress ? `Wallet: ${item.walletAddress}` : "Wallet missing"}</p>
          <p>${createdAt}</p>
          <p>${item.note || "Reward event recorded."}</p>
          ${item.confirmedByName ? `<p>Confirmed by ${item.confirmedByName}${item.confirmedAt ? ` on ${new Date(item.confirmedAt).toLocaleString()}` : ""}</p>` : ""}
        </div>
      `;

      const meta = document.createElement("div");
      meta.className = "transaction-meta";

      const status = document.createElement("span");
      status.className = `status-pill ${item.status === "confirmed" ? "success" : "warning"}`;
      status.textContent = item.status;
      meta.appendChild(status);

      const amount = document.createElement("strong");
      amount.textContent = `${Number(item.amount || 0).toFixed(6)} BTC`;
      meta.appendChild(amount);

      if (item.explorerUrl) {
        const link = document.createElement("a");
        link.href = item.explorerUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "View payout on explorer";
        meta.appendChild(link);
      } else {
        const txIdInput = document.createElement("input");
        txIdInput.type = "text";
        txIdInput.placeholder = "Blockchain tx id";
        txIdInput.className = "admin-inline-input";
        meta.appendChild(txIdInput);

        const confirmBtn = document.createElement("button");
        confirmBtn.className = "btn btn-small btn-secondary";
        confirmBtn.textContent = "Confirm payout";
        confirmBtn.disabled = !item.walletAddress;
        confirmBtn.onclick = () => confirmRewardTransaction(item._id, txIdInput.value);
        meta.appendChild(confirmBtn);
      }

      li.appendChild(meta);
      rewardTransactionsList.appendChild(li);
    });

    if (data.length === 0) {
      rewardTransactionsList.innerHTML = '<li class="empty-state-card">No reward transactions found.</li>';
    }
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function confirmRewardTransaction(id, txId) {
  if (!txId || !txId.trim()) {
    setAdminStatus("Enter a blockchain transaction id before confirming the payout.", true);
    return;
  }

  try {
    await apiFetch(`/transactions/${id}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ txId: txId.trim() })
    });

    setAdminStatus("Reward payout marked as confirmed.", false);
    await Promise.all([loadRewardTransactions(), loadAnalytics()]);
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function loadFairnessProof() {
  try {
    const data = await fetch(API + "/fairness/proof");
    const proof = await data.json();

    if (!data.ok) {
      throw new Error(proof.message || "Failed to load fairness proof");
    }

    fairnessDrawsList.innerHTML = "";

    if (!proof.latestDraws || proof.latestDraws.length === 0) {
      fairnessDrawsList.innerHTML = '<li class="empty-state-card">No recorded draw proofs yet.</li>';
      winnerHeadline.textContent = "No draw recorded";
      winnerProofHint.textContent = proof.proofDescription;
      return;
    }

    const latestDraw = proof.latestDraws[0];
    winnerHeadline.textContent = latestDraw.winnerName;
    winnerProofHint.textContent = `Proof ${latestDraw.proofHash.slice(0, 12)}... | participants ${latestDraw.participantCount}`;

    proof.latestDraws.forEach((draw) => {
      const li = document.createElement("li");
      li.className = "notice-item";
      li.innerHTML = `
        <strong>${draw.winnerName}</strong>
        <p>${new Date(draw.createdAt).toLocaleString()} | pool ${draw.poolSize} | proof ${draw.proofHash}</p>
      `;
      fairnessDrawsList.appendChild(li);
    });
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function loadSupportTickets() {
  try {
    const tickets = await apiFetch("/support/tickets");
    supportTicketsList.innerHTML = "";

    if (!tickets.length) {
      supportTicketsList.innerHTML = '<li class="empty-state-card">No support tickets have been submitted yet.</li>';
      return;
    }

    tickets.forEach((ticket) => {
      const li = document.createElement("li");
      li.className = "notice-item admin-support-item";
      li.innerHTML = `
        <strong>${ticket.subject}</strong>
        <p>${ticket.userName} | ${ticket.userEmail}</p>
        <p>${ticket.category} | ${new Date(ticket.createdAt).toLocaleString()}</p>
        <p>${ticket.message}</p>
        <p><span class="status-pill ${ticket.status === "resolved" ? "success" : ticket.status === "in-review" ? "warning" : "neutral"}">${ticket.status}</span></p>
        ${ticket.adminResponse ? `<p><strong>Existing response:</strong> ${ticket.adminResponse}</p>` : ""}
      `;

      const controls = document.createElement("div");
      controls.className = "admin-support-controls";

      const statusSelect = document.createElement("select");
      statusSelect.className = "admin-inline-input";
      statusSelect.innerHTML = `
        <option value="in-review" ${ticket.status === "in-review" ? "selected" : ""}>In review</option>
        <option value="resolved" ${ticket.status === "resolved" ? "selected" : ""}>Resolved</option>
      `;

      const responseInput = document.createElement("textarea");
      responseInput.className = "admin-rejection-input";
      responseInput.placeholder = "Admin support response";
      responseInput.value = ticket.adminResponse || "";

      const respondButton = document.createElement("button");
      respondButton.className = "btn btn-small";
      respondButton.textContent = ticket.adminResponse ? "Update response" : "Send response";
      respondButton.onclick = () => respondToSupportTicket(ticket._id, statusSelect.value, responseInput.value);

      controls.appendChild(statusSelect);
      controls.appendChild(responseInput);
      controls.appendChild(respondButton);

      li.appendChild(controls);
      supportTicketsList.appendChild(li);
    });
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function respondToSupportTicket(id, status, adminResponse) {
  try {
    await apiFetch(`/support/tickets/${id}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status, adminResponse })
    });

    setAdminStatus("Support ticket updated.", false);
    await loadSupportTickets();
  } catch (error) {
    setAdminStatus(error.message);
  }
}

async function loadAnalytics() {
  try {
    const [users, kycData, rewards] = await Promise.all([
      apiFetch("/users"),
      apiFetch("/kyc"),
      apiFetch("/transactions/admin")
    ]);
    const totalUsers = users.length;
    const entryLabels = users.map((user) => user.name);
    const entryData = users.map((user) => (user.entries || 0) + (user.bonusEntries || 0));
    const approved = kycData.filter((item) => item.status === "approved").length;
    const pending = kycData.filter((item) => item.status === "pending").length;
    const pendingRewards = rewards.filter((item) => item.status !== "confirmed").length;
    document.getElementById("pendingKycValue").textContent = pending;
    document.getElementById("pendingRewardsValue").textContent = pendingRewards;

    if (chartInstances.usersChart) {
      chartInstances.usersChart.destroy();
    }
    chartInstances.usersChart = new Chart(document.getElementById("usersChart"), {
      type: "bar",
      data: {
        labels: ["Total Users"],
        datasets: [{
          label: "Users",
          data: [totalUsers],
          backgroundColor: "rgba(251, 191, 36, 0.7)"
        }]
      }
    });

    if (chartInstances.entriesChart) {
      chartInstances.entriesChart.destroy();
    }
    chartInstances.entriesChart = new Chart(document.getElementById("entriesChart"), {
      type: "bar",
      data: {
        labels: entryLabels,
        datasets: [{
          label: "Entries per User",
          data: entryData,
          backgroundColor: "rgba(56, 189, 248, 0.7)"
        }]
      }
    });

    if (chartInstances.kycChart) {
      chartInstances.kycChart.destroy();
    }
    chartInstances.kycChart = new Chart(document.getElementById("kycChart"), {
      type: "doughnut",
      data: {
        labels: ["Approved", "Pending"],
        datasets: [{
          data: [approved, pending],
          backgroundColor: ["rgba(34, 197, 94, 0.75)", "rgba(251, 191, 36, 0.75)"]
        }]
      }
    });
  } catch (error) {
    setAdminStatus(error.message);
  }
}
