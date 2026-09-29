(() => {
  "use strict";

  const POSTS_URL = "/blog/posts.json";
  const DRAFT_DB_NAME = "kazvt-blog-drafts";
  const DRAFT_DB_VERSION = 1;
  const DRAFT_STORE = "drafts";
  const DRAFT_FALLBACK_KEY = "kazvt-blog-drafts-fallback-v1";
  const MAX_POSTS = 5000;
  const MAX_DELTA_OPS = 5000;
  const MAX_POST_TEXT = 120000;
  const MAX_DATA_IMAGE_CHARS = 1600000;
  const MAX_IMAGE_FILE_BYTES = 12 * 1024 * 1024;
  const MAX_GIF_FILE_BYTES = 1100000;
  const MAX_OPTIMIZED_IMAGE_BYTES = 1050000;
  const THEME_LABELS = Object.freeze({
    p1: "palette one", p2: "palette two", p3: "palette three", p4: "palette four",
    p5: "palette five", p6: "palette six", p7: "palette seven", p8: "palette eight",
    p9: "palette nine", p10: "palette ten", p11: "palette eleven", p12: "palette twelve",
    p13: "palette thirteen", p14: "palette fourteen", p15: "palette fifteen", p16: "palette sixteen",
  });

  const Quill = window.Quill;
  const Delta = Quill?.import("delta");
  let draftDatabasePromise;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setStatus(node, message, kind = "") {
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100)
      .replace(/-+$/g, "");
  }

  function isValidSlug(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
  }

  function safeWebURL(value, { allowHttp = true, allowMail = true } = {}) {
    const raw = String(value || "").trim();
    if (!raw || raw.length > 2048 || /[\u0000-\u001f\u007f]/.test(raw)) return "";
    if (allowMail && /^(mailto:|tel:)/i.test(raw)) {
      return /^[a-z]+:/i.test(raw) ? raw : "";
    }
    try {
      const parsed = new URL(raw, window.location.origin);
      const allowed = allowHttp ? ["https:", "http:"] : ["https:"];
      if (!allowed.includes(parsed.protocol) || parsed.username || parsed.password) return "";
      if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function safeImageURL(value) {
    const raw = String(value || "").trim();
    if (raw.length > MAX_DATA_IMAGE_CHARS) return "";
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/]+=*$/i.test(raw)) return raw;
    return safeWebURL(raw, { allowHttp: false, allowMail: false });
  }

  function parseVideoURL(value) {
    const safe = safeWebURL(value, { allowHttp: false, allowMail: false });
    if (!safe) return null;
    let url;
    try {
      url = new URL(safe);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
    }
    if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return {
        kind: "iframe",
        provider: "YouTube",
        url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,
      };
    }

    if (["vimeo.com", "player.vimeo.com"].includes(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      id = host === "player.vimeo.com" && parts[0] === "video" ? parts[1] || "" : parts.at(-1) || "";
      if (/^\d{1,15}$/.test(id)) {
        return {
          kind: "iframe",
          provider: "Vimeo",
          url: `https://player.vimeo.com/video/${id}?dnt=1`,
        };
      }
    }

    if (host === "open.spotify.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (/^intl-[a-z]{2}$/i.test(parts[0] || "")) parts.shift();
      if (parts[0] === "embed") parts.shift();
      const type = parts[0] || "";
      id = parts[1] || "";
      if (parts.length === 2 && ["track", "album", "playlist", "episode", "show", "artist"].includes(type)
        && /^[a-zA-Z0-9]{10,64}$/.test(id)) {
        return {
          kind: "iframe",
          provider: "Spotify",
          url: `https://open.spotify.com/embed/${type}/${id}`,
        };
      }
    }

    if (url.hostname.toLowerCase() === "w.soundcloud.com" && url.pathname === "/player/") {
      const sharedURL = url.searchParams.get("url");
      if (sharedURL) return parseVideoURL(sharedURL);
    }

    if (host === "soundcloud.com") {
      const path = url.pathname.split("/").filter(Boolean);
      if (path.length && path.every((part) => /^[a-zA-Z0-9_!().-]{1,100}$/.test(part))) {
        const trackURL = `https://soundcloud.com/${path.map(encodeURIComponent).join("/")}`;
        return {
          kind: "iframe",
          provider: "SoundCloud",
          url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackURL)}&auto_play=false&show_artwork=true`,
        };
      }
    }

    if (/\.(?:mp4|webm)$/i.test(url.pathname)) {
      url.hash = "";
      return { kind: "file", provider: "video", url: url.href };
    }
    return null;
  }

  if (Quill && Delta && !window.KazvtBlogVideoRegistered) {
    const BlockEmbed = Quill.import("blots/block/embed");
    class BlogVideoBlot extends BlockEmbed {
      static blotName = "video";
      static tagName = "DIV";
      static className = "blog-video-embed";

      static create(value) {
        const node = super.create();
        const media = parseVideoURL(value);
        node.setAttribute("contenteditable", "false");
        if (!media) {
          node.dataset.videoUrl = "";
          node.setAttribute("aria-label", "Unsupported video embed");
          return node;
        }
        node.dataset.videoUrl = media.url;
        node.dataset.videoProvider = media.provider;

        const card = make("div", "blog-video-card");
        const mediaName = media.kind === "file"
          ? "MP4/WebM video"
          : ["YouTube", "Vimeo"].includes(media.provider) ? `${media.provider} video` : `${media.provider} embed`;
        const note = make("p", "", `${mediaName} stays unloaded until you choose to connect to it.`);
        const load = make("button", "blog-video-load", `load ${mediaName}`);
        load.type = "button";
        load.setAttribute("aria-label", `Load ${mediaName}. This contacts the media source.`);
        load.addEventListener("click", (event) => {
          event.preventDefault();
          if (media.kind === "file") {
            const video = make("video");
            video.controls = true;
            video.preload = "none";
            video.src = media.url;
            node.replaceChildren(video);
            video.focus?.();
          } else {
            const frame = make("iframe");
            frame.src = media.url;
            frame.title = ["YouTube", "Vimeo"].includes(media.provider)
              ? `${media.provider} video player`
              : `${media.provider} embed`;
            frame.loading = "eager";
            frame.referrerPolicy = "strict-origin-when-cross-origin";
            frame.setAttribute("allow", "clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share");
            frame.setAttribute("allowfullscreen", "");
            frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups");
            node.replaceChildren(frame);
          }
        });
        card.append(note, load);
        node.append(card);
        return node;
      }

      static value(node) {
        return node.dataset.videoUrl || "";
      }
    }
    Quill.register(BlogVideoBlot, true);
    window.KazvtBlogVideoRegistered = true;
  }

  function normalizeTextAttributes(attributes = {}) {
    const safe = {};
    for (const key of ["bold", "italic", "underline", "strike", "code"]) {
      if (attributes[key] === true) safe[key] = true;
    }
    if (typeof attributes.link === "string") {
      const link = safeWebURL(attributes.link);
      if (link) safe.link = link;
    }
    if ([1, 2, 3].includes(Number(attributes.header))) safe.header = Number(attributes.header);
    if (["ordered", "bullet"].includes(attributes.list)) safe.list = attributes.list;
    if (attributes.blockquote === true) safe.blockquote = true;
    if (attributes["code-block"] === true) safe["code-block"] = true;
    if (["center", "right", "justify"].includes(attributes.align)) safe.align = attributes.align;
    return safe;
  }

  function sanitizeDelta(raw) {
    const source = Array.isArray(raw?.ops) ? raw.ops.slice(0, MAX_DELTA_OPS) : [];
    const safeOps = [];
    let textLength = 0;
    for (const operation of source) {
      if (!operation || !Object.hasOwn(operation, "insert")) continue;
      const attributes = operation.attributes && typeof operation.attributes === "object" ? operation.attributes : {};
      if (typeof operation.insert === "string") {
        const value = operation.insert.replace(/\u0000/g, "");
        textLength += value.length;
        if (textLength > MAX_POST_TEXT) break;
        const safeAttributes = normalizeTextAttributes(attributes);
        safeOps.push(Object.keys(safeAttributes).length ? { insert: value, attributes: safeAttributes } : { insert: value });
        continue;
      }
      if (!operation.insert || typeof operation.insert !== "object") continue;
      if (typeof operation.insert.image === "string") {
        const src = safeImageURL(operation.insert.image);
        if (!src) continue;
        const alt = typeof attributes.alt === "string" ? attributes.alt.slice(0, 250) : "";
        safeOps.push({ insert: { image: src }, attributes: { alt } });
        continue;
      }
      if (typeof operation.insert.video === "string") {
        const media = parseVideoURL(operation.insert.video);
        if (media) safeOps.push({ insert: { video: media.url } });
      }
    }
    if (!safeOps.length) return { ops: [{ insert: "\n" }] };
    const last = safeOps.at(-1);
    if (typeof last.insert !== "string" || !last.insert.endsWith("\n")) safeOps.push({ insert: "\n" });
    return { ops: safeOps };
  }

  function normalizeTags(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    const seen = new Set();
    const tags = [];
    for (const raw of values) {
      const tag = String(raw || "").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= 12) break;
    }
    return tags;
  }

  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizePost(raw) {
    if (!raw || typeof raw !== "object") throw new Error("post is not an object");
    const title = String(raw.title || "").trim().slice(0, 180);
    const slug = String(raw.slug || "").trim();
    const published = parseDate(raw.publishedAt);
    if (!title) throw new Error("post title is missing");
    if (!isValidSlug(slug)) throw new Error(`invalid post address: ${slug || "(blank)"}`);
    if (!published) throw new Error(`invalid published date for ${slug}`);
    const updated = parseDate(raw.updatedAt) || published;
    return {
      slug,
      title,
      summary: String(raw.summary || "").trim().slice(0, 360),
      tags: normalizeTags(raw.tags),
      publishedAt: published.toISOString(),
      updatedAt: updated.toISOString(),
      content: sanitizeDelta(raw.content),
    };
  }

  function normalizeManifest(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.posts)) {
      throw new Error("expected an object with a posts array");
    }
    if (raw.posts.length > MAX_POSTS) throw new Error(`manifest exceeds ${MAX_POSTS} posts`);
    const seen = new Set();
    const posts = [];
    const errors = [];
    raw.posts.forEach((item, index) => {
      try {
        const post = normalizePost(item);
        if (seen.has(post.slug)) throw new Error(`duplicate post address: ${post.slug}`);
        seen.add(post.slug);
        posts.push(post);
      } catch (error) {
        errors.push(`post ${index + 1}: ${error.message}`);
      }
    });
    return { schema_version: 1, posts, errors };
  }

  function plainText(content) {
    return sanitizeDelta(content).ops
      .map((operation) => typeof operation.insert === "string" ? operation.insert : " ")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formattedDate(value) {
    const date = parseDate(value);
    if (!date) return "date unavailable";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function makeTime(value, className = "") {
    const date = parseDate(value);
    const node = make("time", className, formattedDate(value));
    if (date) node.dateTime = date.toISOString();
    return node;
  }

  function makePanel(title, stamp = "") {
    const section = make("section", "panel scribble-box blog-panel");
    const header = make("header", "panel-head");
    const strong = make("strong", "", title);
    header.append(strong);
    if (stamp) header.append(make("span", "panel-stamp", stamp));
    section.append(header);
    return section;
  }

  function syncBlogPageMetadata() {
    const isWriter = document.body.dataset.page === "blog-write";
    const article = $(".blog-article");
    const postTitle = article?.querySelector("h2")?.textContent?.trim();
    const title = isWriter ? "post desk.exe // kazvt" : postTitle ? `${postTitle} // kazvt blog` : "blog.exe // kazvt";
    const summary = article?.querySelector(".blog-post-summary")?.textContent?.trim()
      || article?.querySelector(".blog-rich-content .ql-editor")?.textContent?.trim().slice(0, 155);
    document.title = title;
    const description = summary || (isWriter
      ? "Write, preview, and export posts for the kazvt blog."
      : "Notes, experiments, and dispatches from kaz's treehouse.");
    const metaDescription = $("meta[name=description]");
    if (metaDescription) metaDescription.content = description;
    const ogTitle = $("meta[property='og:title']");
    if (ogTitle) ogTitle.content = title;
    const ogDescription = $("meta[property='og:description']");
    if (ogDescription) ogDescription.content = description;
  }

  window.addEventListener("kazvt:i18nready", syncBlogPageMetadata);
  window.addEventListener("kazvt:languagechange", syncBlogPageMetadata);

  function buildTagLinks(tags) {
    const wrapper = make("div", "blog-post-tags");
    tags.forEach((tag) => {
      const link = make("a", "blog-tag-chip", `#${tag}`);
      const url = new URL("/blog/", window.location.origin);
      url.searchParams.set("tag", tag);
      link.href = `${url.pathname}${url.search}`;
      link.setAttribute("aria-label", `Show posts tagged ${tag}`);
      wrapper.append(link);
    });
    return wrapper;
  }

  function renderRichContent(host, content) {
    if (!Quill) {
      host.textContent = plainText(content);
      return;
    }
    host.classList.add("blog-rich-content");
    const editor = new Quill(host, {
      theme: "snow",
      readOnly: true,
      modules: { toolbar: false, history: false },
    });
    editor.setContents(sanitizeDelta(content));
    editor.disable();
    editor.root.setAttribute("aria-label", "Post content");
    editor.root.querySelectorAll("img").forEach((image) => {
      image.loading = "lazy";
      image.decoding = "async";
    });
    editor.root.querySelectorAll("a").forEach((link) => {
      link.rel = "noopener noreferrer";
      link.target = "_blank";
    });
  }

  function videoEmbed(slug) {
    const params = new URLSearchParams();
    params.set("post", slug);
    return `/blog/?${params.toString()}`;
  }

  async function loadPublishedManifest() {
    const response = await fetch(`${POSTS_URL}?v=1`, { cache: "no-store" });
    if (!response.ok) throw new Error(`posts.json returned ${response.status}`);
    const manifest = normalizeManifest(await response.json());
    if (manifest.errors.length) console.warn("Some blog posts were skipped:", manifest.errors);
    return manifest;
  }

  function initializeArchive(root) {
    const intro = $(".blog-panel", root);
    root.setAttribute("aria-busy", "true");
    loadPublishedManifest().then((manifest) => {
      const posts = manifest.posts;
      const filterPanel = makePanel("find a post", "words + tags");
      const form = make("form", "blog-filter-form");
      form.setAttribute("role", "search");

      const searchRow = make("div", "blog-search-row");
      const searchField = make("div", "blog-field");
      const searchLabel = make("label", "", "search title, summary, tags, or text");
      searchLabel.htmlFor = "blog-search-query";
      const searchInput = make("input");
      searchInput.id = "blog-search-query";
      searchInput.type = "search";
      searchInput.name = "q";
      searchInput.autocomplete = "off";
      searchInput.maxLength = 120;
      searchField.append(searchLabel, searchInput);
      const submit = make("button", "blog-button blog-button-primary", "search posts");
      submit.type = "submit";
      searchRow.append(searchField, submit);
      form.append(searchRow);

      const tagSet = [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b));
      const tagFieldset = make("fieldset", "blog-filter-tags");
      const legend = make("legend", "", "filter by tag");
      const tagList = make("div", "blog-tag-list");
      tagFieldset.append(legend, tagList);
      if (tagSet.length) {
        tagSet.forEach((tag, index) => {
          const label = make("label", "blog-filter-chip");
          const checkbox = make("input");
          checkbox.type = "checkbox";
          checkbox.name = "tag";
          checkbox.value = tag;
          checkbox.id = `blog-filter-tag-${index}`;
          label.append(checkbox, make("span", "", `#${tag}`));
          tagList.append(label);
        });
        const hint = make("p", "blog-filter-hint", "When several tags are checked, a post matching any one of them is included.");
        tagFieldset.append(hint);
      } else {
        tagList.append(make("span", "blog-small-note", "no tags yet"));
      }
      form.append(tagFieldset);

      const filterOptions = make("div", "blog-filter-options");
      const sortField = make("div", "blog-field");
      const sortLabel = make("label", "", "sort by");
      sortLabel.htmlFor = "blog-sort-order";
      const sortSelect = make("select");
      sortSelect.id = "blog-sort-order";
      sortSelect.name = "sort";
      sortSelect.append(new Option("newest first", "newest"), new Option("oldest first", "oldest"));
      sortField.append(sortLabel, sortSelect);
      filterOptions.append(sortField);
      const filterActions = make("div", "blog-filter-actions");
      const clear = make("button", "blog-button", "clear filters");
      clear.type = "button";
      filterActions.append(clear);
      filterOptions.append(filterActions);
      form.append(filterOptions);
      filterPanel.append(form);

      const resultsPanel = makePanel("posts", "");
      const resultsHeader = make("div", "blog-results-head");
      const resultsTitle = make("h2", "", "the archive");
      const count = make("p", "blog-post-count");
      count.setAttribute("role", "status");
      count.setAttribute("aria-live", "polite");
      resultsHeader.append(resultsTitle, count);
      const results = make("div", "blog-results-list");
      resultsPanel.append(resultsHeader, results);

      const detail = make("div", "blog-detail-view");
      detail.hidden = true;
      root.replaceChildren(intro, filterPanel, resultsPanel, detail);

      function writeFilterURL() {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        const query = searchInput.value.trim();
        if (query) url.searchParams.set("q", query);
        $$("input[name=tag]:checked", form).forEach((checkbox) => url.searchParams.append("tag", checkbox.value));
        if (sortSelect.value === "oldest") url.searchParams.set("sort", "oldest");
        history.replaceState(history.state, "", `${url.pathname}${url.search}`);
      }

      function renderResults() {
        writeFilterURL();
        const query = searchInput.value.trim().toLocaleLowerCase();
        const selectedTags = new Set($$("input[name=tag]:checked", form).map((checkbox) => checkbox.value));
        const filtered = posts.filter((post) => {
          const body = plainText(post.content).toLocaleLowerCase();
          const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")} ${body}`.toLocaleLowerCase();
          const matchesQuery = !query || haystack.includes(query);
          const matchesTag = !selectedTags.size || post.tags.some((tag) => selectedTags.has(tag));
          return matchesQuery && matchesTag;
        }).sort((a, b) => {
          const difference = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
          return sortSelect.value === "oldest" ? difference : -difference;
        });

        count.textContent = `${filtered.length} ${filtered.length === 1 ? "post" : "posts"} found`;
        results.replaceChildren();
        if (!filtered.length) {
          const empty = make("div", "blog-empty");
          const heading = make("h3", "", posts.length ? "nothing in this corner" : "the blog is brand new");
          const message = make("p", "", posts.length
            ? "No posts match those filters. Try another word or clear the filters."
            : "The archive is ready for its first dispatch.");
          if (posts.length) {
            const actions = make("div", "blog-filter-actions");
            const reset = make("button", "blog-button", "clear filters");
            reset.type = "button";
            reset.addEventListener("click", clearFilters);
            actions.append(reset);
            empty.append(heading, message, actions);
          } else {
            empty.append(heading, message);
          }
          results.append(empty);
          return;
        }

        filtered.forEach((post) => {
          const card = make("article", "blog-post-card");
          const heading = make("h3");
          const link = make("a", "blog-post-title-link", post.title);
          link.href = videoEmbed(post.slug);
          link.dataset.blogPostLink = post.slug;
          heading.append(link);
          const meta = make("p", "blog-post-meta");
          meta.append(makeTime(post.publishedAt));
          if (Date.parse(post.updatedAt) - Date.parse(post.publishedAt) > 60000) {
            meta.append(make("span", "", "updated"), makeTime(post.updatedAt));
          }
          const summary = post.summary || plainText(post.content).slice(0, 220);
          card.append(heading, meta);
          if (summary) card.append(make("p", "blog-post-summary", summary));
          if (post.tags.length) card.append(buildTagLinks(post.tags));
          results.append(card);
        });
      }

      function clearFilters() {
        searchInput.value = "";
        sortSelect.value = "newest";
        $$("input[name=tag]", form).forEach((checkbox) => { checkbox.checked = false; });
        renderResults();
        searchInput.focus();
      }

      function applyURLFilters() {
        const params = new URLSearchParams(window.location.search);
        searchInput.value = (params.get("q") || "").slice(0, 120);
        sortSelect.value = params.get("sort") === "oldest" ? "oldest" : "newest";
        const selected = new Set(params.getAll("tag"));
        $$("input[name=tag]", form).forEach((checkbox) => { checkbox.checked = selected.has(checkbox.value); });
        renderResults();
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        renderResults();
      });
      sortSelect.addEventListener("change", renderResults);
      clear.addEventListener("click", clearFilters);

      function renderDetail(post) {
        detail.replaceChildren();
        if (!post) {
          const notFound = makePanel("lost post", "404-ish");
          notFound.append(make("p", "", "That post address is not in the current archive."));
          const back = make("a", "blog-action", "back to all posts →");
          back.href = "/blog/";
          notFound.append(back);
          detail.append(notFound);
          return;
        }
        const article = make("article", "panel scribble-box blog-panel blog-article");
        const header = make("header", "blog-article-head");
        const nav = make("a", "blog-text-button", "← all posts");
        nav.href = "/blog/";
        const title = make("h2", "", post.title);
        const meta = make("p", "blog-post-meta");
        meta.append(makeTime(post.publishedAt, "blog-published-time"));
        if (Date.parse(post.updatedAt) - Date.parse(post.publishedAt) > 60000) {
          meta.append(make("span", "", "updated"), makeTime(post.updatedAt));
        }
        header.append(nav, title, meta);
        article.append(header);
        if (post.summary) article.append(make("p", "blog-post-summary", post.summary));
        if (post.tags.length) article.append(buildTagLinks(post.tags));
        const content = make("div", "blog-rich-content");
        renderRichContent(content, post.content);
        article.append(content);
        const actions = make("div", "blog-article-actions");
        const permalink = make("a", "blog-button", "permalink");
        permalink.href = videoEmbed(post.slug);
        const copy = make("button", "blog-button", "copy post link");
        copy.type = "button";
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(new URL(permalink.href, window.location.href).href);
            setStatus(copy, "link copied");
          } catch {
            setStatus(copy, "copy blocked; use the address bar");
          }
        });
        actions.append(permalink, copy);
        article.append(actions);
        detail.append(article);
        document.title = `${post.title} // kazvt blog`;
        const description = $("meta[name=description]");
        if (description) description.content = post.summary || plainText(post.content).slice(0, 155);
        const ogTitle = $("meta[property='og:title']");
        if (ogTitle) ogTitle.content = `${post.title} // kazvt blog`;
        const ogDescription = $("meta[property='og:description']");
        if (ogDescription) ogDescription.content = post.summary || plainText(post.content).slice(0, 155);
      }

      function renderCurrentURL() {
        const params = new URLSearchParams(window.location.search);
        const postSlug = params.get("post");
        if (!postSlug) {
          detail.hidden = true;
          filterPanel.hidden = false;
          resultsPanel.hidden = false;
          document.title = "blog.exe // kazvt";
          const description = $("meta[name=description]");
          if (description) description.content = "Notes, experiments, and dispatches from kaz's treehouse.";
          const ogTitle = $("meta[property='og:title']");
          if (ogTitle) ogTitle.content = "blog.exe // kazvt";
          const ogDescription = $("meta[property='og:description']");
          if (ogDescription) ogDescription.content = "Notes, experiments, and dispatches from kaz's treehouse.";
          applyURLFilters();
          return;
        }
        filterPanel.hidden = true;
        resultsPanel.hidden = true;
        detail.hidden = false;
        renderDetail(posts.find((post) => post.slug === postSlug));
        window.scrollTo({ top: 0, behavior: "instant" });
      }

      root.addEventListener("click", (event) => {
        const link = event.target.closest("[data-blog-post-link]");
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState({}, "", link.href);
        renderCurrentURL();
      });
      window.addEventListener("popstate", renderCurrentURL);
      root.removeAttribute("aria-busy");
      renderCurrentURL();
    }).catch((error) => {
      console.error("Could not load the blog archive:", error);
      const panel = makePanel("the archive is unavailable", "try again");
      panel.append(make("p", "", "The post file could not be read. Please check back in a moment."));
      const retry = make("button", "blog-button", "reload posts");
      retry.type = "button";
      retry.addEventListener("click", () => window.location.reload());
      panel.append(retry);
      root.replaceChildren(intro, panel);
      root.removeAttribute("aria-busy");
    });
  }

  function localDateTimeValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function openDraftDatabase() {
    if (draftDatabasePromise) return draftDatabasePromise;
    draftDatabasePromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("browser storage is unavailable"));
        return;
      }
      const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
          request.result.createObjectStore(DRAFT_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("could not open browser storage"));
      request.onblocked = () => reject(new Error("close older blog tabs to open browser storage"));
    });
    return draftDatabasePromise;
  }

  function fallbackDrafts() {
    try {
      const raw = localStorage.getItem(DRAFT_FALLBACK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function removeFallbackDraft(id) {
    try {
      const drafts = fallbackDrafts().filter((draft) => draft.id !== id);
      if (drafts.length) localStorage.setItem(DRAFT_FALLBACK_KEY, JSON.stringify(drafts));
      else localStorage.removeItem(DRAFT_FALLBACK_KEY);
    } catch {}
  }

  async function getAllDrafts() {
    try {
      const db = await openDraftDatabase();
      const stored = await new Promise((resolve, reject) => {
        const transaction = db.transaction(DRAFT_STORE, "readonly");
        const request = transaction.objectStore(DRAFT_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error("could not read drafts"));
      });
      const merged = new Map(fallbackDrafts().map((draft) => [draft.id, draft]));
      stored.forEach((draft) => merged.set(draft.id, draft));
      return [...merged.values()];
    } catch {
      return fallbackDrafts();
    }
  }

  async function putDraft(record) {
    try {
      const db = await openDraftDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(DRAFT_STORE, "readwrite");
        transaction.objectStore(DRAFT_STORE).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("could not save draft"));
        transaction.onabort = () => reject(transaction.error || new Error("draft save was cancelled"));
      });
      removeFallbackDraft(record.id);
      return "browser database";
    } catch (error) {
      const drafts = fallbackDrafts().filter((draft) => draft.id !== record.id);
      drafts.push(record);
      try {
        localStorage.setItem(DRAFT_FALLBACK_KEY, JSON.stringify(drafts));
        return "browser storage";
      } catch {
        throw new Error(`draft could not be saved (${error.message})`);
      }
    }
  }

  async function deleteDraft(id) {
    try {
      const db = await openDraftDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(DRAFT_STORE, "readwrite");
        transaction.objectStore(DRAFT_STORE).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("could not delete draft"));
      });
    } catch {}
    removeFallbackDraft(id);
  }

  function readDraftById(id) {
    return getAllDrafts().then((drafts) => drafts.find((draft) => draft.id === id) || null);
  }

  async function optimizeImageFile(file) {
    if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("choose a JPG, PNG, GIF, or WebP image");
    if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error("that image is over 12 MB; resize it first");
    if (file.type === "image/gif") {
      if (file.size > MAX_GIF_FILE_BYTES) throw new Error("animated GIFs must be 1.1 MB or smaller to keep the post file portable");
      return await blobToDataURL(file);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("only JPG, PNG, GIF, and WebP images are supported");

    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("the browser could not read that image");
    }
    try {
      if (bitmap.width * bitmap.height > 35000000) throw new Error("that image is extremely large; resize it before inserting");
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("image optimization is unavailable in this browser");
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob) throw new Error("the browser could not optimize that image");
        if (blob.size <= MAX_OPTIMIZED_IMAGE_BYTES) return await blobToDataURL(blob);
      }
      throw new Error("optimized image is still too large; resize or crop it first");
    } finally {
      bitmap.close?.();
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("could not read the selected image"));
      reader.readAsDataURL(blob);
    });
  }

  function annotateToolbar(quill) {
    const toolbar = $("#blog-toolbar");
    if (!toolbar) return;
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Post formatting");
    const defaultLabels = {
      bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough",
      blockquote: "Block quote", "code-block": "Code block", link: "Insert link", clean: "Clear formatting",
    };
    $$("button", toolbar).forEach((button) => {
      const format = [...button.classList].find((value) => value.startsWith("ql-"))?.slice(3);
      if (format && defaultLabels[format]) {
        button.setAttribute("aria-label", defaultLabels[format]);
        button.title = defaultLabels[format];
      }
    });
    $(".ql-picker.ql-header .ql-picker-label", toolbar)?.setAttribute("aria-label", "Heading level");
    $(".ql-picker.ql-list .ql-picker-label", toolbar)?.setAttribute("aria-label", "List type");

    const controls = $$("button:not(:disabled), .ql-picker-label", toolbar);
    controls.forEach((control, index) => {
      control.tabIndex = index === 0 ? 0 : -1;
      control.addEventListener("focus", () => {
        controls.forEach((item) => { item.tabIndex = item === control ? 0 : -1; });
      });
    });
    toolbar.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      if (event.target.closest(".ql-picker.ql-expanded")) return;
      const index = controls.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0
        : event.key === "End" ? controls.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + controls.length) % controls.length;
      controls[next]?.focus();
    });
    $(".ql-tooltip input[data-link]", document)?.setAttribute("aria-label", "Link URL");
    quill.root.setAttribute("aria-label", "Post body editor. Use the formatting toolbar for headings, lists, links, images, and video.");
    quill.root.setAttribute("aria-labelledby", "blog-editor-label");
    quill.root.setAttribute("role", "textbox");
    quill.root.setAttribute("aria-multiline", "true");
  }

  function initializeWriter() {
    const form = $("#blog-editor-form");
    if (!form || !Quill || !Delta) return;

    const titleInput = $("#blog-title");
    const slugInput = $("#blog-slug");
    const summaryInput = $("#blog-summary");
    const tagsInput = $("#blog-tags");
    const publishedInput = $("#blog-published-at");
    const draftSelect = $("#blog-drafts-select");
    const publishedSelect = $("#blog-published-select");
    const saveStatus = $("#blog-save-status");
    const exportStatus = $("#blog-export-status");
    const previewSection = $("#blog-preview-section");
    const previewHost = $("#blog-preview");
    const imageDialog = $("#blog-image-dialog");
    const videoDialog = $("#blog-video-dialog");

    let workingPosts = [];
    let currentDraftId = createId();
    let currentPostSlug = "";
    let preparedFingerprint = "";
    let slugWasEdited = false;
    let isHydrating = false;
    let autoSaveTimer = 0;

    const quill = new Quill("#blog-quill", {
      theme: "snow",
      placeholder: "Start with a thought…",
      modules: {
        toolbar: {
          container: "#blog-toolbar",
          handlers: {
            link(value) {
              if (value) this.quill.theme.tooltip.edit("link", "https://");
              else this.quill.format("link", false);
            },
          },
        },
        history: { delay: 1000, maxStack: 100, userOnly: true },
        uploader: {
          mimetypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
          handler(range, files) {
            const input = $("#blog-image-file");
            const file = files[0];
            if (!input || !file) return;
            try {
              const transfer = new DataTransfer();
              transfer.items.add(file);
              input.files = transfer.files;
              $("#blog-image-url").value = "";
              $("#blog-image-alt").value = "";
              $("#blog-image-decorative").checked = false;
              $("#blog-image-error").textContent = files.length > 1
                ? "Add alt text for the first image. Paste or drop the others one at a time."
                : "Add alternative text before inserting this image.";
              quill.setSelection(range.index, range.length, "silent");
              openDialog(imageDialog);
              $("#blog-image-alt").focus();
            } catch {
              setStatus(saveStatus, "Use the image button to choose a file in this browser.", "warning");
            }
          },
        },
      },
    });
    annotateToolbar(quill);
    quill.clipboard.addMatcher("IMG", (node) => {
      const src = safeImageURL(node.getAttribute("src"));
      if (!src) return new Delta();
      const alt = String(node.getAttribute("alt") || "").slice(0, 250);
      return new Delta().insert({ image: src }, { alt });
    });
    quill.clipboard.addMatcher("IFRAME", (node) => {
      const media = parseVideoURL(node.getAttribute("src"));
      return media ? new Delta().insert({ video: media.url }) : new Delta();
    });

    function collectForm({ strict = false } = {}) {
      const title = titleInput.value.trim().slice(0, 180);
      const slug = slugInput.value.trim();
      const summary = summaryInput.value.trim().slice(0, 360);
      const tags = normalizeTags(tagsInput.value);
      const publishedDate = new Date(publishedInput.value);
      const content = sanitizeDelta(quill.getContents());
      if (strict) {
        if (!title) throw new Error("add a title first");
        if (!isValidSlug(slug)) throw new Error("the post address should use lowercase letters, numbers, and hyphens");
        if (Number.isNaN(publishedDate.getTime())) throw new Error("choose a valid published date and time");
        if (tagsInput.value.split(",").filter((tag) => tag.trim()).length > 12) throw new Error("use no more than 12 tags");
        if (!content.ops.some((operation) => typeof operation.insert === "object"
          || (typeof operation.insert === "string" && operation.insert.trim()))) {
          throw new Error("write something in the post body first");
        }
      }
      return {
        slug,
        title,
        summary,
        tags,
        publishedAt: Number.isNaN(publishedDate.getTime()) ? "" : publishedDate.toISOString(),
        content,
      };
    }

    function formFingerprint() {
      try { return JSON.stringify(collectForm()); } catch { return ""; }
    }

    function hasMeaningfulDraft() {
      const content = plainText(quill.getContents());
      return Boolean(titleInput.value.trim() || content || summaryInput.value.trim() || tagsInput.value.trim());
    }

    function refreshExportStatus() {
      $("[data-blog-post-count]").textContent = String(workingPosts.length);
      $("[data-blog-post-noun]").textContent = workingPosts.length === 1 ? "post" : "posts";
      const changed = hasMeaningfulDraft() && formFingerprint() !== preparedFingerprint;
      if (changed) {
        setStatus(exportStatus, "The current draft has changes not yet included in the export file. Add / update it before downloading.", "warning");
      } else {
        setStatus(exportStatus, `${workingPosts.length} ${workingPosts.length === 1 ? "post" : "posts"} in the export file. This is still local until you replace posts.json and push it.`, "ok");
      }
      updatePublishedSelect();
    }

    function updatePublishedSelect() {
      const selected = publishedSelect.value;
      publishedSelect.replaceChildren(new Option(workingPosts.length ? "choose a post…" : "no posts in export yet", ""));
      [...workingPosts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).forEach((post) => {
        publishedSelect.add(new Option(`${post.title} · ${new Date(post.publishedAt).toLocaleDateString()}`, post.slug));
      });
      publishedSelect.value = workingPosts.some((post) => post.slug === selected) ? selected : "";
    }

    async function refreshDraftSelect() {
      const selected = currentDraftId;
      const drafts = (await getAllDrafts()).sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
      draftSelect.replaceChildren(new Option(drafts.length ? "choose a saved draft…" : "no saved drafts yet", ""));
      drafts.forEach((draft) => {
        const label = draft.title?.trim() || "untitled draft";
        const date = parseDate(draft.savedAt)?.toLocaleString() || "";
        draftSelect.add(new Option(`${label}${date ? ` · ${date}` : ""}`, draft.id));
      });
      draftSelect.value = drafts.some((draft) => draft.id === selected) ? selected : "";
    }

    function draftSnapshot() {
      return {
        id: currentDraftId,
        title: titleInput.value,
        slug: slugInput.value,
        summary: summaryInput.value,
        tagsText: tagsInput.value,
        publishedAtLocal: publishedInput.value,
        content: sanitizeDelta(quill.getContents()),
        currentPostSlug,
        preparedFingerprint,
        savedAt: new Date().toISOString(),
      };
    }

    async function saveDraftNow() {
      window.clearTimeout(autoSaveTimer);
      const record = draftSnapshot();
      try {
        const storage = await putDraft(record);
        setStatus(saveStatus, `draft saved on this device · ${new Date(record.savedAt).toLocaleTimeString()}`, "ok");
        await refreshDraftSelect();
        if (storage === "browser storage") {
          setStatus(saveStatus, "draft saved on this device · limited-storage fallback in use", "warning");
        }
      } catch (error) {
        setStatus(saveStatus, `${error.message}. Download the publish file to keep your work.`, "error");
      }
      refreshExportStatus();
    }

    function scheduleAutosave() {
      if (isHydrating) return;
      setStatus(saveStatus, "saving draft…", "saving");
      refreshExportStatus();
      window.clearTimeout(autoSaveTimer);
      autoSaveTimer = window.setTimeout(() => { void saveDraftNow(); }, 700);
    }

    function applyDraft(record, { published = false } = {}) {
      isHydrating = true;
      currentDraftId = record.id || createId();
      titleInput.value = record.title || "";
      slugInput.value = record.slug || "";
      summaryInput.value = record.summary || "";
      tagsInput.value = record.tagsText || normalizeTags(record.tags).join(", ");
      publishedInput.value = record.publishedAtLocal || localDateTimeValue(parseDate(record.publishedAt) || new Date());
      currentPostSlug = record.currentPostSlug || (published ? record.slug : "");
      preparedFingerprint = record.preparedFingerprint || "";
      slugWasEdited = Boolean(record.slug);
      quill.setContents(sanitizeDelta(record.content));
      previewSection.hidden = true;
      previewHost.replaceChildren();
      isHydrating = false;
      setStatus(saveStatus, published ? "post loaded into a local draft" : "draft loaded");
      refreshExportStatus();
      void refreshDraftSelect();
    }

    async function fetchLatestLive() {
      const manifest = await loadPublishedManifest();
      return manifest;
    }

    function createVideoEmbedInEditor(url) {
      const media = parseVideoURL(url);
      if (!media) throw new Error("Use YouTube, Vimeo, Spotify, SoundCloud, or a direct HTTPS MP4 / WebM link.");
      const range = quill.getSelection(true) || { index: quill.getLength() - 1, length: 0 };
      quill.insertEmbed(range.index, "video", media.url, "user");
      quill.setSelection(range.index + 1, 0, "silent");
    }

    function insertImageInEditor(src, alt) {
      const safe = safeImageURL(src);
      if (!safe) throw new Error("Use a direct HTTPS image link or choose a supported local image.");
      const range = quill.getSelection(true) || { index: quill.getLength() - 1, length: 0 };
      quill.insertEmbed(range.index, "image", safe, "user");
      quill.formatText(range.index, 1, "alt", String(alt || "").slice(0, 250), "user");
      quill.setSelection(range.index + 1, 0, "silent");
    }

    function openDialog(dialog) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    $("[data-blog-add-image]").addEventListener("click", () => {
      $("#blog-image-error").textContent = "";
      $("#blog-image-url").value = "";
      $("#blog-image-file").value = "";
      $("#blog-image-alt").value = "";
      $("#blog-image-decorative").checked = false;
      openDialog(imageDialog);
      $("#blog-image-file").focus();
    });

    $("[data-blog-add-video]").addEventListener("click", () => {
      $("#blog-video-error").textContent = "";
      $("#blog-video-url").value = "";
      openDialog(videoDialog);
      $("#blog-video-url").focus();
    });

    $$('[data-dialog-close]').forEach((button) => {
      button.addEventListener("click", () => button.closest("dialog")?.close());
    });

    $("#blog-image-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = $("#blog-image-error");
      error.textContent = "";
      const file = $("#blog-image-file").files?.[0];
      const url = $("#blog-image-url").value.trim();
      const decorative = $("#blog-image-decorative").checked;
      const alt = decorative ? "" : $("#blog-image-alt").value.trim();
      if (file && url) {
        error.textContent = "Choose a file or paste a URL, not both.";
        return;
      }
      if (!file && !url) {
        error.textContent = "Choose an image file or paste its URL.";
        return;
      }
      if (!decorative && !alt) {
        error.textContent = "Add alternative text, or mark the image decorative.";
        $("#blog-image-alt").focus();
        return;
      }
      try {
        const source = file ? await optimizeImageFile(file) : safeImageURL(url);
        if (!source) throw new Error("Use a direct HTTPS image link, or choose a supported local image.");
        insertImageInEditor(source, alt);
        imageDialog.close();
        quill.focus();
        setStatus(saveStatus, "image inserted; draft autosaves on this device", "ok");
      } catch (insertError) {
        error.textContent = insertError.message;
      }
    });

    $("#blog-video-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const error = $("#blog-video-error");
      error.textContent = "";
      try {
        createVideoEmbedInEditor($("#blog-video-url").value.trim());
        videoDialog.close();
        quill.focus();
        setStatus(saveStatus, "video embed inserted; it stays unloaded until clicked", "ok");
      } catch (insertError) {
        error.textContent = insertError.message;
      }
    });

    titleInput.addEventListener("input", () => {
      if (!slugWasEdited) slugInput.value = slugify(titleInput.value);
      scheduleAutosave();
    });
    slugInput.addEventListener("input", () => {
      slugWasEdited = true;
      scheduleAutosave();
    });
    [summaryInput, tagsInput, publishedInput].forEach((input) => input.addEventListener("input", scheduleAutosave));
    publishedInput.addEventListener("change", scheduleAutosave);
    quill.on("text-change", scheduleAutosave);

    $("[data-blog-save-draft]").addEventListener("click", () => { void saveDraftNow(); });
    $("[data-blog-prepare]").addEventListener("click", async () => {
      try {
        const formPost = collectForm({ strict: true });
        const currentIndex = currentPostSlug ? workingPosts.findIndex((post) => post.slug === currentPostSlug) : -1;
        const duplicateIndex = workingPosts.findIndex((post) => post.slug === formPost.slug);
        if (duplicateIndex >= 0 && duplicateIndex !== currentIndex) throw new Error(`another post already uses “${formPost.slug}”`);
        if (currentIndex >= 0 && currentPostSlug !== formPost.slug) {
          if (!window.confirm(`Change this post's address from “${currentPostSlug}” to “${formPost.slug}”? Existing links using the old address will stop working.`)) return;
        }
        const now = new Date().toISOString();
        const post = normalizePost({ ...formPost, updatedAt: now });
        if (currentIndex >= 0) workingPosts[currentIndex] = post;
        else if (duplicateIndex >= 0) workingPosts[duplicateIndex] = post;
        else workingPosts.push(post);
        currentPostSlug = post.slug;
        preparedFingerprint = formFingerprint();
        updatePublishedSelect();
        publishedSelect.value = post.slug;
        refreshExportStatus();
        await saveDraftNow();
        setStatus(exportStatus, `“${post.title}” is in your local export list. Download posts.json, replace the repo file, then push to publish.`, "ok");
      } catch (error) {
        setStatus(saveStatus, error.message, "error");
        titleInput.reportValidity();
        if (!titleInput.value.trim()) titleInput.focus();
      }
    });

    $("[data-blog-preview]").addEventListener("click", () => {
      try {
        const post = normalizePost({ ...collectForm({ strict: true }), updatedAt: new Date().toISOString() });
        const article = make("article", "blog-article-preview");
        article.append(make("h2", "", post.title));
        const meta = make("p", "blog-post-meta");
        meta.append(makeTime(post.publishedAt));
        article.append(meta);
        if (post.summary) article.append(make("p", "blog-post-summary", post.summary));
        if (post.tags.length) article.append(buildTagLinks(post.tags));
        const content = make("div", "blog-rich-content");
        renderRichContent(content, post.content);
        article.append(content);
        previewHost.replaceChildren(article);
        previewSection.hidden = false;
        previewSection.scrollIntoView({ block: "start", behavior: "smooth" });
        setStatus(saveStatus, "preview updated", "ok");
      } catch (error) {
        setStatus(saveStatus, error.message, "error");
        if (!titleInput.value.trim()) titleInput.focus();
      }
    });

    $("[data-blog-close-preview]").addEventListener("click", () => { previewSection.hidden = true; });

    $("[data-blog-new]").addEventListener("click", () => {
      if (hasMeaningfulDraft() && !window.confirm("Start a new draft? Your current draft will stay saved on this device.")) return;
      applyDraft({ id: createId(), publishedAtLocal: localDateTimeValue(), content: { ops: [{ insert: "\n" }] } });
      slugWasEdited = false;
      void saveDraftNow();
      titleInput.focus();
    });

    $("[data-blog-load-draft]").addEventListener("click", async () => {
      const id = draftSelect.value;
      if (!id) {
        setStatus(saveStatus, "choose a saved draft first", "warning");
        return;
      }
      const draft = await readDraftById(id);
      if (!draft) {
        setStatus(saveStatus, "that draft is no longer stored in this browser", "error");
        await refreshDraftSelect();
        return;
      }
      if (hasMeaningfulDraft() && currentDraftId !== id && !window.confirm("Load this draft? Your current draft is autosaved first.")) return;
      if (currentDraftId !== id) await saveDraftNow();
      applyDraft(draft);
    });

    $("[data-blog-delete-draft]").addEventListener("click", async () => {
      const id = draftSelect.value || currentDraftId;
      const stored = await readDraftById(id);
      if (!stored) {
        setStatus(saveStatus, "choose a saved draft to delete", "warning");
        return;
      }
      if (!window.confirm(`Delete the local draft “${stored.title || "untitled draft"}”? This cannot be undone.`)) return;
      await deleteDraft(id);
      if (id === currentDraftId) applyDraft({ id: createId(), publishedAtLocal: localDateTimeValue(), content: { ops: [{ insert: "\n" }] } });
      await refreshDraftSelect();
      setStatus(saveStatus, "local draft deleted", "ok");
    });

    $("[data-blog-load-post]").addEventListener("click", async () => {
      const post = workingPosts.find((item) => item.slug === publishedSelect.value);
      if (!post) {
        setStatus(exportStatus, "choose a post in the export file first", "warning");
        return;
      }
      if (hasMeaningfulDraft() && !window.confirm("Load this post into a new local draft? Your current draft is autosaved first.")) return;
      await saveDraftNow();
      const draft = {
        ...post,
        id: createId(),
        tagsText: post.tags.join(", "),
        publishedAtLocal: localDateTimeValue(new Date(post.publishedAt)),
        currentPostSlug: post.slug,
        content: post.content,
      };
      applyDraft(draft, { published: true });
      preparedFingerprint = formFingerprint();
      await saveDraftNow();
    });

    $("[data-blog-remove-post]").addEventListener("click", () => {
      const slug = publishedSelect.value;
      const post = workingPosts.find((item) => item.slug === slug);
      if (!post) {
        setStatus(exportStatus, "choose a post in the export file first", "warning");
        return;
      }
      if (!window.confirm(`Remove “${post.title}” from your local export file? It stays live until you export, replace posts.json, and push the change.`)) return;
      workingPosts = workingPosts.filter((item) => item.slug !== slug);
      if (currentPostSlug === slug) currentPostSlug = "";
      updatePublishedSelect();
      setStatus(exportStatus, `“${post.title}” was removed from the local export list. It is not unpublished until you push the new file.`, "warning");
    });

    async function exportManifest() {
      if (hasMeaningfulDraft() && formFingerprint() !== preparedFingerprint) {
        const proceed = window.confirm("The current draft has changes that are not in the export file. Download the last prepared list anyway? Choose Cancel, then use “add / update in export” to include those changes.");
        if (!proceed) return;
      }
      const posts = [...workingPosts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const manifest = { schema_version: 1, posts };
      const data = `${JSON.stringify(manifest, null, 2)}\n`;
      const size = new Blob([data]).size;
      if (size > 2 * 1024 * 1024 && !window.confirm(`This posts.json file is ${(size / 1024 / 1024).toFixed(1)} MB. It includes uploaded images as data, so consider reducing image sizes before committing. Download it anyway?`)) return;
      const blob = new Blob([data], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = make("a");
      anchor.href = url;
      anchor.download = "posts.json";
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus(exportStatus, `downloaded posts.json (${(size / 1024).toFixed(0)} KB). Replace blog/posts.json in the repo and push to publish.`, "ok");
    }

    $("[data-blog-export]").addEventListener("click", () => { void exportManifest(); });

    $("[data-blog-refresh-live]").addEventListener("click", async () => {
      if (workingPosts.length && !window.confirm("Reload posts.json from the live site? This replaces the local prepared list, but leaves browser drafts alone.")) return;
      setStatus(exportStatus, "loading live posts…", "saving");
      try {
        const manifest = await fetchLatestLive();
        workingPosts = manifest.posts;
        updatePublishedSelect();
        refreshExportStatus();
        if (manifest.errors.length) setStatus(exportStatus, `Loaded ${workingPosts.length} valid posts; ${manifest.errors.length} malformed entries were skipped.`, "warning");
      } catch (error) {
        setStatus(exportStatus, `Could not load the live post file: ${error.message}`, "error");
      }
    });

    $("#blog-import-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      if (file.size > 25 * 1024 * 1024) {
        setStatus(exportStatus, "That posts.json is over 25 MB; split or resize its images first.", "error");
        return;
      }
      try {
        const imported = normalizeManifest(JSON.parse(await file.text()));
        if (imported.errors.length && !window.confirm(`${imported.errors.length} invalid post(s) would be skipped. Replace the current export list with ${imported.posts.length} valid post(s)?`)) return;
        if (!window.confirm(`Replace your local export list with ${imported.posts.length} post(s) from this file? Browser drafts stay unchanged.`)) return;
        workingPosts = imported.posts;
        updatePublishedSelect();
        refreshExportStatus();
        if (imported.errors.length) setStatus(exportStatus, `Imported ${workingPosts.length} valid posts; ${imported.errors.length} malformed entries were skipped.`, "warning");
      } catch (error) {
        setStatus(exportStatus, `Could not import that posts.json: ${error.message}`, "error");
      }
    });

    form.addEventListener("submit", (event) => event.preventDefault());
    window.addEventListener("beforeunload", () => {
      if (autoSaveTimer) void saveDraftNow();
    });

    publishedInput.value = localDateTimeValue();
    isHydrating = false;
    void (async () => {
      await refreshDraftSelect();
      try {
        const manifest = await fetchLatestLive();
        workingPosts = manifest.posts;
        refreshExportStatus();
        if (manifest.errors.length) {
          setStatus(exportStatus, `Loaded ${workingPosts.length} valid posts; ${manifest.errors.length} malformed entries were skipped.`, "warning");
        }
      } catch (error) {
        workingPosts = [];
        refreshExportStatus();
        setStatus(exportStatus, `Could not read the live posts.json (${error.message}). Import one or try reload live posts.`, "error");
      }
      const drafts = await getAllDrafts();
      const latest = drafts.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))[0];
      if (latest) applyDraft(latest);
      else {
        setStatus(saveStatus, "type to start; drafts autosave on this device");
        refreshExportStatus();
      }
    })();
  }

  if (!Quill || !Delta) {
    console.error("The bundled Quill editor did not load.");
  } else if (document.body.dataset.page === "blog") {
    const root = $("#blog-app");
    if (root) initializeArchive(root);
  } else if (document.body.dataset.page === "blog-write") {
    initializeWriter();
  }
})();
