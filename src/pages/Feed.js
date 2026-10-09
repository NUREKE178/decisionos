import { html, useState } from "../lib/preact.js";
import { Card, SectionHeading, Button, TextArea, EmptyState, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { useT } from "../lib/i18n.js";
import { useMyProfile } from "../lib/profile.js";
import { usePosts, createPost, invalidatePosts } from "../lib/postsStore.js";
import { relativeDate } from "../lib/format.js";
import { withTimeout } from "../lib/async.js";

const MAX_LEN = 2000;

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

function Composer({ t, profile }) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await withTimeout(createPost(body), 15000);
      setDraft("");
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
        <div class="flex gap-3">
          <${Avatar} name=${profile?.full_name} />
          <div class="flex-1 min-w-0">
            <${TextArea}
              placeholder=${t("feed.composerPlaceholder")}
              value=${draft}
              onInput=${(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              class="min-h-[70px]"
            />
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

function PostCard({ post, t }) {
  return html`
    <div class="sk-panel-flat rounded-xl p-4">
      <div class="flex gap-3">
        <${Avatar} name=${post.authorName} size=${32} />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="text-sm font-medium text-slate-100">${post.authorName ?? t("feed.unknownAuthor")}</span>
            <span class="text-xs text-slate-500">${relativeDate(post.createdAt)}</span>
          </div>
          <p class="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap break-words">${post.body}</p>
        </div>
      </div>
    </div>
  `;
}

export function Feed() {
  const t = useT();
  const { profile } = useMyProfile();
  const { posts, loading, error } = usePosts();

  return html`
    <div>
      <${SectionHeading} title=${t("feed.title")} subtitle=${t("feed.subtitle")} />
      <${Composer} t=${t} profile=${profile} />

      ${loading && html`<p class="text-sm text-slate-500">${t("common.loading")}</p>`}

      ${error && html`
        <${EmptyState} title=${t("feed.loadErrorTitle")} body=${t("feed.loadErrorBody")} icon="globe"
          action=${html`<${Button} onClick=${() => invalidatePosts()}>${t("common.retry")}<//>`} />
      `}

      ${!loading && !error && posts.length === 0 && html`
        <${EmptyState} title=${t("feed.emptyTitle")} body=${t("feed.emptyBody")} icon="globe" />
      `}

      ${!loading && !error && posts.length > 0 && html`
        <div class="space-y-3">
          ${posts.map((post) => html`<${PostCard} key=${post.id} post=${post} t=${t} />`)}
        </div>
      `}
    </div>
  `;
}
