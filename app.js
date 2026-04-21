// ============================================================
// MITI App — 主逻辑
// ============================================================

// ── 状态 ─────────────────────────────────────────────────────
// answers[i]: null | -2 | -1 | 0 | 1 | 2
// 负数 = 倾向选项A极性，正数 = 倾向选项B极性，0 = 中立
// 绝对值表示强度：2=强烈，1=偏向，0=不确定
let answers = [];
let currentQ = 0;
let shuffledQuestions = []; // 打乱后的题目顺序

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 页面切换 ─────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── 首页 ─────────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => {
  shuffledQuestions = shuffleArray(QUESTIONS);
  answers = new Array(shuffledQuestions.length).fill(null);
  currentQ = 0;
  renderQuestion(0);
  showPage("page-quiz");
  initBgCanvas("bg-canvas"); // keep running
});

// ── 题目渲染 ─────────────────────────────────────────────────
function renderQuestion(idx) {
  const q = shuffledQuestions[idx];
  const card = document.getElementById("question-card");

  // 退出动画
  card.classList.add("slide-out");
  setTimeout(() => {
    card.classList.remove("slide-out");

    const total = shuffledQuestions.length;
    document.getElementById("q-number").textContent = `Q${idx + 1}`;
    document.getElementById("q-text").textContent = q.text;
    document.getElementById("q-current").textContent = idx + 1;
    document.getElementById("q-total").textContent = total;

    // 进度条
    const pct = (idx / total) * 100;
    document.getElementById("progress-fill").style.width = pct + "%";

    // 维度指示（隐藏文字，仅保留颜色进度条装饰）
    const dimEl = document.getElementById("dim-indicator");
    dimEl.textContent = "";
    dimEl.style.color = DIMS[q.dim].colors[0];

    // 选项：5档倾向选择器
    const optArea = document.getElementById("q-options");
    optArea.innerHTML = "";

    // 选项文字标签（左A右B）
    const labelRow = document.createElement("div");
    labelRow.className = "likert-labels";
    labelRow.innerHTML = `
      <span class="likert-label-a">${q.options[0].label}</span>
      <span class="likert-label-b">${q.options[1].label}</span>`;
    optArea.appendChild(labelRow);

    // 5档按钮行
    // 值映射：-2(强A) -1(偏A) 0(中立) 1(偏B) 2(强B)
    const SCALE = [
      { value: -2, hint: "完全符合左侧" },
      { value: -1, hint: "更偏向左侧" },
      { value:  0, hint: "不确定 / 都行" },
      { value:  1, hint: "更偏向右侧" },
      { value:  2, hint: "完全符合右侧" },
    ];
    const btnRow = document.createElement("div");
    btnRow.className = "likert-row";
    SCALE.forEach(({ value, hint }) => {
      const btn = document.createElement("button");
      const isSelected = answers[idx] === value;
      btn.className = "likert-btn" +
        (value === 0 ? " likert-mid" : "") +
        (isSelected ? " selected" : "");
      btn.title = hint;
      btn.setAttribute("data-value", value);
      // 圆点大小随强度变化
      const size = value === 0 ? "md" : Math.abs(value) === 1 ? "sm" : "lg";
      btn.innerHTML = `<span class="likert-dot likert-dot-${size}"></span><span class="likert-hint">${hint}</span>`;
      btn.addEventListener("click", () => selectLikert(idx, value));
      btnRow.appendChild(btn);
    });
    optArea.appendChild(btnRow);

    // 导航按钮
    document.getElementById("btn-prev").disabled = idx === 0;
    updateNextBtn(idx);

    card.classList.add("slide-in");
    setTimeout(() => card.classList.remove("slide-in"), 400);
  }, 200);
}

function selectLikert(qIdx, value) {
  answers[qIdx] = value;
  document.querySelectorAll(".likert-btn").forEach(btn => {
    const v = parseInt(btn.getAttribute("data-value"));
    btn.classList.toggle("selected", v === value);
  });
  updateNextBtn(qIdx);
}

function updateNextBtn(idx) {
  const btn = document.getElementById("btn-next");
  const answered = answers[idx] !== null && answers[idx] !== undefined;
  btn.disabled = !answered;
  if (idx === shuffledQuestions.length - 1 && answered) {
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
  if (currentQ < shuffledQuestions.length - 1) { currentQ++; renderQuestion(currentQ); }
  else showResult();
});

// ── 计分 ─────────────────────────────────────────────────────
// 5档李克特积分制：
//   value=-2 → A得2分  value=-1 → A得1分  value=0 → 各得0分
//   value=+1 → B得1分  value=+2 → B得2分
// scores[dim] = { A: number, B: number }（可为小数，用于雷达图比例）
function calcScores() {
  const scores = [
    { A: 0, B: 0 }, // dim0: A极=C连续, B极=D离散
    { A: 0, B: 0 }, // dim1: A极=C构造, B极=E存在
    { A: 0, B: 0 }, // dim2: A极=P概率, B极=Dt决定
    { A: 0, B: 0 }, // dim3: A极=G全局, B极=L局部
  ];
  shuffledQuestions.forEach((q, i) => {
    const val = answers[i];
    if (val === null || val === undefined) return;
    const s = scores[q.dim];
    if (val < 0) s.A += Math.abs(val); // 负值 = 倾向A
    else if (val > 0) s.B += val;      // 正值 = 倾向B
    // val===0 中立，不加分
  });
  return scores;
}

function buildTypeCode(scores) {
  // 各维度按积分多少判断极性，平局归A（与原始偏好一致）
  const d0 = scores[0].A >= scores[0].B ? "C" : "D";
  const d1 = scores[1].A >= scores[1].B ? "C" : "E";
  const d2 = scores[2].A >= scores[2].B ? "P" : "Dt";
  const d3 = scores[3].A >= scores[3].B ? "G" : "L";
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
  answers = [];
  currentQ = 0;
  shuffledQuestions = [];
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
