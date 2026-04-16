(async function () {
  "use strict";

  // WhatsApp Mobile Layout.
  // Stable anchors (class names are regenerated each build):
  //   HEADER element with [data-icon^="chat"] - app rail (left nav)
  //   #pane-side                              - chat list scroller
  //   #side                                   - chat list column inner
  // The real app root is the parent of the rail header. Its children are:
  //   [overlay] [rail HEADER] [overlay] [overlay] [drawer pane] [main pane] ...
  // Overlay siblings (empty absolute-positioned divs) block clicks and cause
  // the "invisible line at the center". They must be neutralised on mobile.

  const UTILS = {
    addStyle(css) {
      const id = "wam-mobile-style";
      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = css;
    },
    async waitForElement(selector, timeout = 20000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    },
    debounce(fn, wait) {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
      };
    },
  };

  const MANAGED_DESCENDANT_CLASSES = [
    "wam-drawer-shell",
    "wam-drawer-scroll",
    "wam-section-detail",
    "wam-section-primary",
    "wam-stack-frame",
    "wam-stack-scroll",
    "wam-section-detail-sibling",
  ];

  UTILS.addStyle(`
      @media (max-width: 900px) {
        :root {
          --wam-rail-width: 64px;
          --wam-drawer-width: min(calc(100vw - var(--wam-rail-width)), 400px);
          --wam-section-list-height: clamp(260px, 42vh, 380px);
          --wam-drawer-handle-width: 42px;
        }

        /* App root: collapse to viewport width, keep flex layout */
        .wam-app-root {
          width: 100vw !important;
          min-width: 0 !important;
          max-width: 100vw !important;
        }
        .wam-app-root.wam-mode-chat {
          display: flex !important;
          align-items: stretch !important;
          height: 100vh !important;
          overflow: hidden !important;
        }
        .wam-app-root.wam-mode-section {
          display: grid !important;
          grid-template-columns: var(--wam-rail-width) minmax(0, 1fr) !important;
          grid-template-rows: var(--wam-section-list-height) minmax(0, 1fr) !important;
          align-items: stretch !important;
          align-content: stretch !important;
          height: 100vh !important;
          overflow: hidden !important;
        }

        /* Preserve the original rail (links / settings / broadcasts / etc.). */
        .wam-sidebar {
          display: flex !important;
          width: var(--wam-rail-width) !important;
          min-width: var(--wam-rail-width) !important;
          max-width: var(--wam-rail-width) !important;
          flex: 0 0 var(--wam-rail-width) !important;
          position: relative !important;
          z-index: 1201 !important;
        }
        .wam-app-root.wam-mode-section > .wam-sidebar {
          grid-column: 1 !important;
          grid-row: 1 / span 2 !important;
          height: 100vh !important;
        }

        /* Neutralise empty overlay siblings that block clicks and show as
           an invisible vertical line (pane resize wrappers). */
        .wam-overlay-neutral {
          pointer-events: none !important;
          display: none !important;
        }
        .wam-hidden-pane {
          pointer-events: none !important;
          display: none !important;
        }

        /* Main conversation pane: take full viewport width */
        .wam-main {
          width: calc(100vw - var(--wam-rail-width)) !important;
          max-width: calc(100vw - var(--wam-rail-width)) !important;
          min-width: 0 !important;
          left: 0 !important;
          flex: 1 1 auto !important;
          position: relative !important;
        }

        /* Section drawer (chats / channels / status etc.) */
        .wam-drawer {
          position: fixed !important;
          top: 0 !important;
          left: var(--wam-rail-width) !important;
          bottom: 0 !important;
          height: 100vh !important;
          width: var(--wam-drawer-width) !important;
          max-width: var(--wam-drawer-width) !important;
          min-width: 0 !important;
          flex: 0 0 auto !important;
          z-index: 1100 !important;
          overflow: hidden !important;
          border-radius: 0 24px 24px 0 !important;
          display: flex !important;
          flex-direction: column !important;
          transform: translateX(-100%) !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease !important;
          background: var(--panel-header-background, #fff);
        }
        .wam-drawer.wam-open {
          transform: translateX(0) !important;
          box-shadow: 0 0 50px #00000055;
        }
        /* Drawer children: first child is a title/header bar (auto height),
           remaining children (e.g. #side) flex to fill and scroll. */
        .wam-drawer > * {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          pointer-events: auto;
        }
        .wam-drawer > *:first-child {
          flex: 0 0 auto !important;
          height: auto !important;
        }
        .wam-drawer > *:not(:first-child) {
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: auto !important;
        }
        .wam-drawer-shell {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 auto !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .wam-drawer-scroll,
        .wam-stack-scroll {
          height: 100% !important;
          max-height: none !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
        }
        .wam-stack-frame {
          height: 100% !important;
          min-height: 0 !important;
        }

        /* Drawer handle (appended to <body>, animates with drawer state) */
        .wam-drawer-handle {
          position: fixed;
          top: 80px;
          left: var(--wam-rail-width);
          width: var(--wam-drawer-handle-width);
          height: 112px;
          border: 0;
          border-radius: 0 18px 18px 0;
          background: #21c063;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 18px #00000033;
          z-index: 1200;
          transition: left 0.2s ease;
        }
        body.wam-drawer-open .wam-drawer-handle {
          left: calc(var(--wam-rail-width) + var(--wam-drawer-width)) !important;
        }
        body.wam-section-stack-mode .wam-drawer-handle {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .wam-drawer-handle::before {
          content: 'Menu';
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          letter-spacing: 0.08em;
          font-size: 12px;
          font-weight: 600;
        }

        .wam-section-root {
          grid-column: 2 !important;
          grid-row: 1 !important;
          position: relative !important;
          display: grid !important;
          grid-template-rows: minmax(0, var(--wam-section-list-height)) minmax(0, 1fr) !important;
          width: calc(100vw - var(--wam-rail-width)) !important;
          max-width: calc(100vw - var(--wam-rail-width)) !important;
          min-width: 0 !important;
          height: 100% !important;
          max-height: 100% !important;
          left: 0 !important;
          transform: none !important;
          box-shadow: none !important;
          overflow: hidden !important;
          border-radius: 0 0 24px 24px !important;
          background: var(--panel-header-background, #fff) !important;
        }
        .wam-section-root > *,
        .wam-section-detail > * {
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
        }
        .wam-section-root > :not(.wam-section-primary):not(.wam-section-detail) {
          display: none !important;
        }
        .wam-section-primary {
          grid-row: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .wam-section-detail {
          grid-row: 2 !important;
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          left: 0 !important;
          transform: none !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }
        .wam-section-detail.wam-section-detail-sibling {
          grid-column: 2 !important;
          grid-row: 2 !important;
          position: relative !important;
          width: calc(100vw - var(--wam-rail-width)) !important;
          max-width: calc(100vw - var(--wam-rail-width)) !important;
        }

        /* Keep the message composer clear of the preserved rail. */
        footer {
          max-width: calc(100vw - var(--wam-rail-width)) !important;
        }

        /* Tighter message bubbles */
        .message-in, .message-out { padding: 0 20px !important; }
      }
    `);

  function findAppRoot() {
    // Rail = <header> that contains the primary nav icons.
    const icon = document.querySelector(
      'header [data-icon^="chat-filled"], ' + 'header [data-icon^="chats-filled"], ' + 'header [data-icon^="chat"], ' + 'header [aria-label="Chats"]',
    );
    const rail = icon?.closest("header");
    if (!rail) return null;
    const nav = rail.parentElement;
    if (!nav) return null;
    return { nav, rail };
  }

  function clearManagedDescendants(root) {
    const selector = MANAGED_DESCENDANT_CLASSES.map((className) => `.${className}`).join(", ");
    if (!selector) return;
    for (const el of root.querySelectorAll(selector)) {
      el.classList.remove(...MANAGED_DESCENDANT_CLASSES);
    }
  }

  function findScrollableDescendant(root) {
    if (!root) return null;

    const candidates = [root, ...root.querySelectorAll("*")];
    let best = null;
    let bestScore = -1;

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) continue;

      const cs = getComputedStyle(el);
      const overflowScrolls = /(auto|scroll)/.test(cs.overflowY);
      const scrollDelta = el.scrollHeight - el.clientHeight;
      if (!overflowScrolls && scrollDelta <= 24) continue;

      let score = Math.min(rect.height, 1000);
      if (overflowScrolls) score += 400;
      if (el.id === "pane-side") score += 2000;

      const role = el.getAttribute("role") || "";
      if (role === "navigation" || role === "list" || role === "grid") score += 120;
      score += Math.min(Math.max(scrollDelta, 0), 800);

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function markAncestorChain(fromEl, stopEl, className) {
    let el = fromEl?.parentElement || null;
    while (el && el !== stopEl) {
      el.classList.add(className);
      el = el.parentElement;
    }
  }

  function isChatRailButton(button) {
    if (!button) return false;
    const label = (button.getAttribute("aria-label") || "").trim();
    if (/^chat/i.test(label)) return true;

    const icon = button.querySelector("[data-icon]")?.getAttribute("data-icon") || "";
    return /^chat/i.test(icon) || /^chats/i.test(icon);
  }

  function tagDrawerPane(drawer) {
    const side = drawer?.querySelector("#side");
    const paneSide = drawer?.querySelector("#pane-side");

    if (side) side.classList.add("wam-drawer-shell");
    if (paneSide) paneSide.classList.add("wam-drawer-scroll");
  }

  function tagSectionPane(sectionList, sectionDetail) {
    if (sectionList) {
      const primary = sectionList.firstElementChild || sectionList;
      if (primary !== sectionList) primary.classList.add("wam-section-primary");

      const listScroll = findScrollableDescendant(primary);
      if (listScroll) {
        listScroll.classList.add("wam-stack-scroll");
        markAncestorChain(listScroll, primary, "wam-stack-frame");
      }

      if (!sectionDetail) {
        const internalDetail = Array.from(sectionList.children).find((child) => {
          if (child === primary) return false;
          const r = child.getBoundingClientRect();
          return r.width > 100 && r.height > 100;
        });
        if (internalDetail) sectionDetail = internalDetail;
      }
    }

    if (sectionDetail) {
      sectionDetail.classList.add("wam-section-detail");
      if (sectionDetail.parentElement !== sectionList) {
        sectionDetail.classList.add("wam-section-detail-sibling");
      }

      const detailScroll = findScrollableDescendant(sectionDetail);
      if (detailScroll) {
        detailScroll.classList.add("wam-stack-scroll");
        markAncestorChain(detailScroll, sectionDetail, "wam-stack-frame");
      } else {
        sectionDetail.classList.add("wam-stack-scroll");
      }
    }
  }

  function classifyChildren(nav, rail) {
    // Strategy:
    //   - Reset our tags first so the browser measures natural sizes
    //     (not our forced wam-drawer/wam-main dimensions).
    //   - Empty absolute-positioned siblings -> overlay-neutral (they cause
    //     the "invisible center line" and block clicks).
    //   - Among the remaining visible content children, the FIRST in DOM
    //     order is the active section list (drawer on mobile). Any others
    //     become main (right-side detail/conversation pane).
    //
    // When the active rail button is NOT "Chat" (i.e. Channels / Status /
    // Communities), WhatsApp adds a new section-list pane that sits BEFORE
    // the chats pane in DOM order. The drawer then naturally becomes this
    // new pane. When only Chat is active, only the chats pane is visible
    // among section-lists and it becomes the drawer.
    clearManagedDescendants(nav);

    for (const child of nav.children) {
      if (child === rail) continue;
      child.classList.remove("wam-drawer");
      child.classList.remove("wam-main");
      child.classList.remove("wam-section-root");
      child.classList.remove("wam-section-detail");
      child.classList.remove("wam-open");
      child.classList.remove("wam-hidden-pane");
      child.classList.remove("wam-overlay-neutral");
    }
    // Force layout so positions/sizes reflect the reset.
    void nav.offsetHeight;

    const paneSide = document.querySelector("#pane-side");
    let paneSideHost = null;
    if (paneSide) {
      let el = paneSide;
      while (el && el.parentElement !== nav) el = el.parentElement;
      if (el) paneSideHost = el;
    }

    // Is a non-Chat rail section active?
    const activeRailBtn = rail.querySelector('[aria-pressed="true"]');
    const activeLabel = activeRailBtn?.getAttribute("aria-label") || "";
    const chatRailActive = isChatRailButton(activeRailBtn);

    const visibleContentChildren = [];
    for (const child of nav.children) {
      if (child === rail) continue;
      const r = child.getBoundingClientRect();
      const cs = getComputedStyle(child);
      const hasRichContent = !!child.querySelector('#pane-side, [data-icon], [role="tablist"], input, textarea');
      const isAbsolute = cs.position === "absolute";

      if (isAbsolute && !hasRichContent) {
        child.classList.add("wam-overlay-neutral");
        continue;
      }
      if (r.width > 100 && r.height > 100) {
        visibleContentChildren.push(child);
      }
    }

    const hasSectionSiblingCandidate = visibleContentChildren.some((child) => child !== paneSideHost && getComputedStyle(child).position === "absolute");
    const nonChatSectionActive = (!!activeRailBtn && !chatRailActive) || (!chatRailActive && hasSectionSiblingCandidate);

    if (nonChatSectionActive) {
      const sectionCandidates = visibleContentChildren.filter((child) => child !== paneSideHost);
      const sectionRoot = sectionCandidates.find((child) => getComputedStyle(child).position === "absolute") || sectionCandidates[0] || null;
      const sectionDetail = sectionCandidates.find((child) => child !== sectionRoot) || null;

      if (sectionRoot) sectionRoot.classList.add("wam-section-root");
      tagSectionPane(sectionRoot, sectionDetail);
      if (paneSideHost) paneSideHost.classList.add("wam-hidden-pane");
      for (const child of visibleContentChildren) {
        if (child !== sectionRoot && child !== sectionDetail && child !== paneSideHost) {
          child.classList.add("wam-hidden-pane");
        }
      }

      return {
        mode: "section",
        drawer: null,
        main: null,
        list: sectionRoot,
      };
    }

    const drawer = paneSideHost || visibleContentChildren[0] || null;
    const main = visibleContentChildren.find((child) => child !== drawer) || null;

    if (drawer) {
      drawer.classList.add("wam-drawer");
      tagDrawerPane(drawer);
    }
    if (main) main.classList.add("wam-main");
    for (const child of visibleContentChildren) {
      if (child !== drawer && child !== main) {
        child.classList.add("wam-hidden-pane");
      }
    }

    return {
      mode: "chat",
      drawer,
      main,
      list: drawer,
    };
  }

  let drawerEl = null;
  let handleBound = false;
  let drawerOpen = false;
  let navObserver = null;
  let observedNav = null;
  let railBound = false;
  let lastMain = null;

  function ensureNavObserver(nav) {
    if (observedNav === nav && navObserver) return;
    if (navObserver) navObserver.disconnect();

    navObserver = new MutationObserver(() => {
      debouncedApply();
    });
    navObserver.observe(nav, { childList: true, subtree: false });
    observedNav = nav;
  }

  function bindRailApply(rail) {
    if (railBound) return;
    railBound = true;
    rail.addEventListener(
      "click",
      () => {
        setTimeout(debouncedApply, 120);
      },
      true,
    );
  }

  function setRailWidth(rail) {
    const width = Math.round(rail.getBoundingClientRect().width) || 64;
    document.documentElement.style.setProperty("--wam-rail-width", `${width}px`);
    document.documentElement.style.setProperty("--wam-drawer-width", `min(calc(100vw - ${width}px), 400px)`);
  }

  function setDrawerOpen(isOpen) {
    drawerOpen = !!isOpen;
    document.body.classList.toggle("wam-drawer-open", drawerOpen);
    if (drawerEl) drawerEl.classList.toggle("wam-open", drawerOpen);
  }

  function setLayoutMode(mode) {
    const isSectionMode = mode === "section";
    document.body.classList.toggle("wam-section-stack-mode", isSectionMode);
  }

  function ensureHandle(drawer) {
    // Handle lives on <body> (not inside drawer) because the drawer uses
    // transform: translateX which would create a containing block for
    // position:fixed descendants, trapping the handle off-screen.
    let handle = document.body.querySelector(":scope > .wam-drawer-handle");
    if (!handle) {
      handle = document.createElement("button");
      handle.type = "button";
      handle.className = "wam-drawer-handle";
      handle.setAttribute("aria-label", "Toggle section drawer");
      document.body.appendChild(handle);
      handle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const activeDrawer = drawerEl || drawer;
        if (!activeDrawer) return;
        setDrawerOpen(!drawerOpen);
      });
    } else if (handle.parentElement !== document.body) {
      document.body.appendChild(handle);
    }
    return handle;
  }

  function bindGlobalClosers() {
    if (handleBound) return;
    handleBound = true;

    // Close drawer after selecting a chat row (without blocking the click).
    document.addEventListener(
      "click",
      (e) => {
        if (window.innerWidth > 900) return;
        if (!drawerEl) return;
        if (!drawerOpen) return;
        if (e.target.closest(".wam-drawer-handle")) return;
        if (drawerEl.contains(e.target)) {
          const row = e.target.closest('[role="listitem"], [role="row"], [role="button"][tabindex]');
          if (row) setTimeout(() => setDrawerOpen(false), 60);
        } else {
          setDrawerOpen(false);
        }
      },
      true,
    );

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    });
  }

  function applyLayout() {
    if (window.innerWidth > 900) return false;

    const roots = findAppRoot();
    if (!roots) return false;
    const { nav, rail } = roots;

    nav.classList.add("wam-app-root");
    rail.classList.add("wam-sidebar");
    setRailWidth(rail);

    const layout = classifyChildren(nav, rail);

    if (layout.mode === "chat") {
      if (layout.main) {
        lastMain = layout.main;
      } else if (lastMain && lastMain.parentElement === nav) {
        layout.main = lastMain;
        lastMain.classList.add("wam-main");
      }
    }

    nav.classList.toggle("wam-mode-chat", layout.mode === "chat");
    nav.classList.toggle("wam-mode-section", layout.mode === "section");
    setLayoutMode(layout.mode);

    if (layout.mode === "chat" && layout.drawer) {
      drawerEl = layout.drawer;
      ensureHandle(layout.drawer);
      setDrawerOpen(drawerOpen);
    } else {
      drawerEl = null;
      setDrawerOpen(false);
    }

    ensureNavObserver(nav);
    bindRailApply(rail);
    bindGlobalClosers();
    return true;
  }

  const debouncedApply = UTILS.debounce(applyLayout, 80);

  await UTILS.waitForElement("#pane-side");
  applyLayout();

  window.addEventListener("resize", debouncedApply);
})();
