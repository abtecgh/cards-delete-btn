"use strict";

async function init() {
  try {
    await browser.cardsDelete.inject();
    console.log("[CardsDelete] Extension initialized.");
  } catch (e) {
    console.error("[CardsDelete] Init failed:", e);
  }
}

browser.runtime.onStartup.addListener(init);
browser.runtime.onInstalled.addListener(init);
