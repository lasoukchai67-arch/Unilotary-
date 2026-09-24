import { api } from './services/api.js';
import { state } from './store/state.js';
import { DEFAULT_ANIMALS, MULTIPLIERS, WHEEL_PRIZES } from './data/constants.js';


// Application State

// Animal Catalog Local Fallback (in case API is starting up)
  { animal_id: 2, animal_name_lo: "ຫອຍ", animal_name_en: "Snail", base_number: "02", related_numbers: "02, 42, 82", icon_symbol: "🐚" },
  { animal_id: 3, animal_name_lo: "ຫ່ານ", animal_name_en: "Goose", base_number: "03", related_numbers: "03, 43, 83", icon_symbol: "🪿" },
  { animal_id: 4, animal_name_lo: "ນົກຍູງ", animal_name_en: "Peacock", base_number: "04", related_numbers: "04, 44, 84", icon_symbol: "🦚" },
  { animal_id: 5, animal_name_lo: "ສິງ", animal_name_en: "Lion", base_number: "05", related_numbers: "05, 45, 85", icon_symbol: "🦁" },
  { animal_id: 6, animal_name_lo: "ເສືອ", animal_name_en: "Tiger", base_number: "06", related_numbers: "06, 46, 86", icon_symbol: "🐯" },
  { animal_id: 7, animal_name_lo: "ໝູ", animal_name_en: "Pig", base_number: "07", related_numbers: "07, 47, 87", icon_symbol: "🐷" },
  { animal_id: 8, animal_name_lo: "ກະຕ່າຍ", animal_name_en: "Rabbit", base_number: "08", related_numbers: "08, 48, 88", icon_symbol: "🐰" },
  { animal_id: 9, animal_name_lo: "ຄວາຍ", animal_name_en: "Buffalo", base_number: "09", related_numbers: "09, 49, 89", icon_symbol: "🐃" },
  { animal_id: 10, animal_name_lo: "ນາກບິນ", animal_name_en: "Flying Dragon", base_number: "10", related_numbers: "10, 50, 90", icon_symbol: "🐉" },
  { animal_id: 11, animal_name_lo: "ໝາ", animal_name_en: "Dog", base_number: "11", related_numbers: "11, 51, 91", icon_symbol: "🐶" },
  { animal_id: 12, animal_name_lo: "ມ້າ", animal_name_en: "Horse", base_number: "12", related_numbers: "12, 52, 92", icon_symbol: "🐴" },
  { animal_id: 13, animal_name_lo: "ຊ້າງ", animal_name_en: "Elephant", base_number: "13", related_numbers: "13, 53, 93", icon_symbol: "🐘" },
  { animal_id: 14, animal_name_lo: "ແມວບ້ານ", animal_name_en: "Cat", base_number: "14", related_numbers: "14, 54, 94", icon_symbol: "🐱" },
  { animal_id: 15, animal_name_lo: "ໜູ", animal_name_en: "Rat", base_number: "15", related_numbers: "15, 55, 95", icon_symbol: "🐭" },
  { animal_id: 16, animal_name_lo: "ເຜິ້ງ", animal_name_en: "Bee", base_number: "16", related_numbers: "16, 56, 96", icon_symbol: "🐝" },
  { animal_id: 17, animal_name_lo: "ນົກກາງແກ", animal_name_en: "Pigeon", base_number: "17", related_numbers: "17, 57, 97", icon_symbol: "🕊️" },
  { animal_id: 18, animal_name_lo: "ແຄ້ວ / ແຂ້", animal_name_en: "Crocodile", base_number: "18", related_numbers: "18, 58, 98", icon_symbol: "🐊" },
  { animal_id: 19, animal_name_lo: "ແມງກະເບື້ອ", animal_name_en: "Butterfly", base_number: "19", related_numbers: "19, 59, 99", icon_symbol: "🦋" },
  { animal_id: 20, animal_name_lo: "ຂີ້ເຂັບ", animal_name_en: "Centipede", base_number: "20", related_numbers: "20, 60, 00", icon_symbol: "🐛" },
  { animal_id: 21, animal_name_lo: "ນົກກືດ", animal_name_en: "Swallow", base_number: "21", related_numbers: "21, 61", icon_symbol: "🐦" },
  { animal_id: 22, animal_name_lo: "ນົກກົກ", animal_name_en: "Hornbill", base_number: "22", related_numbers: "22, 62", icon_symbol: "🦜" },
  { animal_id: 23, animal_name_lo: "ລີງ", animal_name_en: "Monkey", base_number: "23", related_numbers: "23, 63", icon_symbol: "🐒" },
  { animal_id: 24, animal_name_lo: "ກົບ", animal_name_en: "Frog", base_number: "24", related_numbers: "24, 64", icon_symbol: "🐸" },
  { animal_id: 25, animal_name_lo: "ເຫງັ້ນ", animal_name_en: "Civet", base_number: "25", related_numbers: "25, 65", icon_symbol: "🦡" },
  { animal_id: 26, animal_name_lo: "ນົກເຂົາ", animal_name_en: "Turtle Dove", base_number: "26", related_numbers: "26, 66", icon_symbol: "🐦‍⬛" },
  { animal_id: 27, animal_name_lo: "ເຕົ່າ", animal_name_en: "Turtle", base_number: "27", related_numbers: "27, 67", icon_symbol: "🐢" },
  { animal_id: 28, animal_name_lo: "ໄກ່", animal_name_en: "Rooster", base_number: "28", related_numbers: "28, 68", icon_symbol: "🐓" },
  { animal_id: 29, animal_name_lo: "ອຽນ", animal_name_en: "Eel", base_number: "29", related_numbers: "29, 69", icon_symbol: "🐍" },
  { animal_id: 30, animal_name_lo: "ປານ້ອຍ", animal_name_en: "Small Fish", base_number: "30", related_numbers: "30, 70", icon_symbol: "🐠" },
  { animal_id: 31, animal_name_lo: "ກຸ້ງ", animal_name_en: "Shrimp", base_number: "31", related_numbers: "31, 71", icon_symbol: "🦐" },
  { animal_id: 32, animal_name_lo: "ງູ", animal_name_en: "Snake", base_number: "32", related_numbers: "32, 72", icon_symbol: "🐍" },
  { animal_id: 33, animal_name_lo: "ແມງມຸມ", animal_name_en: "Spider", base_number: "33", related_numbers: "33, 73", icon_symbol: "🕷️" },
  { animal_id: 34, animal_name_lo: "ກວາງ", animal_name_en: "Deer", base_number: "34", related_numbers: "34, 74", icon_symbol: "🦌" },
  { animal_id: 35, animal_name_lo: "ແບ້", animal_name_en: "Goat", base_number: "35", related_numbers: "35, 75", icon_symbol: "🐐" },
  { animal_id: 36, animal_name_lo: "ເຫຍັ້ນ", animal_name_en: "Otter", animal_id: 36, base_number: "36", related_numbers: "36, 76", icon_symbol: "🦦" },
  { animal_id: 37, animal_name_lo: "ຕຸ່ນ", animal_name_en: "Bamboo Rat", base_number: "37", related_numbers: "37, 77", icon_symbol: "🦔" },
  { animal_id: 38, animal_name_lo: "ໝາໄນ", animal_name_en: "Wolf", base_number: "38", related_numbers: "38, 78", icon_symbol: "🐺" },
  { animal_id: 39, animal_name_lo: "ແມ່ໝີ", animal_name_en: "Bear", base_number: "39", related_numbers: "39, 79", icon_symbol: "🐻" },
  { animal_id: 40, animal_name_lo: "ນົກອິນຊີ", animal_name_en: "Eagle", base_number: "40", related_numbers: "40, 80", icon_symbol: "🦅" }
];


// Formatting helpers
function formatLAK(num) {
  return new Intl.NumberFormat('lo-LA').format(Math.round(num)) + ' ₭';
}

function getAnimalForNumber(numStr) {
  if (!numStr || numStr.length < 2) return null;
  const last2 = numStr.slice(-2);
  return state.animals.find(a => 
    a.base_number === last2 || 
    (a.related_numbers && a.related_numbers.includes(last2))
  );
}

function getAnimalNumbers(animal) {
  if (!animal) return [];
  if (animal.related_numbers) {
    return animal.related_numbers.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [animal.base_number];
}

function buyAnimalFull(animal) {
  if (!animal) return;
  const nums = getAnimalNumbers(animal);
  nums.forEach(num => {
    state.cart.push({
      chosen_number: num,
      bet_type: 'ANIMAL',
      bet_amount: state.selectedAmount,
      chosen_animal_id: animal.animal_id,
      chosen_animal_name: animal.animal_name_lo
    });
  });
  state.keypadDigits = '';
  state.activeModal = 'cart';
  renderApp();
}

// ---------------------------------------------------------------------------
// Gamification & Suspense Engine (ລະບົບການລຸ້ນໂຊກ)
// ---------------------------------------------------------------------------

// 1. Particle Engine (Confetti & Gold Coins)
function launchConfetti(durationMs = 4500) {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.className = 'confetti-canvas-overlay';
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  const colors = ['#e31b23', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffd700', '#ffffff'];
  
  for (let i = 0; i < 130; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 160,
      y: canvas.height / 3 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 15,
      vy: Math.random() * -15 - 5,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      isCoin: Math.random() > 0.65,
      alpha: 1
    });
  }

  const startTime = Date.now();
  function loop() {
    const elapsed = Date.now() - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.36; // gravity
      p.rotation += p.rotSpeed;
      if (elapsed > durationMs - 1200) {
        p.alpha -= 0.025;
      }
      
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      
      if (p.isCoin) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
      }
      ctx.restore();
    });

    if (elapsed < durationMs) {
      requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(loop);
}

// 2. Live Drum Machine Simulator
let drumInterval = null;
function startLiveDrumRoll(targetWinningNumber = '784928', targetAnimalId = 28) {
  state.liveDrum.isRunning = true;
  state.liveDrum.targetDigits = targetWinningNumber;
  state.liveDrum.targetAnimalId = targetAnimalId;
  state.liveDrum.displayDigits = ['0', '0', '0', '0', '0', '0'];
  state.liveDrum.lockedCount = 0;
  renderApp();

  const digitsArr = targetWinningNumber.split('');

  if (drumInterval) clearInterval(drumInterval);
  drumInterval = setInterval(() => {
    const unlockedMax = 6 - state.liveDrum.lockedCount;
    for (let i = 0; i < unlockedMax; i++) {
      state.liveDrum.displayDigits[i] = Math.floor(Math.random() * 10).toString();
    }
    const boxes = document.querySelectorAll('.drum-digit-box');
    boxes.forEach((box, idx) => {
      if (idx < unlockedMax) {
        box.textContent = state.liveDrum.displayDigits[idx];
        box.classList.add('rolling');
      }
    });
  }, 60);

  // Stop digits one-by-one from right (Units) to left (Hundred-Thousands)
  const lockSchedule = [
    { idx: 5, delay: 1200 },
    { idx: 4, delay: 2200 },
    { idx: 3, delay: 3100 },
    { idx: 2, delay: 3900 },
    { idx: 1, delay: 4600 },
    { idx: 0, delay: 5300 }
  ];

  lockSchedule.forEach((step, sIdx) => {
    setTimeout(() => {
      state.liveDrum.displayDigits[step.idx] = digitsArr[step.idx];
      state.liveDrum.lockedCount = sIdx + 1;
      
      const boxes = document.querySelectorAll('.drum-digit-box');
      const box = boxes[step.idx];
      if (box) {
        box.textContent = digitsArr[step.idx];
        box.classList.remove('rolling');
        box.classList.add('locked');
      }

      if (sIdx === 5) {
        clearInterval(drumInterval);
        state.liveDrum.isRunning = false;
        evaluateUserTicketsAfterDraw(targetWinningNumber, targetAnimalId);
      }
    }, step.delay);
  });
}

function evaluateUserTicketsAfterDraw(winningDigits, animalId) {
  let totalWon = 0;
  const wonTickets = [];
  const animal = state.animals.find(a => a.animal_id === animalId) || { animal_name_lo: 'ໄກ່', icon_symbol: '🐓' };

  state.myTickets.forEach(t => {
    let ticketWon = 0;
    t.items.forEach(it => {
      const num = it.chosen_number;
      const len = num.length;
      if (winningDigits.endsWith(num)) {
        it.is_win = true;
        it.actual_win = it.bet_amount * (MULTIPLIERS[len] || 60);
        ticketWon += it.actual_win;
      } else {
        it.is_win = false;
      }
    });

    if (ticketWon > 0) {
      t.status = 'WON';
      t.total_won_amount = ticketWon;
      totalWon += ticketWon;
      wonTickets.push(t);
    } else {
      t.status = 'LOST';
    }
  });

  if (totalWon > 0) {
    state.walletBalance += totalWon;
    state.bigWinData = {
      amount: totalWon,
      winningNumber: winningDigits,
      animal: animal,
      wonTickets: wonTickets
    };
    launchConfetti(5500);
    setTimeout(() => {
      state.activeModal = 'big_win';
      renderApp();
    }, 600);
  } else {
    renderApp();
  }
}

// 3. Digital Scratch Card Logic
function initScratchCard() {
  const canvas = document.getElementById('scratch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const w = (rect.width > 50) ? Math.round(rect.width) : (canvas.offsetWidth > 50 ? canvas.offsetWidth : 320);
  const h = (rect.height > 50) ? Math.round(rect.height) : (canvas.offsetHeight > 50 ? canvas.offsetHeight : 180);
  canvas.width = w;
  canvas.height = h;

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#94a3b8');
  grad.addColorStop(0.3, '#f1f5f9');
  grad.addColorStop(0.7, '#cbd5e1');
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✨ ໃຊ້ນິ້ວມືຂູດບ່ອນນີ້ເພື່ອລຸ້ນໂຊກ ✨', canvas.width / 2, canvas.height / 2);

  let isDrawing = false;
  let scratchedPoints = 0;

  function scratch(clientX, clientY) {
    const cRect = canvas.getBoundingClientRect();
    const x = clientX - cRect.left;
    const y = clientY - cRect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();

    scratchedPoints++;
    if (scratchedPoints > 14 && !state.scratchCardCleared) {
      state.scratchCardCleared = true;
      launchConfetti(3500);
      canvas.style.transition = 'opacity 0.6s ease';
      canvas.style.opacity = '0';
      setTimeout(() => {
        if (canvas.parentNode) canvas.style.display = 'none';
      }, 600);
    }
  }

  canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { isDrawing = false; });
  canvas.addEventListener('mousemove', (e) => { if (isDrawing) scratch(e.clientX, e.clientY); });

  canvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    if (e.touches[0]) scratch(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (isDrawing && e.touches[0]) scratch(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchend', () => { isDrawing = false; });
}

// 4. Lucky Spin Wheel Logic
  { label: 'ໂຊກດີຄັ້ງໜ້າ', amount: 0, color: '#1e293b' },
  { label: '2,000 ₭', amount: 2000, color: '#f59e0b' },
  { label: 'ປີ້ຟຣີ 5,000 ₭', amount: 5000, color: '#059669' },
  { label: '5,000 ₭', amount: 5000, color: '#2563eb' },
  { label: 'ຄູນ 2x UniLotary', amount: 2000, color: '#7c3aed' },
  { label: '10,000 ₭', amount: 10000, color: '#d97706' },
  { label: '👑 50,000 ₭', amount: 50000, color: '#dc2626' }
];

function spinLuckyWheel() {
  if (state.luckyWheel.isSpinning) return;
  state.luckyWheel.isSpinning = true;

  const prizeIdx = Math.floor(Math.random() * WHEEL_PRIZES.length);
  const prize = WHEEL_PRIZES[prizeIdx];

  const segmentDeg = 360 / 8;
  const currentRot = state.luckyWheel.rotation || 0;
  const targetDeg = currentRot + 360 * 5 + (8 - prizeIdx) * segmentDeg - segmentDeg / 2;

  state.luckyWheel.rotation = targetDeg;
  const wheelDisc = document.getElementById('wheel-disc');
  if (wheelDisc) {
    wheelDisc.style.transform = `rotate(${targetDeg}deg)`;
  }

  const spinBtn = document.getElementById('spin-wheel-action-btn');
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.5';
    spinBtn.textContent = '⏳ ກຳລັງໝູນລຸ້ນໂຊກ...';
  }

  setTimeout(() => {
    state.luckyWheel.isSpinning = false;
    state.luckyWheel.wonPrize = prize;

    if (prize.amount > 0) {
      state.walletBalance += prize.amount;
      launchConfetti(4500);
    }
    renderApp();
  }, 4200);
}

// Initialize Application
async function initApp() {
  setupPWA();
  await loadUserData();
  await loadDrawsAndAnimals();
  renderApp();
  startCountdownTimer();
}

// PWA Setup
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'flex';
  });
}

// Load Data
async function loadUserData() {
  try {
    if (!api.token) {
      // Auto login with demo account
      const auth = await api.login('02055556666', '123456');
    }
    const profile = await api.getProfile();
    state.user = profile;
    state.walletBalance = profile.wallet_balance;
  } catch (err) {
    state.user = { phone_number: '02055556666', full_name: 'ຜູ້ໃຊ້ທົດລອງ (Demo)', role: 'Player' };
    state.walletBalance = 150000;
  }
}

async function loadDrawsAndAnimals() {
  try {
    const [animalsData, drawsData] = await Promise.all([
      api.getAnimals().catch(() => DEFAULT_ANIMALS),
      api.getDraws().catch(() => [])
    ]);
    state.animals = animalsData.length ? animalsData : DEFAULT_ANIMALS;
    state.draws = drawsData;
    state.activeDraw = drawsData.find(d => d.status === 'OPEN') || {
      period_id: 'sample-period-01',
      period_code: 'DRAW-20260923-01',
      draw_date: new Date().toISOString().split('T')[0],
      draw_time: '20:00:00',
      status: 'OPEN'
    };
  } catch (err) {
    state.animals = DEFAULT_ANIMALS;
  }
}

// Main Render
function renderApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <div class="app-container">
      <!-- PWA Install Banner -->
      <div id="pwa-install-banner" class="install-banner">
        <div class="install-text">
          <span>📲</span> ຕິດຕັ້ງແອັບເທິງມືຖື Android / iPhone
        </div>
        <button class="install-btn" id="install-app-btn">ຕິດຕັ້ງເລີຍ</button>
      </div>

      <!-- App Header -->
      <header class="app-header">
        <div class="logo-badge">
          <img src="/icons/icon.svg" class="logo-icon-svg" alt="UniLotary Logo" />
          <div>
            <div class="logo-title">UniLotary</div>
            <div class="logo-subtitle">UNILOTARY LAO LOTTERY</div>
          </div>
        </div>
        <div class="header-actions">
          <button class="topup-btn" id="open-lucky-wheel-btn" style="background:#f59e0b;color:#1e293b;border:none;font-weight:800;padding:6px 10px;font-size:0.8rem;">
            🎡 ກົງລໍ້ໂຊກ
          </button>
          <div class="wallet-badge" id="wallet-badge-btn" title="ກົດເພື່ອເຕີມເງິນ">
            <span>💰</span>
            <span id="header-balance-text">${formatLAK(state.walletBalance)}</span>
          </div>
          <button class="topup-btn" id="open-topup-btn">+ ເຕີມເງິນ</button>
        </div>
      </header>

      <!-- Draw Hero Banner -->
      <section class="draw-banner">
        <div class="draw-top-row">
          <span class="draw-badge-pill">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:white;animation:pulseGold 1s infinite;"></span>
            ເປີດຮັບຊື້ (OPEN)
          </span>
          <span class="draw-code-label">${state.activeDraw ? state.activeDraw.period_code : 'DRAW-LIVE'}</span>
        </div>
        <div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);">
          ງວດວັນທີ: <strong style="color:var(--text-main);">${state.activeDraw ? state.activeDraw.draw_date : 'ມື້ນີ້'}</strong> (20:00 ໂມງ)
        </div>
        <div class="draw-countdown">
          <div class="time-box">
            <div class="time-num" id="cd-hours">04</div>
            <div class="time-label">ຊົ່ວໂມງ</div>
          </div>
          <div class="time-box">
            <div class="time-num" id="cd-mins">25</div>
            <div class="time-label">ນາທີ</div>
          </div>
          <div class="time-box">
            <div class="time-num" id="cd-secs">10</div>
            <div class="time-label">ວິນາທີ</div>
          </div>
        </div>
      </section>

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button class="tab-btn ${state.activeTab === 'buy_number' ? 'active' : ''}" data-tab="buy_number">
          🔢 ຊື້ເລກ 1-6 ໂຕ
        </button>
        <button class="tab-btn ${state.activeTab === 'animal_picker' ? 'active' : ''}" data-tab="animal_picker">
          🐾 ຫວຍນາມສັດ (40 ໂຕ)
        </button>
        <button class="tab-btn ${state.activeTab === 'my_tickets' ? 'active' : ''}" data-tab="my_tickets">
          📜 ປີ້ຫວຍຂອງຂ້ອຍ
        </button>
        <button class="tab-btn ${state.activeTab === 'results' ? 'active' : ''}" data-tab="results">
          🏆 ຜົນການອອກເລກ
        </button>
      </nav>

      <!-- Content Area -->
      <main class="content-area">
        ${renderTabContent()}
      </main>

      <!-- Floating Bet Slip Bar (if items in cart) -->
      ${state.cart.length > 0 ? `
        <div class="cart-floating-bar" id="open-cart-modal-btn">
          <div class="cart-summary-text">
            <span>ເລືອກແລ້ວ: <strong>${state.cart.length} ລາຍການ</strong></span><br/>
            <span class="cart-total-amt">${formatLAK(calculateCartTotal())}</span>
          </div>
          <button class="cart-checkout-btn">ຢືນຢັນການຊື້ (${state.cart.length})</button>
        </div>
      ` : ''}

      <!-- Bottom Navigation Bar -->
      <nav class="bottom-nav">
        <button class="nav-item ${state.activeTab === 'buy_number' ? 'active' : ''}" data-tab="buy_number">
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7"/></svg>
          <span>ຊື້ຫວຍ</span>
        </button>
        <button class="nav-item ${state.activeTab === 'animal_picker' ? 'active' : ''}" data-tab="animal_picker">
          <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-.5-5.5a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0V12a1 1 0 0 0-1-1z"/></svg>
          <span>ນາມສັດ</span>
        </button>
        <button class="nav-item ${state.activeTab === 'my_tickets' ? 'active' : ''}" data-tab="my_tickets">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>ປີ້ຂອງຂ້ອຍ</span>
        </button>
        <button class="nav-item ${state.activeTab === 'results' ? 'active' : ''}" data-tab="results">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          <span>ຜົນຫວຍ</span>
        </button>
        <button class="nav-item" id="nav-install-btn">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>ຕິດຕັ້ງແອັບ</span>
        </button>
      </nav>

      <!-- Active Modal Rendering -->
      ${renderModal()}
    </div>
  `;

  attachEventHandlers();
}

function renderTabContent() {
  if (state.activeTab === 'buy_number') {
    return renderBuyNumberTab();
  } else if (state.activeTab === 'animal_picker') {
    return renderAnimalPickerTab();
  } else if (state.activeTab === 'my_tickets') {
    return renderMyTicketsTab();
  } else if (state.activeTab === 'results') {
    return renderResultsTab();
  }
  return '';
}

// 1. Buy Number Keypad Tab
function renderBuyNumberTab() {
  const digitLen = state.keypadDigits.length;
  const multiplier = MULTIPLIERS[digitLen] || 0;
  const potentialWin = digitLen > 0 ? (state.selectedAmount * multiplier) : 0;
  
  const digitPlaces = {
    1: "ເລກ 1 ໂຕ (ຫຼັກໜ່ວຍ)",
    2: "ເລກ 2 ໂຕ (ຫຼັກສິບ, ໜ່ວຍ)",
    3: "ເລກ 3 ໂຕ (ຫຼັກຮ້ອຍ, ສິບ, ໜ່ວຍ)",
    4: "ເລກ 4 ໂຕ (ຫຼັກພັນ, ຮ້ອຍ, ສິບ, ໜ່ວຍ)",
    5: "ເລກ 5 ໂຕ (ຫຼັກໝື່ນ, ພັນ, ຮ້ອຍ, ສິບ, ໜ່ວຍ)",
    6: "ເລກ 6 ໂຕ (ຫຼັກແສນ, ໝື່ນ, ພັນ, ຮ້ອຍ, ສິບ, ໜ່ວຍ)"
  };
  
  const matchedAnimal = getAnimalForNumber(state.keypadDigits);
  let animalDisplay = '';
  if (matchedAnimal) {
    const animalNums = getAnimalNumbers(matchedAnimal);
    const totalCost = state.selectedAmount * animalNums.length;
    animalDisplay = `
      <div style="width:100%;margin-top:10px;background:rgba(227,27,35,0.06);border:1.5px solid var(--sokxay-red);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:0.88rem;font-weight:700;color:var(--text-main);margin-bottom:6px;">
          ນາມສັດ: <span style="font-size:1.15rem;">${matchedAnimal.icon_symbol}</span> <strong>${matchedAnimal.animal_name_lo}</strong> (ເລກ: <strong>${animalNums.join(', ')}</strong>)
        </div>
        <button id="quick-buy-animal-btn" data-animal-id="${matchedAnimal.animal_id}" style="width:100%;background:var(--sokxay-red);color:white;border:none;border-radius:8px;padding:10px;font-size:0.92rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 3px 10px rgba(227,27,35,0.3);">
          <span>🐾</span> ຊື້ເຕັມນາມ (${matchedAnimal.animal_name_lo} ${animalNums.length} ໂຕ: ${animalNums.join(', ')}) • ${formatLAK(totalCost)}
        </button>
      </div>
    `;
  }
  
  const digitPlaceDisplay = digitLen > 0 
    ? `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">ຫຼັກ: ${digitPlaces[digitLen] || 'ເລກ ' + digitLen + ' ໂຕ'}</div>` 
    : '';

  return `
    <div class="input-display-card">
      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <button class="topup-btn" style="flex:1;background:rgba(255,255,255,0.1);color:white;font-size:0.85rem;border:1px solid rgba(255,255,255,0.2);" data-tab-switch="animal_picker">
          🐾 ຊື້ເຕັມນາມ (ນາມສັດ)
        </button>
        <button class="topup-btn" id="open-digit-places-btn" style="flex:1;background:rgba(255,255,255,0.1);color:white;font-size:0.85rem;border:1px solid rgba(255,255,255,0.2);cursor:pointer;">
          📍 ຊື້ເລກຫຼັກ
        </button>
      </div>
      <div class="chosen-digits-display" style="flex-direction:column;align-items:center;padding:16px;">
        <div style="display:flex;width:100%;justify-content:center;position:relative;">
          <div class="digits-large">
            ${state.keypadDigits || '<span class="placeholder-text">ກົດເລກທີ່ຕ້ອງການ...</span>'}
          </div>
          ${state.keypadDigits ? '<button class="clear-btn" id="keypad-clear-btn" style="position:absolute;right:0;top:50%;transform:translateY(-50%);">ລຶບ</button>' : ''}
        </div>
        ${animalDisplay}
        ${digitPlaceDisplay}
      </div>

      <!-- Quick Amount Presets -->
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;font-weight:600;">ຈຳນວນເງິນແທງ (ກີບ):</div>
      <div class="amount-pills-row">
        ${[1000, 2000, 5000, 10000, 20000, 50000, 100000].map(amt => `
          <button class="amount-pill ${state.selectedAmount === amt ? 'selected' : ''}" data-amt="${amt}">
            ${amt.toLocaleString()} ₭
          </button>
        `).join('')}
      </div>

      <!-- Potential Prize Preview -->
      <div class="potential-prize-badge">
        <div>
          <span>ລາງວັນຄູນ: <strong>${multiplier ? multiplier.toLocaleString() + 'x' : '-'}</strong></span>
          <div style="font-size:0.7rem;color:var(--text-muted);">
            ${digitLen > 0 ? `ເລກ ${digitLen} ໂຕ` : 'ເລືອກເລກ 1-6 ໂຕ'}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem;color:var(--text-muted);">ລາງວັນທີ່ຈະໄດ້ຮັບ:</div>
          <div class="prize-highlight">${formatLAK(potentialWin)}</div>
        </div>
      </div>
    </div>

    <!-- Number Keypad -->
    <div class="keypad-grid">
      <button class="keypad-btn" data-key="1">1</button>
      <button class="keypad-btn" data-key="2">2</button>
      <button class="keypad-btn" data-key="3">3</button>
      <button class="keypad-btn" data-key="4">4</button>
      <button class="keypad-btn" data-key="5">5</button>
      <button class="keypad-btn" data-key="6">6</button>
      <button class="keypad-btn" data-key="7">7</button>
      <button class="keypad-btn" data-key="8">8</button>
      <button class="keypad-btn" data-key="9">9</button>
      <button class="keypad-btn action" id="quick-random-btn">🎲 ສຸ່ມ</button>
      <button class="keypad-btn" data-key="0">0</button>
      <button class="keypad-btn action" id="keypad-backspace-btn">⌫</button>
    </div>

    <!-- Add to Cart Action Button -->
    <button class="add-slip-btn" id="add-to-slip-btn" ${!state.keypadDigits ? 'disabled style="opacity:0.5;"' : ''}>
      <span>➕ ເພີ່ມໃສ່ໃບບິນ</span> (${state.keypadDigits || '0'} • ${formatLAK(state.selectedAmount)})
    </button>
  `;
}

// 2. Animal Picker Tab (40 Lao Animals)
function renderAnimalPickerTab() {
  return `
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">
        ກົດຊື້ເຕັມນາມ (ນາມສັດ 40 ໂຕ) • ລາງວັນ 60x
      </span>
      <span style="font-size:0.85rem;color:var(--sokxay-red);font-weight:800;">
        ແທງ: ${formatLAK(state.selectedAmount)}/ໂຕ
      </span>
    </div>

    <div class="animals-grid">
      ${state.animals.map(a => {
        const nums = getAnimalNumbers(a);
        const totalCost = state.selectedAmount * nums.length;
        return `
          <div class="animal-card" data-animal-id="${a.animal_id}" style="display:flex;flex-direction:column;align-items:stretch;padding:12px;border:1px solid var(--border-glass);border-radius:10px;background:white;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div class="animal-icon" style="font-size:2rem;">${a.icon_symbol}</div>
              <div class="animal-info" style="flex:1;">
                <div class="animal-name" style="font-size:0.95rem;font-weight:800;color:var(--text-main);">${a.animal_name_lo}</div>
                <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">
                  ${nums.map(n => `
                    <button class="buy-single-animal-num-btn" data-animal-id="${a.animal_id}" data-num="${n}" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:3px 8px;font-family:'Outfit';font-weight:800;font-size:0.85rem;color:var(--sokxay-red);cursor:pointer;" title="ກົດເພື່ອຊື້ສະເພາະເລກນີ້">
                      ${n}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
            <button class="buy-full-animal-btn" data-animal-id="${a.animal_id}" style="width:100%;background:rgba(227,27,35,0.08);border:1px solid var(--sokxay-red);color:var(--sokxay-red);padding:8px 10px;border-radius:8px;font-size:0.85rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              🐾 ຊື້ໝົດນາມ (${nums.length} ໂຕ: ${nums.join(', ')}) • ${formatLAK(totalCost)}
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 3. My Tickets Tab
function renderMyTicketsTab() {
  if (state.myTickets.length === 0) {
    return `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:3rem;margin-bottom:12px;">🎟️</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--text-main);margin-bottom:6px;">ຍັງບໍ່ມີປີ້ຫວຍເທື່ອ</div>
        <p style="font-size:0.85rem;margin-bottom:20px;">ເລືອກເລກທີ່ທ່ານມັກ ແລ້ວຊື້ຫວຍເພື່ອລຸ້ນຮັບລາງວັນໃຫຍ່!</p>
        <button class="topup-btn" style="padding:10px 24px;font-size:0.9rem;" data-tab-switch="buy_number">ເລີ່ມຕົ້ນຊື້ຫວຍເລີຍ</button>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:700;font-size:1rem;">ປີ້ຫວຍທັງໝົດ (${state.myTickets.length})</span>
      <button class="topup-btn" style="font-size:0.75rem;padding:4px 10px;" id="refresh-tickets-btn">🔄 ອັບເດດ</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:30px;">
      ${state.myTickets.map(t => `
        <div class="animal-card" style="display:block;cursor:pointer;" data-ticket-id="${t.ticket_id}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-family:monospace;font-weight:700;color:var(--gold-secondary);font-size:0.9rem;">
              ${t.ticket_serial}
            </span>
            <span style="padding:2px 8px;border-radius:99px;font-size:0.7rem;font-weight:800;
              ${t.status === 'WON' ? 'background:#20bf6b;color:#0b132b;' : t.status === 'LOST' ? 'background:#475569;color:white;' : 'background:#f7b731;color:#0b132b;'}">
              ${t.status === 'WON' ? '🎉 ຊະນະແລ້ວ!' : t.status === 'LOST' ? 'ບໍ່ຖືກລາງວັນ' : '⏳ ລໍຖ້າຜົນ'}
            </span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;">
            <span>ງວດ: <strong>${t.period_code}</strong> (${t.draw_date})</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span>ຍອດຊື້: <strong style="color:var(--text-main);">${formatLAK(t.total_amount)}</strong></span>
              <button class="open-scratch-card-btn" data-ticket-id="${t.ticket_id}" style="background:#fef3c7;border:1px solid #fde68a;color:#d97706;padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;cursor:pointer;">
                ✨ ຂູດບັດລຸ້ນ
              </button>
            </div>
          </div>
          ${t.status === 'WON' ? `
            <div style="margin-top:6px;padding:6px;background:rgba(32,191,107,0.15);border-radius:6px;font-size:0.85rem;color:#20bf6b;font-weight:800;text-align:center;">
              ຮັບລາງວັນ: +${formatLAK(t.total_won_amount)}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// 4. Draw Results Tab
function renderResultsTab() {
  return `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:700;font-size:1rem;">ຜົນການອອກລາງວັນ ຫວຍພັດທະນາ</span>
        <button class="topup-btn" style="background:#e2e8f0;color:#1e293b;" id="admin-draw-sim-btn">⚙️ ຈຳລອງອອກເລກ (Admin)</button>
      </div>

      <!-- Live Drum Simulator Trigger Banner -->
      <div style="background:linear-gradient(135deg, #0f172a, #1e293b);padding:14px;border-radius:12px;margin-bottom:16px;color:white;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 16px rgba(0,0,0,0.15);border:1px solid #334155;">
        <div>
          <div style="font-weight:800;font-size:1rem;color:#f59e0b;display:flex;align-items:center;gap:6px;">
            <span>🎰</span> ຫ້ອງລຸ້ນຜົນຫວຍສົດ (Live Draw)
          </div>
          <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">
            ໝູນລູກບານລຸ້ນເລກ 6 ຫຼັກ ແລະ ນາມສັດແບບສົດໆ
          </div>
        </div>
        <button class="topup-btn" id="open-live-drum-btn" style="background:var(--emerald-gradient);color:white;font-weight:800;padding:8px 14px;border:none;border-radius:8px;font-size:0.85rem;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.3);">
          ▶ ເປີດລຸ້ນສົດ
        </button>
      </div>

      <!-- Latest Result Highlight -->
      <div class="draw-banner" style="margin:0 0 16px 0;background:var(--sokxay-red);">
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.8);font-weight:700;letter-spacing:1px;text-transform:uppercase;">ຜົນລ່າສຸດ (LATEST RESULT)</div>
        <div style="font-size:0.9rem;font-weight:700;margin:4px 0 10px 0;">ງວດວັນທີ 21/09/2026 (DRAW-20260921-01)</div>
        
        <div style="display:flex;gap:6px;justify-content:center;margin:12px 0;">
          ${"582914".split('').map(d => `
            <div style="width:42px;height:48px;background:#ffffff;color:var(--sokxay-red);font-size:1.8rem;font-weight:900;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-family:'Outfit';">
              ${d}
            </div>
          `).join('')}
        </div>

        <div style="text-align:center;font-size:0.9rem;font-weight:700;color:white;margin-top:8px;">
          ນາມສັດ: 14 ແມວບ້ານ (🐱)
        </div>
      </div>

      <!-- Result Prize Tiers -->
      <div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:14px;">
        <div style="font-weight:700;font-size:0.85rem;color:var(--gold-secondary);margin-bottom:10px;">ຕາຕະລາງລາງວັນເລກທ້າຍ:</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.82rem;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
            <span>ເລກ 6 ໂຕ (Full 6 Digits)</span>
            <strong style="color:var(--gold-primary);">400,000x (400 ລ້ານກີບ)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
            <span>ເລກ 5 ໂຕ (Last 5 Digits)</span>
            <strong style="color:var(--gold-primary);">40,000x (40 ລ້ານກີບ)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
            <span>ເລກ 4 ໂຕ (Last 4 Digits)</span>
            <strong style="color:var(--gold-primary);">6,000x (6 ລ້ານກີບ)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
            <span>ເລກ 3 ໂຕ (Last 3 Digits)</span>
            <strong style="color:var(--gold-primary);">500x (500 ພັນກີບ)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
            <span>ເລກ 2 ໂຕ & ນາມສັດ (Last 2 Digits)</span>
            <strong style="color:var(--gold-primary);">60x (60 ພັນກີບ)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>ເລກ 1 ໂຕ (Last Digit)</span>
            <strong style="color:var(--gold-primary);">8.5x (8.5 ພັນກີບ)</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Modal Rendering
function renderModal() {
  if (!state.activeModal) return '';

  if (state.activeModal === 'cart') {
    const total = calculateCartTotal();
    const isExceeded = total > state.walletBalance;

    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="max-height:88vh;display:flex;flex-direction:column;">
          <div class="modal-header">
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              <span>🛒 ລາຍການຊື້ຫວຍ (${state.cart.length} ໂຕ)</span>
              ${state.cart.length > 0 ? `
                <button id="clear-all-cart-btn" style="background:none;border:1px solid #cbd5e1;border-radius:4px;padding:2px 8px;font-size:0.72rem;color:#64748b;cursor:pointer;">
                  ລຶບທັງໝົດ
                </button>
              ` : ''}
            </div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>

          <!-- Quick Batch Preset Row -->
          <div style="background:#f1f5f9;padding:8px 12px;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:6px;overflow-x:auto;">
            <span style="font-size:0.75rem;color:#475569;font-weight:700;white-space:nowrap;">ປັບເງິນທຸກໂຕ:</span>
            <div style="display:flex;gap:4px;">
              ${[1000, 2000, 5000, 10000, 20000].map(amt => `
                <button class="batch-amt-pill-btn" data-batch-amt="${amt}" style="background:white;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:0.75rem;font-weight:700;color:#1e293b;cursor:pointer;white-space:nowrap;">
                  ${(amt/1000).toFixed(0)}k
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Cart Items List with +/- controls -->
          <div style="max-height:360px;overflow-y:auto;margin-bottom:16px;padding-right:2px;">
            ${state.cart.map((item, idx) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:10px;margin-bottom:8px;border:1px solid #e2e8f0;">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:900;font-size:1.25rem;color:var(--sokxay-red);font-family:'Outfit';">
                      ${item.chosen_number}
                    </span>
                    ${item.chosen_animal_name ? `<span style="font-size:0.8rem;color:#334155;font-weight:700;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${item.chosen_animal_name}</span>` : ''}
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">
                    ${item.bet_type} • ຄູນ ${(MULTIPLIERS[item.chosen_number.length] || 60)}x • ລາງວັນ: <span style="color:#059669;font-weight:700;">${formatLAK(item.bet_amount * (MULTIPLIERS[item.chosen_number.length] || 60))}</span>
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:6px;">
                  <!-- Minus Button -->
                  <button class="cart-amt-btn" data-amt-action="minus" data-cart-idx="${idx}" style="width:30px;height:30px;border-radius:6px;border:1px solid #cbd5e1;background:white;font-size:1.1rem;font-weight:900;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.05);" ${item.bet_amount <= 1000 ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : ''}>
                    -
                  </button>

                  <!-- Amount Display -->
                  <div style="min-width:68px;text-align:center;font-weight:800;font-size:0.92rem;color:#0f172a;font-family:'Outfit';">
                    ${item.bet_amount.toLocaleString()} ₭
                  </div>

                  <!-- Plus Button -->
                  <button class="cart-amt-btn" data-amt-action="plus" data-cart-idx="${idx}" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--sokxay-red);background:rgba(227,27,35,0.08);font-size:1.1rem;font-weight:900;color:var(--sokxay-red);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    +
                  </button>

                  <!-- Delete Button -->
                  <button style="background:none;border:none;color:#eb3b5a;font-size:1.25rem;cursor:pointer;padding:0 2px 0 6px;line-height:1;" data-del-cart="${idx}" title="ລຶບລາຍການນີ້">&times;</button>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Total & Wallet Limit Info -->
          <div style="background:#ffffff;border-top:1px dashed #cbd5e1;padding-top:12px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:1.15rem;font-weight:900;margin-bottom:6px;">
              <span>ຍອດລວມທັງໝົດ:</span>
              <span style="color:var(--sokxay-red);font-family:'Outfit';">${formatLAK(total)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-muted);">
              <span>ວົງເງິນໃນບັນຊີ:</span>
              <strong style="color:${!isExceeded ? '#059669' : '#e11d48'};">${formatLAK(state.walletBalance)}</strong>
            </div>
            ${isExceeded ? `
              <div style="margin-top:8px;background:#fff1f2;border:1px solid #fecdd3;color:#e11d48;font-size:0.8rem;padding:6px 10px;border-radius:6px;font-weight:700;">
                ⚠️ ຍອດລວມເກີນວົງເງິນໃນບັນຊີ! ກະລຸນາກົດປຸ່ມ [-] ເພື່ອຫຼຸດຍອດເງິນ ຫຼື ກົດເຕີມເງິນກ່ອນ.
              </div>
            ` : ''}
          </div>

          <!-- Action Buttons -->
          <div style="display:flex;gap:10px;">
            <button class="add-slip-btn" id="confirm-purchase-btn" style="flex:1;background:var(--emerald-gradient);" ${isExceeded ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              ✓ ຢືນຢັນການຊື້ຫວຍທັນທີ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'onepay') {
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">
              <span style="color:#e31b23;font-weight:900;">BCEL One</span> • ເຕີມເງິນເຂົ້າແອັບ
            </div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
              ສະແກນ QR ຜ່ານແອັບ BCEL One ເພື່ອເຕີມເງິນອັດຕະໂນມັດ
            </div>
            
            <!-- Quick Topup Amount Picker -->
            <div class="amount-pills-row" style="justify-content:center;margin-bottom:14px;">
              ${[20000, 50000, 100000, 200000, 500000].map(amt => `
                <button class="amount-pill ${state.topupAmount === amt ? 'selected' : ''}" data-topup-amt="${amt}">
                  ${(amt/1000).toFixed(0)}k ₭
                </button>
              `).join('')}
            </div>

            <!-- QR Display -->
            <div style="background:white;padding:16px;border-radius:14px;display:inline-block;box-shadow:0 8px 25px rgba(0,0,0,0.5);margin-bottom:14px;">
              <img src="${state.onePayData ? state.onePayData.qr_image_data_uri : ''}" style="width:200px;height:200px;display:block;" alt="OnePay QR" />
              <div style="color:#0c2340;font-size:0.75rem;font-weight:800;margin-top:6px;letter-spacing:1px;">
                LAO QR PAYMENT (BCEL One)
              </div>
            </div>

            <div style="font-size:1.15rem;font-weight:800;color:var(--gold-secondary);margin-bottom:6px;">
              ${formatLAK(state.topupAmount)}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;margin-bottom:16px;">
              REF: ${state.onePayData ? state.onePayData.payment_ref : 'BCEL-50000-DEMO'}
            </div>

            <button class="add-slip-btn" id="sim-onepay-confirm-btn" style="background:var(--emerald-gradient);">
              📲 ທົດສອບຊຳລະເງິນສຳເລັດ (Simulate BCEL Pay)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'ticket_detail' && state.activeTicket) {
    const t = state.activeTicket;
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">🎟️ ໃບບິນຫວຍດີຈິຕອນ (Digital Ticket)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          
          <!-- White Paper Ticket Slip -->
          <div class="ticket-slip" id="printable-ticket">
            <div class="ticket-header-logo">
              <div class="ticket-company">ບໍລິສັດ UniLotary ພັດທະນາ ຈຳກັດ</div>
              <div style="font-size:0.75rem;color:#64748b;">UNILOTARY LOTTERY SOLE CO., LTD.</div>
              <div class="ticket-serial-tag" style="margin-top:6px;">ເລກທີປີ້: ${t.ticket_serial}</div>
              <div style="font-size:0.75rem;color:#64748b;">ວັນທີຊື້: ${t.created_at}</div>
            </div>

            <div style="font-size:0.8rem;display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">
              <span>ງວດ: <strong>${t.period_code}</strong></span>
              <span>ອອກວັນທີ: <strong>${t.draw_date}</strong> (20:00)</span>
            </div>

            <div class="ticket-items-list">
              ${t.items.map(it => `
                <div class="ticket-line-item">
                  <div>
                    <span class="ticket-num-badge">${it.chosen_number}</span>
                    <span style="font-size:0.75rem;color:#64748b;margin-left:6px;">
                      ${it.chosen_animal_name ? `🐾 ${it.chosen_animal_name} (${it.bet_type})` : `(${it.bet_type})`}
                    </span>
                  </div>
                  <div>
                    <strong>${formatLAK(it.bet_amount)}</strong>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="ticket-total-row">
              <span>ລວມມູນຄ່າທັງໝົດ:</span>
              <span style="color:#d63031;">${formatLAK(t.total_amount)}</span>
            </div>

            <div class="barcode-sim">
              ||| | |||| || | ||||| ||| |||| |
              <div style="font-size:0.65rem;letter-spacing:1px;color:#64748b;margin-top:4px;">${t.barcode}</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button class="topup-btn" id="ticket-modal-scratch-btn" style="flex:1;padding:12px;background:#fef3c7;color:#d97706;border:1px solid #fde68a;font-weight:800;">
              ✨ ຂູດບັດລຸ້ນໂຊກ
            </button>
          </div>

          <div style="display:flex;gap:10px;">
            <button class="topup-btn" style="flex:1;padding:12px;background:#e2e8f0;color:#1e293b;" id="print-ticket-btn">
              🖨️ ພິມ / ບັນທຶກປີ້
            </button>
            <button class="topup-btn" style="flex:1;padding:12px;background:var(--emerald-gradient);color:#070d1e;" id="close-modal-btn">
              ✓ ສຳເລັດ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'install_guide') {
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">📲 ວິທີຕິດຕັ້ງແອັບເທິງມືຖື</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          <div style="font-size:0.9rem;line-height:1.6;">
            <h4 style="color:var(--gold-secondary);margin-bottom:8px;">🤖 ສຳລັບ Android:</h4>
            <ol style="padding-left:20px;margin-bottom:16px;color:#475569;">
              <li>ກົດປຸ່ມ <strong>"ຕິດຕັ້ງເລີຍ"</strong> ຢູ່ດ້ານເທິງ ຫຼື ໃນເມນູ</li>
              <li>ກົດຢືນຢັນ <strong>"Install"</strong></li>
              <li>ແອັບຈະຖືກຕິດຕັ້ງເຂົ້າໜ້າຈໍມືຖືຄືກັບແອັບປົກກະຕິທັນທີ</li>
            </ol>

            <h4 style="color:var(--gold-secondary);margin-bottom:8px;">🍏 ສຳລັບ iPhone / iPad (iOS ທຸກລຸ້ນ):</h4>
            <ol style="padding-left:20px;margin-bottom:16px;color:#475569;">
              <li>ເປີດເວັບໄຊນີ້ດ້ວຍ <strong>Safari</strong></li>
              <li>ກົດປຸ່ມ Share (ໄອຄອນລູກສອນຊີ້ຂຶ້ນ ⬆️ ຢູ່ແຖບລຸ່ມ)</li>
              <li>ເລື່ອນລົງແລ້ວກົດ <strong>"Add to Home Screen" (ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ)</strong></li>
              <li>ກົດ <strong>"Add" (ເພີ່ມ)</strong> ແອັບຈະປະກົດຢູ່ໜ້າຈໍ iPhone ທັນທີ!</li>
            </ol>

            <button class="add-slip-btn" id="close-modal-btn" style="background:var(--blue-gradient);color:white;">
              ຮັບຊາບແລ້ວ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'digit_places') {
    const digit = state.selectedHoodDigit ?? 2;
    const tensSeries = Array.from({ length: 10 }, (_, i) => `${digit}${i}`);
    const unitsSeries = Array.from({ length: 10 }, (_, i) => `${i}${digit}`);

    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="max-height:85vh;overflow-y:auto;">
          <div class="modal-header">
            <div class="modal-title">📍 ຊື້ເລກຫຼັກ (Digit Place Betting)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>

          <!-- Section 1: Lao Style Hood Series (ເລກຮູດຫຼັກ 10 ໂຕ) -->
          <div style="background:#f8fafc;padding:14px;border-radius:12px;border:1.5px solid #e2e8f0;margin-bottom:16px;">
            <div style="font-weight:800;font-size:1rem;color:var(--sokxay-red);margin-bottom:4px;">
              ⚡ ຮູດເລກຫຼັກ 2 ໂຕ (10 ໂຕ • ລາງວັນ 60x)
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">
              ກົດເລືອກຕົວເລກ (0-9) ເພື່ອຮູດຫຼັກສິບ ຫຼື ຮູດຫຼັກໜ່ວຍ:
            </div>

            <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;margin-bottom:14px;">
              ${[0,1,2,3,4,5,6,7,8,9].map(d => `
                <button class="hood-digit-picker-btn" data-digit="${d}" style="padding:10px;background:${digit === d ? 'var(--sokxay-red)' : 'white'};color:${digit === d ? 'white' : '#1e293b'};border:1.5px solid ${digit === d ? 'var(--sokxay-red)' : '#cbd5e1'};border-radius:8px;font-weight:800;font-size:1.15rem;font-family:'Outfit';cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                  ${d}
                </button>
              `).join('')}
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="hood-buy-btn" data-series-type="tens" style="width:100%;background:var(--sokxay-red);color:white;border:none;padding:12px;border-radius:8px;font-weight:800;font-size:0.88rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;box-shadow:0 3px 10px rgba(227,27,35,0.25);">
                <span>👉 ຮູດຫຼັກສິບ: <strong>${tensSeries[0]} - ${tensSeries[9]}</strong> (10 ໂຕ)</span>
                <span>${formatLAK(state.selectedAmount * 10)}</span>
              </button>
              <button class="hood-buy-btn" data-series-type="units" style="width:100%;background:#0c2340;color:white;border:none;padding:12px;border-radius:8px;font-weight:800;font-size:0.88rem;cursor:pointer;display:flex;justify-content:space-between;align-items:center;box-shadow:0 3px 10px rgba(12,35,64,0.25);">
                <span>👉 ຮູດຫຼັກໜ່ວຍ: <strong>${unitsSeries[0]}, ${unitsSeries[1]}...${unitsSeries[9]}</strong> (10 ໂຕ)</span>
                <span>${formatLAK(state.selectedAmount * 10)}</span>
              </button>
            </div>
          </div>

          <!-- Section 2: Specific Place Options -->
          <div style="font-weight:800;font-size:0.95rem;margin-bottom:8px;color:#1e293b;">
            🎯 ຊື້ເລກຕາມຫຼັກ (1 - 6 ໂຕ):
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            ${[
              { len: 1, name: 'ເລກ 1 ໂຕ (ຫຼັກໜ່ວຍ)', mult: '8.5x', eg: 'ເລືອກເລກ 0-9' },
              { len: 2, name: 'ເລກ 2 ໂຕ (ຫຼັກສິບ, ໜ່ວຍ)', mult: '60x', eg: 'ເລືອກເລກ 00-99' },
              { len: 3, name: 'ເລກ 3 ໂຕ (ຫຼັກຮ້ອຍ, ສິບ, ໜ່ວຍ)', mult: '500x', eg: 'ເລືອກເລກ 000-999' },
              { len: 4, name: 'ເລກ 4 ໂຕ (ຫຼັກພັນ ຫາ ໜ່ວຍ)', mult: '6,000x', eg: 'ເລືອກເລກ 0000-9999' },
              { len: 5, name: 'ເລກ 5 ໂຕ (ຫຼັກໝື່ນ ຫາ ໜ່ວຍ)', mult: '40,000x', eg: 'ເລືອກເລກ 5 ໂຕ' },
              { len: 6, name: 'ເລກ 6 ໂຕ (ຫຼັກແສນ ຫາ ໜ່ວຍ)', mult: '400,000x', eg: 'ເລືອກເລກ 6 ໂຕ ເຕັມ' }
            ].map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:white;border:1px solid #e2e8f0;padding:12px 14px;border-radius:10px;">
                <div>
                  <div style="font-weight:800;font-size:0.92rem;color:#1e293b;">${p.name}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">ລາງວັນ: <strong style="color:var(--sokxay-red);">${p.mult}</strong> (${p.eg})</div>
                </div>
                <button class="quick-pick-place-btn" data-place-len="${p.len}" style="background:rgba(227,27,35,0.08);border:1px solid var(--sokxay-red);color:var(--sokxay-red);font-weight:800;padding:8px 14px;border-radius:6px;font-size:0.85rem;cursor:pointer;">
                  🎲 ສຸ່ມ & ຊື້
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'live_drum') {
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="text-align:center;">
          <div class="modal-header">
            <div class="modal-title">🎰 ຫ້ອງລຸ້ນຜົນຫວຍສົດ (Live Drum Machine)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
            ຈຳລອງເຄື່ອງໝູນລູກບານຫວຍພັດທະນາ 6 ຫຼັກ ແລະ ນາມສັດແບບສົດໆ
          </div>

          <!-- 6 Drum Digit Boxes -->
          <div class="drum-roller-container">
            ${state.liveDrum.displayDigits.map((d, i) => `
              <div class="drum-digit-box ${i >= 6 - state.liveDrum.lockedCount ? 'locked' : (state.liveDrum.isRunning ? 'rolling' : '')}">
                ${d}
              </div>
            `).join('')}
          </div>

          <!-- Status Indicator -->
          <div style="margin:14px 0;font-size:0.95rem;font-weight:800;color:var(--sokxay-red);">
            ${state.liveDrum.isRunning ? '⏳ ກຳລັງໝູນລູກບານລຸ້ນໂຊກ... ກະລຸນາລໍຖ້າ!' : (state.liveDrum.lockedCount === 6 ? '✨ ອອກລາງວັນສຳເລັດແລ້ວ!' : '👉 ກົດປຸ່ມດ້ານລຸ່ມເພື່ອເລີ່ມໝູນລຸ້ນ')}
          </div>

          ${state.liveDrum.lockedCount === 6 ? `
            <div style="background:#fef2f2;border:1px solid #fecdd3;padding:12px;border-radius:10px;margin-bottom:16px;">
              <div style="font-size:0.9rem;font-weight:700;color:#991b1b;">
                ເລກ 6 ໂຕ: <strong>${state.liveDrum.targetDigits}</strong> • ນາມສັດ: <strong>${state.liveDrum.targetDigits.slice(-2)} (ໄກ່ 🐓)</strong>
              </div>
            </div>
          ` : ''}

          <div style="display:flex;gap:10px;">
            <button class="add-slip-btn" id="trigger-live-drum-spin-btn" style="flex:1;background:var(--emerald-gradient);" ${state.liveDrum.isRunning ? 'disabled style="opacity:0.5;"' : ''}>
              ${state.liveDrum.isRunning ? '⏳ ກຳລັງລຸ້ນ...' : '🎰 ໝູນລູກບານລຸ້ນສົດເລີຍ!'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'big_win' && state.bigWinData) {
    const bw = state.bigWinData;
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="text-align:center;background:linear-gradient(180deg, #fffbeb, #ffffff);border:2px solid #f59e0b;">
          <div class="modal-header" style="justify-content:center;position:relative;">
            <div class="modal-title" style="color:#d97706;font-size:1.3rem;">🎉 ເສດຖີໃໝ່ UniLotary!</div>
            <button class="close-modal-btn" id="close-modal-btn" style="position:absolute;right:0;">&times;</button>
          </div>

          <div style="padding:10px 0;">
            <div class="big-win-badge">👑 ຍິນດີດ້ວຍ! ທ່ານຖືກຫວຍແລ້ວ!</div>
            <div class="big-win-amount">+${formatLAK(bw.amount)}</div>
            
            <div style="font-size:1rem;color:#1e293b;margin-bottom:8px;">
              ເລກທີ່ອອກ: <strong style="color:var(--sokxay-red);font-size:1.3rem;font-family:'Outfit';">${bw.winningNumber}</strong>
            </div>

            <div style="background:#ffffff;border:1px dashed #cbd5e1;border-radius:12px;padding:14px;margin:14px 0;">
              <div style="font-size:0.8rem;color:#64748b;">ປີ້ທີ່ຖືກລາງວັນ:</div>
              ${bw.wonTickets.map(wt => `
                <div style="font-weight:800;color:var(--gold-secondary);font-size:0.95rem;margin-top:4px;">
                  ${wt.ticket_serial} (+${formatLAK(wt.total_won_amount)})
                </div>
              `).join('')}
              <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-top:6px;">
                ✓ ຍອດເງິນໂອນເຂົ້າກະເປົາຮຽບຮ້ອຍແລ້ວ
              </div>
            </div>

            <div style="display:flex;gap:10px;">
              <button class="add-slip-btn" id="share-win-card-btn" style="flex:1;background:var(--blue-gradient);color:white;">
                📲 ແຊຣ໌ໃບປະກາດ UniLotary
              </button>
              <button class="add-slip-btn" id="close-modal-btn" style="flex:1;background:var(--emerald-gradient);">
                ✓ ຮັບຊາບ
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'scratch_card' && state.scratchTicket) {
    const t = state.scratchTicket;
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="text-align:center;">
          <div class="modal-header">
            <div class="modal-title">✨ ບັດຂູດລຸ້ນໂຊກ (Digital Scratch Card)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">
            ໃຊ້ນິ້ວມື ຫຼື ເມົ້າສ໌ "ຂູດ" ແຜ່ນເງິນ Foil ເພື່ອເປີດໂຊກຂອງທ່ານ!
          </div>

          <div class="scratch-card-wrapper">
            <div class="scratch-card-underlay">
              <div style="font-size:0.75rem;color:#64748b;font-weight:700;">ເລກທີປີ້: ${t.ticket_serial}</div>
              <div style="font-size:2.2rem;font-weight:900;color:var(--sokxay-red);font-family:'Outfit';margin:8px 0;letter-spacing:2px;">
                ${t.items.map(it => it.chosen_number).join(' • ')}
              </div>
              <div style="font-size:1.05rem;font-weight:800;color:#1e293b;">
                ${t.items.map(it => it.chosen_animal_name ? `🐾 ${it.chosen_animal_name}` : '').filter(Boolean).join(', ') || 'ເລກຊຸດນຳໂຊກ'}
              </div>
              <div style="font-size:0.75rem;color:#059669;font-weight:800;margin-top:6px;">
                ຍອດຊື້: ${formatLAK(t.total_amount)}
              </div>
            </div>
            <canvas id="scratch-canvas" class="scratch-canvas"></canvas>
          </div>

          <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="topup-btn" id="scratch-all-btn" style="flex:1;background:var(--gold-primary);color:#070d1e;font-weight:800;padding:10px;font-size:0.85rem;">
              ⚡ ເປີດໂຊກທັນທີ (Auto Reveal)
            </button>
            <button class="topup-btn" id="close-modal-btn" style="flex:1;padding:10px;font-size:0.85rem;">
              ✓ ປິດໜ້າບັດຂູດ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'lucky_wheel') {
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet" style="text-align:center;">
          <div class="modal-header">
            <div class="modal-title">🎡 ກົງລໍ້ UniLotary (Daily Lucky Spin)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">
            ໝູນກົງລໍ້ຟຣີເພື່ອຮັບເຄຣດິດ, ເງິນສົດ ຫຼື ປີ້ຫວຍຟຣີ!
          </div>

          <div class="lucky-wheel-container">
            <div class="wheel-pointer"></div>
            <div id="wheel-disc" class="wheel-disc" style="transform: rotate(${state.luckyWheel.rotation || 0}deg);">
              <svg viewBox="0 0 300 300" style="width:100%;height:100%;border-radius:50%;">
                ${WHEEL_PRIZES.map((p, i) => {
                  const angle = 45;
                  const startAngle = i * angle;
                  const endAngle = (i + 1) * angle;
                  const x1 = 150 + 140 * Math.cos((Math.PI * startAngle) / 180);
                  const y1 = 150 + 140 * Math.sin((Math.PI * startAngle) / 180);
                  const x2 = 150 + 140 * Math.cos((Math.PI * endAngle) / 180);
                  const y2 = 150 + 140 * Math.sin((Math.PI * endAngle) / 180);
                  const midAngle = startAngle + angle / 2;
                  const tx = 150 + 95 * Math.cos((Math.PI * midAngle) / 180);
                  const ty = 150 + 95 * Math.sin((Math.PI * midAngle) / 180);

                  return `
                    <path d="M150,150 L${x1},${y1} A140,140 0 0,1 ${x2},${y2} Z" fill="${p.color}" stroke="#ffffff" stroke-width="2"/>
                    <text x="${tx}" y="${ty}" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" dominant-baseline="middle" transform="rotate(${midAngle + 90}, ${tx}, ${ty})">
                      ${p.label}
                    </text>
                  `;
                }).join('')}
                <circle cx="150" cy="150" r="28" fill="#ffffff" stroke="var(--sokxay-red)" stroke-width="4"/>
                <text x="150" y="154" fill="var(--sokxay-red)" font-size="9" font-weight="900" text-anchor="middle">UniLotary</text>
              </svg>
            </div>
          </div>

          ${state.luckyWheel.wonPrize ? `
            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px;margin:12px 0;">
              <div style="font-weight:900;color:#15803d;font-size:1.1rem;">
                🎉 ທ່ານໝູນໄດ້: ${state.luckyWheel.wonPrize.label}
              </div>
              ${state.luckyWheel.wonPrize.amount > 0 ? `
                <div style="font-size:0.85rem;color:#166534;margin-top:2px;font-weight:700;">
                  +${formatLAK(state.luckyWheel.wonPrize.amount)} ຖືກໂອນເຂົ້າກະເປົາຮຽບຮ້ອຍແລ້ວ!
                </div>
              ` : ''}
            </div>
          ` : ''}

          <button class="add-slip-btn" id="spin-wheel-action-btn" style="background:var(--emerald-gradient);" ${state.luckyWheel.isSpinning ? 'disabled style="opacity:0.5;"' : ''}>
            ${state.luckyWheel.isSpinning ? '⏳ ກຳລັງໝູນລຸ້ນໂຊກ...' : '🎯 ໝູນກົງລໍ້ເລີຍ!'}
          </button>
        </div>
      </div>
    `;
  }

  if (state.activeModal === 'admin_draw') {
    return `
      <div class="modal-overlay" id="modal-overlay-bg">
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">⚙️ ອອກເລກລາງວັນ (Admin System)</div>
            <button class="close-modal-btn" id="close-modal-btn">&times;</button>
          </div>
          <div style="margin-bottom:14px;">
            <label style="font-size:0.8rem;color:var(--text-muted);">ປ້ອນເລກ 6 ໂຕທີ່ອອກລາງວັນ:</label>
            <input type="text" id="admin-winning-input" maxlength="6" value="784928" 
              style="width:100%;padding:12px;background:#ffffff;border:2px solid var(--border-gold);border-radius:8px;color:var(--gold-secondary);font-size:1.5rem;font-weight:900;text-align:center;letter-spacing:6px;font-family:'Outfit';" />
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:0.8rem;color:var(--text-muted);">ເລືອກນາມສັດທີ່ອອກ:</label>
            <select id="admin-animal-select" style="width:100%;padding:10px;background:#ffffff;border:1px solid var(--border-glass);border-radius:8px;color:#1e293b;">
              ${state.animals.map(a => `
                <option value="${a.animal_id}" ${a.animal_id === 28 ? 'selected' : ''}>${a.base_number} - ${a.animal_name_lo} (${a.icon_symbol})</option>
              `).join('')}
            </select>
          </div>
          <button class="add-slip-btn" id="submit-admin-draw-btn">
            ອອກເລກ & ຕັດສິນປີ້ຫວຍອັດຕະໂນມັດ
          </button>
        </div>
      </div>
    `;
  }

  return '';
}

// Event Handlers
function attachEventHandlers() {
  // Navigation Tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      if (tab) {
        state.activeTab = tab;
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.activeTab = e.currentTarget.getAttribute('data-tab-switch');
      renderApp();
    });
  });

  // Amount Presets
  document.querySelectorAll('[data-amt]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.selectedAmount = parseInt(e.currentTarget.getAttribute('data-amt'), 10);
      renderApp();
    });
  });

  // Keypad Keys
  document.querySelectorAll('.keypad-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.getAttribute('data-key');
      if (state.keypadDigits.length < 6) {
        state.keypadDigits += key;
        renderApp();
      }
    });
  });

  // Clear & Backspace
  const clearBtn = document.getElementById('keypad-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.keypadDigits = '';
      renderApp();
    });
  }

  const bsBtn = document.getElementById('keypad-backspace-btn');
  if (bsBtn) {
    bsBtn.addEventListener('click', () => {
      state.keypadDigits = state.keypadDigits.slice(0, -1);
      renderApp();
    });
  }

  // Quick Random
  const randBtn = document.getElementById('quick-random-btn');
  if (randBtn) {
    randBtn.addEventListener('click', () => {
      const len = state.keypadDigits.length > 0 ? state.keypadDigits.length : 2;
      let rand = '';
      for (let i = 0; i < len; i++) {
        rand += Math.floor(Math.random() * 10).toString();
      }
      state.keypadDigits = rand;
      renderApp();
    });
  }

  // Add to Bet Slip
  const addSlipBtn = document.getElementById('add-to-slip-btn');
  if (addSlipBtn) {
    addSlipBtn.addEventListener('click', () => {
      if (!state.keypadDigits) return;
      const num = state.keypadDigits;
      const betType = `DIGIT_${num.length}`;
      state.cart.push({
        chosen_number: num,
        bet_type: betType,
        bet_amount: state.selectedAmount,
        chosen_animal_name: null
      });
      state.keypadDigits = '';
      renderApp();
    });
  }

  // Quick Buy Animal from Keypad (Full Animal - ຊື້ໝົດນາມ)
  const quickBuyAnimalBtn = document.getElementById('quick-buy-animal-btn');
  if (quickBuyAnimalBtn) {
    quickBuyAnimalBtn.addEventListener('click', (e) => {
      const animalId = parseInt(e.currentTarget.getAttribute('data-animal-id'), 10);
      const animal = state.animals.find(a => a.animal_id === animalId);
      if (animal) {
        buyAnimalFull(animal);
      }
    });
  }

  // Full Animal Buy from Animal Picker Tab (ຊື້ໝົດນາມ)
  document.querySelectorAll('.buy-full-animal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const animalId = parseInt(e.currentTarget.getAttribute('data-animal-id'), 10);
      const animal = state.animals.find(a => a.animal_id === animalId);
      if (animal) {
        buyAnimalFull(animal);
      }
    });
  });

  // Single Animal Number Click from Animal Picker Tab (ຊື້ສະເພາະເລກນີ້)
  document.querySelectorAll('.buy-single-animal-num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = e.currentTarget.getAttribute('data-num');
      const animalId = parseInt(e.currentTarget.getAttribute('data-animal-id'), 10);
      const animal = state.animals.find(a => a.animal_id === animalId);
      state.cart.push({
        chosen_number: num,
        bet_type: 'ANIMAL',
        bet_amount: state.selectedAmount,
        chosen_animal_id: animalId,
        chosen_animal_name: animal ? animal.animal_name_lo : null
      });
      state.activeModal = 'cart';
      renderApp();
    });
  });

  // Open Digit Places Modal
  const openDigitPlacesBtn = document.getElementById('open-digit-places-btn');
  if (openDigitPlacesBtn) {
    openDigitPlacesBtn.addEventListener('click', () => {
      state.activeModal = 'digit_places';
      renderApp();
    });
  }

  // Digit Place Hood Picker (0-9)
  document.querySelectorAll('.hood-digit-picker-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.selectedHoodDigit = parseInt(e.currentTarget.getAttribute('data-digit'), 10);
      renderApp();
    });
  });

  // Digit Place Hood Buy Action (Tens or Units - 10 Numbers)
  document.querySelectorAll('.hood-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-series-type');
      const digit = state.selectedHoodDigit ?? 2;
      const series = (type === 'tens')
        ? Array.from({ length: 10 }, (_, i) => `${digit}${i}`)
        : Array.from({ length: 10 }, (_, i) => `${i}${digit}`);
      
      series.forEach(num => {
        state.cart.push({
          chosen_number: num,
          bet_type: 'DIGIT_2',
          bet_amount: state.selectedAmount,
          chosen_animal_name: (type === 'tens' ? `ຮູດຫຼັກສິບ ${digit}x` : `ຮູດຫຼັກໜ່ວຍ x${digit}`)
        });
      });
      state.activeModal = 'cart';
      renderApp();
    });
  });

  // Quick Pick Place Length
  document.querySelectorAll('.quick-pick-place-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const len = parseInt(e.currentTarget.getAttribute('data-place-len'), 10);
      let rand = '';
      for (let i = 0; i < len; i++) {
        rand += Math.floor(Math.random() * 10).toString();
      }
      state.cart.push({
        chosen_number: rand,
        bet_type: `DIGIT_${len}`,
        bet_amount: state.selectedAmount,
        chosen_animal_name: null
      });
      state.activeModal = 'cart';
      renderApp();
    });
  });

  // Open Cart Modal
  const openCartBtn = document.getElementById('open-cart-modal-btn');
  if (openCartBtn) {
    openCartBtn.addEventListener('click', () => {
      state.activeModal = 'cart';
      renderApp();
    });
  }

  // Delete Cart Item
  document.querySelectorAll('[data-del-cart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-del-cart'), 10);
      state.cart.splice(idx, 1);
      if (state.cart.length === 0) state.activeModal = null;
      renderApp();
    });
  });

  // Adjust Individual Cart Item Amount (+ / -) with Wallet Limit Guard
  document.querySelectorAll('[data-amt-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-cart-idx'), 10);
      const action = e.currentTarget.getAttribute('data-amt-action');
      const item = state.cart[idx];
      if (!item) return;

      const STEP = 1000; // 1,000 Kip per step

      if (action === 'plus') {
        const currentTotal = calculateCartTotal();
        if (currentTotal + STEP > state.walletBalance) {
          alert(`ຍອດເງິນໃນບັນຊີຂອງທ່ານມີ: ${formatLAK(state.walletBalance)}\nບໍ່ສາມາດເພີ່ມເກີນວົງເງິນໃນບັນຊີໄດ້!`);
          return;
        }
        item.bet_amount += STEP;
      } else if (action === 'minus') {
        if (item.bet_amount > 1000) {
          item.bet_amount -= STEP;
        } else {
          alert('ຈຳນວນເງິນແທງຂັ້ນຕ່ຳແມ່ນ 1,000 ₭');
        }
      }
      renderApp();
    });
  });

  // Batch Set Amount for All Items in Cart
  document.querySelectorAll('[data-batch-amt]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetAmt = parseInt(e.currentTarget.getAttribute('data-batch-amt'), 10);
      const newTotal = targetAmt * state.cart.length;
      if (newTotal > state.walletBalance) {
        alert(`ຍອດລວມຈະເປັນ ${formatLAK(newTotal)} ເຊິ່ງເກີນວົງເງິນໃນບັນຊີ (${formatLAK(state.walletBalance)})!`);
        return;
      }
      state.cart.forEach(item => {
        item.bet_amount = targetAmt;
      });
      renderApp();
    });
  });

  // Clear All Items from Cart
  const clearCartBtn = document.getElementById('clear-all-cart-btn');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (confirm('ທ່ານຕ້ອງການລຶບລາຍການຊື້ທັງໝົດບໍ?')) {
        state.cart = [];
        state.activeModal = null;
        renderApp();
      }
    });
  }

  // Confirm Purchase
  const confirmBtn = document.getElementById('confirm-purchase-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const total = calculateCartTotal();
      if (state.walletBalance < total) {
        alert('ຍອດເງິນໃນກະເປົາບໍ່ພຽງພໍ! ກະລຸນາເຕີມເງິນກ່ອນ');
        state.activeModal = 'onepay';
        openOnePayModal();
        return;
      }

      try {
        const periodId = state.activeDraw ? state.activeDraw.period_id : 'sample-period-01';
        const ticketRes = await api.buyTicket(periodId, state.cart).catch(() => {
          // Fallback simulation
          const serial = `UL-2026-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
          return {
            ticket_id: 'tk-' + Date.now(),
            ticket_serial: serial,
            barcode: serial.replace(/-/g, ''),
            period_code: state.activeDraw ? state.activeDraw.period_code : 'DRAW-20260923-01',
            draw_date: state.activeDraw ? state.activeDraw.draw_date : '2026-09-23',
            draw_time: '20:00:00',
            total_amount: total,
            total_won_amount: 0,
            status: 'PENDING',
            created_at: new Date().toLocaleString(),
            items: state.cart.map(c => ({
              ...c,
              potential_win: c.bet_amount * (MULTIPLIERS[c.chosen_number.length] || 60),
              actual_win: 0,
              is_win: false
            }))
          };
        });

        state.walletBalance -= total;
        state.cart = [];
        state.myTickets.unshift(ticketRes);
        state.activeTicket = ticketRes;
        state.activeModal = 'ticket_detail';
        renderApp();
      } catch (err) {
        alert('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
      }
    });
  }

  // Top-up Modal Triggers
  const topupBtn = document.getElementById('open-topup-btn');
  const walletBadge = document.getElementById('wallet-badge-btn');
  if (topupBtn) topupBtn.addEventListener('click', openOnePayModal);
  if (walletBadge) walletBadge.addEventListener('click', openOnePayModal);

  // Topup Amount selection in modal
  document.querySelectorAll('[data-topup-amt]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      state.topupAmount = parseInt(e.currentTarget.getAttribute('data-topup-amt'), 10);
      await generateOnePayQR();
      renderApp();
    });
  });

  // Simulate OnePay Confirm
  const simPayBtn = document.getElementById('sim-onepay-confirm-btn');
  if (simPayBtn) {
    simPayBtn.addEventListener('click', async () => {
      try {
        const ref = state.onePayData ? state.onePayData.payment_ref : 'BCEL-DEMO';
        await api.confirmOnePayTopup(ref, state.topupAmount).catch(() => {});
        state.walletBalance += state.topupAmount;
        alert(`ເຕີມເງິນສຳເລັດ! +${formatLAK(state.topupAmount)} ເຂົ້າກະເປົາແລ້ວ.`);
        state.activeModal = null;
        renderApp();
      } catch (e) {
        state.walletBalance += state.topupAmount;
        state.activeModal = null;
        renderApp();
      }
    });
  }

  // View Ticket Detail
  document.querySelectorAll('[data-ticket-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      const tid = e.currentTarget.getAttribute('data-ticket-id');
      const found = state.myTickets.find(t => t.ticket_id === tid);
      if (found) {
        state.activeTicket = found;
        state.activeModal = 'ticket_detail';
        renderApp();
      }
    });
  });

  // Admin Draw Simulation
  const adminBtn = document.getElementById('admin-draw-sim-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      state.activeModal = 'admin_draw';
      renderApp();
    });
  }

  const submitDrawBtn = document.getElementById('submit-admin-draw-btn');
  if (submitDrawBtn) {
    submitDrawBtn.addEventListener('click', async () => {
      const winningDigits = document.getElementById('admin-winning-input').value.trim();
      const animalId = parseInt(document.getElementById('admin-animal-select').value, 10);
      if (winningDigits.length !== 6) {
        alert('ກະລຸນາປ້ອນເລກ 6 ໂຕ');
        return;
      }

      try {
        const periodId = state.activeDraw ? state.activeDraw.period_id : 'sample-period-01';
        await api.submitDrawResult(periodId, winningDigits, animalId).catch(() => {});
        
        // Evaluate local tickets
        state.myTickets.forEach(t => {
          let wonTotal = 0;
          t.items.forEach(it => {
            const num = it.chosen_number;
            const len = num.length;
            if (winningDigits.endsWith(num)) {
              it.is_win = true;
              it.actual_win = it.bet_amount * (MULTIPLIERS[len] || 60);
              wonTotal += it.actual_win;
            } else {
              it.is_win = false;
            }
          });
          if (wonTotal > 0) {
            t.status = 'WON';
            t.total_won_amount = wonTotal;
            state.walletBalance += wonTotal;
          } else {
            t.status = 'LOST';
          }
        });

        alert(`ອອກເລກສຳເລັດ: ${winningDigits}! ລະບົບໄດ້ກວດສອບ ແລະ ໂອນເງິນລາງວັນໃຫ້ຜູ້ຖືກຫວຍແລ້ວ.`);
        state.activeModal = null;
        state.activeTab = 'my_tickets';
        renderApp();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Install app guides
  const installBannerBtn = document.getElementById('install-app-btn');
  const navInstallBtn = document.getElementById('nav-install-btn');
  const triggerInstall = () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      state.deferredInstallPrompt.userChoice.then(() => {
        state.deferredInstallPrompt = null;
      });
    } else {
      state.activeModal = 'install_guide';
      renderApp();
    }
  };
  if (installBannerBtn) installBannerBtn.addEventListener('click', triggerInstall);
  if (navInstallBtn) navInstallBtn.addEventListener('click', triggerInstall);

  // Close Modal
  document.querySelectorAll('#close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeModal = null;
      renderApp();
    });
  });

  const overlayBg = document.getElementById('modal-overlay-bg');
  if (overlayBg) {
    overlayBg.addEventListener('click', (e) => {
      if (e.target === overlayBg) {
        state.activeModal = null;
        renderApp();
      }
    });
  }

  // Print ticket
  const printBtn = document.getElementById('print-ticket-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // --- Gamification & Suspense Listeners ---
  // 1. Lucky Wheel Modal & Spin
  const luckyWheelBtn = document.getElementById('open-lucky-wheel-btn');
  if (luckyWheelBtn) {
    luckyWheelBtn.addEventListener('click', () => {
      state.activeModal = 'lucky_wheel';
      renderApp();
    });
  }

  const spinWheelBtn = document.getElementById('spin-wheel-action-btn');
  if (spinWheelBtn) {
    spinWheelBtn.addEventListener('click', () => {
      spinLuckyWheel();
    });
  }

  // 2. Live Drum Modal & Spin
  const liveDrumBtn = document.getElementById('open-live-drum-btn');
  if (liveDrumBtn) {
    liveDrumBtn.addEventListener('click', () => {
      state.activeModal = 'live_drum';
      renderApp();
    });
  }

  const triggerLiveDrumBtn = document.getElementById('trigger-live-drum-spin-btn');
  if (triggerLiveDrumBtn) {
    triggerLiveDrumBtn.addEventListener('click', () => {
      // Pick random 6-digit number or 784928 (matching Rooster ໄກ່ 28)
      const randomWinning = String(Math.floor(100000 + Math.random() * 900000));
      const animal2Digits = parseInt(randomWinning.slice(-2), 10);
      startLiveDrumRoll(randomWinning, animal2Digits || 28);
    });
  }

  // 3. Digital Scratch Card
  document.querySelectorAll('.open-scratch-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tid = e.currentTarget.getAttribute('data-ticket-id');
      const found = state.myTickets.find(t => t.ticket_id === tid) || state.activeTicket;
      if (found) {
        state.scratchTicket = found;
        state.scratchCardCleared = false;
        state.activeModal = 'scratch_card';
        renderApp();
        setTimeout(initScratchCard, 60);
      }
    });
  });

  const ticketModalScratchBtn = document.getElementById('ticket-modal-scratch-btn');
  if (ticketModalScratchBtn) {
    ticketModalScratchBtn.addEventListener('click', () => {
      if (state.activeTicket) {
        state.scratchTicket = state.activeTicket;
        state.scratchCardCleared = false;
        state.activeModal = 'scratch_card';
        renderApp();
        setTimeout(initScratchCard, 60);
      }
    });
  }

  const scratchAllBtn = document.getElementById('scratch-all-btn');
  if (scratchAllBtn) {
    scratchAllBtn.addEventListener('click', () => {
      const canvas = document.getElementById('scratch-canvas');
      if (canvas) {
        state.scratchCardCleared = true;
        launchConfetti(3500);
        canvas.style.transition = 'opacity 0.6s ease';
        canvas.style.opacity = '0';
        setTimeout(() => {
          if (canvas.parentNode) canvas.style.display = 'none';
        }, 600);
      }
    });
  }

  // 4. Big Win Social Share Card
  const shareWinBtn = document.getElementById('share-win-card-btn');
  if (shareWinBtn) {
    shareWinBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'ຂ້ອຍຖືກຫວຍ UniLotary!',
          text: `🎉 ຍິນດີນໍາຂ້ອຍແດ່! ຂ້ອຍຖືກຫວຍ UniLotary ເປັນເງິນ ${state.bigWinData ? formatLAK(state.bigWinData.amount) : ''}! ມາລຸ້ນໂຊກນໍາກັນ!`,
          url: window.location.href
        }).catch(() => {});
      } else {
        alert('ຄັດລອກໃບປະກາດ UniLotary ຮຽບຮ້ອຍແລ້ວ! ສາມາດສົ່ງຕໍ່ໃຫ້ໝູ່ເພື່ອນທາງ WhatsApp, Facebook, Telegram ໄດ້ເລີຍ 🎉');
      }
    });
  }
}

async function openOnePayModal() {
  state.activeModal = 'onepay';
  await generateOnePayQR();
  renderApp();
}

async function generateOnePayQR() {
  try {
    state.onePayData = await api.createOnePayQR(state.topupAmount);
  } catch (e) {
    // Local SVG fallback
    state.onePayData = {
      payment_ref: `BCEL-${state.topupAmount}-DEMO`,
      qr_image_data_uri: '/icons/icon.svg'
    };
  }
}

function calculateCartTotal() {
  return state.cart.reduce((sum, item) => sum + item.bet_amount, 0);
}

// Live Countdown to 20:00 Lao draw
function startCountdownTimer() {
  setInterval(() => {
    const now = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }
    const diff = target - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const hElem = document.getElementById('cd-hours');
    const mElem = document.getElementById('cd-mins');
    const sElem = document.getElementById('cd-secs');

    if (hElem) hElem.textContent = String(hours).padStart(2, '0');
    if (mElem) mElem.textContent = String(mins).padStart(2, '0');
    if (sElem) sElem.textContent = String(secs).padStart(2, '0');
  }, 1000);
}

// Boot
window.addEventListener('DOMContentLoaded', initApp);
