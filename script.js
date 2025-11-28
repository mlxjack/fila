// script.js

// Nome das vendedoras em ordem (Dani, Talita, Renata)
const vendedoras = ["Dani", "Talita", "Renata"];

// Senha de acesso
const PASSWORD = "equipedevendas";

// Elementos DOM
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const passwordInput = document.getElementById("password-input");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout-button");

// Queue elements
const queueElements = {
  whatsapp: {
    current: document.getElementById("whatsapp-current"),
    orderList: document.getElementById("whatsapp-order"),
    historyBody: document.getElementById("whatsapp-history"),
    form: document.getElementById("whatsapp-form"),
  },
  site: {
    current: document.getElementById("site-current"),
    orderList: document.getElementById("site-order"),
    historyBody: document.getElementById("site-history"),
    form: document.getElementById("site-form"),
  },
};

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o usuário já está logado
  if (localStorage.getItem("loggedIn") === "true") {
    showApp();
  } else {
    showLogin();
  }

  // Eventos de login
  loginButton.addEventListener("click", handleLogin);
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  // Evento de logout
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    location.reload();
  });

  // Eventos das filas
  document.querySelectorAll(".next-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const queue = btn.dataset.queue;
      advanceQueue(queue);
    });
  });

  // Eventos dos formulários
  Object.keys(queueElements).forEach((queue) => {
    const form = queueElements[queue].form;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      registerAtendimento(queue);
    });
  });
});

function handleLogin() {
  const value = passwordInput.value.trim();
  if (value === PASSWORD) {
    localStorage.setItem("loggedIn", "true");
    passwordInput.value = "";
    loginError.textContent = "";
    showApp();
  } else {
    loginError.textContent = "Senha incorreta. Tente novamente.";
    passwordInput.value = "";
  }
}

// Exibe a tela de login
function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

// Exibe a tela principal e inicializa dados
function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  initQueues();
}

// Inicializa as filas (ordem, posição atual e histórico)
function initQueues() {
  // Para cada fila, certifique-se de que existem chaves de índice e histórico
  ["whatsapp", "site"].forEach((queue) => {
    if (!localStorage.getItem(`${queue}Index`)) {
      localStorage.setItem(`${queue}Index`, "0");
    }
    if (!localStorage.getItem(`${queue}History`)) {
      localStorage.setItem(`${queue}History`, JSON.stringify([]));
    }
    renderQueue(queue);
    renderHistory(queue);
  });

  // Carrega o histórico da planilha Google, caso disponível
  loadHistoryFromSheet();

  // Sincroniza periodicamente o histórico da planilha. Isso garante que o
  // histórico seja atualizado mesmo quando diferentes usuárias estiverem
  // utilizando o sistema em máquinas distintas. A cada 30 segundos, uma
  // solicitação doGet é realizada e o localStorage atualizado. A variável
  // global previne múltiplas instâncias do temporizador.
  if (!window.historySyncInterval) {
    window.historySyncInterval = setInterval(() => {
      loadHistoryFromSheet();
    }, 30000);
  }
}

// Avança para a próxima vendedora na fila
function advanceQueue(queue) {
  const indexKey = `${queue}Index`;
  let currentIndex = parseInt(localStorage.getItem(indexKey), 10);
  currentIndex = (currentIndex + 1) % vendedoras.length;
  localStorage.setItem(indexKey, currentIndex.toString());
  renderQueue(queue);
}

// Renderiza o estado atual da fila (vendedora da vez e ordem)
function renderQueue(queue) {
  const currentIndex = parseInt(localStorage.getItem(`${queue}Index`), 10);
  const elements = queueElements[queue];
  // Atualiza a vendedora da vez
  elements.current.textContent = vendedoras[currentIndex];
  // Renderiza a lista com destaque para a atual
  elements.orderList.innerHTML = "";
  vendedoras.forEach((nome, idx) => {
    const li = document.createElement("li");
    li.textContent = nome;
    if (idx === currentIndex) {
      li.classList.add("current");
    }
    elements.orderList.appendChild(li);
  });
}

// Registra um atendimento e salva no histórico da fila
function registerAtendimento(queue) {
  const index = parseInt(localStorage.getItem(`${queue}Index`), 10);
  const vendedora = vendedoras[index];
  const form = queueElements[queue].form;
  // Recupere os valores dos campos a partir de IDs exclusivos para cada fila.
  let cliente = '';
  let contato = '';
  let observacao = '';
  if (queue === 'whatsapp') {
    cliente = (document.getElementById('cliente-whatsapp').value || '').trim();
    contato = (document.getElementById('contato-whatsapp').value || '').trim();
    observacao = (document.getElementById('observacao-whatsapp').value || '').trim();
  } else if (queue === 'site') {
    cliente = (document.getElementById('cliente-site').value || '').trim();
    contato = (document.getElementById('contato-site').value || '').trim();
    observacao = (document.getElementById('observacao-site').value || '').trim();
  }
  const dataHora = formatDate(new Date());
  // Cria o objeto do atendimento
  const atendimento = {
    dataHora,
    vendedora,
    cliente,
    contato,
    observacao,
  };
  // Recupera histórico, adiciona e salva
  const historyKey = `${queue}History`;
  const history = JSON.parse(localStorage.getItem(historyKey));
  history.unshift(atendimento); // adiciona no início
  localStorage.setItem(historyKey, JSON.stringify(history));
  // Limpa o formulário
  form.reset();
  // Atualiza a tabela
  renderHistory(queue);

  // Após registrar, avança automaticamente para a próxima vendedora
  advanceQueue(queue);

  // Envia o registro para a planilha via Apps Script
  saveToSheet(queue, atendimento);

  // Recarrega o histórico após alguns segundos para garantir que o
  // registro gravado apareça para todas as usuárias. O atraso concede
  // tempo para que o Apps Script processe a gravação.
  setTimeout(() => {
    loadHistoryFromSheet();
  }, 2000);
}

// Renderiza a tabela de histórico da fila
function renderHistory(queue) {
  const historyKey = `${queue}History`;
  const history = JSON.parse(localStorage.getItem(historyKey));
  const tbody = queueElements[queue].historyBody;
  tbody.innerHTML = "";
  history.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.dataHora}</td>
      <td>${item.vendedora}</td>
      <td>${item.cliente}</td>
      <td>${item.contato}</td>
      <td>${item.observacao || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Formata uma data para DD/MM/YYYY HH:MM
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// URL do Apps Script implantado (substitua pela URL apropriada)
const scriptURL =
  'https://script.google.com/macros/s/AKfycbw8qfhJKKt4vYdFoUHUn0AVqTl9KVDrLRqF5xzYLGFYqSRslDcMXraAoGb6ekR4R6nR/exec';

/**
 * Envia os dados de atendimento para a planilha Google através do Apps Script.
 * O corpo da requisição inclui a fila para que o script possa diferenciar
 * entre WhatsApp e Site. A opção `no-cors` é usada para contornar restrições
 * de CORS — embora a resposta seja opaca, isso não interfere na gravação.
 * @param {string} queue - identifica a fila (whatsapp ou site)
 * @param {Object} atendimento - dados do atendimento (dataHora, vendedora,
 *   cliente, contato, observacao)
 */
function saveToSheet(queue, atendimento) {
  const payload = {
    fila: queue,
    dataHora: atendimento.dataHora,
    vendedora: atendimento.vendedora,
    cliente: atendimento.cliente,
    contato: atendimento.contato,
    observacao: atendimento.observacao,
  };
  if (!scriptURL || scriptURL.startsWith('COLE_AQUI')) return;
  fetch(scriptURL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.error('Erro ao enviar dados para a planilha', err));
}

/**
 * Recupera os dados da planilha Google via método GET do Apps Script. Os
 * dados retornados são uma lista de objetos representando cada linha da
 * planilha. Essa função atualiza o localStorage para ambas as filas e
 * re-renderiza o histórico. Se a planilha não estiver configurada ou se
 * houver algum erro, a chamada é ignorada.
 */
function loadHistoryFromSheet() {
  if (!scriptURL || scriptURL.startsWith('COLE_AQUI')) return;
  const url = scriptURL + '?action=get';
  fetch(url)
    .then((response) => {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }
      return response.text().then((text) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('Resposta inesperada ao carregar histórico');
        }
      });
    })
    .then((data) => {
      if (!Array.isArray(data)) return;
      const whatsHistory = [];
      const siteHistory = [];
      data.forEach((item) => {
        const fila = item.Fila || item.fila || '';
        const registro = {
          dataHora: item['Data/Hora'] || item.dataHora || '',
          vendedora: item.Vendedora || item.vendedora || '',
          cliente: item.Cliente || item.cliente || '',
          contato: item.Contato || item.contato || '',
          observacao: item['Observação'] || item.observacao || '',
        };
        if (fila === 'whatsapp') {
          whatsHistory.push(registro);
        } else if (fila === 'site') {
          siteHistory.push(registro);
        }
      });
      // Atualiza o armazenamento local e a visualização
      localStorage.setItem('whatsappHistory', JSON.stringify(whatsHistory));
      localStorage.setItem('siteHistory', JSON.stringify(siteHistory));
      renderHistory('whatsapp');
      renderHistory('site');
    })
    .catch((err) => console.error('Erro ao carregar histórico da planilha', err));
}