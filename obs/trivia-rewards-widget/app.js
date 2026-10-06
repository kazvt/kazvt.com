import { encryptReward } from "./reward-crypto.mjs";

(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    questionsUrl: "questions.json",
    websocket: {
      url: "ws://127.0.0.1:8080",
      reconnectInitialMs: 1000,
      reconnectMaxMs: 15000,
      reconnectFactor: 1.8,
      reconnectJitter: 0.2,
      maxMessageChars: 32768,
      dedupeCacheSize: 2000,
      ignoreBots: true
    },
    commands: {
      trivia: "!trivia",
      leaderboard: "!leaderboard",
      perUserCooldownMs: 1200,
      leaderboardGlobalCooldownMs: 3500
    },
    game: {
      defaultDurationSeconds: 30,
      defaultPoints: 10,
      answerMode: "all_until_timeout",
      oneAwardPerUserPerQuestion: true,
      maxWinnersPerQuestion: 0,
      recentQuestionMemory: 5,
      resultVisibleMs: 4200,
      autoContinue: false,
      autoContinueDelayMs: 4500
    },
    rewards: {
      enabled: true,
      catalogUrl: "rewards.json",
      pageUrl: "https://kazvt.com/reward/",
      queueEndpoint: "/api/rewards"
    },
    leaderboard: {
      size: 5,
      visibleMs: 10000,
      storageKey: "obs-trivia-widget:v2:scores"
    },
    display: {
      offsetX: 32,
      offsetY: 32,
      width: 620,
      showConnectionStatus: true
    }
  };

  const dom = {
    connectionBadge: document.getElementById("connectionBadge"),
    connectionText: document.getElementById("connectionText"),
    questionCard: document.getElementById("questionCard"),
    categoryChip: document.getElementById("categoryChip"),
    categoryIcon: document.getElementById("categoryIcon"),
    categoryName: document.getElementById("categoryName"),
    difficulty: document.getElementById("difficulty"),
    questionText: document.getElementById("questionText"),
    pointsText: document.getElementById("pointsText"),
    winnerCount: document.getElementById("winnerCount"),
    timeText: document.getElementById("timeText"),
    timerBar: document.getElementById("timerBar"),
    resultCard: document.getElementById("resultCard"),
    resultKicker: document.getElementById("resultKicker"),
    resultMain: document.getElementById("resultMain"),
    resultSub: document.getElementById("resultSub"),
    activityCard: document.getElementById("activityCard"),
    activityIcon: document.getElementById("activityIcon"),
    activityTitle: document.getElementById("activityTitle"),
    activitySub: document.getElementById("activitySub"),
    leaderboardCard: document.getElementById("leaderboardCard"),
    leaderboardTitle: document.getElementById("leaderboardTitle"),
    leaderboardScope: document.getElementById("leaderboardScope"),
    leaderboardRows: document.getElementById("leaderboardRows"),
    errorCard: document.getElementById("errorCard"),
    errorTitle: document.getElementById("errorTitle"),
    errorDetail: document.getElementById("errorDetail")
  };

  const state = {
    config: null,
    bank: null,
    categoriesById: new Map(),
    phase: "booting",
    activeRound: null,
    recentQuestionIds: [],
    roundNumber: 0,
    timerAnimationFrame: null,
    roundTimeout: null,
    autoContinueTimeout: null,
    activityTimeout: null,
    resultTimeout: null,
    leaderboardTimeout: null,
    lastLeaderboardShownAt: 0,
    leaderboardFilterCategoryId: null,
    commandCooldowns: new Map(),
    seenMessageIds: new Map(),
    socket: null,
    socketReconnectTimeout: null,
    socketAttempt: 0,
    socketConnected: false,
    shuttingDown: false,
    scores: new Map(),
    rewardCatalog: [],
    storageAvailable: true
  };

  function deepMerge(base, override) {
    if (!isPlainObject(override)) return clone(base);
    const out = clone(base);
    for (const [key, value] of Object.entries(override)) {
      if (isPlainObject(value) && isPlainObject(out[key])) {
        out[key] = deepMerge(out[key], value);
      } else if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isPlainObject(value)) {
      const out = {};
      for (const [key, child] of Object.entries(value)) out[key] = clone(child);
      return out;
    }
    return value;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function sanitizeConfig(config) {
    const out = deepMerge(DEFAULT_CONFIG, config);

    out.questionsUrl = String(out.questionsUrl || DEFAULT_CONFIG.questionsUrl);
    out.websocket.url = String(out.websocket.url || DEFAULT_CONFIG.websocket.url);
    out.websocket.reconnectInitialMs = clamp(out.websocket.reconnectInitialMs, 100, 60000, 1000);
    out.websocket.reconnectMaxMs = clamp(out.websocket.reconnectMaxMs, 500, 300000, 15000);
    out.websocket.reconnectFactor = clamp(out.websocket.reconnectFactor, 1, 5, 1.8);
    out.websocket.reconnectJitter = clamp(out.websocket.reconnectJitter, 0, 1, 0.2);
    out.websocket.maxMessageChars = Math.round(clamp(out.websocket.maxMessageChars, 256, 1000000, 32768));
    out.websocket.dedupeCacheSize = Math.round(clamp(out.websocket.dedupeCacheSize, 100, 20000, 2000));
    out.websocket.ignoreBots = Boolean(out.websocket.ignoreBots);

    out.commands.trivia = normalizeCommandName(out.commands.trivia, "!trivia");
    out.commands.leaderboard = normalizeCommandName(out.commands.leaderboard, "!leaderboard");
    out.commands.perUserCooldownMs = clamp(out.commands.perUserCooldownMs, 0, 60000, 1200);
    out.commands.leaderboardGlobalCooldownMs = clamp(out.commands.leaderboardGlobalCooldownMs, 0, 60000, 3500);

    out.game.defaultDurationSeconds = Math.round(clamp(out.game.defaultDurationSeconds, 5, 300, 30));
    out.game.defaultPoints = Math.round(clamp(out.game.defaultPoints, 1, 100000, 10));
    out.game.answerMode = ["all_until_timeout", "first_correct"].includes(out.game.answerMode)
      ? out.game.answerMode
      : "all_until_timeout";
    out.game.oneAwardPerUserPerQuestion = Boolean(out.game.oneAwardPerUserPerQuestion);
    out.game.maxWinnersPerQuestion = Math.round(clamp(out.game.maxWinnersPerQuestion, 0, 100000, 0));
    out.game.recentQuestionMemory = Math.round(clamp(out.game.recentQuestionMemory, 0, 1000, 5));
    out.game.resultVisibleMs = clamp(out.game.resultVisibleMs, 500, 60000, 4200);
    out.game.autoContinue = Boolean(out.game.autoContinue);
    out.game.autoContinueDelayMs = clamp(out.game.autoContinueDelayMs, 500, 60000, 4500);

    out.rewards.enabled = Boolean(out.rewards.enabled);
    out.rewards.catalogUrl = String(out.rewards.catalogUrl || DEFAULT_CONFIG.rewards.catalogUrl);
    out.rewards.pageUrl = String(out.rewards.pageUrl || DEFAULT_CONFIG.rewards.pageUrl);
    out.rewards.queueEndpoint = String(out.rewards.queueEndpoint || DEFAULT_CONFIG.rewards.queueEndpoint);
    if (!/^https:\/\/kazvt\.com\/reward\/?$/.test(out.rewards.pageUrl)) {
      out.rewards.pageUrl = DEFAULT_CONFIG.rewards.pageUrl;
    }
    if (!/^\/api\/[a-z0-9/_-]+$/i.test(out.rewards.queueEndpoint)) {
      out.rewards.queueEndpoint = DEFAULT_CONFIG.rewards.queueEndpoint;
    }

    out.leaderboard.size = Math.round(clamp(out.leaderboard.size, 1, 20, 5));
    out.leaderboard.visibleMs = clamp(out.leaderboard.visibleMs, 1000, 60000, 10000);
    out.leaderboard.storageKey = String(out.leaderboard.storageKey || DEFAULT_CONFIG.leaderboard.storageKey);

    out.display.offsetX = Math.round(clamp(out.display.offsetX, 0, 1920, 32));
    out.display.offsetY = Math.round(clamp(out.display.offsetY, 0, 1080, 32));
    out.display.width = Math.round(clamp(out.display.width, 320, 1200, 620));
    out.display.showConnectionStatus = Boolean(out.display.showConnectionStatus);

    return out;
  }

  function normalizeCommandName(value, fallback) {
    const text = String(value || fallback).trim().toLowerCase();
    return text.startsWith("!") ? text : fallback;
  }

  async function fetchJson(url, label) {
    let response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (error) {
      const fileHint = location.protocol === "file:"
        ? " This page is running from file://. Serve the folder from localhost with server.py instead."
        : "";
      throw new Error(`Could not load ${label} from ${url}.${fileHint} ${error.message || error}`);
    }

    if (!response.ok) {
      throw new Error(`${label} request failed: HTTP ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(`${label} is not valid JSON: ${error.message || error}`);
    }
  }

  function validateRewardCatalog(raw) {
    if (!isPlainObject(raw) || raw.version !== 1 || !Array.isArray(raw.files)) {
      throw new Error("Reward catalog must have version 1 and a files array.");
    }

    const files = [...new Set(raw.files.map(value => String(value || "").trim()))];
    const invalid = files.filter(file => !/^[^/\\\u0000-\u001f]+\.png$/i.test(file));
    if (files.length === 0 || invalid.length > 0) {
      throw new Error("Reward catalog must contain PNG filenames without folders.");
    }
    return files;
  }

  async function createRewardUrl(player, file) {
    const encrypted = await encryptReward({
      version: 1,
      username: String(player.displayName || "Viewer").slice(0, 100),
      file
    });

    const url = new URL(state.config.rewards.pageUrl);
    url.search = "";
    url.searchParams.set("id", encrypted.id);
    url.hash = `key=${encrypted.key}`;
    return url.href;
  }

  async function issueRewardLink(player) {
    if (!state.config.rewards.enabled) return null;
    if (state.rewardCatalog.length === 0) throw new Error("No reward PNGs are available.");

    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % state.rewardCatalog.length;
    const file = state.rewardCatalog[randomIndex];
    const link = await createRewardUrl(player, file);
    const record = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      username: String(player.displayName || "Viewer").slice(0, 100),
      filename: file,
      link,
      platform: String(player.platform || "chat"),
      issuedAt: new Date().toISOString()
    };

    const response = await fetch(state.config.rewards.queueEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!response.ok) {
      throw new Error(`Could not save the reward link (HTTP ${response.status}).`);
    }
    return record;
  }

  function applyQueryOverrides(config) {
    const params = new URLSearchParams(location.search);
    if (params.has("ws")) config.websocket.url = params.get("ws");
    if (params.has("questions")) config.questionsUrl = params.get("questions");
    return config;
  }

  function applyDisplayConfig() {
    const display = state.config.display;
    document.documentElement.style.setProperty("--offset-x", `${display.offsetX}px`);
    document.documentElement.style.setProperty("--offset-y", `${display.offsetY}px`);
    document.documentElement.style.setProperty("--panel-width", `${display.width}px`);
  }

  function validateQuestionBank(raw) {
    const errors = [];
    if (!isPlainObject(raw)) errors.push("Question bank root must be an object.");
    if (raw && raw.version !== 1) errors.push("Question bank version must be 1.");
    if (!raw || !Array.isArray(raw.categories) || raw.categories.length === 0) {
      errors.push("Question bank must contain at least one category.");
    }

    if (errors.length) throw new Error(errors.join("\n"));

    const categoryIds = new Set();
    const questionIds = new Set();
    const categories = [];

    raw.categories.forEach((category, categoryIndex) => {
      const prefix = `categories[${categoryIndex}]`;
      if (!isPlainObject(category)) {
        errors.push(`${prefix} must be an object.`);
        return;
      }

      const id = String(category.id || "").trim();
      const name = String(category.name || "").trim();
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) errors.push(`${prefix}.id is invalid.`);
      if (!name) errors.push(`${prefix}.name is required.`);
      if (categoryIds.has(id)) errors.push(`Duplicate category id: ${id}`);
      categoryIds.add(id);

      const accent = category.accent == null ? "#8B5CF6" : String(category.accent);
      if (!/^#[0-9a-fA-F]{6}$/.test(accent)) errors.push(`${prefix}.accent must be #RRGGBB.`);

      if (!Array.isArray(category.questions) || category.questions.length === 0) {
        errors.push(`${prefix}.questions must contain at least one question.`);
        return;
      }

      const normalizedCategory = {
        id,
        name,
        aliases: Array.isArray(category.aliases) ? category.aliases.map(String).filter(Boolean) : [],
        icon: category.icon == null ? "" : String(category.icon),
        accent,
        enabled: category.enabled !== false,
        weight: clamp(category.weight, 0, 1000, 1),
        questions: []
      };

      category.questions.forEach((question, questionIndex) => {
        const qPrefix = `${prefix}.questions[${questionIndex}]`;
        if (!isPlainObject(question)) {
          errors.push(`${qPrefix} must be an object.`);
          return;
        }

        const qid = String(question.id || "").trim();
        const prompt = String(question.prompt || "").trim();
        const answers = Array.isArray(question.answers)
          ? question.answers.map(answer => String(answer).trim()).filter(Boolean)
          : [];

        if (!/^[a-z0-9][a-z0-9_-]*$/.test(qid)) errors.push(`${qPrefix}.id is invalid.`);
        if (questionIds.has(qid)) errors.push(`Duplicate question id: ${qid}`);
        questionIds.add(qid);
        if (!prompt) errors.push(`${qPrefix}.prompt is required.`);
        if (!answers.length) errors.push(`${qPrefix}.answers must contain at least one answer.`);

        const normalizedAnswers = answers.map(normalizeAnswer);
        if (new Set(normalizedAnswers).size !== normalizedAnswers.length) {
          errors.push(`${qPrefix}.answers contains aliases that become duplicates after normalization.`);
        }

        const points = question.points == null
          ? state.config.game.defaultPoints
          : Math.round(clamp(question.points, 1, 100000, state.config.game.defaultPoints));
        const durationSeconds = question.durationSeconds == null
          ? state.config.game.defaultDurationSeconds
          : Math.round(clamp(question.durationSeconds, 5, 300, state.config.game.defaultDurationSeconds));
        const difficulty = question.difficulty == null ? "" : String(question.difficulty).toLowerCase();
        if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
          errors.push(`${qPrefix}.difficulty must be easy, medium, or hard.`);
        }

        normalizedCategory.questions.push({
          id: qid,
          prompt,
          answers,
          normalizedAnswers,
          points,
          durationSeconds,
          difficulty,
          explanation: question.explanation == null ? "" : String(question.explanation).trim(),
          enabled: question.enabled !== false,
          tags: Array.isArray(question.tags) ? question.tags.map(String).filter(Boolean) : []
        });
      });

      categories.push(normalizedCategory);
    });

    const playable = categories.filter(category => category.enabled)
      .flatMap(category => category.questions.filter(question => question.enabled));
    if (!playable.length) errors.push("No enabled/playable questions exist in the question bank.");

    if (errors.length) throw new Error(errors.join("\n"));

    return { version: 1, categories };
  }

  function normalizeAnswer(value) {
    return String(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’‚‛]/g, "'")
      .trim()
      .replace(/^[\s.,!?;:'"()[\]{}]+|[\s.,!?;:'"()[\]{}]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function normalizeLookup(value) {
    return normalizeAnswer(value).replace(/[_-]+/g, " ");
  }

  function buildCategoryIndex() {
    state.categoriesById.clear();
    for (const category of state.bank.categories) {
      state.categoriesById.set(category.id, category);
    }
  }

  function findCategory(value) {
    const needle = normalizeLookup(value);
    if (!needle) return null;

    for (const category of state.bank.categories) {
      if (!category.enabled) continue;
      const candidates = [category.id, category.name, ...category.aliases].map(normalizeLookup);
      if (candidates.includes(needle)) return category;
    }
    return null;
  }

  function listEnabledCategoryNames() {
    return state.bank.categories
      .filter(category => category.enabled && category.questions.some(question => question.enabled))
      .map(category => category.name);
  }

  function pickQuestion(requestedCategoryId = null) {
    const availableCategories = state.bank.categories.filter(category =>
      category.enabled && category.questions.some(question => question.enabled)
    );
    if (!availableCategories.length) return null;

    let category;
    if (requestedCategoryId) {
      category = state.categoriesById.get(requestedCategoryId);
      if (!category || !category.enabled) return null;
    } else {
      category = weightedCategoryChoice(availableCategories);
    }

    const enabledQuestions = category.questions.filter(question => question.enabled);
    if (!enabledQuestions.length) return null;

    const recent = new Set(state.recentQuestionIds);
    let candidates = enabledQuestions.filter(question => !recent.has(question.id));
    if (!candidates.length) candidates = enabledQuestions;

    const question = candidates[Math.floor(Math.random() * candidates.length)];
    rememberQuestion(question.id);
    return { category, question };
  }

  function weightedCategoryChoice(categories) {
    const usable = categories.filter(category => category.weight > 0);
    if (!usable.length) return categories[Math.floor(Math.random() * categories.length)];

    const total = usable.reduce((sum, category) => sum + category.weight, 0);
    let cursor = Math.random() * total;
    for (const category of usable) {
      cursor -= category.weight;
      if (cursor <= 0) return category;
    }
    return usable[usable.length - 1];
  }

  function rememberQuestion(questionId) {
    const limit = state.config.game.recentQuestionMemory;
    if (limit <= 0) return;
    state.recentQuestionIds = state.recentQuestionIds.filter(id => id !== questionId);
    state.recentQuestionIds.push(questionId);
    if (state.recentQuestionIds.length > limit) {
      state.recentQuestionIds.splice(0, state.recentQuestionIds.length - limit);
    }
  }

  function scoreStoragePayload() {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      players: [...state.scores.entries()].map(([key, player]) => [key, player])
    };
  }

  function loadScores() {
    try {
      const raw = localStorage.getItem(state.config.leaderboard.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.players)) return;

      for (const pair of parsed.players) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [key, player] = pair;
        if (typeof key !== "string" || !isPlainObject(player)) continue;
        const total = Number(player.total);
        if (!Number.isFinite(total) || total < 0) continue;
        state.scores.set(key, {
          platform: String(player.platform || "unknown"),
          userId: String(player.userId || ""),
          displayName: String(player.displayName || "viewer"),
          total,
          correctAnswers: Math.max(0, Number(player.correctAnswers) || 0),
          categories: isPlainObject(player.categories) ? player.categories : {}
        });
      }
    } catch (error) {
      state.storageAvailable = false;
      console.warn("[trivia] Score storage unavailable; scores will be memory-only.", error);
    }
  }

  function persistScores() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(state.config.leaderboard.storageKey, JSON.stringify(scoreStoragePayload()));
    } catch (error) {
      state.storageAvailable = false;
      console.warn("[trivia] Score storage failed; continuing in memory.", error);
    }
  }

  function playerKey(chat) {
    const platform = normalizePlatform(chat.platform);
    const stablePart = chat.userId
      ? String(chat.userId)
      : `name:${normalizeLookup(chat.displayName || "anonymous")}`;
    return `${platform}:${stablePart}`;
  }

  function awardPoints(chat, categoryId, points) {
    const key = playerKey(chat);
    const existing = state.scores.get(key) || {
      platform: normalizePlatform(chat.platform),
      userId: String(chat.userId || ""),
      displayName: chat.displayName || "Viewer",
      total: 0,
      correctAnswers: 0,
      categories: {}
    };

    existing.platform = normalizePlatform(chat.platform);
    existing.userId = String(chat.userId || existing.userId || "");
    existing.displayName = String(chat.displayName || existing.displayName || "Viewer");
    existing.total += points;
    existing.correctAnswers += 1;
    existing.categories[categoryId] = (Number(existing.categories[categoryId]) || 0) + points;
    state.scores.set(key, existing);
    persistScores();
    return existing;
  }

  function sortedScores(categoryId = null) {
    const rows = [...state.scores.values()].map(player => ({
      ...player,
      score: categoryId ? (Number(player.categories[categoryId]) || 0) : player.total
    })).filter(player => player.score > 0);

    rows.sort((a, b) =>
      b.score - a.score ||
      b.correctAnswers - a.correctAnswers ||
      a.displayName.localeCompare(b.displayName)
    );

    return rows.slice(0, state.config.leaderboard.size);
  }

  function connectSocket() {
    clearTimeout(state.socketReconnectTimeout);
    closeSocket(false);

    const url = state.config.websocket.url;
    setConnectionState(false, state.socketAttempt === 0 ? "Connecting to chat" : "Chat link reconnecting");

    try {
      state.socket = new WebSocket(url);
    } catch (error) {
      console.error("[trivia] Invalid WebSocket URL or constructor failure:", error);
      scheduleReconnect();
      return;
    }

    const socket = state.socket;

    socket.addEventListener("open", () => {
      if (state.socket !== socket) return;
      state.socketAttempt = 0;
      setConnectionState(true, "Connected");
      console.info("[trivia] WebSocket connected:", url);
    });

    socket.addEventListener("message", event => {
      if (state.socket !== socket) return;
      if (typeof event.data !== "string") return;
      if (event.data.length > state.config.websocket.maxMessageChars) {
        console.warn("[trivia] Ignored oversized WebSocket message.");
        return;
      }
      consumeSocketPayload(event.data);
    });

    socket.addEventListener("close", event => {
      if (state.socket !== socket) return;
      state.socketConnected = false;
      setConnectionState(false, "Chat link reconnecting");
      if (!state.shuttingDown) scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (state.socket !== socket) return;
      setConnectionState(false, "Chat link error");
    });
  }

  function closeSocket(clean = true) {
    if (!state.socket) return;
    try {
      state.socket.close(clean ? 1000 : undefined);
    } catch (_) {
      // Ignore close races.
    }
    state.socket = null;
  }

  function scheduleReconnect() {
    clearTimeout(state.socketReconnectTimeout);
    const wsConfig = state.config.websocket;
    const base = Math.min(
      wsConfig.reconnectMaxMs,
      wsConfig.reconnectInitialMs * Math.pow(wsConfig.reconnectFactor, state.socketAttempt)
    );
    const jitter = 1 + ((Math.random() * 2 - 1) * wsConfig.reconnectJitter);
    const delay = Math.max(100, Math.round(base * jitter));
    state.socketAttempt += 1;
    state.socketReconnectTimeout = setTimeout(connectSocket, delay);
  }

  function setConnectionState(connected, text) {
    state.socketConnected = connected;
    if (!state.config || !state.config.display.showConnectionStatus) {
      dom.connectionBadge.classList.add("is-hidden");
      return;
    }

    if (connected) {
      dom.connectionBadge.classList.add("is-hidden");
      return;
    }

    dom.connectionText.textContent = text;
    dom.connectionBadge.classList.remove("is-hidden");
  }

  function consumeSocketPayload(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      parsed = {
        platform: "unknown",
        username: "anonymous",
        message: raw
      };
    }

    const chat = normalizeChatPayload(parsed);
    if (!chat || !chat.text) return;
    if (state.config.websocket.ignoreBots && chat.isBot) return;
    if (isDuplicateMessage(chat)) return;
    handleChat(chat);
  }

  function normalizeChatPayload(payload, depth = 0) {
    if (!isPlainObject(payload) || depth > 3) return null;

    // Preferred v1 envelope:
    // { type:"chat.message", platform, id, user:{id,displayName}, message:{text}, timestamp }
    if (payload.type === "chat.message" && isPlainObject(payload.user) && isPlainObject(payload.message)) {
      return finalizeChat({
        platform: payload.platform,
        messageId: payload.id || payload.messageId,
        userId: payload.user.id,
        displayName: payload.user.displayName || payload.user.name || payload.user.username,
        text: payload.message.text,
        timestamp: payload.timestamp,
        isBot: payload.user.isBot
      });
    }

    // Twitch EventSub channel.chat.message, raw event or common envelope forms.
    const twitchEvent = findNestedEvent(payload, candidate =>
      isPlainObject(candidate) &&
      candidate.chatter_user_id != null &&
      isPlainObject(candidate.message) &&
      typeof candidate.message.text === "string"
    );
    if (twitchEvent) {
      return finalizeChat({
        platform: "twitch",
        messageId: twitchEvent.message_id,
        userId: twitchEvent.chatter_user_id,
        displayName: twitchEvent.chatter_user_name || twitchEvent.chatter_user_login,
        text: twitchEvent.message.text,
        timestamp: twitchEvent.timestamp || payload.timestamp,
        isBot: false
      });
    }

    // YouTube LiveChatMessage resource.
    if (
      payload.kind === "youtube#liveChatMessage" ||
      (isPlainObject(payload.snippet) && isPlainObject(payload.authorDetails))
    ) {
      const snippet = payload.snippet || {};
      const text = snippet.displayMessage ||
        (snippet.textMessageDetails && snippet.textMessageDetails.messageText) || "";
      return finalizeChat({
        platform: "youtube",
        messageId: payload.id,
        userId: payload.authorDetails && payload.authorDetails.channelId,
        displayName: payload.authorDetails && payload.authorDetails.displayName,
        text,
        timestamp: snippet.publishedAt,
        isBot: false
      });
    }

    // Kick chat.message.sent webhook payload.
    if (payload.message_id != null && isPlainObject(payload.sender) && typeof payload.content === "string") {
      return finalizeChat({
        platform: "kick",
        messageId: payload.message_id,
        userId: payload.sender.user_id,
        displayName: payload.sender.username,
        text: payload.content,
        timestamp: payload.created_at,
        isBot: false
      });
    }

    // Common wrapper: { data: { ...actual event... } }
    if (isPlainObject(payload.data)) {
      const nested = normalizeChatPayload(payload.data, depth + 1);
      if (nested) return nested;
    }

    // Generic flat / lightly nested format.
    const user = isPlainObject(payload.user) ? payload.user : {};
    const sender = isPlainObject(payload.sender) ? payload.sender : {};
    const author = isPlainObject(payload.author) ? payload.author : {};
    const message = isPlainObject(payload.message) ? payload.message : {};

    return finalizeChat({
      platform: firstText(payload.platform, payload.source, payload.service, payload.provider, "unknown"),
      messageId: firstText(payload.messageId, payload.message_id, payload.id),
      userId: firstText(
        payload.userId,
        payload.user_id,
        user.id,
        user.userId,
        sender.id,
        sender.user_id,
        author.id,
        author.channelId
      ),
      displayName: firstText(
        payload.username,
        payload.displayName,
        payload.name,
        user.displayName,
        user.username,
        user.name,
        sender.username,
        sender.displayName,
        sender.name,
        author.displayName,
        author.username,
        author.name,
        "anonymous"
      ),
      text: firstText(
        typeof payload.message === "string" ? payload.message : "",
        payload.text,
        payload.content,
        payload.body,
        message.text,
        message.content
      ),
      timestamp: firstText(payload.timestamp, payload.createdAt, payload.created_at, payload.sentAt),
      isBot: Boolean(payload.isBot || user.isBot || sender.isBot || author.isBot)
    });
  }

  function findNestedEvent(payload, predicate) {
    if (predicate(payload)) return payload;
    for (const key of ["event", "payload"]) {
      if (isPlainObject(payload[key])) {
        if (predicate(payload[key])) return payload[key];
        if (isPlainObject(payload[key].event) && predicate(payload[key].event)) return payload[key].event;
      }
    }
    return null;
  }

  function finalizeChat(raw) {
    const text = raw.text == null ? "" : String(raw.text).trim();
    const displayName = raw.displayName == null ? "anonymous" : String(raw.displayName).trim();
    if (!text) return null;
    return {
      platform: normalizePlatform(raw.platform),
      messageId: raw.messageId == null ? "" : String(raw.messageId),
      userId: raw.userId == null ? "" : String(raw.userId),
      displayName: displayName || "anonymous",
      text,
      timestamp: raw.timestamp == null ? "" : String(raw.timestamp),
      isBot: Boolean(raw.isBot)
    };
  }

  function firstText(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  }

  function normalizePlatform(value) {
    const text = String(value || "unknown").trim().toLowerCase();
    if (text.includes("twitch")) return "twitch";
    if (text.includes("youtube") || text === "yt") return "youtube";
    if (text.includes("kick")) return "kick";
    return text || "unknown";
  }

  function isDuplicateMessage(chat) {
    if (!chat.messageId) return false;
    const key = `${chat.platform}:${chat.messageId}`;
    if (state.seenMessageIds.has(key)) return true;

    state.seenMessageIds.set(key, Date.now());
    const limit = state.config.websocket.dedupeCacheSize;
    if (state.seenMessageIds.size > limit) {
      const overflow = state.seenMessageIds.size - limit;
      let removed = 0;
      for (const seenKey of state.seenMessageIds.keys()) {
        state.seenMessageIds.delete(seenKey);
        removed += 1;
        if (removed >= overflow) break;
      }
    }
    return false;
  }

  function handleChat(chat) {
    if (state.phase === "question") expireRoundIfNeeded();

    const triviaArgument = commandArgument(chat.text, state.config.commands.trivia);
    if (triviaArgument !== null) {
      if (!consumeCommandCooldown(chat, "trivia")) return;
      handleTriviaCommand(triviaArgument);
      return;
    }

    const leaderboardArgument = commandArgument(chat.text, state.config.commands.leaderboard);
    if (leaderboardArgument !== null) {
      if (!consumeCommandCooldown(chat, "leaderboard")) return;
      handleLeaderboardCommand(leaderboardArgument);
      return;
    }

    if (state.phase === "question" && state.activeRound) {
      handleAnswer(chat);
    }
  }

  function commandArgument(text, command) {
    const trimmed = String(text).trim();
    const firstSpace = trimmed.search(/\s/);
    const head = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase();
    if (head !== command.toLowerCase()) return null;
    return firstSpace === -1 ? "" : trimmed.slice(firstSpace).trim();
  }

  function consumeCommandCooldown(chat, commandName) {
    const cooldown = state.config.commands.perUserCooldownMs;
    if (cooldown <= 0) return true;
    const key = `${playerKey(chat)}:${commandName}`;
    const now = Date.now();
    const last = state.commandCooldowns.get(key) || 0;
    if (now - last < cooldown) return false;
    state.commandCooldowns.set(key, now);
    return true;
  }

  function handleTriviaCommand(argument) {
    if (state.phase === "question") return;

    let categoryId = null;
    if (argument) {
      const category = findCategory(argument);
      if (!category) {
        showActivity(
          "?",
          "Unknown category",
          `Try: ${listEnabledCategoryNames().join(" • ")}`,
          4200,
          "info"
        );
        return;
      }
      categoryId = category.id;
    }

    startRound(categoryId);
  }

  function handleLeaderboardCommand(argument) {
    const now = Date.now();
    const globalCooldown = state.config.commands.leaderboardGlobalCooldownMs;
    if (now - state.lastLeaderboardShownAt < globalCooldown && !dom.leaderboardCard.classList.contains("is-hidden")) {
      return;
    }

    let categoryId = null;
    if (argument) {
      const category = findCategory(argument);
      if (!category) {
        showActivity(
          "?",
          "Unknown leaderboard category",
          `Try: ${listEnabledCategoryNames().join(" • ")}`,
          4200,
          "info"
        );
        return;
      }
      categoryId = category.id;
    }

    state.lastLeaderboardShownAt = now;
    showLeaderboard(categoryId);
  }

  function startRound(categoryId = null) {
    clearTimeout(state.autoContinueTimeout);
    clearTimeout(state.resultTimeout);
    hideResult();

    const selection = pickQuestion(categoryId);
    if (!selection) {
      showActivity("!", "No playable question", "Check questions.json and category settings.", 4500, "error");
      return;
    }

    const { category, question } = selection;
    const startedAt = Date.now();
    const durationMs = question.durationSeconds * 1000;
    state.roundNumber += 1;
    state.phase = "question";
    state.activeRound = {
      id: state.roundNumber,
      category,
      question,
      startedAt,
      endsAt: startedAt + durationMs,
      winners: new Map()
    };

    renderQuestion();
    scheduleRoundEnd();
    animateTimer();
  }

  function scheduleRoundEnd() {
    clearTimeout(state.roundTimeout);
    if (!state.activeRound) return;
    const remaining = Math.max(0, state.activeRound.endsAt - Date.now());
    state.roundTimeout = setTimeout(() => finishRound("timeout"), remaining + 10);
  }

  function expireRoundIfNeeded() {
    if (state.phase !== "question" || !state.activeRound) return false;
    if (Date.now() < state.activeRound.endsAt) return false;
    finishRound("timeout");
    return true;
  }

  function handleAnswer(chat) {
    const round = state.activeRound;
    if (!round || Date.now() >= round.endsAt) {
      expireRoundIfNeeded();
      return;
    }

    const normalizedAttempt = normalizeAnswer(chat.text);
    if (!round.question.normalizedAnswers.includes(normalizedAttempt)) return;

    const key = playerKey(chat);
    if (state.config.game.oneAwardPerUserPerQuestion && round.winners.has(key)) return;

    const player = awardPoints(chat, round.category.id, round.question.points);
    round.winners.set(key, {
      displayName: player.displayName,
      platform: player.platform,
      awardedAt: Date.now(),
      points: round.question.points
    });

    updateWinnerCount();
    showActivity(
      "✓",
      `${player.displayName} got it!`,
      `+${round.question.points} points • ${platformLabel(player.platform)}`,
      2400,
      "success"
    );

    if (state.config.rewards.enabled) {
      issueRewardLink(player).then(record => {
        if (!record) return;
        showActivity(
          "🎁",
          `${record.username} won a reward!`,
          `Link ready to copy • ${record.filename}`,
          5600,
          "success"
        );
      }).catch(error => {
        console.error("[trivia] Could not issue reward link:", error);
        showActivity("!", "Reward link could not be saved", "Check the local Reward Links page and widget server.", 5600, "error");
      });
    }

    if (!dom.leaderboardCard.classList.contains("is-hidden")) {
      renderLeaderboard(state.leaderboardFilterCategoryId);
    }

    const maxWinners = state.config.game.maxWinnersPerQuestion;
    if (state.config.game.answerMode === "first_correct") {
      finishRound("first_correct");
    } else if (maxWinners > 0 && round.winners.size >= maxWinners) {
      finishRound("winner_limit");
    }
  }

  function finishRound(reason) {
    if (state.phase !== "question" || !state.activeRound) return;

    const round = state.activeRound;
    state.phase = "result";
    state.activeRound = null;
    clearTimeout(state.roundTimeout);
    cancelAnimationFrame(state.timerAnimationFrame);
    state.timerAnimationFrame = null;
    hideQuestion();

    const winnerCount = round.winners.size;
    const answer = round.question.answers[0];
    let kicker = "ROUND OVER";
    let main = `Answer: ${answer}`;
    let sub = "";

    if (reason === "first_correct" && winnerCount > 0) {
      const first = [...round.winners.values()][0];
      kicker = "FIRST CORRECT";
      main = `${first.displayName} +${first.points}`;
      sub = `Answer: ${answer}`;
    } else if (winnerCount === 0) {
      kicker = "TIME'S UP";
      sub = round.question.explanation || "Nobody scored this round.";
    } else {
      sub = `${winnerCount} ${winnerCount === 1 ? "player" : "players"} scored this round.`;
      if (round.question.explanation) sub += ` ${round.question.explanation}`;
    }

    showResult(kicker, main, sub);

    clearTimeout(state.resultTimeout);
    state.resultTimeout = setTimeout(() => {
      hideResult();
      state.phase = "idle";
    }, state.config.game.resultVisibleMs);

    if (state.config.game.autoContinue) {
      clearTimeout(state.autoContinueTimeout);
      state.autoContinueTimeout = setTimeout(() => {
        if (state.phase !== "question") startRound(round.category.id);
      }, state.config.game.autoContinueDelayMs);
    }
  }

  function renderQuestion() {
    const round = state.activeRound;
    if (!round) return;

    document.documentElement.style.setProperty("--accent", round.category.accent);
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(round.category.accent, 0.18));
    dom.categoryIcon.textContent = round.category.icon || "";
    dom.categoryIcon.classList.toggle("is-hidden", !round.category.icon);
    dom.categoryName.textContent = round.category.name;
    dom.questionText.textContent = round.question.prompt;
    dom.pointsText.textContent = `+${round.question.points} pts`;

    if (round.question.difficulty) {
      dom.difficulty.textContent = round.question.difficulty;
      dom.difficulty.classList.remove("is-hidden");
    } else {
      dom.difficulty.classList.add("is-hidden");
    }

    updateWinnerCount();
    dom.timerBar.style.transform = "scaleX(1)";
    dom.questionCard.classList.remove("is-hidden");
  }

  function updateWinnerCount() {
    const round = state.activeRound;
    if (!round) return;
    const count = round.winners.size;
    if (count === 0) {
      dom.winnerCount.textContent = "Answer in chat";
    } else {
      dom.winnerCount.textContent = `${count} correct so far`;
    }
  }

  function animateTimer() {
    cancelAnimationFrame(state.timerAnimationFrame);

    const tick = () => {
      const round = state.activeRound;
      if (!round || state.phase !== "question") return;
      const total = Math.max(1, round.endsAt - round.startedAt);
      const remainingMs = Math.max(0, round.endsAt - Date.now());
      const ratio = Math.max(0, Math.min(1, remainingMs / total));
      dom.timerBar.style.transform = `scaleX(${ratio})`;
      dom.timeText.textContent = `${Math.max(0, Math.ceil(remainingMs / 1000))}s`;

      if (remainingMs <= 0) {
        finishRound("timeout");
        return;
      }
      state.timerAnimationFrame = requestAnimationFrame(tick);
    };

    state.timerAnimationFrame = requestAnimationFrame(tick);
  }

  function hideQuestion() {
    dom.questionCard.classList.add("is-hidden");
  }

  function showResult(kicker, main, sub) {
    dom.resultKicker.textContent = kicker;
    dom.resultMain.textContent = main;
    dom.resultSub.textContent = sub || "";
    dom.resultSub.classList.toggle("is-hidden", !sub);
    dom.resultCard.classList.remove("is-hidden");
  }

  function hideResult() {
    dom.resultCard.classList.add("is-hidden");
  }

  function showActivity(icon, title, sub, visibleMs = 2500, tone = "success") {
    clearTimeout(state.activityTimeout);
    dom.activityIcon.textContent = icon;
    dom.activityTitle.textContent = title;
    dom.activitySub.textContent = sub || "";
    dom.activitySub.classList.toggle("is-hidden", !sub);

    if (tone === "error") {
      dom.activityIcon.style.background = "var(--danger)";
      dom.activityIcon.style.color = "#fff";
    } else if (tone === "info") {
      dom.activityIcon.style.background = "var(--accent)";
      dom.activityIcon.style.color = "#fff";
    } else {
      dom.activityIcon.style.background = "var(--success)";
      dom.activityIcon.style.color = "#07130c";
    }

    dom.activityCard.classList.remove("is-hidden");
    state.activityTimeout = setTimeout(() => {
      dom.activityCard.classList.add("is-hidden");
    }, visibleMs);
  }

  function showLeaderboard(categoryId = null) {
    state.leaderboardFilterCategoryId = categoryId;
    renderLeaderboard(categoryId);
    dom.leaderboardCard.classList.remove("is-hidden");
    clearTimeout(state.leaderboardTimeout);
    state.leaderboardTimeout = setTimeout(() => {
      dom.leaderboardCard.classList.add("is-hidden");
      state.leaderboardFilterCategoryId = null;
    }, state.config.leaderboard.visibleMs);
  }

  function renderLeaderboard(categoryId = null) {
    const category = categoryId ? state.categoriesById.get(categoryId) : null;
    dom.leaderboardTitle.textContent = category ? category.name : "Overall";
    dom.leaderboardScope.textContent = `Top ${state.config.leaderboard.size}`;
    dom.leaderboardRows.replaceChildren();

    const rows = sortedScores(categoryId);
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = category
        ? `No ${category.name} points yet.`
        : "No points yet. Start a round with !trivia.";
      dom.leaderboardRows.appendChild(empty);
      return;
    }

    rows.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";

      const rank = document.createElement("div");
      rank.className = "rank";
      rank.textContent = `#${index + 1}`;

      const playerWrap = document.createElement("div");
      playerWrap.className = "player";

      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.displayName;

      const platform = document.createElement("span");
      platform.className = "platform-tag";
      platform.textContent = platformLabel(player.platform);

      const score = document.createElement("div");
      score.className = "score";
      score.textContent = `${player.score} pts`;

      playerWrap.append(name, platform);
      row.append(rank, playerWrap, score);
      dom.leaderboardRows.appendChild(row);
    });
  }

  function platformLabel(platform) {
    switch (normalizePlatform(platform)) {
      case "twitch": return "TW";
      case "youtube": return "YT";
      case "kick": return "KICK";
      default: return String(platform || "CHAT").slice(0, 5).toUpperCase();
    }
  }

  function hexToRgba(hex, alpha) {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) return `rgba(139, 92, 246, ${alpha})`;
    const [r, g, b] = match.slice(1).map(value => parseInt(value, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function showFatalError(title, detail) {
    state.phase = "error";
    hideQuestion();
    hideResult();
    dom.activityCard.classList.add("is-hidden");
    dom.leaderboardCard.classList.add("is-hidden");
    dom.errorTitle.textContent = title;
    dom.errorDetail.textContent = detail;
    dom.errorCard.classList.remove("is-hidden");
  }

  function resetScores() {
    state.scores.clear();
    persistScores();
    if (!dom.leaderboardCard.classList.contains("is-hidden")) {
      renderLeaderboard(state.leaderboardFilterCategoryId);
    }
  }

  function injectChat(platform, displayName, text, options = {}) {
    const chat = finalizeChat({
      platform,
      displayName,
      text,
      userId: options.userId || "",
      messageId: options.messageId || "",
      timestamp: options.timestamp || "",
      isBot: Boolean(options.isBot)
    });
    if (chat) handleChat(chat);
  }

  function publicState() {
    const round = state.activeRound;
    return {
      phase: state.phase,
      connected: state.socketConnected,
      activeRound: round ? {
        categoryId: round.category.id,
        questionId: round.question.id,
        prompt: round.question.prompt,
        endsAt: round.endsAt,
        winners: round.winners.size
      } : null,
      scoreCount: state.scores.size
    };
  }

  async function init() {
    try {
      const configRaw = await fetchJson("config.json", "config.json");
      state.config = sanitizeConfig(applyQueryOverrides(deepMerge(DEFAULT_CONFIG, configRaw)));
      applyDisplayConfig();

      const bankRaw = await fetchJson(state.config.questionsUrl, "question bank");
      state.bank = validateQuestionBank(bankRaw);
      if (state.config.rewards.enabled) {
        const rewardRaw = await fetchJson(state.config.rewards.catalogUrl, "reward catalog");
        state.rewardCatalog = validateRewardCatalog(rewardRaw);
      }
      buildCategoryIndex();
      loadScores();

      state.phase = "idle";
      connectSocket();

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && state.phase === "question") {
          if (!expireRoundIfNeeded()) animateTimer();
        }
      });

      window.addEventListener("beforeunload", () => {
        state.shuttingDown = true;
        clearTimeout(state.socketReconnectTimeout);
        closeSocket(true);
      });

      window.TriviaWidget = {
        version: "2.1.0-rewards",
        injectChat,
        startRound: category => {
          if (state.phase === "question") return false;
          if (!category) {
            startRound(null);
            return true;
          }
          const match = findCategory(category);
          if (!match) return false;
          startRound(match.id);
          return true;
        },
        showLeaderboard: category => {
          if (!category) {
            showLeaderboard(null);
            return true;
          }
          const match = findCategory(category);
          if (!match) return false;
          showLeaderboard(match.id);
          return true;
        },
        resetScores,
        getScores: category => {
          const match = category ? findCategory(category) : null;
          return sortedScores(match ? match.id : null).map(player => ({
            platform: player.platform,
            displayName: player.displayName,
            score: player.score,
            correctAnswers: player.correctAnswers
          }));
        },
        getState: publicState,
        reconnect: connectSocket
      };

      console.info("[trivia] Ready.", {
        websocket: state.config.websocket.url,
        categories: listEnabledCategoryNames(),
        storage: state.storageAvailable ? "localStorage" : "memory"
      });
    } catch (error) {
      console.error("[trivia] Startup failed:", error);
      const detail = String(error && error.message ? error.message : error);
      showFatalError("Could not start trivia", detail);
    }
  }

  init();
})();
