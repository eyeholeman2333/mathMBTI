// ============================================================
// MITI App — 主逻辑
// ============================================================

// ── 状态 ─────────────────────────────────────────────────────
let answers = new Array(16).fill(null); // null | 0 | 1
let currentQ = 0;

// ── 页面切换 ─────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── 首页 ─────────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => {
  answers = new Array(16).fill(null);
  currentQ = 0;
  renderQuestion(0);
  showPage("page-quiz");
  initBgCanvas("bg-canvas"); // keep running
});

// ── 题目渲染 ─────────────────────────────────────────────────
function renderQuestion(idx) {
  const q = QUESTIONS[idx];
  const card = document.getElementById("question-card");

  // 退出动画
  card.classList.add("slide-out");
  setTimeout(() => {
    card.classList.remove("slide-out");

    document.getElementById("q-number").textContent = `Q${idx + 1}`;
    document.getElementById("q-text").textContent = q.text;
    document.getElementById("q-current").textContent = idx + 1;

    // 进度条
    const pct = (idx / 16) * 100;
    document.getElementById("progress-fill").style.width = pct + "%";

    // 维度指示
    const dimEl = document.getElementById("dim-indicator");
    const dim = DIMS[q.dim];
    dimEl.textContent = `维度 ${q.dim + 1}：${dim.label}`;
    dimEl.style.color = dim.colors[0];

    // 选项
    const optArea = document.getElementById("q-options");
    optArea.innerHTML = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "opt-btn" + (answers[idx] === i ? " selected" : "");
      btn.innerHTML = `<span class="opt-letter">${i === 0 ? "A" : "B"}</span><span class="opt-text">${opt.label}</span>`;
      btn.addEventListener("click", () => selectOption(idx, i));
      optArea.appendChild(btn);
    });

    // 导航按钮
    document.getElementById("btn-prev").disabled = idx === 0;
    updateNextBtn(idx);

    card.classList.add("slide-in");
    setTimeout(() => card.classList.remove("slide-in"), 400);
  }, 200);
}

function selectOption(qIdx, optIdx) {
  answers[qIdx] = optIdx;
  document.querySelectorAll(".opt-btn").forEach((btn, i) => {
    btn.classList.toggle("selected", i === optIdx);
  });
  updateNextBtn(qIdx);
}

function updateNextBtn(idx) {
  const btn = document.getElementById("btn-next");
  const answered = answers[idx] !== null;
  btn.disabled = !answered;
  if (idx === 15 && answered) {
    btn.textContent = "查看结果 ✓";
    btn.classList.add("btn-finish");
  } else {
    btn.textContent = "下一题 →";
    btn.classList.remove("btn-finish");
  }
}

document.getElementById("btn-prev").addEventListener("click", () => {
  if (currentQ > 0) { currentQ--; renderQuestion(currentQ); }
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (answers[currentQ] === null) return;
  if (currentQ < 15) { currentQ++; renderQuestion(currentQ); }
  else showResult();
});

// ── 计分 ─────────────────────────────────────────────────────
function calcScores() {
  // scores[dim] = { A: count, B: count }
  const scores = [
    { A: 0, B: 0 }, // dim0: A=C连续, B=D离散
    { A: 0, B: 0 }, // dim1: A=C构造, B=E存在
    { A: 0, B: 0 }, // dim2: A=P概率, B=Dt决定
    { A: 0, B: 0 }, // dim3: A=G全局, B=L局部
  ];
  QUESTIONS.forEach((q, i) => {
    const ans = answers[i];
    if (ans === null) return;
    const pole = q.options[ans].pole;
    // 按极性累计
    if (["C", "E", "P", "Dt", "G", "L", "D"].includes(pole)) {
      const dimScore = scores[q.dim];
      if (ans === 0) dimScore.A++; else dimScore.B++;
    }
  });
  return scores;
}

function buildTypeCode(scores) {
  // dim0: A≥2 → C(连续), else D(离散)
  const d0 = scores[0].A >= scores[0].B ? "C" : "D";
  // dim1: A≥2 → C(构造), else E(存在)
  const d1 = scores[1].A >= scores[1].B ? "C" : "E";
  // dim2: A≥2 → P(概率), else Dt(决定)
  const d2 = scores[2].A >= scores[2].B ? "P" : "Dt";
  // dim3: A≥2 → G(全局), else L(局部)
  const d3 = scores[3].A >= scores[3].B ? "G" : "L";

  // 构建可读类型码（与 TYPES 键对应）
  // 注意：键名用 D/C+C/E+P/Dt+G/L 排列
  return d0 + d1 + d2 + d3;
}

// ── 结果页 ─────────────────────────────────────────────────────
function showResult() {
  const scores = calcScores();
  const code = buildTypeCode(scores);
  const type = lookupType(code);

  // 类型头
  document.getElementById("result-type").textContent = type.code;
  document.getElementById("result-name").textContent = `${type.emoji} ${type.name}`;

  // 维度条
  const dimsEl = document.getElementById("result-dims");
  dimsEl.innerHTML = "";
  DIMS.forEach((dim, i) => {
    const total = scores[i].A + scores[i].B;
    const pctA = total ? Math.round((scores[i].A / total) * 100) : 50;
    const pctB = 100 - pctA;
    dimsEl.innerHTML += `
      <div class="dim-row">
        <span class="dim-pole" style="color:${dim.colors[0]}">${dim.poles[0]}</span>
        <div class="dim-bar-bg">
          <div class="dim-bar-a" style="width:${pctA}%;background:${dim.colors[0]}"></div>
          <div class="dim-bar-b" style="width:${pctB}%;background:${dim.colors[1]}"></div>
        </div>
        <span class="dim-pole" style="color:${dim.colors[1]}">${dim.poles[1]}</span>
      </div>`;
  });

  // 描述卡
  document.getElementById("res-title").textContent = `"${type.tagline}"`;
  document.getElementById("res-desc").textContent = type.desc;
  const tagsEl = document.getElementById("res-tags");
  tagsEl.innerHTML = type.fields.map(f => `<span class="field-tag">${f}</span>`).join("");

  // 搭档
  const collabEl = document.getElementById("result-collab");
  if (type.collab) {
    const cp = lookupType(type.collab);
    collabEl.innerHTML = `<div class="collab-card">
      <span class="collab-label">理想科研搭档</span>
      <span class="collab-type">${cp.code}</span>
      <span class="collab-name">${cp.emoji} ${cp.name}</span>
      <span class="collab-hint">一个设计系统，一个证明边界</span>
    </div>`;
  } else {
    collabEl.innerHTML = "";
  }

  // 雷达图
  drawRadar(scores);

  showPage("page-result");
  initResultCanvas();
}

// ── 雷达图 ────────────────────────────────────────────────────
function drawRadar(scores) {
  const canvas = document.getElementById("radar-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.38;
  const labels = ["离散/连续", "构造/存在", "概率/决定", "全局/局部"];
  const colors = DIMS.map(d => d.colors[0]);
  const n = 4;

  ctx.clearRect(0, 0, W, H);

  // 网格
  for (let r = 1; r <= 4; r++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + (R * r / 4) * Math.cos(angle);
      const y = cy + (R * r / 4) * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 轴
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 数据
  const vals = scores.map(s => {
    const t = s.A + s.B;
    return t ? s.A / t : 0.5;
  });

  ctx.beginPath();
  vals.forEach((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + R * v * Math.cos(angle);
    const y = cy + R * v * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(99, 179, 237, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "#63b3ed";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 点
  vals.forEach((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + R * v * Math.cos(angle);
    const y = cy + R * v * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors[i];
    ctx.fill();
  });

  // 标签
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + (R + 28) * Math.cos(angle);
    const ly = cy + (R + 28) * Math.sin(angle);
    ctx.fillStyle = colors[i];
    ctx.fillText(label, lx, ly);
  });
}

// ── 背景粒子动画 ─────────────────────────────────────────────
function initBgCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const SYMBOLS = ["∑", "∫", "∂", "∇", "∞", "√", "π", "∈", "⊕", "⊗", "λ", "φ", "Ω", "σ", "μ", "ε", "δ"];
  const particles = Array.from({ length: 30 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    size: 14 + Math.random() * 20,
    alpha: 0.04 + Math.random() * 0.1,
  }));

  let raf;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -30) p.x = canvas.width + 30;
      if (p.x > canvas.width + 30) p.x = -30;
      if (p.y < -30) p.y = canvas.height + 30;
      if (p.y > canvas.height + 30) p.y = -30;
      ctx.font = `${p.size}px serif`;
      ctx.fillStyle = `rgba(147, 197, 253, ${p.alpha})`;
      ctx.fillText(p.sym, p.x, p.y);
    });
    raf = requestAnimationFrame(draw);
  }
  if (raf) cancelAnimationFrame(raf);
  draw();
}

function initResultCanvas() {
  initBgCanvas("result-canvas");
}

// ── 首页立即启动动画 ─────────────────────────────────────────
window.addEventListener("load", () => {
  initBgCanvas("bg-canvas");
});

// ── 重试 / 分享 ──────────────────────────────────────────────
document.getElementById("btn-retry").addEventListener("click", () => {
  answers = new Array(16).fill(null);
  currentQ = 0;
  showPage("page-intro");
});

document.getElementById("btn-share").addEventListener("click", () => {
  const code = document.getElementById("result-type").textContent;
  const name = document.getElementById("result-name").textContent;
  const text = `我的 MITI 数学直觉类型是 ${code} — ${name}\n快来测测你的类型：https://github.com/`;
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  });
});
