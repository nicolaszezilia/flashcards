import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { iniciarNuvem, pararNuvem } from "./nuvem.js";
const firebaseConfig = {
  apiKey: "AIzaSyBeGiiOqxB-KXgWmvsJmjau0c0PqxfjaNY",
  authDomain: "flashcards-124f8.firebaseapp.com",
  projectId: "flashcards-124f8",
  storageBucket: "flashcards-124f8.firebasestorage.app",
  messagingSenderId: "672565160880",
  appId: "1:672565160880:web:d8d1f54091d99659d70475",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Fica disponível para as próximas etapas (sincronização)
window.conta = { app, auth, usuario: null };

const $ = (id) => document.getElementById(id);

// ---------- Tela de login ----------
const tela = document.createElement("div");
tela.id = "tela-login";
tela.innerHTML = `
  <form id="form-login" novalidate>
    <h1>Flashcards</h1>
    <p id="login-sub">Entre na sua conta</p>
    <input id="login-email" type="email" inputmode="email" autocomplete="username"
           autocapitalize="none" placeholder="E-mail">
    <input id="login-senha" type="password" autocomplete="current-password"
           placeholder="Senha (mínimo 6 caracteres)">
    <p id="login-msg" class="oculto"></p>
    <button id="login-enviar" type="submit">Entrar</button>
    <button id="login-alternar" type="button" class="login-link">Não tenho conta: criar</button>
    <button id="login-esqueci" type="button" class="login-link">Esqueci a senha</button>
  </form>`;
document.body.appendChild(tela);

let modoCriar = false;

function mostrarMsg(texto) {
  $("login-msg").textContent = texto;
  $("login-msg").classList.toggle("oculto", !texto);
}

function ajustarModo() {
  $("login-sub").textContent = modoCriar ? "Crie sua conta" : "Entre na sua conta";
  $("login-enviar").textContent = modoCriar ? "Criar conta" : "Entrar";
  $("login-alternar").textContent = modoCriar ? "Já tenho conta: entrar" : "Não tenho conta: criar";
  $("login-senha").autocomplete = modoCriar ? "new-password" : "current-password";
  $("login-esqueci").classList.toggle("oculto", modoCriar);
  mostrarMsg("");
}

function traduzirErro(e) {
  switch (e && e.code) {
    case "auth/invalid-email": return "E-mail inválido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use": return "Este e-mail já tem conta. Toque em \"Já tenho conta: entrar\".";
    case "auth/weak-password": return "Senha fraca: use pelo menos 6 caracteres.";
    case "auth/network-request-failed": return "Sem internet. Conecte-se para entrar.";
    case "auth/too-many-requests": return "Muitas tentativas. Aguarde alguns minutos.";
    case "auth/unauthorized-domain": return "Este endereço não está em Domínios autorizados no Firebase.";
    case "auth/operation-not-allowed": return "Login por e-mail/senha não está ativado no Firebase.";
    default: return "Erro: " + ((e && e.code) || (e && e.message) || e);
  }
}

$("login-alternar").addEventListener("click", () => {
  modoCriar = !modoCriar;
  ajustarModo();
});

$("login-esqueci").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  if (!email) {
    mostrarMsg("Digite seu e-mail acima e toque em \"Esqueci a senha\" de novo.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMsg("Enviamos um link de redefinição para " + email + ". Veja também o spam.");
  } catch (e) {
    mostrarMsg(traduzirErro(e));
  }
});

$("form-login").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  mostrarMsg("");
  const email = $("login-email").value.trim();
  const senha = $("login-senha").value;
  if (!email || !senha) {
    mostrarMsg("Preencha e-mail e senha.");
    return;
  }
  $("login-enviar").disabled = true;
  try {
    if (modoCriar) await createUserWithEmailAndPassword(auth, email, senha);
    else await signInWithEmailAndPassword(auth, email, senha);
    $("login-senha").value = "";
  } catch (e) {
    mostrarMsg(traduzirErro(e));
  } finally {
    $("login-enviar").disabled = false;
  }
});

// ---------- Botão Sair (em Ajustes) ----------
const blocoSair = document.createElement("div");
blocoSair.id = "bloco-conta";
const textoConta = document.createElement("p");
const botaoSair = document.createElement("button");
botaoSair.type = "button";
botaoSair.id = "btn-sair-conta";
botaoSair.textContent = "Sair da conta";
blocoSair.append(textoConta, botaoSair);
document.getElementById("tela-ajustes").appendChild(blocoSair);

botaoSair.addEventListener("click", async () => {
  if (confirm("Sair da conta neste aparelho?")) await signOut(auth);
});

// ---------- Reage a entrar / sair ----------
onAuthStateChanged(auth, (user) => {
  window.conta.usuario = user;
  tela.classList.toggle("oculto", !!user);
  document.body.classList.toggle("bloqueado", !user);
  textoConta.textContent = user ? "Conta: " + user.email : "";
  blocoSair.classList.toggle("oculto", !user);
});
