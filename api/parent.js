"use strict";

/**
 * Cards View Delete Button — Experiment API (parent process)
 *
 * Injects a delete button into each message card in Thunderbird's Cards View
 * (about:3pane). Uses folder.deleteMessages() directly so that:
 *   - The current selection is not changed after deletion
 *   - The action is registered with Thunderbird's undo manager (Ctrl+Z)
 *
 * Tested on Thunderbird 115–148.
 */

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

this.cardsDelete = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {

    // -------------------------------------------------------------------------
    // Styles injected into about:3pane
    // -------------------------------------------------------------------------

    const BUTTON_CSS = `
      .cards-delete-btn {
        position: absolute;
        right: 80px;
        bottom: 0;
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        color: #888;
        font-size: 24px;
        line-height: 1;
        z-index: 100;
        padding: 1px;
        box-sizing: border-box;
      }

      .cards-delete-btn:hover {
        background: rgba(204, 51, 51, 0.15);
        color: #cc3333;
      }
    `;

    // -------------------------------------------------------------------------
    // Delete a specific message by its view index
    // -------------------------------------------------------------------------

    function deleteMessage(row, innerWin) {
      const rowIndex = typeof row.index === "number" ? row.index : -1;
      if (rowIndex < 0) {
        return;
      }

      const view = innerWin.gDBView;
      if (!view) {
        return;
      }

      const msgHdr = view.getMsgHdrAt(rowIndex);
      if (!msgHdr) {
        return;
      }

      // Pass msgWindow so the deletion is recorded by Thunderbird's undo manager
      const topWin = innerWin.browsingContext?.top?.window ?? innerWin;
      const msgWindow = topWin.msgWindow ?? null;

      msgHdr.folder.deleteMessages(
        [msgHdr],
        msgWindow,
        false, // deleteStorage — false = move to Trash
        false, // isMove
        null,  // copyListener
        true   // allowUndo — registers with undo manager for Ctrl+Z support
      );
    }

    // -------------------------------------------------------------------------
    // Attach a delete button to a single thread-card element
    // -------------------------------------------------------------------------

    function attachButton(row, innerWin) {
      if (row._cardsDeleteAttached) {
        return;
      }
      row._cardsDeleteAttached = true;

      // The button is positioned absolutely inside .card-container, which
      // already has position:relative in Thunderbird's own stylesheet.
      const container = row.querySelector(".card-container") ?? row;
      if (innerWin.getComputedStyle(container).position === "static") {
        container.style.position = "relative";
      }

      const btn = innerWin.document.createElement("button");
      btn.className = "cards-delete-btn";
      btn.title = "Delete message";
      btn.setAttribute("aria-label", "Delete message");
      btn.textContent = "🗑";

      // Use capture to intercept the click before the card's own click handler
      // would change the selection.
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        deleteMessage(row, innerWin);
      }, /* capture */ true);

      container.appendChild(btn);
    }

    // -------------------------------------------------------------------------
    // Scan the document for unprocessed thread-card elements
    // -------------------------------------------------------------------------

    function processCards(innerWin) {
      innerWin.document
        .querySelectorAll("[is='thread-card']:not([data-cdb-done])")
        .forEach(row => {
          row.setAttribute("data-cdb-done", "1");
          attachButton(row, innerWin);
        });
    }

    // -------------------------------------------------------------------------
    // Inject styles and button logic into about:3pane
    // -------------------------------------------------------------------------

    function injectInto3Pane(innerWin) {
      if (!innerWin || innerWin._cardsDeleteInjected) {
        return;
      }
      innerWin._cardsDeleteInjected = true;

      const doc = innerWin.document;

      // Inject stylesheet once
      if (!doc.getElementById("cards-delete-btn-css")) {
        const style = doc.createElement("style");
        style.id = "cards-delete-btn-css";
        style.textContent = BUTTON_CSS;
        (doc.head ?? doc.documentElement).appendChild(style);
      }

      // Process cards already in the DOM
      processCards(innerWin);

      // Process cards added later (virtual list recycles rows while scrolling)
      new innerWin.MutationObserver(() => processCards(innerWin))
        .observe(doc.documentElement, { childList: true, subtree: true });

      // Short polling window to catch the initial render burst (~60 s)
      let ticks = 0;
      const timer = innerWin.setInterval(() => {
        processCards(innerWin);
        if (++ticks >= 100) {
          innerWin.clearInterval(timer);
        }
      }, 600);
    }

    // -------------------------------------------------------------------------
    // Find and watch the about:3pane browser frame inside a mail:3pane window
    // -------------------------------------------------------------------------

    function watchMailWindow(outerWin) {
      if (!outerWin || outerWin._cardsDeleteWatching) {
        return;
      }
      outerWin._cardsDeleteWatching = true;

      const doc = outerWin.document;

      function tryInject() {
        doc.querySelectorAll("browser, iframe").forEach(frame => {
          try {
            const cw = frame.contentWindow;
            if (cw?.location?.href?.startsWith("about:3pane")) {
              injectInto3Pane(cw);
            }
          } catch (_) {
            // Cross-origin or not-yet-loaded frame — ignore
          }
        });
      }

      tryInject();

      // Re-try when new frames are added (e.g. new tab opened)
      new outerWin.MutationObserver(tryInject)
        .observe(doc.documentElement, { childList: true, subtree: true });

      // Re-try when a tab is selected
      doc.getElementById("tabmail")
        ?.addEventListener("select", () => outerWin.setTimeout(tryInject, 300));

      // Short polling window for the initial load
      let ticks = 0;
      const timer = outerWin.setInterval(() => {
        tryInject();
        if (++ticks >= 30) {
          outerWin.clearInterval(timer);
        }
      }, 500);
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    return {
      cardsDelete: {
        async inject() {
          const { ExtensionSupport } = ChromeUtils.importESModule(
            "resource:///modules/ExtensionSupport.sys.mjs"
          );

          // Inject into windows that are already open
          const openWindows = Services.wm.getEnumerator("mail:3pane");
          while (openWindows.hasMoreElements()) {
            watchMailWindow(openWindows.getNext());
          }

          // Inject into windows opened after the extension loads
          ExtensionSupport.registerWindowListener("cardsDeleteBtn", {
            onLoadWindow(win) {
              if (win.document?.documentElement?.getAttribute("windowtype") === "mail:3pane") {
                watchMailWindow(win);
              }
            },
          });

          // Clean up when the extension is disabled or uninstalled
          context.callOnClose({
            close() {
              ExtensionSupport.unregisterWindowListener("cardsDeleteBtn");
            },
          });
        },
      },
    };
  }
};
