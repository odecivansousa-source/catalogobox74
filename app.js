/* =======================================================
   Catálogo Online BOX74 — loja pública + painel adm
   Vanilla JS + Supabase.
   ======================================================= */

const raiz = document.getElementById("raiz");
let supa = null;
let sessaoAdm = null;

let produtos = [];
let abaLoja = "todos"; // "todos" | "ofertas"
let carrinho = []; // { id, nome, preco, foto, quantidade }
let carrinhoAberto = false;
let telaCheckout = false;

let telaAdm = "produtos";

/* ---------- Inicialização ---------- */
function registrarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .then(() => {
          console.log("BOX74 PWA ativado.");
        })
        .catch((erro) => {
          console.error("Erro ao ativar o PWA:", erro);
        });
    });
  }
}
function configEhValida() {
  return (
    window.CONFIG &&
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY &&
    !CONFIG.SUPABASE_URL.includes("COLE_AQUI") &&
    !CONFIG.SUPABASE_ANON_KEY.includes("COLE_AQUI")
  );
}

async function iniciar() {
 registrarPWA(); 
   if (!configEhValida()) {
    raiz.innerHTML = `
      <div class="tela-login"><div class="cartao-login">
        <h1>Quase lá 🧴</h1>
        <p class="sub">Abra o arquivo <strong>config.js</strong> e cole a URL e a chave
        "anon public" do seu projeto Supabase. Depois, atualize esta página.</p>
      </div></div>`;
    return;
  }
  supa = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  const { data } = await supa.auth.getSession();
  sessaoAdm = data.session;
  supa.auth.onAuthStateChange((_ev, nova) => { sessaoAdm = nova; });

  window.addEventListener("hashchange", rotear);
  await carregarProdutos();
  rotear();
}

function rotear() {
  if (location.hash.startsWith("#admin")) {
    if (sessaoAdm) renderPainelAdm();
    else renderLoginAdm();
  } else {
    renderLoja();
  }
}

async function carregarProdutos() {
  const { data } = await supa.from("produtos").select("*").order("created_at", { ascending: false });
  produtos = data || [];
}

/* ---------- Utilidades ---------- */

function formatarMoeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function comprimirImagem(file, maxLado = 700, qualidade = 0.72) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) { height = height * (maxLado / width); width = maxLado; }
        else if (height > maxLado) { width = width * (maxLado / height); height = maxLado; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.onerror = reject;
      img.src = leitor.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(file);
  });
}

/* =======================================================
   LOJA PÚBLICA
   ======================================================= */

function renderLoja() {
  const listaFiltrada = abaLoja === "ofertas" ? produtos.filter((p) => p.oferta) : produtos;

  raiz.innerHTML = `
    <div class="topo-loja">
      <div class="topo-loja-interno">
        <div class="marca-loja">
          <img src="logo.png" alt="Logo ${escapeAttr(CONFIG.NOME_LOJA)}" onerror="this.style.display='none'">
          <div>
            <div class="titulo-marca">${escapeHtml(CONFIG.NOME_LOJA)}</div>
            <div class="subtitulo">Produtos de limpeza</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <a class="link-adm" href="#admin">Painel administrativo</a>
          <button class="btn-carrinho" id="btn-abrir-carrinho">
            🛒 Carrinho
            ${carrinho.length ? `<span class="contagem">${carrinho.reduce((s, i) => s + i.quantidade, 0)}</span>` : ""}
          </button>
        </div>
      </div>
    </div>
    <div class="faixa-abas">
      <button class="aba-catalogo ${abaLoja === "todos" ? "ativa" : ""}" data-aba="todos">Todos os produtos</button>
      <button class="aba-catalogo ${abaLoja === "ofertas" ? "ativa" : ""}" data-aba="ofertas">🔥 Ofertas</button>
    </div>
    <div class="miolo-loja">
      ${
        listaFiltrada.length === 0
          ? `<div class="vazio">${abaLoja === "ofertas" ? "Nenhuma oferta no momento." : "Nenhum produto cadastrado ainda."}</div>`
          : `<div class="grade-produtos">${listaFiltrada.map(cartaoProdutoHtml).join("")}</div>`
      }
    </div>
    <nav class="barra-navegacao-mobile">
  <button type="button" data-nav="inicio">
    <span>🏠</span>
    <small>Início</small>
  </button>

  <button type="button" data-nav="ofertas">
    <span>🔥</span>
    <small>Ofertas</small>
  </button>

  <button type="button" data-nav="carrinho">
    <span>🛒</span>
    <small>Carrinho</small>
    ${carrinho.length ? `<b>${carrinho.reduce((s, i) => s + i.quantidade, 0)}</b>` : ""}
  </button>

  <button type="button" data-nav="admin">
    <span>⚙️</span>
    <small>Admin</small>
  </button>
</nav>
    ${carrinhoAberto ? htmlPainelCarrinho() : ""}
  `;

  document.querySelectorAll("[data-aba]").forEach((b) =>
    b.addEventListener("click", () => { abaLoja = b.dataset.aba; renderLoja(); })
  );
  document.getElementById("btn-abrir-carrinho").addEventListener("click", () => { carrinhoAberto = true; telaCheckout = false; renderLoja(); });

document.querySelectorAll("[data-nav]").forEach((botao) => {
  botao.addEventListener("click", () => {
    const destino = botao.dataset.nav;

    if (destino === "inicio") {
      abaLoja = "todos";
      carrinhoAberto = false;
      renderLoja();
    }

    if (destino === "ofertas") {
      abaLoja = "ofertas";
      carrinhoAberto = false;
      renderLoja();
    }

    if (destino === "carrinho") {
      carrinhoAberto = true;
      telaCheckout = false;
      renderLoja();
    }

    if (destino === "admin") {
      location.hash = "admin";
    }
  });
});  
   document.querySelectorAll("[data-add-carrinho]").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.dataset.addCarrinho;
      const qtdInput = document.querySelector(`[data-qtd-input="${id}"]`);
      const qtd = Math.max(1, parseInt(qtdInput.value) || 1);
      adicionarAoCarrinho(id, qtd);
    })
  );

  if (carrinhoAberto) ligarEventosCarrinho();
}

function cartaoProdutoHtml(p) {
  const semEstoque = p.estoque <= 0;
  return `
    <div class="cartao-produto">
      <div class="foto-produto">
        ${p.oferta ? `<span class="selo-oferta">Oferta</span>` : ""}
        ${p.foto ? `<img src="${p.foto}" alt="${escapeAttr(p.nome)}">` : `<span class="sem-foto">🧴</span>`}
      </div>
      <div class="info-produto">
        <div class="nome">${escapeHtml(p.nome)}</div>
        <div class="preco">${formatarMoeda(p.preco)}</div>
        <div class="estoque ${semEstoque ? "indisponivel" : ""}">${semEstoque ? "Indisponível no momento" : `${p.estoque} em estoque`}</div>
        <div class="linha-adicionar">
          <input type="number" min="1" max="${p.estoque}" value="1" data-qtd-input="${p.id}" ${semEstoque ? "disabled" : ""}>
          <button class="btn btn-principal" data-add-carrinho="${p.id}" ${semEstoque ? "disabled" : ""}>Adicionar</button>
        </div>
      </div>
    </div>`;
}

function adicionarAoCarrinho(produtoId, quantidade) {
  const p = produtos.find((x) => x.id === produtoId);
  if (!p) return;
  const existente = carrinho.find((i) => i.id === produtoId);
  if (existente) existente.quantidade = Math.min(p.estoque, existente.quantidade + quantidade);
  else carrinho.push({ id: p.id, nome: p.nome, preco: p.preco, foto: p.foto, quantidade: Math.min(p.estoque, quantidade) });
  carrinhoAberto = true;
  renderLoja();
}

function htmlPainelCarrinho() {
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  if (telaCheckout) return htmlCheckout(total);
  return `
    <div class="fundo-painel" id="fundo-carrinho">
      <div class="painel-carrinho">
        <button class="fechar-painel" id="fechar-carrinho">&times;</button>
        <h2>Seu carrinho</h2>
        ${
          carrinho.length === 0
            ? `<div class="vazio">Seu carrinho está vazio.</div>`
            : carrinho
                .map(
                  (i) => `
              <div class="item-carrinho">
                ${i.foto ? `<img src="${i.foto}">` : `<div style="width:48px;height:48px;"></div>`}
                <div class="nome-item">${escapeHtml(i.nome)}<div class="qtd-item">${i.quantidade} x ${formatarMoeda(i.preco)}</div></div>
                <button class="remover-item" data-remover="${i.id}">remover</button>
              </div>`
                )
                .join("")
        }
        ${
          carrinho.length
            ? `<div class="total-carrinho"><span>Total</span><span>${formatarMoeda(total)}</span></div>
               <button class="btn btn-principal btn-bloco" style="margin-top:16px;" id="btn-ir-checkout">Finalizar pedido</button>`
            : ""
        }
      </div>
    </div>`;
}

function htmlCheckout(total) {
  return `
    <div class="fundo-painel" id="fundo-carrinho">
      <div class="painel-carrinho">
        <button class="fechar-painel" id="fechar-carrinho">&times;</button>
        <h2>Finalizar pedido</h2>
        <p style="font-size:0.86rem; color:var(--texto-suave);">Confira o pedido, copie a chave Pix para pagar e depois envie o pedido no WhatsApp da loja.</p>
        ${carrinho.map((i) => `
          <div class="item-carrinho">
            ${i.foto ? `<img src="${i.foto}">` : `<div style="width:48px;height:48px;"></div>`}
            <div class="nome-item">${escapeHtml(i.nome)}<div class="qtd-item">${i.quantidade} x ${formatarMoeda(i.preco)}</div></div>
            <div>${formatarMoeda(i.preco * i.quantidade)}</div>
          </div>`).join("")}
        <div class="total-carrinho"><span>Total</span><span>${formatarMoeda(total)}</span></div>
        <div class="bloco-pix">
          <div class="rotulo">Pagar com Pix para</div>
          <div style="font-weight:600; margin:2px 0;">${escapeHtml(CONFIG.PIX_NOME)}</div>
          <div class="chave" id="texto-chave-pix">${escapeHtml(CONFIG.PIX_CHAVE)}</div>
          <button class="btn btn-secundario btn-bloco" id="btn-copiar-pix">Copiar chave Pix</button>
        </div>
        <button class="btn btn-principal btn-bloco" id="btn-enviar-whats">Enviar pedido no WhatsApp</button>
        <button class="btn btn-secundario btn-bloco" style="margin-top:8px;" id="btn-voltar-carrinho">Voltar ao carrinho</button>
      </div>
    </div>`;
}

function ligarEventosCarrinho() {
  const fundo = document.getElementById("fundo-carrinho");
  fundo.addEventListener("click", (e) => { if (e.target === fundo) { carrinhoAberto = false; renderLoja(); } });
  document.getElementById("fechar-carrinho").addEventListener("click", () => { carrinhoAberto = false; renderLoja(); });

  document.querySelectorAll("[data-remover]").forEach((el) =>
    el.addEventListener("click", () => {
      carrinho = carrinho.filter((i) => i.id !== el.dataset.remover);
      renderLoja();
    })
  );

  const btnCheckout = document.getElementById("btn-ir-checkout");
  if (btnCheckout) btnCheckout.addEventListener("click", () => { telaCheckout = true; renderLoja(); });

  const btnVoltar = document.getElementById("btn-voltar-carrinho");
  if (btnVoltar) btnVoltar.addEventListener("click", () => { telaCheckout = false; renderLoja(); });

  const btnCopiar = document.getElementById("btn-copiar-pix");
  if (btnCopiar) btnCopiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.PIX_CHAVE);
      btnCopiar.textContent = "Chave copiada ✓";
      setTimeout(() => { btnCopiar.textContent = "Copiar chave Pix"; }, 2000);
    } catch {
      alert("Não foi possível copiar automaticamente. Chave Pix: " + CONFIG.PIX_CHAVE);
    }
  });

  const btnWhats = document.getElementById("btn-enviar-whats");
  if (btnWhats) btnWhats.addEventListener("click", enviarPedidoWhatsApp);
}

function enviarPedidoWhatsApp() {
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const linhas = carrinho.map((i) => `• ${i.quantidade}x ${i.nome} — ${formatarMoeda(i.preco * i.quantidade)}`).join("\n");
  const mensagem =
    `Olá! Quero fazer um pedido na ${CONFIG.NOME_LOJA}:\n\n${linhas}\n\n` +
    `Total: ${formatarMoeda(total)}\n\n` +
    `Já fiz o Pix para ${CONFIG.PIX_NOME}. Segue o comprovante.`;
  const url = `https://wa.me/${CONFIG.WHATSAPP_LOJA}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

/* =======================================================
   PAINEL ADMINISTRATIVO
   ======================================================= */

function renderLoginAdm(erro) {
  raiz.innerHTML = `
    <div class="tela-login">
      <div class="cartao-login">
        <h1>Painel — ${escapeHtml(CONFIG.NOME_LOJA)}</h1>
        <p class="sub">Digite o código de acesso da loja.</p>
        ${erro ? `<div class="erro">${erro}</div>` : ""}
        <form id="form-pin">
          <div class="campo">
            <label for="pin">Código de acesso</label>
            <input id="pin" type="password" inputmode="numeric" required autofocus>
          </div>
          <button class="btn btn-principal btn-bloco" type="submit">Entrar</button>
        </form>
        <div style="text-align:center; margin-top:14px;">
          <a class="link-adm" href="#">&larr; Voltar para a loja</a>
        </div>
      </div>
    </div>`;

  document.getElementById("form-pin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = document.getElementById("pin").value.trim();
    const { data, error } = await supa.auth.signInWithPassword({ email: CONFIG.ADMIN_EMAIL, password: pin });
    if (error) { renderLoginAdm("Código incorreto."); return; }
    sessaoAdm = data.session;
    renderPainelAdm();
  });
}

async function sairAdm() {
  await supa.auth.signOut();
  sessaoAdm = null;
  location.hash = "";
}

function shellAdm(conteudoHtml) {
  raiz.innerHTML = `
    <div class="app-adm">
      <div class="barra-lateral-adm">
        <div class="marca-adm">🧴 ${escapeHtml(CONFIG.NOME_LOJA)}</div>
        <button data-tela-adm="produtos">Produtos</button>
        <button data-tela-adm="ofertas">Ofertas</button>
        <div class="rodape-adm">
          <a href="#">Ver a loja</a>
          <button id="btn-sair-adm">Sair</button>
        </div>
      </div>
      <div class="conteudo-adm" id="conteudo-adm">${conteudoHtml}</div>
    </div>`;
  document.querySelectorAll("[data-tela-adm]").forEach((b) =>
    b.addEventListener("click", () => { telaAdm = b.dataset.telaAdm; renderPainelAdm(); })
  );
  document.getElementById("btn-sair-adm").addEventListener("click", sairAdm);
}

async function renderPainelAdm() {
  await carregarProdutos();
  const lista = telaAdm === "ofertas" ? produtos.filter((p) => p.oferta) : produtos;

  shellAdm(`
    <div class="cabecalho-pagina">
      <div>
        <h1>${telaAdm === "ofertas" ? "Ofertas" : "Produtos"}</h1>
        <p>${telaAdm === "ofertas" ? "Produtos marcados como oferta — aparecem na aba Ofertas da loja" : "Catálogo completo da loja"}</p>
      </div>
      <button class="btn btn-principal" id="btn-novo-produto">+ Novo produto</button>
    </div>
    <div class="envolucro-tabela">
      ${
        lista.length === 0
          ? `<div class="vazio">${telaAdm === "ofertas" ? "Nenhum produto em oferta." : "Nenhum produto cadastrado."}</div>`
          : `<table class="tabela-adm">
              <thead><tr><th></th><th>Nome</th><th>Preço</th><th>Estoque</th><th>Oferta</th><th></th></tr></thead>
              <tbody>
                ${lista.map((p) => `
                  <tr>
                    <td>${p.foto ? `<img src="${p.foto}">` : "—"}</td>
                    <td>${escapeHtml(p.nome)}</td>
                    <td>${formatarMoeda(p.preco)}</td>
                    <td>${p.estoque}</td>
                    <td>${p.oferta ? `<span class="selo-mini ativa">Sim</span>` : "—"}</td>
                    <td class="acoes-linha">
                      <button data-editar="${p.id}">Editar</button>
                      <button data-excluir="${p.id}">Excluir</button>
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>`
      }
    </div>
  `);

  document.getElementById("btn-novo-produto").addEventListener("click", () => abrirModalProduto());
  document.querySelectorAll("[data-editar]").forEach((el) =>
    el.addEventListener("click", () => abrirModalProduto(produtos.find((p) => p.id === el.dataset.editar)))
  );
  document.querySelectorAll("[data-excluir]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (!confirm("Excluir este produto?")) return;
      await supa.from("produtos").delete().eq("id", el.dataset.excluir);
      renderPainelAdm();
    })
  );
}

function abrirModalProduto(produto) {
  const editando = !!produto;
  const div = document.createElement("div");
  div.className = "fundo-modal";
  div.innerHTML = `
    <div class="modal">
      <div class="modal-cabecalho">
        <h2>${editando ? "Editar produto" : "Novo produto"}</h2>
        <button class="fechar-modal" data-fechar>&times;</button>
      </div>
      <form id="form-produto">
        <div class="campo">
          <label>Foto do produto</label>
          ${editando && produto.foto ? `<img class="previa-foto" id="previa-foto" src="${produto.foto}">` : `<img class="previa-foto" id="previa-foto" style="display:none;">`}
          <input type="file" accept="image/*" id="input-foto">
        </div>
        <div class="campo">
          <label>Nome do produto</label>
          <input name="nome" required value="${editando ? escapeAttr(produto.nome) : ""}">
        </div>
        <div class="campo">
          <label>Descrição (opcional)</label>
          <input name="descricao" value="${editando ? escapeAttr(produto.descricao || "") : ""}">
        </div>
        <div class="grade-2">
          <div class="campo">
            <label>Preço (R$)</label>
            <input name="preco" type="number" step="0.01" min="0" required value="${editando ? produto.preco : ""}">
          </div>
          <div class="campo">
            <label>Estoque</label>
            <input name="estoque" type="number" step="1" min="0" required value="${editando ? produto.estoque : "0"}">
          </div>
        </div>
        <div class="linha-checkbox">
          <input type="checkbox" id="check-oferta" ${editando && produto.oferta ? "checked" : ""}>
          <label for="check-oferta" style="margin:0;">Colocar em oferta (aparece na aba Ofertas)</label>
        </div>
        <div class="linha-form-acoes">
          <button class="btn btn-principal" type="submit">${editando ? "Salvar" : "Cadastrar"}</button>
          ${editando ? `<button type="button" class="btn btn-perigo" id="btn-excluir-modal">Excluir</button>` : ""}
        </div>
      </form>
    </div>`;
  document.body.appendChild(div);
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
  div.querySelector("[data-fechar]").addEventListener("click", () => div.remove());

  let fotoBase64 = editando ? produto.foto || null : null;
  div.querySelector("#input-foto").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    fotoBase64 = await comprimirImagem(arquivo);
    const previa = div.querySelector("#previa-foto");
    previa.src = fotoBase64;
    previa.style.display = "block";
  });

  div.querySelector("#form-produto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const registro = {
      nome: fd.get("nome").trim(),
      descricao: fd.get("descricao").trim(),
      preco: Number(fd.get("preco")),
      estoque: parseInt(fd.get("estoque")) || 0,
      oferta: div.querySelector("#check-oferta").checked,
      foto: fotoBase64,
    };
    if (editando) await supa.from("produtos").update(registro).eq("id", produto.id);
    else await supa.from("produtos").insert(registro);
    div.remove();
    renderPainelAdm();
  });

  if (editando) {
    div.querySelector("#btn-excluir-modal").addEventListener("click", async () => {
      if (!confirm("Excluir este produto?")) return;
      await supa.from("produtos").delete().eq("id", produto.id);
      div.remove();
      renderPainelAdm();
    });
  }
}

iniciar();
