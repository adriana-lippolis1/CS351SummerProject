// Get elements
const openPostBtn = document.getElementById("openPostBtn");
const modal = document.getElementById("createPostModal");
const closeModal = document.getElementById("closePostModal");
const postForm = document.getElementById("postForm");
const postSubject = document.getElementById("postSubject");
const postContent = document.getElementById("postContent");
const postsContainer = document.getElementById("postsContainer");
const logoutBtn = document.getElementById("logoutBtn");

// Check login
const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
if (!currentUser) {
  window.location.href = "login.html";
}

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
});

// Modal open/close
openPostBtn.addEventListener("click", () => (modal.style.display = "block"));
closeModal.addEventListener("click", () => (modal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Save a new post
function savePost(subject, content) {
  let posts = JSON.parse(localStorage.getItem("posts")) || [];
  const id = Date.now();
  posts.push({
    id,
    subject,
    content,
    date: new Date().toLocaleString(),
    poster: currentUser.username, // use logged-in user
    likes: 0,
    comments: []
  });
  localStorage.setItem("posts", JSON.stringify(posts));
}

// Load posts
function loadPosts() {
  postsContainer.innerHTML = "";
  let posts = JSON.parse(localStorage.getItem("posts")) || [];
  posts.forEach(post => {
    const postDiv = document.createElement("div");
    postDiv.className = "post";
    postDiv.dataset.id = post.id;

    // Comments
    let commentsHTML = '<div class="comment-section">';
    post.comments.forEach((c,i) => {
      commentsHTML += `
        <div class="comment">
          <div>${c.text}</div>
          <div><strong>${c.commenter}</strong> ${c.date}
            <button class="like-comment-btn" data-post="${post.id}" data-comment="${i}">
              <i class="fas fa-heart"></i> ${c.likes}
            </button>
            <button class="delete-comment-btn" data-post="${post.id}" data-comment="${i}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    commentsHTML += `
      <form class="comment-form" data-id="${post.id}">
        <input type="text" placeholder="Add a comment..." required/>
        <button type="submit">Comment</button>
      </form>
    </div>`;

    postDiv.innerHTML = `
      <h4>${post.subject}</h4>
      <p>${post.content}</p>
      <span class="timestamp"><strong>${post.poster}</strong> ${post.date}</span>
      <div>
        <button class="like-post-btn" title="Like post">
          <i class="fas fa-heart"></i> ${post.likes}
        </button>
        <button class="delete-post-btn" title="Delete post">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      ${commentsHTML}
    `;
    postsContainer.prepend(postDiv);
  });
}

// Submit new post
postForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const subject = postSubject.value.trim();
  const content = postContent.value.trim();
  if (!subject || !content) return;
  savePost(subject, content);
  postSubject.value = "";
  postContent.value = "";
  modal.style.display = "none";
  loadPosts();
});

// Event delegation for likes, deletes, comments
postsContainer.addEventListener("click", (e) => {
  const postDiv = e.target.closest(".post");
  if (!postDiv) return;
  const postId = parseInt(postDiv.dataset.id);
  let posts = JSON.parse(localStorage.getItem("posts")) || [];
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  // Delete post
  if (e.target.closest(".delete-post-btn")) {
    posts = posts.filter(p => p.id !== postId);
    localStorage.setItem("posts", JSON.stringify(posts));
    loadPosts();
  }

  // Like post
  if (e.target.closest(".like-post-btn")) {
    if (!post.liked) {
      post.likes++;
      post.liked = true;
    } else {
      post.likes--;
      post.liked = false;
    }
    localStorage.setItem("posts", JSON.stringify(posts));
    loadPosts();
  }

  // Like comment
  if (e.target.closest(".like-comment-btn")) {
    const btn = e.target.closest(".like-comment-btn");
    const idx = parseInt(btn.dataset.comment);
    if (!post.comments[idx].liked) {
      post.comments[idx].likes++;
      post.comments[idx].liked = true;
    } else {
      post.comments[idx].likes--;
      post.comments[idx].liked = false;
    }
    localStorage.setItem("posts", JSON.stringify(posts));
    loadPosts();
  }

  // Delete comment
  if (e.target.closest(".delete-comment-btn")) {
    const btn = e.target.closest(".delete-comment-btn");
    const idx = parseInt(btn.dataset.comment);
    post.comments.splice(idx, 1);
    localStorage.setItem("posts", JSON.stringify(posts));
    loadPosts();
  }
});

// Comment form submission
postsContainer.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.closest(".comment-form");
  if (!form) return;
  const postId = parseInt(form.dataset.id);
  const input = form.querySelector("input");
  if (!input.value.trim()) return;
  let posts = JSON.parse(localStorage.getItem("posts")) || [];
  const post = posts.find(p => p.id === postId);
  post.comments.push({
    commenter: currentUser.username, // use logged-in user
    text: input.value,
    date: new Date().toLocaleString(),
    likes: 0,
    liked: false
  });
  localStorage.setItem("posts", JSON.stringify(posts));
  input.value = "";
  loadPosts();
});

// Initial load
loadPosts();
