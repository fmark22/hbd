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
const letterHint = document.getElementById("letter-hint"); // ✨ 힌트 오버레이

const loadingTitle = document.querySelector(".loading-title");
const loadingText = document.getElementById("loading-subtext");

// ===== 전역 배경 동기화 =====
function setGlobalBg(url) {
  document.documentElement.style.setProperty("--page-bg-url", `url("${url}")`);
}

// ===== 에셋 프리로드 + 가짜 프로그레스 =====
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

const MIN_LOADING_MS = 5000;
const loadStart = performance.now();
let assetsDone = false;
let fakeProgress = 0;

const IMAGE_DIMS = new Map(); // src -> {w,h}
let CURRENT_BG_KEY = "bg/map.png";

// 진행 퍼센트 표시
const progressTimer = setInterval(() => {
  const target = assetsDone ? 100 : 95;
  fakeProgress += (target - fakeProgress) * 0.1 + Math.random() * 0.8;
  if (!assetsDone && fakeProgress > 95) fakeProgress = 95;
  fakeProgress = Math.max(0, Math.min(100, fakeProgress));
  const pct = Math.floor(fakeProgress);
  loadingTitle.textContent = pct < 100 ? "로딩 중…" : "로딩 완료";
  loadingText.textContent = `필요한 리소스를 불러오고 있어요 (${pct}%)`;
}, 110);

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

// ===== cover 좌표 변환 =====
function imagePointToContainerXY({ xRatio, yRatio }, containerRect, imgSrc) {
  const dims = IMAGE_DIMS.get(imgSrc);
  if (!dims)
    return {
      x: containerRect.width * xRatio,
      y: containerRect.height * yRatio,
    };
  const { w: iw, h: ih } = dims;
  const scale = Math.max(containerRect.width / iw, containerRect.height / ih);
  const rw = iw * scale,
    rh = ih * scale;
  const offsetX = (containerRect.width - rw) / 2;
  const offsetY = (containerRect.height - rh) / 2;
  return { x: offsetX + rw * xRatio, y: offsetY + rh * yRatio };
}

// ===== 아이템 좌표(비율) + 라벨(툴팁용) =====
const toyData = {
  cake: {
    img: "assets/cake.png",
    className: "",
    init: { xRatio: 0.22, yRatio: 0.7 },
    label: "단종되어 사지 못한 테디 스콘",
  },
  cookie: {
    img: "assets/cookie.png",
    className: "toy--cookie",
    init: { xRatio: 0.55, yRatio: 0.46 },
    label: "테디 쿠키",
  },
  lamp: {
    img: "assets/lamp.png",
    className: "toy--lamp",
    init: { xRatio: 0.73, yRatio: 0.91 },
    label: "팬들이 주로 만드는 무드등",
  },
  lp: {
    img: "assets/lp.png",
    className: "",
    init: { xRatio: 0.78, yRatio: 0.1 },
    label: "옷장 속에 함참 있던 LP",
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

// 타자기 효과
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

// ===== 커스텀 툴팁 =====
const tooltip = (() => {
  const el = document.createElement("div");
  el.className = "tooltip";
  el.innerHTML = `<span class="tooltip__text"></span><span class="tooltip__arrow"></span>`;
  document.body.appendChild(el);
  return el;
})();
const tooltipText = tooltip.querySelector(".tooltip__text");
let tooltipTimer = null;

function showTooltipFor(target) {
  const label = target?.dataset?.tip || target?.getAttribute("aria-label");
  if (!label) return;
  tooltipText.textContent = label;

  const r = target.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  tooltip.classList.add("show");
}
function hideTooltip() {
  tooltip.classList.remove("show");
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
}

// 시작
startBtn.addEventListener("click", () => {
  loadingEl.classList.add("hidden");
  appEl.setAttribute("aria-hidden", "false");
  initGame();
});

// 초기화
const collectionIconMap = new Map();
let toyElements = {};
function initGame() {
  setGlobalBg("bg/map.png");
  CURRENT_BG_KEY = "bg/map.png";
  foundCount = 0;
  buildCollectionBar();
  spawnAllToys();
  positionAllToys();
  updateText();
  window.addEventListener("resize", () => {
    positionAllToys();
    if (letterSceneStarted) positionLetterIcon(0.5, 0.6);
  });
}

function buildCollectionBar() {
  collectionBar.innerHTML = "";
  collectionIconMap.clear();
  Object.entries(toyData).forEach(([key, def]) => {
    const el = document.createElement("div");
    el.className = "item-collection__icon";
    el.style.backgroundImage = `url('${def.img}')`;

    // 접근성 라벨 & 툴팁 텍스트
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", def.label || key);
    el.dataset.tip = def.label || key;

    // 탭(눌림) 피드백
    const pressOn = () => el.classList.add("is-pressing");
    const pressOff = () => el.classList.remove("is-pressing");
    el.addEventListener("pointerdown", pressOn);
    el.addEventListener("pointerup", pressOff);
    el.addEventListener("pointerleave", pressOff);
    el.addEventListener("pointercancel", pressOff);

    // 툴팁 이벤트
    el.addEventListener("mouseenter", () => showTooltipFor(el));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("focus", () => showTooltipFor(el));
    el.addEventListener("blur", hideTooltip);
    el.addEventListener(
      "touchstart",
      () => {
        showTooltipFor(el);
        tooltipTimer = setTimeout(hideTooltip, 1200);
      },
      { passive: true }
    );

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
    el.addEventListener("click", () => collectToy(key, el));
    map.appendChild(el);
    toyElements[key] = el;
  });
}

function positionAllToys() {
  const rect = map.getBoundingClientRect();
  const SAFE_BOTTOM = 110;
  Object.entries(toyData).forEach(([key, toy]) => {
    const el = toyElements[key];
    if (!el) return;
    const pt = imagePointToContainerXY(toy.init, rect, CURRENT_BG_KEY);
    let L = Math.round(pt.x),
      T = Math.round(pt.y);
    if (T > rect.height - SAFE_BOTTOM) T = rect.height - SAFE_BOTTOM;
    el.style.left = `${L}px`;
    el.style.top = `${T}px`;
  });
}

// 수집
function collectToy(key, el) {
  if (el.classList.contains("found")) return;
  el.classList.add("found");
  collectionIconMap.get(key)?.classList.add("is-collected");
  foundCount++;
  updateText();
  if (foundCount === totalItems) triggerLetterScene();
}

// 편지씬 전환 + 힌트 표시
let letterSceneStarted = false;
function triggerLetterScene() {
  if (letterSceneStarted) return;
  letterSceneStarted = true;

  collectionBar.classList.add("hidden");

  mapFader.style.opacity = "1";
  setTimeout(() => {
    map.style.backgroundImage = 'url("bg/letter_map.png")';
    setGlobalBg("bg/letter_map.png");
    CURRENT_BG_KEY = "bg/letter_map.png";
    map.querySelectorAll(".toy").forEach((n) => n.remove());
    mapFader.style.opacity = "0";

    // 👇 기존 안내 문구 숨기기
    textBar.style.opacity = "0";
    textBar.style.visibility = "hidden";

    // ✨ 편지 힌트 띄우기
    letterHint.classList.add("show");
    setTimeout(() => {
      letterHint.classList.remove("show");
      letterHint.classList.add("hide");

      // 편지 표시 + 안내 문구
      positionLetterIcon(0.5, 0.6);
      letterIcon.classList.add("show");
      letterIcon.setAttribute("aria-hidden", "false");
      typewrite(textBar, "편지를 클릭해보세요.", { speed: 26, sound: false });
    }, 2200);
  }, 300);
}

function positionLetterIcon(xRatio, yRatio) {
  const rect = map.getBoundingClientRect();
  const pt = imagePointToContainerXY({ xRatio, yRatio }, rect, CURRENT_BG_KEY);
  letterIcon.style.left = `${pt.x}px`;
  letterIcon.style.top = `${pt.y}px`;
}

// 상단 텍스트
function updateText() {
  const step = Math.min(foundCount, scenarios.length - 1);
  typewrite(textBar, scenarios[step].text, { speed: 22, sound: false });
}

// 편지 아이콘 → 바로 편지 모달 열기
letterIcon.addEventListener("click", openLetter);
letterIcon.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openLetter();
  }
});

function openLetter() {
  letterModal.classList.add("show");
  letterModal.setAttribute("aria-hidden", "false");
}

closeLetterBtn.addEventListener("click", () => {
  letterModal.classList.remove("show");
  letterModal.setAttribute("aria-hidden", "true");
  returnToLoading();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && letterModal.classList.contains("show")) {
    letterModal.classList.remove("show");
    letterModal.setAttribute("aria-hidden", "true");
    returnToLoading();
  }
});

function returnToLoading() {
  // 게임 영역 숨기기
  appEl.setAttribute("aria-hidden", "true");

  // 편지 아이콘 숨기기
  letterIcon.classList.remove("show");
  letterIcon.setAttribute("aria-hidden", "true");

  // 텍스트 초기화
  textBar.textContent = "";

  // 상태값 초기화
  letterSceneStarted = false;
  foundCount = 0;

  // 맵 초기화
  map.style.backgroundImage = 'url("bg/map.png")';
  setGlobalBg("bg/map.png");
  CURRENT_BG_KEY = "bg/map.png";

  // 로딩 화면 다시 표시
  loadingEl.classList.remove("hidden");
  loadingEl.classList.remove("ready");
  startBtn.hidden = false;
  startBtn.disabled = false;

  // 로딩 텍스트 초기화
  loadingTitle.textContent = "로딩 완료";
  loadingText.textContent = "필요한 리소스를 불러오고 있어요 (100%)";
}

// 로딩 화면으로 완전 복귀 + 0%부터 다시 차오르는 연출
let reloadTimer = null;
function returnToLoading() {
  // 게임 영역/상태 초기화
  appEl.setAttribute("aria-hidden", "true");
  letterIcon.classList.remove("show");
  letterIcon.setAttribute("aria-hidden", "true");
  textBar.textContent = "";
  letterSceneStarted = false;
  foundCount = 0;

  // 맵/배경 초기화
  map.style.backgroundImage = 'url("bg/map.png")';
  setGlobalBg("bg/map.png");
  CURRENT_BG_KEY = "bg/map.png";

  // 로딩 UI 초기화
  loadingEl.classList.remove("hidden");
  loadingEl.classList.remove("ready");
  startBtn.hidden = true;
  startBtn.disabled = true;

  // 텍스트 0%로 리셋
  loadingTitle.textContent = "로딩 중…";
  loadingText.textContent = "필요한 리소스를 불러오고 있어요 (0%)";

  // 기존 재로딩 타이머가 있다면 정리
  if (reloadTimer) clearInterval(reloadTimer);

  // 0% → 100% 가짜 로딩 연출 (약 2.5초)
  const DURATION = 2500;
  const began = performance.now();
  reloadTimer = setInterval(() => {
    const t = performance.now() - began;
    const pct = Math.min(100, Math.floor((t / DURATION) * 100));
    loadingText.textContent = `필요한 리소스를 불러오고 있어요 (${pct}%)`;

    if (pct >= 100) {
      clearInterval(reloadTimer);
      reloadTimer = null;
      loadingTitle.textContent = "로딩 완료";
      // 시작 버튼만 중앙에 노출
      loadingEl.classList.add("ready");
      startBtn.hidden = false;
      startBtn.disabled = false;
    }
  }, 60);
}
