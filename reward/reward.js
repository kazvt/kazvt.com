(() => {
  "use strict";

  const loadingState = document.getElementById("loadingState");
  const rewardState = document.getElementById("rewardState");
  const errorState = document.getElementById("errorState");
  const recipient = document.getElementById("recipient");
  const filename = document.getElementById("filename");
  const rewardImage = document.getElementById("rewardImage");
  const errorMessage = document.getElementById("errorMessage");

  function decodeBase64Url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function showError(message) {
    loadingState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
  }

  async function openReward() {
    const token = new URLSearchParams(location.search).get("id");
    const keyText = new URLSearchParams(location.hash.slice(1)).get("key");
    if (!token || !keyText) throw new Error("The link is missing its encrypted reward data or key.");

    const tokenBytes = decodeBase64Url(token);
    const keyBytes = decodeBase64Url(keyText);
    if (tokenBytes.length < 29 || tokenBytes.length > 2048 || keyBytes.length !== 32) {
      throw new Error("The reward link is malformed.");
    }

    const response = await fetch("/assets/rewards/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("The reward list could not be loaded.");
    const catalog = await response.json();
    if (catalog.version !== 1 || !Array.isArray(catalog.files)) {
      throw new Error("The reward list is invalid.");
    }

    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const iv = tokenBytes.slice(0, 12);
    const ciphertext = tokenBytes.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const data = JSON.parse(new TextDecoder().decode(plaintext));
    const allowedFiles = new Set(catalog.files.filter(file => typeof file === "string"));

    if (data.version !== 1 || typeof data.username !== "string" || !data.username.trim() ||
        data.username.length > 100 || typeof data.file !== "string" || !allowedFiles.has(data.file)) {
      throw new Error("The reward details are invalid.");
    }

    rewardImage.src = `/assets/rewards/${encodeURIComponent(data.file)}`;
    rewardImage.alt = data.file;
    recipient.textContent = `For ${data.username}`;
    filename.textContent = data.file;
    loadingState.hidden = true;
    rewardState.hidden = false;
  }

  openReward().catch(error => {
    console.warn("[reward] Could not open reward link:", error);
    showError("Check that you copied the complete reward link, including everything after #key=.");
  });
})();
