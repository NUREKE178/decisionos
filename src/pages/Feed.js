import { html, useState, useRef, useMemo, useEffect } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Button, Badge, EmptyState, toast, Skeleton } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { useT } from "../lib/i18n.js";
import { useMyProfile } from "../lib/profile.js";
import { getCurrentUser } from "../lib/auth.js";
import { usePosts, createPost, deletePost, invalidatePosts } from "../lib/postsStore.js";
import { uploadPostImage, validateAssetFile } from "../lib/storage.js";
import { relativeDate } from "../lib/format.js";
import { withTimeout } from "../lib/async.js";
import { moderatePost } from "../lib/profanityFilter.js";

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
  if (!name) return "";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function Avatar({ name, url, size = 36 }) {
  if (url) {
    return html`<img src=${url} class="rounded-full object-cover shrink-0" style=${{ width: `${size}px`, height: `${size}px` }} />`;
  }
  return html`
    <div class="shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center font-semibold text-white"
      style=${{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(10, size * 0.38)}px` }}>
      ${name ? initialsFor(name) : html`<${Icon} name="user" size=${Math.round(size * 0.55)} />`}
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  // Preview is a local blob: URL for the selected file, revoked whenever it
  // changes or the composer unmounts so we don't leak object URLs.
  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function onInput(e) {
    setDraft(e.target.value.slice(0, MAX_LEN));
    autoGrow(e.target);
  }

  function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    try {
      validateAssetFile(file);
      setImageFile(file);
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    }
  }

  async function submit(e) {
    e.preventDefault();
    const rawBody = draft.trim();
    if (!rawBody || posting) return;

    const mod = moderatePost(rawBody);
    if (mod.action === "block") {
      toast(t("feed.profanityBlocked"), "rose");
      return;
    }

    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const authorId = getCurrentUser()?.id;
        const uploaded = await withTimeout(uploadPostImage({ authorId, file: imageFile }), 20000);
        imageUrl = uploaded.url;
      }
      await withTimeout(createPost(mod.text, imageUrl), 15000);
      setDraft("");
      setImageFile(null);
      autoGrow(taRef.current);
      toast(t(mod.action === "censor" ? "feed.postedCensored" : "feed.posted"), mod.action === "censor" ? "amber" : "emerald");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setPosting(false);
    }
  }

  return html`
    <${Card} className="p-5 mt-6">
      <form onSubmit=${submit}>
        <div class="flex gap-3 items-start">
          <div class="pt-1.5"><${Avatar} name=${profile?.full_name} url=${profile?.avatar_url} /></div>
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

            ${imagePreview && html`
              <div class="relative inline-block mt-3">
                <img src=${imagePreview} class="sk-display rounded-lg max-h-48 object-cover" />
                <button type="button" onClick=${() => setImageFile(null)}
                  aria-label=${t("feed.removeImage")}
                  class="sk-btn absolute -top-2 -right-2 h-6 w-6 rounded-full text-slate-300">
                  <${Icon} name="close" size=${12} />
                <//>
              </div>
            `}

            <div class="flex items-center justify-between mt-3">
              <div class="flex items-center gap-3">
                <span class="text-xs text-slate-500">${draft.length}/${MAX_LEN}</span>
                <button type="button" onClick=${() => fileRef.current?.click()}
                  class="text-slate-500 hover:text-indigo-300 transition-colors" aria-label=${t("feed.addImage")}>
                  <${Icon} name="image" size=${18} />
                <//>
                <input ref=${fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" onChange=${onPickImage} />
              </div>
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

function PostCard({ post, t, onHashtagClick, canDelete, onDeleteClick }) {
  const hasProfile = !!post.authorUsername;
  const goToAuthor = () => hasProfile && navigate(`/u/${post.authorUsername}`);
  return html`
    <div class="sk-panel-flat rounded-xl p-4">
      <div class="flex gap-3">
        <button type="button" onClick=${goToAuthor} disabled=${!hasProfile}
          class=${`shrink-0 rounded-full ${hasProfile ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}`}>
          <${Avatar} name=${post.authorName} url=${post.authorAvatarUrl} size=${32} />
        <//>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-baseline gap-2 flex-wrap">
              <button type="button" onClick=${goToAuthor} disabled=${!hasProfile}
                class=${`text-sm font-medium text-slate-100 ${hasProfile ? "hover:underline cursor-pointer" : "cursor-default"}`}>
                ${post.authorName ?? t("feed.unknownAuthor")}
              <//>
              <span class="text-xs text-slate-500">${relativeDate(post.createdAt)}</span>
            </div>
            ${canDelete && html`
              <button type="button" onClick=${() => onDeleteClick(post)} aria-label=${t("feed.deletePost")}
                class="shrink-0 text-slate-600 hover:text-rose-400 transition-colors">
                <${Icon} name="trash" size=${15} />
              <//>
            `}
          </div>
          <p class="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap break-words">${renderPostBody(post.body, onHashtagClick)}</p>
          ${post.imageUrl && html`<img src=${post.imageUrl} class="sk-display rounded-lg mt-3 max-h-96 w-full object-cover" />`}
        </div>
      </div>
    </div>
  `;
}

export function Feed() {
  const t = useT();
  const { profile } = useMyProfile();
  const currentUserId = getCurrentUser()?.id;
  const { posts, loading, error } = usePosts();
  const [activeHashtag, setActiveHashtag] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const visiblePosts = useMemo(() => {
    if (!activeHashtag) return posts;
    const needle = activeHashtag.toLowerCase();
    return posts.filter((p) => p.body.toLowerCase().includes(needle));
  }, [posts, activeHashtag]);

  async function doDelete() {
    setDeleting(true);
    try {
      await withTimeout(deletePost(confirmDelete.id), 15000);
      setConfirmDelete(null);
      toast(t("feed.postDeleted"), "emerald");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setDeleting(false);
    }
  }

  return html`
    <div>
      <${SectionHeading} title=${t("feed.title")} subtitle=${t("feed.subtitle")} />

      ${activeHashtag && html`
        <div class="flex items-center gap-2 mb-4">
          <${Badge} tone="indigo">${activeHashtag}<//>
          <button type="button" onClick=${() => setActiveHashtag(null)} class="text-xs text-slate-500 hover:text-slate-300">${t("feed.clearFilter")}</button>
        </div>
      `}

      ${loading && html`
        <div class="space-y-3">
          ${[0, 1].map((i) => html`
            <div key=${i} class="sk-panel-flat rounded-xl p-4">
              <div class="flex gap-3">
                <${Skeleton} className="h-8 w-8 rounded-full shrink-0" />
                <div class="flex-1 min-w-0">
                  <${Skeleton} className="h-4 w-32" />
                  <${Skeleton} className="h-3 w-full mt-2.5" />
                  <${Skeleton} className="h-3 w-2/3 mt-1.5" />
                </div>
              </div>
            </div>
          `)}
        </div>
      `}

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
          ${visiblePosts.map((post) => html`
            <${PostCard} key=${post.id} post=${post} t=${t} onHashtagClick=${setActiveHashtag}
              canDelete=${post.authorId === currentUserId || !!profile?.is_admin}
              onDeleteClick=${setConfirmDelete} />
          `)}
        </div>
      `}

      <${Composer} t=${t} profile=${profile} />

      ${confirmDelete && html`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick=${(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <${Card} className="max-w-sm p-5">
            <div class="font-semibold text-slate-100">${t("feed.confirmDeleteTitle")}</div>
            <p class="text-sm text-slate-500 mt-1.5">${t("feed.confirmDeleteBody")}</p>
            <div class="flex justify-end gap-2 mt-5">
              <${Button} variant="secondary" size="sm" onClick=${() => setConfirmDelete(null)}>${t("common.cancel")}<//>
              <${Button} variant="danger" size="sm" disabled=${deleting} onClick=${doDelete}>${t("common.delete")}<//>
            </div>
          <//>
        </div>
      `}
    </div>
  `;
}
