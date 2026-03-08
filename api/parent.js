"use strict";

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

this.cardsDelete = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {

    function log(msg) {
      try { Services.console.logStringMessage("[CardsDelete] " + msg); } catch(e) {}
    }

    const CSS = `
      .cards-delete-btn {
        position: absolute !important;
        right: 80px !important;
        bottom: 0px !important;
        top: auto !important;
        width: 36px !important;
        height: 36px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: none !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        color: #888 !important;
        z-index: 9999 !important;
        padding: 1px !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        font-size: 24px !important;
        line-height: 1 !important;
      }
      .cards-delete-btn:hover {
        background: rgba(204,51,51,0.15) !important;
        color: #cc3333 !important;
      }
    `;

    function deleteRowMessage(row, innerWin) {
      try {
        const rowIndex = typeof row.index === "number" ? row.index : -1;
        log("delete rowIndex=" + rowIndex);
        if (rowIndex < 0) return;
        const view = innerWin.gDBView;
        if (!view) { log("no gDBView"); return; }
        const msgHdr = view.getMsgHdrAt(rowIndex);
        if (!msgHdr) { log("no msgHdr"); return; }
        // Use deleteMessages directly - does NOT change selection or open next message
        msgHdr.folder.deleteMessages([msgHdr], null, false, false, null, true);
        log("deleted: " + msgHdr.subject);
      } catch(e) { log("delete err: " + e); }
    }

    function attachBtn(row, innerWin) {
      if (row.__cdDone) return;
      row.__cdDone = true;

      const container = row.querySelector(".card-container") || row;
      const computed = innerWin.getComputedStyle(container);
      if (computed.position === "static") {
        container.style.setProperty("position", "relative", "important");
      }

      const btn = innerWin.document.createElement("button");
      btn.className = "cards-delete-btn";
      btn.title = "Delete";
      btn.textContent = "🗑";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteRowMessage(row, innerWin);
      }, true);

      container.appendChild(btn);
    }

    function processRows(innerWin) {
      try {
        innerWin.document.querySelectorAll("[is='thread-card']:not([data-cd])").forEach(row => {
          row.setAttribute("data-cd", "1");
          attachBtn(row, innerWin);
        });
      } catch(e) { log("processRows err: " + e); }
    }

    function injectIntoInnerDoc(innerWin) {
      try {
        if (!innerWin || innerWin.__cdSetup) return;
        innerWin.__cdSetup = true;
        const doc = innerWin.document;
        if (!doc.getElementById("cards-delete-css")) {
          const s = doc.createElement("style");
          s.id = "cards-delete-css";
          s.textContent = CSS;
          (doc.head || doc.documentElement).appendChild(s);
        }
        processRows(innerWin);
        new innerWin.MutationObserver(() => processRows(innerWin))
          .observe(doc.documentElement, { childList: true, subtree: true });
        let n = 0;
        const t = innerWin.setInterval(() => {
          processRows(innerWin);
          if (++n > 100) innerWin.clearInterval(t);
        }, 600);
      } catch(e) { log("injectIntoInnerDoc err: " + e); }
    }

    function injectIntoMailWindow(outerWin) {
      try {
        if (!outerWin || outerWin.__cdOuterSetup) return;
        outerWin.__cdOuterSetup = true;
        const doc = outerWin.document;
        function tryInjectFrames() {
          doc.querySelectorAll("browser, iframe").forEach(br => {
            try {
              const cw = br.contentWindow;
              if (cw?.location?.href?.startsWith("about:3pane")) injectIntoInnerDoc(cw);
            } catch(e) {}
          });
        }
        tryInjectFrames();
        new outerWin.MutationObserver(() => tryInjectFrames())
          .observe(doc.documentElement, { childList: true, subtree: true });
        const tabmail = doc.getElementById("tabmail");
        if (tabmail) tabmail.addEventListener("select", () => outerWin.setTimeout(tryInjectFrames, 300));
        let n = 0;
        const t = outerWin.setInterval(() => { tryInjectFrames(); if (++n > 30) outerWin.clearInterval(t); }, 500);
      } catch(e) { log("injectIntoMailWindow err: " + e); }
    }

    return {
      cardsDelete: {
        async inject() {
          try {
            const { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");
            try {
              const wins = Services.wm.getEnumerator("mail:3pane");
              while (wins.hasMoreElements()) injectIntoMailWindow(wins.getNext());
            } catch(e) { log("wm err: " + e); }
            ExtensionSupport.registerWindowListener("cardsDeleteListener", {
              onLoadWindow(win) {
                try {
                  if (win.document?.documentElement?.getAttribute("windowtype") === "mail:3pane")
                    injectIntoMailWindow(win);
                } catch(e) {}
              },
            });
            context.callOnClose({
              close() { try { ExtensionSupport.unregisterWindowListener("cardsDeleteListener"); } catch(e) {} }
            });
          } catch(e) { log("inject FAILED: " + e); throw e; }
        }
      }
    };
  }
};
