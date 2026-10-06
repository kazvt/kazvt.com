import { decryptReward } from "./reward-crypto.mjs";

(() => {
  "use strict";

  const loadingState = document.getElementById("loadingState");
  const rewardState = document.getElementById("rewardState");
  const errorState = document.getElementById("errorState");
  const recipient = document.getElementById("recipient");
  const filename = document.getElementById("filename");
  const rewardImage = document.getElementById("rewardImage");
  const errorMessage = document.getElementById("errorMessage");

  function showError(message) {
    loadingState.hidden = true;
    rewardState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
  }

  async function openReward() {
    const token = new URLSearchParams(location.search).get("id");
    const keyText = new URLSearchParams(location.hash.slice(1)).get("key");
    if (!token || !keyText) throw new Error("The link is missing its encrypted reward data or key.");

    const response = await fetch("/assets/rewards/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("The reward list could not be loaded.");
    const catalog = await response.json();
    if (catalog.version !== 1 || !Array.isArray(catalog.files)) {
      throw new Error("The reward list is invalid.");
    }

    const data = await decryptReward(token, keyText);
    const allowedFiles = new Set(catalog.files.filter(file => typeof file === "string"));

    if (data.version !== 1 || typeof data.username !== "string" || !data.username.trim() ||
        data.username.length > 100 || typeof data.file !== "string" || !allowedFiles.has(data.file)) {
      throw new Error("The reward details are invalid.");
    }

    rewardImage.src = `/assets/rewards/${encodeURIComponent(data.file)}`;
    rewardImage.alt = data.file;
    rewardImage.onerror = () => showError("This award image is no longer available.");
    recipient.textContent = `For ${data.username}`;
    filename.textContent = data.file;
    loadingState.hidden = true;
    rewardState.hidden = false;
  }

  openReward().catch(error => {
    console.warn("[reward] Could not open reward link:", error);
    const publicAssetError = /award list|reward list/i.test(String(error && error.message));
    showError(publicAssetError
      ? "The reward list could not be loaded. Refresh this page in a moment."
      : "This link is invalid or incomplete. Copy the complete link, including everything after #key=.");
  });
})();
