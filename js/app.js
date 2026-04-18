(function () {
  "use strict";

  const SWIPE_THRESHOLD = 45;
  const SWIPE_MAX_VERTICAL = 80;

  /** @type {{ id: string, title: string, subtitle?: string, accent: string, cards: { front: string, back: string, subtext?: string }[] }[]} */
  const decks = window.DECKS || [];

  const landingEl = document.getElementById("screen-landing");
  const studyEl = document.getElementById("screen-study");
  const finishEl = document.getElementById("screen-finish");
  const deckGrid = document.getElementById("deck-grid");
  const deckGridExtra = document.getElementById("deck-grid-extra");
  const deckSeeMoreBtn = document.getElementById("deck-see-more");
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
      "pule-1": "🙏",
      "proverbs-2": "🔥",
      "proverbs-3": "📜",
      "plants-1": "🌿",
      "plants-2": "🪴",
      "respect-1": "🏞️",
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

  function createDeckTile(deck) {
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
    return btn;
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
    if (deckGridExtra) deckGridExtra.innerHTML = "";

    const deckOrder = [
      "practice-1",
      "pule-1",
      "proverbs-1",
      "plants-1",
      "surf-olelo-1",
      "tropical-fruits-1",
      "proverbs-2",
      "plants-2",
      "surf-olelo-2",
      "tropical-fruits-2",
      "proverbs-3",
      "surf-olelo-3",
      "surf-olelo-4",
      "surf-olelo-5",
      "respect-1",
    ];

    const orderIndex = (id) => {
      const i = deckOrder.indexOf(id);
      return i === -1 ? deckOrder.length : i;
    };

    const orderedDecks = [...decks].sort((a, b) => {
      const ia = orderIndex(a.id);
      const ib = orderIndex(b.id);
      if (ia !== ib) return ia - ib;
      return a.title.localeCompare(b.title);
    });

    const fruits1Idx = deckOrder.indexOf("tropical-fruits-1");
    const primaryIdSet =
      fruits1Idx === -1
        ? new Set(deckOrder)
        : new Set(deckOrder.slice(0, fruits1Idx + 1));
    const primaryDecks = orderedDecks.filter((d) => primaryIdSet.has(d.id));
    const extraDecks = orderedDecks.filter((d) => !primaryIdSet.has(d.id));

    primaryDecks.forEach((deck) => {
      deckGrid.appendChild(createDeckTile(deck));
    });

    if (deckGridExtra && deckSeeMoreBtn) {
      extraDecks.forEach((deck) => {
        deckGridExtra.appendChild(createDeckTile(deck));
      });
      const iconEl = deckSeeMoreBtn.querySelector(".deck-see-more__icon");
      const labelEl = deckSeeMoreBtn.querySelector(".deck-see-more__label");

      const setExtraDecksExpanded = (expanded) => {
        deckGridExtra.hidden = !expanded;
        deckSeeMoreBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        if (iconEl) iconEl.textContent = expanded ? "−" : "+";
        if (labelEl) labelEl.textContent = expanded ? "See fewer cards" : "See more cards";
      };

      if (extraDecks.length > 0) {
        deckSeeMoreBtn.hidden = false;
        setExtraDecksExpanded(false);
        deckSeeMoreBtn.onclick = () => {
          setExtraDecksExpanded(deckGridExtra.hidden);
        };
      } else {
        deckSeeMoreBtn.hidden = true;
        deckSeeMoreBtn.onclick = null;
        deckGridExtra.hidden = true;
      }
    }
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

  function setBackFaceContent(el, card) {
    if (!el || !card) return;
    el.textContent = "";
    el.classList.remove("flashcard-text--has-sub");
    if (card.subtext) {
      el.classList.add("flashcard-text--has-sub");
      const main = document.createElement("span");
      main.className = "flashcard-text__main";
      main.textContent = card.back;
      const sub = document.createElement("span");
      sub.className = "flashcard-text__sub";
      sub.textContent = card.subtext;
      el.append(main, sub);
    } else {
      el.textContent = card.back;
    }
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
    if (faceBackText) setBackFaceContent(faceBackText, card);

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
