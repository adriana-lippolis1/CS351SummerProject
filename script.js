// ---------- Element lookups (null-safe) ----------
const openPostBtn   = document.getElementById("openPostBtn");
const modal         = document.getElementById("createPostModal");
const closeModal    = document.getElementById("closePostModal");
const postForm      = document.getElementById("postForm");
const postSubject   = document.getElementById("postSubject");
const postContent   = document.getElementById("postContent");
const postsContainer= document.getElementById("postsContainer");
const logoutBtn     = document.getElementById("logoutBtn");
const userBadge     = document.getElementById("userBadge");

// Track edit state
let editingPostId = null;

// Page detection
const onLoginPage = !!document.getElementById("loginForm") || !!document.getElementById("registerForm");

// ---------- Registration + Login (backend) ----------
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm    = document.getElementById("loginForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        name:     document.getElementById("regName").value.trim(),
        username: document.getElementById("regUsername").value.trim(),
        email:    document.getElementById("regEmail").value.trim(),
        password: document.getElementById("regPassword").value,
      };
      try {
        const res = await fetch("/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        alert(result.message || result.error || "Unknown response");
        if (res.ok) registerForm.reset();
      } catch (err) {
        alert("Registration failed.");
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        username: document.getElementById("loginUsername").value.trim(),
        password: document.getElementById("loginPassword").value,
      };
      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (res.ok) {
          window.location.href = "/";
        } else {
          alert(result.error || "Login failed");
        }
      } catch (err) {
        alert("Login failed.");
      }
    });
  }

  // Session check (for both pages). If on login page and logged in → go home.
  fetch("/check-auth")
    .then((r) => r.json())
    .then((data) => {
      if (data.loggedIn) {
        if (onLoginPage) {
          window.location.href = "/";
          return;
        }
        // Show header controls & user badge
        if (userBadge) {
          userBadge.style.display = "inline-block";
          userBadge.textContent = data.user.username;

          // Show "Admin" tag for admins
          if (data.user.admin) {
            const tag = document.createElement('span');
            tag.className = 'admin-tag';
            tag.textContent = 'Admin';
            userBadge.appendChild(tag);
          }
        }
        if (openPostBtn) openPostBtn.style.display = "inline-block";
        if (logoutBtn)   logoutBtn.style.display   = "inline-block";
      } else {
        if (!onLoginPage) window.location.href = "/login";
      }
    })
    .catch(() => {
      if (!onLoginPage) window.location.href = "/login";
    });
});

// ---------- Logout ----------
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/login";
  });
}

// ---------- Modal open/close ----------
if (openPostBtn && modal && closeModal) {
  openPostBtn.addEventListener("click", () => {
    editingPostId = null; // create mode
    if (postSubject) postSubject.value = "";
    if (postContent) postContent.value = "";
    modal.style.display = "block";
  });
  closeModal.addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}

// ---------- Posts: create or edit ----------
function savePost(subject, content) {
  const date = new Date().toLocaleString();
  return fetch("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, content, date }),
  });
}
function updatePost(id, subject, content) {
  return fetch(`/posts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, content }),
  });
}

if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = (postSubject?.value || "").trim();
    const content = (postContent?.value || "").trim();
    if (!subject || !content) return;
    const res = editingPostId
      ? await updatePost(editingPostId, subject, content)
      : await savePost(subject, content);

    if (res.ok) {
      editingPostId = null;
      if (postSubject) postSubject.value = "";
      if (postContent) postContent.value = "";
      if (modal) modal.style.display = "none";
      loadPosts();
    } else {
      const r = await res.json().catch(() => ({}));
      alert(r.error || "Failed to save");
    }
  });
}

// ---------- Posts: load + comments integration ----------
async function loadPosts() {
  if (!postsContainer) return;

  postsContainer.innerHTML = "";
  try {
    const res = await fetch("/posts");
    const posts = await res.json();

    for (const post of posts) {
      const postDiv = document.createElement("div");
      postDiv.className = "post";
      postDiv.dataset.id = post.id;

      let editedTag = "";
      if (post.editedAt) {
        editedTag = `<span class="timestamp edited-tag">
          Edited: 
          ${post.editedBy ? ` <span class="admin-name">${escapeHTML(post.editedBy)}</span>` : ""} ${escapeHTML(post.editedAt)}
        </span>`;
      }

      // Load comments
      let commentsHTML = '<div class="comment-section">';
      try {
        const commentsRes = await fetch(`/posts/${post.id}/comments`);
        const comments = await commentsRes.json();
        comments.forEach((c) => {
          commentsHTML += `
            <div class="comment" data-comment-id="${c.id}">
              <div>${escapeHTML(c.content)}</div>
              <div><strong>${escapeHTML(c.commenter)}</strong> ${escapeHTML(c.date)}
                <button class="like-comment-btn" data-post="${post.id}">
                  <i class="fas fa-heart"></i> ${c.likes}
                </button>
                <button class="delete-comment-btn" data-post="${post.id}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>`;
        });
      } catch {}

      commentsHTML += `
        <form class="comment-form" data-id="${post.id}">
          <input type="text" placeholder="Add a comment..." required />
          <button type="submit">Comment</button>
        </form>
      </div>`;

      postDiv.innerHTML = `
        <h4>${escapeHTML(post.subject)}</h4>
        <p>${escapeHTML(post.content)}</p>
        <span class="timestamp"><strong>${escapeHTML(post.poster)}</strong> ${escapeHTML(post.date)}</span>
        ${editedTag}
        <div>
          <button class="like-post-btn" title="Like post"><i class="fas fa-heart"></i> ${post.likes || 0}</button>
          <button class="edit-post-btn" title="Edit post"><i class="fas fa-edit"></i></button>
          <button class="delete-post-btn" title="Delete post"><i class="fas fa-trash"></i></button>
        </div>
        ${commentsHTML}
      `;
      postsContainer.appendChild(postDiv);
    }
  } catch (err) {
    console.error("Failed to load posts:", err);
  }
}

// Utilities
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[s]));
}

// ---------- Event delegation ----------
if (postsContainer) {
  postsContainer.addEventListener("click", async (e) => {
    const postDiv = e.target.closest(".post");
    if (!postDiv) return;
    const postId = postDiv.dataset.id;

    // Edit post
    if (e.target.closest(".edit-post-btn")) {
      // Prefill modal with current content
      const subjectText = postDiv.querySelector("h4")?.textContent || "";
      const contentText = postDiv.querySelector("p")?.textContent || "";
      if (postSubject) postSubject.value = subjectText;
      if (postContent) postContent.value = contentText;
      editingPostId = postId;
      if (modal) modal.style.display = "block";
      return;
    }

    // Delete post
    if (e.target.closest(".delete-post-btn")) {
      const res = await fetch(`/posts/${postId}`, { method: "DELETE" });
      if (res.ok) loadPosts();
      else alert("Not allowed or failed");
      return;
    }

    // Like post
    if (e.target.closest(".like-post-btn")) {
      const res = await fetch(`/posts/${postId}/like`, { method: "POST" });
      if (res.ok) loadPosts();
      return;
    }

    // Like comment
    if (e.target.closest(".like-comment-btn")) {
      const commentDiv = e.target.closest(".comment");
      const commentId  = commentDiv?.dataset.commentId;
      if (!commentId) return;
      const res = await fetch(`/posts/${postId}/comments/${commentId}/like`, { method: "POST" });
      if (res.ok) loadPosts();
      return;
    }

    // Delete comment
    if (e.target.closest(".delete-comment-btn")) {
      const commentDiv = e.target.closest(".comment");
      const commentId  = commentDiv?.dataset.commentId;
      if (!commentId) return;
      const res = await fetch(`/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) loadPosts();
      else alert("Not allowed or failed");
      return;
    }
  });

  // Add comment
  postsContainer.addEventListener("submit", async (e) => {
    const form = e.target.closest(".comment-form");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const text = (input?.value || "").trim();
    if (!text) return;
    const postId = form.dataset.id;
    const res = await fetch(`/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, date: new Date().toLocaleString() }),
    });
    if (res.ok) {
      input.value = "";
      loadPosts();
    }
  });

  // Initial load on homepage
  loadPosts();
}
