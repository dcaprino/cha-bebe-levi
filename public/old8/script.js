document.addEventListener("DOMContentLoaded", () => {
  const screens = {
    welcome: document.getElementById("screenWelcome"),
    name: document.getElementById("screenName"),
    whats: document.getElementById("screenWhats"),
    grid: document.getElementById("screenGrid"),
    number: document.getElementById("screenNumber"),
    thanks: document.getElementById("screenThanks"),
  };

  const nameInput = document.getElementById("inputName");
  const phoneInput = document.getElementById("inputWhats");
  const grid = document.getElementById("grid");
  const listMyNumbers = document.getElementById("listMyNumbers");

  const overlay = document.getElementById("overlay");
  const overlayMsg = document.getElementById("overlayMsg");
  const overlayBtn = document.getElementById("overlayBtn");

  let guest = { name: "", phone: "" };
  let selected = null;

  function show(id) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[id].classList.remove("hidden");
  }

  function showOverlay(msg) {
    overlayMsg.textContent = msg;
    overlay.classList.remove("hidden");
  }
  overlayBtn.onclick = () => overlay.classList.add("hidden");

  function validPhone(p) {
    return /^\d{10,11}$/.test(p);
  }

  async function saveGuest() {
    await fetch("/api/guest/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guest),
    });
  }

  async function loadGrid() {
    const res = await fetch("/api/numbers");
    const list = await res.json();
    grid.innerHTML = "";
    list.forEach((item) => {
      const btn = document.createElement("button");
      btn.textContent = item.label;
      btn.className =
        "w-14 h-14 text-lg font-bold rounded-md border transition";
      if (item.status === "free") {
        btn.classList.add("bg-white", "text-blue-700", "hover:bg-blue-100");
        btn.onclick = () => openNumber(item);
      } else {
        btn.classList.add("bg-gray-200", "text-gray-500", "cursor-not-allowed");
      }
      grid.appendChild(btn);
    });
  }

// Carrega todos os números já escolhidos pelo convidado
// Carrega todos os números e itens associados ao convidado diretamente do banco
async function loadMyNumbers() {
  if (!guest.phone) return;
  const res = await fetch(`/api/my-numbers/${guest.phone}`);
  const data = await res.json();
  console.log("[MYNUMBERS] phone:", guest.phone, data);

  // Limpa lista atual
  listMyNumbers.innerHTML = "";

  // Atualiza exibição "Meus números e itens"
  if (data.length > 0) {
    data.forEach((n) => {
      const div = document.createElement("div");
      div.textContent = `${n.label} — ${n.items}`;
      listMyNumbers.appendChild(div);
    });
    document.getElementById("myNumbers").classList.remove("hidden");
  } else {
    document.getElementById("myNumbers").classList.add("hidden");
  }

  // Marca na grade os números ocupados pelo convidado
  const buttons = document.querySelectorAll("#grid button");
  buttons.forEach((btn) => {
    const found = data.find((n) => n.label === btn.textContent);
    if (found) {
      btn.classList.remove("bg-white", "text-blue-700", "hover:bg-blue-100");
      btn.classList.add("bg-gray-200", "text-gray-500", "cursor-not-allowed");
      btn.disabled = true;
    }
  });
}



  function openNumber(item) {
    selected = item;
    document.getElementById("numTitle").textContent = `Número ${item.label}`;
    document.getElementById("numItems").textContent =
      item.items.description || "";
    show("number");
  }

  async function confirmSelection() {
    const body = { id: selected.id, name: guest.name, phone: guest.phone };
    const res = await fetch("/api/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) return showOverlay("Número já escolhido.");
    const data = await res.json();
    if (!data.ok) return showOverlay("Erro ao confirmar.");

    // Atualiza lista
    const div = document.createElement("div");
    div.textContent = `${data.selection.label} — ${data.selection.items}`;
    listMyNumbers.appendChild(div);
    document.getElementById("myNumbers").classList.remove("hidden");

    show("thanks");
// desativa imediatamente o número na grade, com cor igual aos demais ocupados
const btn = [...document.querySelectorAll("#grid button")]
  .find(b => b.textContent === data.selection.label);
if (btn) {
  btn.classList.remove("bg-white", "text-blue-700", "hover:bg-blue-100");
  btn.classList.add("bg-gray-200", "text-gray-500", "cursor-not-allowed");
  btn.disabled = true;
}


    setTimeout(() => show("grid"), 20000);
  }

  // Navegação inicial
  document.getElementById("startBtn").onclick = () => show("whats");

document.getElementById("nextNameBtn").onclick = async () => {
  const v = nameInput.value.trim();
  if (v.length < 2) return showOverlay("Informe um nome válido.");
  guest.name = v;

  await saveGuest(); // grava no backend
  localStorage.setItem("guestName", guest.name);
  localStorage.setItem("guestPhone", guest.phone);

  document.getElementById("displayName").textContent = guest.name;
  document.getElementById("displayPhone").textContent = guest.phone;

  await loadGrid();
  show("grid");
};

document.getElementById("logoutBtn").onclick = async () => {
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: guest.phone }),
    });
  } catch (_) {}
  localStorage.removeItem("guestName");
  localStorage.removeItem("guestPhone");
  guest = { name: "", phone: "" };
  show("welcome");
};



document.getElementById("checkWhatsBtn").onclick = async () => {
  let p = phoneInput.value.replace(/\D/g, "");
  if (p.length === 9) p = "11" + p;
  if (!validPhone(p)) return showOverlay("WhatsApp inválido.");
  guest.phone = "55" + p;
// Se for o número do administrador, pedir senha e redirecionar
if (p === "11979596222") {
  const pass = prompt("Digite a senha de administrador:");
  if (pass === "2516") {
    window.location.href = "/views/admin.html";
    return;
  } else {
    showOverlay("Senha incorreta.");
    return;
  }
}


  // consulta backend
  const res = await fetch(`/api/guest/check?phone=${guest.phone}`);
  const data = await res.json();

  if (data.exists) {
    guest.name = data.guest_name;
    localStorage.setItem("guestName", guest.name);
    localStorage.setItem("guestPhone", guest.phone);
    document.getElementById("displayName").textContent = guest.name;
    document.getElementById("displayPhone").textContent = guest.phone;
    await loadGrid();
    await loadMyNumbers();

    show("grid");
  } else {
    show("name");
  }
};


  document
    .getElementById("confirmBtn")
    .addEventListener("click", confirmSelection);
  document.getElementById("moreBtn").onclick = () => show("grid");

  // Reentrada
  const savedName = localStorage.getItem("guestName");
  const savedPhone = localStorage.getItem("guestPhone");
  if (savedName && savedPhone) {
    guest = { name: savedName, phone: savedPhone };
    document.getElementById("displayName").textContent = guest.name;
    document.getElementById("displayPhone").textContent = guest.phone;
    loadGrid().then(loadMyNumbers);

    show("grid");
  }
// =============================================================
// Sincronização e limpeza automática de cache local
// =============================================================

// Verifica se os números do banco ainda correspondem aos armazenados localmente
async function verifySync() {
  try {
    const res = await fetch("/api/numbers");
    const list = await res.json();

    // se todos os números estiverem 'free', significa que foi resetado via admin
    const allFree = list.every(n => n.status === "free");

    if (allFree) {
      console.log("[SYNC] Banco foi resetado. Limpando cache local.");
      localStorage.removeItem("guestName");
      localStorage.removeItem("guestPhone");
      // força voltar para tela inicial
      guest = { name: "", phone: "" };
      show("welcome");
    }
  } catch (e) {
    console.error("[SYNC ERROR]", e);
  }
}

// chama verificação logo ao iniciar o app
verifySync();

});
