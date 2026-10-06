(() => {
  "use strict";

  const list = document.getElementById("rewardList");
  const status = document.getElementById("status");

  function makeText(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function fallbackCopy(value) {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("Clipboard access was denied.");
  }

  async function copyLink(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      fallbackCopy(value);
    }
  }

  function render(items) {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(makeText("li", "empty", "No reward links yet. A new link appears when someone answers correctly."));
      status.textContent = "Watching for new rewards…";
      return;
    }

    for (const item of items) {
      const row = document.createElement("li");
      row.className = "reward-row";
      const details = document.createElement("div");
      details.appendChild(makeText("p", "recipient", `${item.username} won`));
      details.appendChild(makeText("p", "details", item.filename));
      const issuedAt = new Date(item.issuedAt);
      details.appendChild(makeText("p", "issued", Number.isNaN(issuedAt.valueOf()) ? "" : issuedAt.toLocaleString()));

      const actions = document.createElement("div");
      actions.className = "actions";
      const copyButton = makeText("button", "", "Copy link");
      copyButton.type = "button";
      copyButton.addEventListener("click", async () => {
        try {
          await copyLink(item.link);
          copyButton.textContent = "Copied";
          status.textContent = `Copied the reward link for ${item.username}. Paste it into chat.`;
          setTimeout(() => { copyButton.textContent = "Copy link"; }, 1800);
        } catch (error) {
          status.textContent = error.message || "Could not copy the link.";
        }
      });
      const openLink = makeText("a", "open-link", "Preview");
      openLink.href = item.link;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      actions.append(copyButton, openLink);
      row.append(details, actions);
      list.appendChild(row);
    }
    status.textContent = `${items.length} recent reward ${items.length === 1 ? "link" : "links"}.`;
  }

  async function refresh() {
    try {
      const response = await fetch("/api/rewards", { cache: "no-store" });
      if (!response.ok) throw new Error(`Reward queue request failed (HTTP ${response.status}).`);
      const data = await response.json();
      render(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      status.textContent = "Start or restart the local widget server to load reward links.";
      list.replaceChildren(makeText("li", "empty", error.message || "The local reward queue is unavailable."));
    }
  }

  document.getElementById("refreshButton").addEventListener("click", refresh);
  refresh();
  setInterval(refresh, 5000);
})();
