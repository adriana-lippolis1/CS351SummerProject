
// Get elements
const openPostBtn = document.getElementById("openPostBtn");
const modal = document.getElementById("createPostModal");
const closeModal = document.getElementById("closePostModal");
const postForm = document.getElementById("postForm");
const postSubject = document.getElementById("postSubject");
const postContent = document.getElementById("postContent");
const postsContainer = document.getElementById("postsContainer");
const logoutBtn = document.getElementById("logoutBtn");


// Registration and Login
// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById("regName").value,
        username: document.getElementById("regUsername").value,
        email: document.getElementById("regEmail").value,
        password: document.getElementById("regPassword").value,
      };

      const res = await fetch("/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      alert(result.message || result.error);
      if(result.message){
        registerForm.reset();
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        username: document.getElementById("loginUsername").value,
        password: document.getElementById("loginPassword").value,
      };

      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      if (res.ok) {
        alert("Login successful!");
        window.location.href = "/";
      } else {
        alert(result.error);
      }
    });
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = "/login";
});


//Check if user is logged in
let currentUser = null;
fetch('/check-auth')
  .then(res => res.json())
  .then(data => {
    if (data.loggedIn) {
      currentUser = data.user;
      console.log("User is logged in:", currentUser.username);
    } else {
      window.location.href = '/login'; // redirect if not logged in
    }
});

// Modal open/close
openPostBtn.addEventListener("click", () => (modal.style.display = "block"));
closeModal.addEventListener("click", () => (modal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Save a new post
function savePost(subject, content) {

  const date = new Date().toLocaleString();

  fetch('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, content, date })
  }).then(res => {
    if (res.ok) {
      alert('Post created successfully');
      loadPosts();
    } else {
      alert('Failed to save post');
      loadPosts();
    }
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

// Load posts
function loadPosts() {
  postsContainer.innerHTML = "";

  fetch('/posts')
    .then(res => res.json())
    .then(posts => {
      posts.forEach(post => {
        const postDiv = document.createElement("div");
        postDiv.className = "post";
        postDiv.dataset.id = post.postId; // match your DB column name

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
          <div class="comment-section">
            <!-- Comments could go here later -->
          </div>
        `;
        postsContainer.append(postDiv);
      });
    })
    .catch(err => {
      console.error('Failed to load posts:', err);
    });
}

// // Event delegation for likes, deletes, comments
// postsContainer.addEventListener("click", (e) => {
//   const postDiv = e.target.closest(".post");
//   if (!postDiv) return;
//   const postId = parseInt(postDiv.dataset.id);
//   let posts = JSON.parse(localStorage.getItem("posts")) || [];
//   const post = posts.find(p => p.id === postId);
//   if (!post) return;

//   // Delete post
//   if (e.target.closest(".delete-post-btn")) {
//     posts = posts.filter(p => p.id !== postId);
//     localStorage.setItem("posts", JSON.stringify(posts));
//     loadPosts();
//   }

//   // Like post
//   if (e.target.closest(".like-post-btn")) {
//     if (!post.liked) {
//       post.likes++;
//       post.liked = true;
//     } else {
//       post.likes--;
//       post.liked = false;
//     }
//     localStorage.setItem("posts", JSON.stringify(posts));
//     loadPosts();
//   }

//   // Like comment
//   if (e.target.closest(".like-comment-btn")) {
//     const btn = e.target.closest(".like-comment-btn");
//     const idx = parseInt(btn.dataset.comment);
//     if (!post.comments[idx].liked) {
//       post.comments[idx].likes++;
//       post.comments[idx].liked = true;
//     } else {
//       post.comments[idx].likes--;
//       post.comments[idx].liked = false;
//     }
//     localStorage.setItem("posts", JSON.stringify(posts));
//     loadPosts();
//   }

//   // Delete comment
//   if (e.target.closest(".delete-comment-btn")) {
//     const btn = e.target.closest(".delete-comment-btn");
//     const idx = parseInt(btn.dataset.comment);
//     post.comments.splice(idx, 1);
//     localStorage.setItem("posts", JSON.stringify(posts));
//     loadPosts();
//   }
// });

// // Comment form submission
// postsContainer.addEventListener("submit", (e) => {
//   e.preventDefault();
//   const form = e.target.closest(".comment-form");
//   if (!form) return;
//   const postId = parseInt(form.dataset.id);
//   const input = form.querySelector("input");
//   if (!input.value.trim()) return;
//   let posts = JSON.parse(localStorage.getItem("posts")) || [];
//   const post = posts.find(p => p.id === postId);
//   post.comments.push({
//     commenter: currentUser.username, // use logged-in user
//     text: input.value,
//     date: new Date().toLocaleString(),
//     likes: 0,
//     liked: false
//   });
//   localStorage.setItem("posts", JSON.stringify(posts));
//   input.value = "";
//   loadPosts();
// });

// Initial load
loadPosts();
