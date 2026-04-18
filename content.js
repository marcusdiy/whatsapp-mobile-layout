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
          --wam-rail-width: 50px;
          --wam-drawer-width: min(calc(100vw - var(--wam-rail-width) - 32px), 320px);
          --wam-section-list-height: clamp(260px, 42vh, 380px);
          --wam-drawer-handle-width: 36px;
        }

        /* Popups, tooltips, dialogs and media composer overlays must float
           above the drawer (z-index 1100) and rail (1201). We tag both
           the popup itself AND the WhatsApp absolute-positioned popup
           HOST container that wraps it (otherwise z-index on the inner
           tooltip is meaningless inside its low-z stacking context). */
        [role="tooltip"],
        [role="menu"],
        [role="listbox"] {
          z-index: 2147483646 !important;
        }
        .wam-popup-host {
          z-index: 2147483645 !important;
          overflow: visible !important;
          isolation: isolate !important;
        }
        [role="dialog"],
        [aria-modal="true"],
        [data-animate-modal-popup],
        [data-animate-modal-body],
        .wam-popup-sibling {
          z-index: 2147483640 !important;
        }
        /* Confirmation / option dialogs must fit in the narrow viewport.
           WhatsApp uses min-width values that overflow on mobile widths,
           pushing Cancel/OK buttons offscreen. */
        @media (max-width: 900px) {
          [role="dialog"],
          [aria-modal="true"],
          [data-animate-modal-body] > div,
          [data-animate-modal-popup] > div {
            max-width: calc(100vw - 24px) !important;
            min-width: 0 !important;
            width: auto !important;
            box-sizing: border-box !important;
          }
          [role="dialog"] *,
          [aria-modal="true"] * {
            max-width: 100% !important;
            min-width: 0 !important;
          }
        }
        /* When an empty overlay sibling gets populated by WhatsApp (media
           composer, drag-drop overlay etc.), we strip wam-overlay-neutral
           and add wam-popup-sibling. Restore normal rendering so its
           contents are actually visible. */
        .wam-popup-sibling {
          width: auto !important;
          height: auto !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          overflow: visible !important;
        }
        /* If the populated overlay needs to fill the conversation area
           (drag overlay, media composer), it usually has explicit inset
           values. Provide a sensible fallback for those that don't. */
        .wam-popup-sibling.wam-popup-fill {
          position: fixed !important;
          top: 0 !important;
          left: var(--wam-rail-width) !important;
          right: 0 !important;
          bottom: 0 !important;
          width: calc(100vw - var(--wam-rail-width)) !important;
          height: 100vh !important;
        }
        /* Inner WA layouts (media composer split-pane, drag overlay) can
           leave the popup-sibling visually small. Force its children to
           fill the available space so the composer is usable on mobile. */
        .wam-popup-sibling.wam-popup-fill > * {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: 100% !important;
          left: 0 !important;
          right: 0 !important;
          flex: 1 1 auto !important;
        }
        /* WhatsApp's media composer renders as a 2-column flex container:
           a duplicated chat-list/conversation pane on the left and the
           actual file-preview composer on the right. On narrow widths we
           hide the duplicate so the composer takes full width. */
        .wam-popup-sibling.wam-popup-fill > *:first-child:not(:only-child) {
          display: none !important;
        }
        .wam-popup-sibling.wam-popup-fill > *:last-child {
          flex: 1 1 100% !important;
          width: 100% !important;
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
          overflow: visible !important;
          padding: 5px;
          box-shadow: 0 0 10px #00000024
        }
        .wam-app-root.wam-mode-section > .wam-sidebar {
          grid-column: 1 !important;
          grid-row: 1 / span 2 !important;
          height: 100vh !important;
        }

        /* Neutralise empty overlay siblings that block clicks and show as
           an invisible vertical line (pane resize wrappers). Do NOT use
           display:none — WhatsApp uses these as drag/drop and tooltip
           hosts; removing them breaks drag-to-upload and other features.
           We collapse them to zero size + transparent + click-through. */
        .wam-overlay-neutral {
          position: absolute !important;
          width: 0 !important;
          height: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
          overflow: visible !important;
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
           remaining children (e.g. #side) flex to fill and scroll. If it's a
           complex pane (like Canali) we only apply this auto-height to explicit
           <header> elements to prevent list-containers from collapsing. */
        .wam-drawer > * {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          pointer-events: auto;
        }
        .wam-drawer > header:first-child {
          flex: 0 0 auto !important;
          height: auto !important;
        }
        .wam-drawer > *:not(header:first-child) {
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

        /* Hidden hover strip along the rail edge. Keep it out of the
           composer area so it never blocks the + button. */
        .wam-edge-hotzone {
          position: fixed;
          left: var(--wam-rail-width);
          top: 0;
          bottom: 96px;
          width: 44px;
          z-index: 2147483647;
          background: transparent;
          cursor: pointer;
        }
        body.wam-drawer-open .wam-edge-hotzone {
          left: calc(var(--wam-rail-width) + var(--wam-drawer-width));
          width: 36px;
        }
        .wam-edge-hotzone::before {
          display: none;
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

  // A "popup-like" sibling is anything WhatsApp adds at the app-root level
  // that's actually a tooltip / menu / dialog / media composer etc. — not
  // a structural pane. We must NEVER hide or neutralise these, otherwise
  // file uploads, attach menus, emoji pickers and tooltips break.
  const overlayWatchers = new WeakMap();

  function hasRichOverlayContent(el) {
    if (!el) return false;
    return !!el.querySelector(
      [
        '[role="dialog"]',
        '[role="menu"]',
        '[role="tooltip"]',
        '[role="listbox"]',
        '[aria-modal="true"]',
        "[data-animate-modal-popup]",
        "[data-animate-modal-body]",
        '[contenteditable="true"]',
        'input[type="file"]',
        "textarea",
        '[data-icon="send"]',
        '[data-icon="document-refreshed"]',
        '[data-icon="media-multiple"]',
        '[data-icon="image"]',
        '[data-icon="document"]',
      ].join(", "),
    );
  }

  function promoteOverlayIfPopulated(child) {
    if (!child.classList.contains("wam-overlay-neutral")) return;
    if (!hasRichOverlayContent(child)) return;

    child.classList.remove("wam-overlay-neutral");
    child.classList.add("wam-popup-sibling");

    // If the populated overlay has no positioning that gives it visible
    // size, make it fill the conversation area (drag overlay fallback).
    const r = child.getBoundingClientRect();
    if (r.width < 100 || r.height < 100) {
      child.classList.add("wam-popup-fill");
    }
  }

  function watchOverlayNeutral(child) {
    if (overlayWatchers.has(child)) return;
    const obs = new MutationObserver(() => {
      promoteOverlayIfPopulated(child);
      // If WA later empties it again, demote back so it doesn't block.
      if (child.classList.contains("wam-popup-sibling") && !hasRichOverlayContent(child)) {
        child.classList.remove("wam-popup-sibling", "wam-popup-fill");
        child.classList.add("wam-overlay-neutral");
      }
    });
    obs.observe(child, { childList: true, subtree: true, attributes: false });
    overlayWatchers.set(child, obs);
  }

  function isPopupLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (
      el.matches(
        '[role="dialog"], [role="menu"], [role="tooltip"], [role="listbox"], [aria-modal="true"], [data-animate-modal-popup], [data-animate-modal-body]',
      )
    ) {
      return true;
    }
    if (
      el.querySelector('[role="dialog"], [role="menu"], [role="tooltip"], [aria-modal="true"], [data-animate-modal-popup], [data-animate-modal-body]')
    ) {
      return true;
    }
    // Media/file composer: WhatsApp inserts a fullscreen overlay with a
    // close button + a row of file inputs. Detect via the close icon plus
    // the absence of #pane-side / rail content.
    if (el.querySelector('[data-icon="x"], [data-icon="x-alt"], [data-icon="close"]') && !el.querySelector("#pane-side, header")) {
      return true;
    }
    // Drag-drop overlay shown when dragging a file over the window.
    if (
      el.querySelector('[data-icon="media-multiple"], [data-icon="paperclip"], [data-icon="document-refreshed"]') &&
      !el.querySelector("#pane-side, header")
    ) {
      return true;
    }
    return false;
  }

  function tagDrawerPane(drawer) {
    const side = drawer?.querySelector("#side");
    const paneSide = drawer?.querySelector("#pane-side");

    if (side) side.classList.add("wam-drawer-shell");
    if (paneSide) paneSide.classList.add("wam-drawer-scroll");
  }

  function tagSectionDrawer(sectionList, sectionDetail) {
    if (sectionList) {
      const primary = sectionList.firstElementChild || sectionList;
      const listScroll = findScrollableDescendant(primary);
      if (listScroll) {
        listScroll.classList.add("wam-drawer-scroll");
        markAncestorChain(listScroll, sectionList, "wam-drawer-shell");
      } else {
        primary.classList.add("wam-drawer-shell");
      }

      // WhatsApp often bundles the list and an empty detail placeholder
      // together in non-Chat tabs. Hide the duplicate inner placeholder.
      const internalDetail = Array.from(sectionList.children).find((child) => {
        if (child === primary) return false;
        const r = child.getBoundingClientRect();
        return r.width > 50 && r.height > 50;
      });
      if (internalDetail) {
        internalDetail.classList.add("wam-hidden-pane");
      }
    }

    if (sectionDetail) {
      const detailScroll = findScrollableDescendant(sectionDetail);
      if (detailScroll) {
        detailScroll.classList.add("wam-stack-scroll");
        markAncestorChain(detailScroll, sectionDetail, "wam-stack-frame");
      }
    }
  }

  function scoreSectionDrawerCandidate(child) {
    if (!child) return Number.NEGATIVE_INFINITY;

    const rect = child.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) {
      return Number.NEGATIVE_INFINITY;
    }

    const text = (child.innerText || "").trim();
    const buttons = child.querySelectorAll('button, [role="button"], [role="row"], [role="gridcell"], a').length;
    const search = child.querySelector('input, [role="textbox"], textarea');
    const structuredList = child.querySelector('[role="grid"], [role="list"], [role="feed"], [role="tree"]');
    const avatarCount = child.querySelectorAll("img").length;
    const scrollRoot = findScrollableDescendant(child);
    const lineCount = text ? text.split(/\n+/).filter(Boolean).length : 0;
    const heroLike = /canali suggeriti|restare in contatto|condividi aggiornamenti di stato/i.test(text);

    let score = 0;
    if (search) score += 500;
    if (structuredList) score += 220;
    score += Math.min(buttons, 14) * 24;
    score += Math.min(avatarCount, 12) * 10;
    score += Math.min(lineCount, 18) * 6;
    score += Math.max(0, 240 - rect.left) / 3;

    if (scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight + 40) {
      score += 120;
    }

    if (/trova canali da seguire|il mio stato|cerca/i.test(text)) {
      score += 100;
    }

    if (heroLike) {
      score -= 320;
    }

    if (!search && !structuredList && buttons <= 2 && lineCount <= 6) {
      score -= 140;
    }

    return score;
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
      child.classList.remove("wam-popup-sibling");
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

      // Popups, tooltips, menus and the media-composer overlay must be
      // left alone. Tag them so CSS can lift their z-index and position
      // them over the main pane, but DO NOT include them in pane
      // classification (otherwise they'd be hidden or stretched as
      // structural panes).
      if (isPopupLike(child)) {
        child.classList.add("wam-popup-sibling");
        continue;
      }

      const r = child.getBoundingClientRect();
      const cs = getComputedStyle(child);
      const hasRichContent = !!child.querySelector('#pane-side, [data-icon], [role="tablist"], input, textarea');
      const isAbsolute = cs.position === "absolute";

      if (isAbsolute && !hasRichContent) {
        child.classList.add("wam-overlay-neutral");
        watchOverlayNeutral(child);
        continue;
      }
      if (r.width > 100 && r.height > 100) {
        visibleContentChildren.push(child);
      }
    }

    const hasSectionSiblingCandidate = visibleContentChildren.some(
      (child) => child !== paneSideHost && getComputedStyle(child).position === "absolute",
    );
    const nonChatSectionActive = (!!activeRailBtn && !chatRailActive) || (!chatRailActive && hasSectionSiblingCandidate);

    if (nonChatSectionActive) {
      const sectionCandidates = visibleContentChildren.filter((child) => child !== paneSideHost);
      const rankedSectionCandidates = sectionCandidates
        .map((child) => ({ child, score: scoreSectionDrawerCandidate(child) }))
        .sort((a, b) => b.score - a.score);

      const sectionRoot = rankedSectionCandidates[0]?.child || null;
      const sectionDetail = rankedSectionCandidates.find((entry) => entry.child !== sectionRoot)?.child || null;

      if (sectionRoot) sectionRoot.classList.add("wam-drawer");
      if (sectionDetail) sectionDetail.classList.add("wam-main");
      tagSectionDrawer(sectionRoot, sectionDetail);
      if (paneSideHost) paneSideHost.classList.add("wam-hidden-pane");
      for (const child of visibleContentChildren) {
        if (child !== sectionRoot && child !== sectionDetail && child !== paneSideHost) {
          child.classList.add("wam-hidden-pane");
        }
      }

      return {
        mode: "section-drawer",
        drawer: sectionRoot,
        main: sectionDetail,
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

    navObserver = new MutationObserver((mutations) => {
      // Filter out mutations that only add/remove popup-like nodes.
      // Re-running the classifier on every tooltip mount caused tooltips
      // to flicker (appear, get re-tagged, lose hover, vanish).
      const structural = mutations.some((m) => {
        const nodes = [...m.addedNodes, ...m.removedNodes];
        return nodes.some((n) => {
          if (n.nodeType !== 1) return false;
          if (isPopupLike(n)) return false;
          if (n.classList?.contains("wam-popup-sibling")) return false;
          return true;
        });
      });
      if (!structural) {
        // Still tag any newly added popups so they get correct z-index.
        for (const m of mutations) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && isPopupLike(n)) {
              n.classList.add("wam-popup-sibling");
            }
          }
        }
        return;
      }
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
      (event) => {
        const target = event.target;
        const railButton = target instanceof Element ? target.closest("button, [role='button']") : null;
        if (railButton) {
          setDrawerOpen(false);
        }
        setTimeout(debouncedApply, 120);
      },
      true,
    );
  }

  function setRailWidth(rail) {
    const measured = Math.round(rail.getBoundingClientRect().width) || 56;
    // Clamp to a safe range so a misclassified header can't blow up the
    // layout to e.g. 200px wide.
    const width = Math.max(48, Math.min(measured, 64));
    document.documentElement.style.setProperty("--wam-rail-width", `${width}px`);
    document.documentElement.style.setProperty("--wam-drawer-width", `min(calc(100vw - ${width}px - 32px), 320px)`);
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

  let hoverCloseTimer = null;

  function cancelHoverClose() {
    if (hoverCloseTimer) {
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }

  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimer = setTimeout(() => {
      if (!drawerEl) return;
      const hovered = document.querySelector(":hover");
      const overDrawer = hovered instanceof Element && drawerEl.contains(hovered);
      if (!overDrawer) setDrawerOpen(false);
      hoverCloseTimer = null;
    }, 350);
  }

  function isInFooterBand(clientY) {
    const footer = document.querySelector("footer");
    if (!footer) return false;
    const rect = footer.getBoundingClientRect();
    return clientY >= rect.top - 12;
  }

  function ensureHandle(drawer) {
    let zone = document.body.querySelector(":scope > .wam-edge-hotzone");
    if (!zone) {
      zone = document.createElement("div");
      zone.className = "wam-edge-hotzone";
      zone.setAttribute("aria-label", "Reveal chat list");
      document.body.appendChild(zone);

      zone.addEventListener("mouseenter", () => {
        cancelHoverClose();
        if (drawerEl) setDrawerOpen(true);
      });
      zone.addEventListener("mouseleave", scheduleHoverClose);
      zone.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (drawerEl) setDrawerOpen(!drawerOpen);
      });

      document.addEventListener("mousemove", (e) => {
        if (!drawerOpen || !drawerEl) return;
        const overDrawer = drawerEl.contains(e.target);
        const overZone = zone.contains(e.target);
        if (overDrawer || overZone) {
          cancelHoverClose();
        } else if (!hoverCloseTimer) {
          scheduleHoverClose();
        }
      });
    } else if (zone.parentElement !== document.body || zone !== document.body.lastElementChild) {
      document.body.appendChild(zone);
    }

    zone.style.bottom = document.querySelector("footer") ? "96px" : "0px";

    const oldHandle = document.body.querySelector(":scope > .wam-drawer-handle");
    if (oldHandle) oldHandle.remove();
    return zone;
  }

  function removeHandle() {
    document.body.querySelector(":scope > .wam-edge-hotzone")?.remove();
    document.body.querySelector(":scope > .wam-drawer-handle")?.remove();
  }

  function bindGlobalClosers() {
    if (handleBound) return;
    handleBound = true;

    // Close drawer after selecting a chat row (without blocking the click).
    // Only treat clicks on the MAIN conversation pane as outside; clicks
    // on rail/drawer/handle/popups must not toggle the drawer (that caused
    // the "click empty sidebar -> chats appear and disappear" flicker).
    document.addEventListener(
      "click",
      (e) => {
        if (window.innerWidth > 900) return;
        if (!drawerEl) return;
        if (!drawerOpen) return;
        if (e.target.closest(".wam-drawer-handle")) return;
        if (e.target.closest(".wam-edge-hotzone")) return;
        if (e.target.closest(".wam-sidebar")) return;
        if (
          e.target.closest(
            '[role="dialog"], [role="menu"], [role="tooltip"], [role="listbox"], [aria-modal="true"], .wam-popup-sibling, .wam-popup-host',
          )
        )
          return;
        if (drawerEl.contains(e.target)) {
          const row = e.target.closest('[role="listitem"], [role="row"], [role="button"][tabindex]');
          if (row) setTimeout(() => setDrawerOpen(false), 60);
          return;
        }
        // Only auto-close when clicking inside the actual main pane.
        const main = lastMain;
        if (main && main.contains(e.target)) {
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

    // Body-level popup lifter: any tooltip/menu/dialog inserted anywhere
    // in the document needs its absolute-positioned ancestor (the popup
    // host) lifted above the drawer. WhatsApp's popup root sits inside
    // app-wrapper-web (z-index 100) which traps tooltips behind .wam-main.
    const POPUP_SEL =
      '[role="tooltip"], [role="menu"], [role="dialog"], [role="listbox"], [aria-modal="true"], [data-animate-modal-popup], [data-animate-modal-body]';

    function liftPopupAncestors(node) {
      if (!node || node.nodeType !== 1) return;
      let el = node.parentElement;
      let lifted = 0;
      while (el && el !== document.body && lifted < 6) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" || cs.position === "fixed") {
          el.classList.add("wam-popup-host");
          lifted++;
        }
        el = el.parentElement;
      }
    }

    function scanForPopups(root) {
      if (!root || root.nodeType !== 1) return;
      if (root.matches && root.matches(POPUP_SEL)) liftPopupAncestors(root);
      if (root.querySelectorAll) {
        for (const p of root.querySelectorAll(POPUP_SEL)) liftPopupAncestors(p);
      }
    }

    // Initial sweep + watch.
    scanForPopups(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) scanForPopups(n);
      }
      if (window.innerWidth <= 900) {
        const zone = document.body.querySelector(":scope > .wam-edge-hotzone");
        if (zone) {
          zone.style.bottom = document.querySelector("footer") ? "96px" : "0px";
          if (zone !== document.body.lastElementChild) {
            document.body.appendChild(zone);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
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
    const drawerChanged = !!layout.drawer && layout.drawer !== drawerEl;

    if (layout.mode === "chat") {
      if (layout.main) {
        lastMain = layout.main;
      } else if (lastMain && lastMain.parentElement === nav) {
        layout.main = lastMain;
        lastMain.classList.add("wam-main");
      }
    }

    nav.classList.toggle("wam-mode-chat", layout.mode === "chat" || layout.mode === "section-drawer");
    nav.classList.toggle("wam-mode-section", layout.mode === "section");
    setLayoutMode(layout.mode);

    if (layout.drawer) {
      if (drawerChanged) {
        drawerOpen = false;
      }
      drawerEl = layout.drawer;
      ensureHandle(layout.drawer);
      setDrawerOpen(drawerOpen);
    } else {
      drawerEl = null;
      setDrawerOpen(false);
      removeHandle();
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
