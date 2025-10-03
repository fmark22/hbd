// ===== DOM =====
const pageBg = document.getElementById("page-bg");
const loadingEl = document.getElementById("loading");
const startBtn = document.getElementById("start-btn");
const appEl = document.getElementById("app");

const map = document.getElementById("map");
const mapFader = document.getElementById("map-fader");
const textBar = document.getElementById("text-bar");
const collectionBar = document.getElementById("collection-bar");

const letterIcon = document.getElementById("letter-icon");
const letterModal = document.getElementById("letter-modal");
const closeLetterBtn = document.getElementById("close-letter");

const loadingTitle = document.querySelector(".loading-title");
const loadingText = document.getElementById("loading-subtext");

// Gate(비번)
const letterGate = document.getElementById("letter-gate");
const gateForm = document.getElementById("gate-form");
const gateInput = document.getElementById("gate-input");
const gateCancel = document.getElementById("gate-cancel");
const gateError = document.getElementById("gate-error");
const PASSCODE_PLAIN = "0825";

// ===== 전역 배경 동기화 =====
function setGlobalBg(url) {
  document.documentElement.style.setProperty("--page-bg-url", `url("${url}")`);
}

// ===== 에셋 프리로드 + 가짜 프로그레스(0→100%) + 최소 5초 =====
const ASSETS = [
  "bg/map.png",
  "bg/letter_map.png",
  "bg/hanok_gil.png",
  "assets/letter.png",
  "assets/cake.png",
  "assets/cookie.png",
  "assets/lamp.png",
  "assets/lp.png",
  "assets/sfx/type.wav",
];

const MIN_LOADING_MS = 5000; // 최소 5초
const loadStart = performance.now();
let assetsDone = false;
let fakeProgress = 0;

// cover 보정용 이미지 원본 크기 기록
const IMAGE_DIMS = new Map(); // src -> {w,h}
let CURRENT_BG_KEY = "bg/map.png";

// 0→100% 자연스러운 증가
const progressTimer = setInterval(() => {
  const target = assetsDone ? 100 : 95;
  fakeProgress += (target - fakeProgress) * 0.1 + Math.random() * 0.8;
  if (!assetsDone && fakeProgress > 95) fakeProgress = 95;
  fakeProgress = Math.max(0, Math.min(100, fakeProgress));
  const pct = Math.floor(fakeProgress);
  loadingTitle.textContent = pct < 100 ? "로딩 중…" : "로딩 완료";
  loadingText.textContent = `필요한 리소스를 불러오고 있어요 (${pct}%)`;
}, 110);

// 프리로드
preloadAssets(ASSETS, () => {}, onAssetsDone);
function preloadAssets(list, onProgress, onDone) {
  let loaded = 0;
  const total = list.length;
  const step = () => {
    loaded++;
    onProgress?.(loaded / total);
    if (loaded >= total) onDone?.();
  };
  list.forEach((src) => {
    if (/\.(png|jpg|jpeg|webp)$/i.test(src)) {
      const img = new Image();
      img.onload = () => {
        try {
          IMAGE_DIMS.set(src, { w: img.naturalWidth, h: img.naturalHeight });
        } catch {}
        step();
      };
      img.onerror = step;
      img.src = src;
    } else if (/\.(wav|mp3|ogg)$/i.test(src)) {
      const aud = new Audio();
      aud.oncanplaythrough = step;
      aud.onerror = step;
      aud.src = src;
    } else step();
  });
}

function onAssetsDone() {
  assetsDone = true;
  const elapsed = performance.now() - loadStart;
  const remain = Math.max(0, MIN_LOADING_MS - elapsed);
  setTimeout(() => {
    const fin = setInterval(() => {
      fakeProgress += (100 - fakeProgress) * 0.2 + 1.2;
      if (fakeProgress >= 99.5) {
        fakeProgress = 100;
        clearInterval(fin);
      }
      const pct = Math.floor(fakeProgress);
      loadingTitle.textContent = pct < 100 ? "로딩 중…" : "로딩 완료";
      loadingText.textContent = `필요한 리소스를 불러오고 있어요 (${pct}%)`;
    }, 60);
    setTimeout(() => {
      loadingEl.classList.add("ready");
      startBtn.hidden = false;
      startBtn.disabled = false;
      clearInterval(progressTimer);
    }, 300);
  }, remain);
}

// ===== 배경이미지(cover) 좌표 변환 유틸 =====
function imagePointToContainerXY({ xRatio, yRatio }, containerRect, imgSrc) {
  const dims = IMAGE_DIMS.get(imgSrc);
  if (!dims) {
    return {
      x: containerRect.width * xRatio,
      y: containerRect.height * yRatio,
    };
  }
  const { w: iw, h: ih } = dims;
  const scale = Math.max(containerRect.width / iw, containerRect.height / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  const offsetX = (containerRect.width - rw) / 2;
  const offsetY = (containerRect.height - rh) / 2;
  return { x: offsetX + rw * xRatio, y: offsetY + rh * yRatio };
}

// ===== 데이터: 비율 좌표 (map.png 하얀 점 위치 반영) =====
const toyData = {
  cake: {
    img: "assets/cake.png",
    className: "",
    init: { xRatio: 0.22, yRatio: 0.7 },
    label: "Cake",
  },
  cookie: {
    img: "assets/cookie.png",
    className: "toy--cookie",
    init: { xRatio: 0.55, yRatio: 0.46 },
    label: "Cookie",
  },
  lamp: {
    img: "assets/lamp.png",
    className: "toy--lamp",
    init: { xRatio: 0.73, yRatio: 0.91 },
    label: "Lamp",
  },
  lp: {
    img: "assets/lp.png",
    className: "",
    init: { xRatio: 0.84, yRatio: 0.1 },
    label: "LP",
  },
};
const totalItems = Object.keys(toyData).length;
let foundCount = 0;

// 진행 문구
const scenarios = [
  { required: 0, text: "아이템을 찾아주세요. 〔0/4〕" },
  { required: 1, text: "좋아요, 시작이 반이죠!" },
  { required: 2, text: "절반을 넘어섰어요!" },
  { required: 3, text: "마지막 하나만 더!" },
  { required: 4, text: "모두 찾았어요! 대단해요! 🎉" },
];

// ===== 타자기 효과 =====
let typeTimer = null;
let typeSfx;
try {
  typeSfx = new Audio("assets/sfx/type.wav");
  typeSfx.volume = 0.15;
} catch (e) {}
function typewrite(el, text, { speed = 22, sound = false } = {}) {
  if (!el) return;
  if (typeTimer) {
    clearInterval(typeTimer);
    typeTimer = null;
  }
  el.textContent = "";
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent += text.charAt(i++);
    if (sound && typeSfx?.play) {
      try {
        typeSfx.currentTime = 0;
        typeSfx.play();
      } catch (e) {}
    }
    if (i >= text.length) {
      clearInterval(typeTimer);
      typeTimer = null;
      const cursor = document.createElement("span");
      cursor.className = "tw-cursor";
      cursor.textContent = "▍";
      el.appendChild(cursor);
    }
  }, speed);
}

// ===== 시작 버튼 =====
startBtn.addEventListener("click", () => {
  loadingEl.classList.add("hidden");
  appEl.setAttribute("aria-hidden", "false");
  initGame();
});

// ===== 초기화 =====
const collectionIconMap = new Map();
let toyElements = {}; // key -> DOM

function initGame() {
  setGlobalBg("bg/map.png");
  CURRENT_BG_KEY = "bg/map.png";
  foundCount = 0;

  buildCollectionBar();
  spawnAllToys();
  positionAllToys();
  updateText();

  window.addEventListener("resize", positionAllToys);
}

function buildCollectionBar() {
  collectionBar.innerHTML = "";
  collectionIconMap.clear();
  Object.entries(toyData).forEach(([key, def]) => {
    const el = document.createElement("div");
    el.className = "item-collection__icon";
    el.style.backgroundImage = `url('${def.img}')`;
    el.title = def.label || key;
    el.dataset.key = key;

    // 눌림 피드백
    const pressOn = () => el.classList.add("is-pressing");
    const pressOff = () => el.classList.remove("is-pressing");
    el.addEventListener("pointerdown", pressOn);
    el.addEventListener("pointerup", pressOff);
    el.addEventListener("pointerleave", pressOff);
    el.addEventListener("pointercancel", pressOff);

    collectionBar.appendChild(el);
    collectionIconMap.set(key, el);
  });
}

function spawnAllToys() {
  map.querySelectorAll(".toy").forEach((n) => n.remove());
  toyElements = {};
  Object.entries(toyData).forEach(([key, toy]) => {
    const el = document.createElement("img");
    el.src = toy.img;
    el.className = `toy ${toy.className || ""}`.trim();
    el.dataset.key = key;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `${toy.label || key} 찾기`);
    el.addEventListener("click", () => collectToy(key, el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        collectToy(key, el);
      }
    });
    map.appendChild(el);
    toyElements[key] = el;
  });
}

function getSafeBottom() {
  const rectBar = collectionBar.getBoundingClientRect?.();
  return Math.ceil(rectBar?.height || 100) + 16; // 여유 16px
}

function positionAllToys() {
  const rect = map.getBoundingClientRect();
  const SAFE_BOTTOM = getSafeBottom();
  Object.entries(toyData).forEach(([key, toy]) => {
    const el = toyElements[key];
    if (!el) return;
    const pt = imagePointToContainerXY(
      { xRatio: toy.init.xRatio, yRatio: toy.init.yRatio },
      rect,
      CURRENT_BG_KEY
    );
    let L = Math.round(pt.x);
    let T = Math.round(pt.y);
    if (T > rect.height - SAFE_BOTTOM) T = rect.height - SAFE_BOTTOM;
    el.style.left = `${L}px`;
    el.style.top = `${T}px`;
  });
}

// ===== 수집 처리 =====
function collectToy(key, el) {
  if (el.classList.contains("found")) return;
  el.classList.add("found");
  const icon = collectionIconMap.get(key);
  if (icon) icon.classList.add("is-collected");

  foundCount++;
  updateText();
  if (foundCount === totalItems) triggerLetterScene();
}

// ===== 스토리 → 배경 전환 → 편지 아이콘 =====
let letterSceneStarted = false;
function triggerLetterScene() {
  if (letterSceneStarted) return;
  letterSceneStarted = true;

  collectionBar.classList.add("hidden");
  typewrite(textBar, "근데, 중요한 하나를 잃어버리는데…", {
    speed: 28,
    sound: false,
  });

  setTimeout(() => {
    mapFader.style.opacity = "1";
    setTimeout(() => {
      map.style.backgroundImage = 'url("bg/letter_map.png")';
      setGlobalBg("bg/letter_map.png");
      CURRENT_BG_KEY = "bg/letter_map.png";
      map.querySelectorAll(".toy").forEach((n) => n.remove());
      setTimeout(() => {
        mapFader.style.opacity = "0";
        setTimeout(() => {
          typewrite(textBar, "편지를 클릭해보세요.", {
            speed: 26,
            sound: false,
          });
          // 편지 아이콘을 의도한 좌표(하얀점)에 배치 (비율: 이전 요청값)
          positionLetterIcon(0.79, 0.68);
          letterIcon.classList.add("show");
          letterIcon.setAttribute("aria-hidden", "false");
        }, 350);
      }, 80);
    }, 450);
  }, 900);
}

function positionLetterIcon(xRatio, yRatio) {
  const rect = map.getBoundingClientRect();
  const pt = imagePointToContainerXY({ xRatio, yRatio }, rect, CURRENT_BG_KEY);
  letterIcon.style.left = `${pt.x}px`;
  letterIcon.style.top = `${pt.y}px`;
}

// ===== 상단 텍스트 =====
function updateText() {
  const step = Math.min(foundCount, scenarios.length - 1);
  typewrite(textBar, scenarios[step].text, { speed: 22, sound: false });
}

// ===== 편지 아이콘 → 게이트 → 편지 모달 =====
letterIcon.addEventListener("click", () => {
  letterGate.classList.add("show");
  letterGate.setAttribute("aria-hidden", "false");
  gateInput.focus();
});
letterIcon.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    letterGate.classList.add("show");
    letterGate.setAttribute("aria-hidden", "false");
    gateInput.focus();
  }
});

gateForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = (gateInput.value || "").trim();
  if (val === PASSCODE_PLAIN) {
    gateError.hidden = true;
    letterGate.classList.remove("show");
    letterGate.setAttribute("aria-hidden", "true");
    letterModal.classList.add("show");
    letterModal.setAttribute("aria-hidden", "false");
  } else {
    gateError.hidden = false;
    gateInput.select();
  }
});
gateCancel?.addEventListener("click", () => {
  letterGate.classList.remove("show");
  letterGate.setAttribute("aria-hidden", "true");
});
closeLetterBtn.addEventListener("click", () => {
  letterModal.classList.remove("show");
  letterModal.setAttribute("aria-hidden", "true");
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (letterModal.classList.contains("show")) {
      letterModal.classList.remove("show");
      letterModal.setAttribute("aria-hidden", "true");
    } else if (letterGate.classList.contains("show")) {
      letterGate.classList.remove("show");
      letterGate.setAttribute("aria-hidden", "true");
    }
  }
});
