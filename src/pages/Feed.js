import { html, useState, useRef, useMemo } from "../lib/preact.js";
import { Card, SectionHeading, Button, Badge, EmptyState, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { useT } from "../lib/i18n.js";
import { useMyProfile } from "../lib/profile.js";
import { usePosts, createPost, invalidatePosts } from "../lib/postsStore.js";
import { relativeDate } from "../lib/format.js";
import { withTimeout } from "../lib/async.js";
import { containsProfanity } from "../lib/profanityFilter.js";

const MAX_LEN = 2000;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

/** Splits a post body into plain-text chunks and clickable hashtag buttons. */
function renderPostBody(body, onHashtagClick) {
  const parts = [];
  let lastIndex = 0;
  const re = new RegExp(HASHTAG_RE);
  let match;
  while ((match = re.exec(body))) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    const tag = match[0];
    parts.push(html`<button type="button" key=${`${match.index}-${tag}`}
      onClick=${() => onHashtagClick(tag)}
      class="text-indigo-300 hover:text-indigo-200 font-medium">${tag}</button>`);
    lastIndex = match.index + tag.length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts;
}

function initialsFor(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function Avatar({ name, size = 36 }) {
  return html`
    <div class="shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center font-semibold text-white"
      style=${{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(10, size * 0.38)}px` }}>
      ${initialsFor(name)}
    </div>
  `;
}

const COMPOSER_MIN_H = 44;
const COMPOSER_MAX_H = 240;

function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_H), COMPOSER_MAX_H)}px`;
}

function Composer({ t, profile }) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const taRef = useRef(null);

  function onInput(e) {
    setDraft(e.target.value.slice(0, MAX_LEN));
    autoGrow(e.target);
  }

  async function submit(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;
    if (containsProfanity(body)) {
      toast(t("feed.profanityBlocked"), "rose");
      return;
    }
    setPosting(true);
    try {
      await withTimeout(createPost(body), 15000);
      setDraft("");
      autoGrow(taRef.current);
      toast(t("feed.posted"), "emerald");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setPosting(false);
    }
  }

  return html`
    <${Card} className="p-5 mb-6">
      <form onSubmit=${submit}>
        <div class="flex gap-3 items-start">
          <div class="pt-1.5"><${Avatar} name=${profile?.full_name} /></div>
          <div class="flex-1 min-w-0">
            <textarea
              ref=${taRef}
              placeholder=${t("feed.composerPlaceholder")}
              value=${draft}
              onInput=${onInput}
              rows="1"
              style=${{ height: `${COMPOSER_MIN_H}px` }}
              class="sk-input w-full rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 resize-none overflow-hidden leading-relaxed"
            ></textarea>
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs text-slate-500">${draft.length}/${MAX_LEN}</span>
              <${Button} type="submit" disabled=${!draft.trim() || posting}>
                <${Icon} name="plus" size=${16} /> ${posting ? t("feed.posting") : t("feed.publish")}
              <//>
            </div>
          </div>
        </div>
      </form>
    <//>
  `;
}

function PostCard({ post, t, onHashtagClick }) {
  return html`
    <div class="sk-panel-flat rounded-xl p-4">
      <div class="flex gap-3">
        <${Avatar} name=${post.authorName} size=${32} />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="text-sm font-medium text-slate-100">${post.authorName ?? t("feed.unknownAuthor")}</span>
            <span class="text-xs text-slate-500">${relativeDate(post.createdAt)}</span>
          </div>
          <p class="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap break-words">${renderPostBody(post.body, onHashtagClick)}</p>
        </div>
      </div>
    </div>
  `;
}

export function Feed() {
  const t = useT();
  const { profile } = useMyProfile();
  const { posts, loading, error } = usePosts();
  const [activeHashtag, setActiveHashtag] = useState(null);

  const visiblePosts = useMemo(() => {
    if (!activeHashtag) return posts;
    const needle = activeHashtag.toLowerCase();
    return posts.filter((p) => p.body.toLowerCase().includes(needle));
  }, [posts, activeHashtag]);

  return html`
    <div>
      <${SectionHeading} title=${t("feed.title")} subtitle=${t("feed.subtitle")} />
      <${Composer} t=${t} profile=${profile} />

      ${activeHashtag && html`
        <div class="flex items-center gap-2 mb-4">
          <${Badge} tone="indigo">${activeHashtag}<//>
          <button type="button" onClick=${() => setActiveHashtag(null)} class="text-xs text-slate-500 hover:text-slate-300">${t("feed.clearFilter")}</button>
        </div>
      `}

      ${loading && html`<p class="text-sm text-slate-500">${t("common.loading")}</p>`}

      ${error && html`
        <${EmptyState} title=${t("feed.loadErrorTitle")} body=${t("feed.loadErrorBody")} icon="globe"
          action=${html`<${Button} onClick=${() => invalidatePosts()}>${t("common.retry")}<//>`} />
      `}

      ${!loading && !error && posts.length === 0 && html`
        <${EmptyState} title=${t("feed.emptyTitle")} body=${t("feed.emptyBody")} icon="globe" />
      `}

      ${!loading && !error && posts.length > 0 && visiblePosts.length === 0 && html`
        <${EmptyState} title=${t("feed.noHashtagTitle")} body=${t("feed.noHashtagBody", { tag: activeHashtag })} icon="search" />
      `}

      ${!loading && !error && visiblePosts.length > 0 && html`
        <div class="space-y-3">
          ${visiblePosts.map((post) => html`<${PostCard} key=${post.id} post=${post} t=${t} onHashtagClick=${setActiveHashtag} />`)}
        </div>
      `}
    </div>
  `;
}
