(function () {
  "use strict";

  const SWIPE_THRESHOLD = 45;
  const SWIPE_MAX_VERTICAL = 80;

  /** @type {{ id: string, title: string, subtitle?: string, accent: string, cards: { front: string, back: string }[] }[]} */
  const decks = window.DECKS || [];

  const landingEl = document.getElementById("screen-landing");
  const studyEl = document.getElementById("screen-study");
  const finishEl = document.getElementById("screen-finish");
  const deckGrid = document.getElementById("deck-grid");
  const backBtn = document.getElementById("back-btn");
  const studyTitle = document.getElementById("study-title");
  const progressFill = document.getElementById("progress-fill");
  const counterEl = document.getElementById("study-counter");
  const flashcardBtn = document.getElementById("flashcard");
  const faceFrontText = document.getElementById("face-front-text");
  const faceBackText = document.getElementById("face-back-text");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const finishMsg = document.getElementById("finish-msg");
  const restartBtn = document.getElementById("restart-btn");
  const homeBtn = document.getElementById("home-btn");

  let activeDeck = null;
  let order = [];
  let index = 0;
  let flipped = false;

  let touchStartX = 0;
  let touchStartY = 0;
  let suppressCardClick = false;

  function emojiForDeck(deck) {
    const fixed = {
      "proverbs-1": "🗣️",
      "practice-1": "🤝",
      "proverbs-2": "🔥",
      "proverbs-3": "📜",
      "plants-1": "🌿",
    };
    if (fixed[deck.id]) return fixed[deck.id];

    const surfMatch = /^surf-olelo-(\d+)$/.exec(deck.id);
    if (surfMatch) {
      const surfEmojis = ["🏄", "🌊", "🛶", "🌬️", "🐚"];
      const idx = Math.max(0, Number(surfMatch[1]) - 1) % surfEmojis.length;
      return surfEmojis[idx];
    }

    const fruitMatch = /^tropical-fruits-(\d+)$/.exec(deck.id);
    if (fruitMatch) {
      const fruitEmojis = ["🍍", "🥭", "🍌", "🥥", "🍉"];
      const idx = Math.max(0, Number(fruitMatch[1]) - 1) % fruitEmojis.length;
      return fruitEmojis[idx];
    }

    return "📘";
  }

  function showScreen(name) {
    [landingEl, studyEl, finishEl].forEach((el) => {
      if (!el) return;
      el.classList.toggle("is-active", el.dataset.screen === name);
    });
  }

  function buildLanding() {
    if (!deckGrid) return;
    deckGrid.innerHTML = "";
    const orderedDecks = [...decks].sort((a, b) => {
      if (a.id === "proverbs-1" && b.id !== "proverbs-1") return -1;
      if (b.id === "proverbs-1" && a.id !== "proverbs-1") return 1;
      if (a.id === "practice-1" && b.id !== "practice-1") return -1;
      if (b.id === "practice-1" && a.id !== "practice-1") return 1;
      if (a.id === "proverbs-2" && b.id !== "proverbs-2") return -1;
      if (b.id === "proverbs-2" && a.id !== "proverbs-2") return 1;
      if (a.id === "proverbs-3" && b.id !== "proverbs-3") return -1;
      if (b.id === "proverbs-3" && a.id !== "proverbs-3") return 1;
      if (a.id === "plants-1" && b.id !== "plants-1") return -1;
      if (b.id === "plants-1" && a.id !== "plants-1") return 1;

      const surfA = /^surf-olelo-(\d+)$/.exec(a.id);
      const surfB = /^surf-olelo-(\d+)$/.exec(b.id);
      const tropicalA = /^tropical-fruits-(\d+)$/.exec(a.id);
      const tropicalB = /^tropical-fruits-(\d+)$/.exec(b.id);

      const getLevel = (surfMatch, tropicalMatch) => {
        if (surfMatch) return Number(surfMatch[1]);
        if (tropicalMatch) return Number(tropicalMatch[1]);
        return Number.MAX_SAFE_INTEGER;
      };

      const levelA = getLevel(surfA, tropicalA);
      const levelB = getLevel(surfB, tropicalB);
      if (levelA !== levelB) return levelA - levelB;

      const getWithinLevelOrder = (surfMatch, tropicalMatch) => {
        if (surfMatch) return 0;
        if (tropicalMatch) return 1;
        return 2;
      };

      const withinLevelA = getWithinLevelOrder(surfA, tropicalA);
      const withinLevelB = getWithinLevelOrder(surfB, tropicalB);
      if (withinLevelA !== withinLevelB) return withinLevelA - withinLevelB;

      return a.title.localeCompare(b.title);
    });

    orderedDecks.forEach((deck) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "deck-tile deck-tile--" + (deck.accent === "fruit" ? "fruit" : "ocean");
      btn.setAttribute("aria-label", `Open deck: ${deck.title}, ${deck.cards.length} cards`);

      const count = document.createElement("span");
      count.className = "deck-tile__count";
      count.textContent = `${deck.cards.length} cards`;

      const title = document.createElement("span");
      title.className = "deck-tile__title";
      title.textContent = deck.title;

      const emoji = document.createElement("span");
      emoji.className = "deck-tile__emoji";
      emoji.textContent = emojiForDeck(deck);
      emoji.setAttribute("aria-hidden", "true");

      const sub = document.createElement("p");
      sub.className = "deck-tile__subtitle";
      sub.textContent = deck.subtitle || "";

      btn.append(count, emoji, title, sub);
      btn.addEventListener("click", () => startDeck(deck.id));
      deckGrid.appendChild(btn);
    });
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startDeck(deckId) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;

    activeDeck = deck;
    order = shuffleInPlace(
      deck.cards.map((_, i) => i).filter((i) => i < deck.cards.length)
    );
    index = 0;
    flipped = false;
    updateCardDisplay();
    showScreen("study");
    history.replaceState({ deck: deckId }, "", `#/deck/${deckId}`);
  }

  function setFlipped(next) {
    flipped = next;
    if (flashcardBtn) flashcardBtn.classList.toggle("is-flipped", flipped);
    if (flashcardBtn)
      flashcardBtn.setAttribute("aria-pressed", flipped ? "true" : "false");
  }

  function currentCard() {
    if (!activeDeck || !order.length) return null;
    const ci = order[index];
    return activeDeck.cards[ci];
  }

  function updateCardDisplay() {
    const card = currentCard();
    if (!activeDeck || !card) return;

    if (studyTitle) studyTitle.textContent = activeDeck.title;
    const total = order.length;
    const pos = index + 1;
    if (counterEl) counterEl.textContent = `Card ${pos} of ${total}`;
    if (progressFill) progressFill.style.width = `${(pos / total) * 100}%`;

    if (faceFrontText) faceFrontText.textContent = card.front;
    if (faceBackText) faceBackText.textContent = card.back;

    setFlipped(false);

    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = false;
  }

  function goNext() {
    if (!activeDeck) return;
    if (index < order.length - 1) {
      index += 1;
      updateCardDisplay();
    } else {
      finishStudy();
    }
  }

  function goPrev() {
    if (!activeDeck || index === 0) return;
    index -= 1;
    updateCardDisplay();
  }

  function finishStudy() {
    if (finishMsg && activeDeck) {
      finishMsg.textContent = `You finished ${activeDeck.title}.`;
    }
    showScreen("finish");
    history.replaceState({}, "", "#/");
  }

  function toggleFlip() {
    setFlipped(!flipped);
  }

  function onHashRoute() {
    const h = window.location.hash;
    const m = h.match(/^#\/deck\/([^/]+)/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (decks.some((d) => d.id === id)) {
        startDeck(id);
        return;
      }
    }
    activeDeck = null;
    showScreen("landing");
  }

  function bindGestures() {
    if (!flashcardBtn) return;

    flashcardBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (suppressCardClick) {
        suppressCardClick = false;
        return;
      }
      toggleFlip();
    });

    flashcardBtn.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );

    flashcardBtn.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
        if (dy > SWIPE_MAX_VERTICAL) return;
        if (dx > SWIPE_THRESHOLD) {
          suppressCardClick = true;
          goPrev();
        } else if (dx < -SWIPE_THRESHOLD) {
          suppressCardClick = true;
          goNext();
        }
      },
      { passive: true }
    );
  }

  backBtn?.addEventListener("click", () => {
    history.replaceState({}, "", "#/");
    onHashRoute();
  });

  prevBtn?.addEventListener("click", goPrev);
  nextBtn?.addEventListener("click", goNext);

  restartBtn?.addEventListener("click", () => {
    if (activeDeck) startDeck(activeDeck.id);
  });

  homeBtn?.addEventListener("click", () => {
    history.replaceState({}, "", "#/");
    onHashRoute();
  });

  window.addEventListener("hashchange", onHashRoute);
  window.addEventListener("keydown", (e) => {
    if (!studyEl?.classList.contains("is-active")) return;
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      if (e.key === " ") toggleFlip();
      else goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  });

  buildLanding();
  bindGestures();
  onHashRoute();
})();
