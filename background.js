"use strict";

/**
 * Cards View Delete Button — background script
 *
 * Calls the Experiment API to inject the delete button into all open and
 * future mail:3pane windows.
 */

async function init() {
  await browser.cardsDelete.inject();
}

browser.runtime.onStartup.addListener(init);
browser.runtime.onInstalled.addListener(init);
