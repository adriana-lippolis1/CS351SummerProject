
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


// Load and display posts with comments
async function loadPosts() {
  postsContainer.innerHTML = "";

  try {
    const res = await fetch('/posts');
    const posts = await res.json();

    // For each post, fetch comments asynchronously
    const postElements = await Promise.all(posts.map(async (post) => {
      let commentsHTML = '<div class="comment-section">';
      
      try {
        const commentsRes = await fetch(`/posts/${post.id}/comments`);
        const comments = await commentsRes.json();

        comments.forEach((c, i) => {

          const commentDiv = document.createElement("div");
          commentDiv.className = "comment";
          commentDiv.dataset.id = c.id;

          commentsHTML += `
            <div class="comment" data-comment-id="${c.id}">
              <div>${c.content}</div>
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
      } catch (err) {
        console.error(`Failed to load comments for post ${post.id}:`, err);
      }

      commentsHTML += `
        <form class="comment-form" data-id="${post.id}">
          <input type="text" placeholder="Add a comment..." required />
          <button type="submit">Comment</button>
        </form>
      </div>`;

      // Create post div with full HTML including comments
      const postDiv = document.createElement("div");
      postDiv.className = "post";
      postDiv.dataset.id = post.id;

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

      return postDiv;
    }));

    // Append all posts with comments to container
    postElements.forEach(postEl => postsContainer.append(postEl));
    
  } catch (err) {
    console.error('Failed to load posts:', err);
  }
}


// Event delegation for likes, deletes, comments
postsContainer.addEventListener("click", (e) => {
  const postDiv = e.target.closest(".post");
  if (!postDiv) return;

  // Get post id
  const postId = parseInt(postDiv.dataset.id);

  // Delete post
  if (e.target.closest(".delete-post-btn")) {
    // Send request to server to delete post, using postId and session user
    fetch(`/posts/${postId}`, { 
      method: 'DELETE', 
      body: JSON.stringify({ username: currentUser.username }),
      headers: { 'Content-Type': 'application/json' }})
      .then(res => {
        if (res.ok) {
          alert('Post deleted');
        } else {
          alert('Failed to delete post');
        }
        loadPosts();
      });
  }

  // Like post
  if (e.target.closest(".like-post-btn")) {
    // Send request to server to like post, using postId and session user
    // If a post is already liked by this user, unlike it
    fetch(`/posts/${postId}/like`, { method: 'POST', })
      .then(res => {
        if (res.ok) {
          //alert('Post liked');
        } else {
          alert('Failed to like post');
        }
        loadPosts();
      });
  }

  // Like comment
  if (e.target.closest(".like-comment-btn")) {
    const commentDiv = e.target.closest(".comment");
    const commentId = commentDiv?.dataset.commentId;
    fetch(`/posts/${postId}/comments/${commentId}/like`, { method: 'POST' })
      .then(res => {
        if (res.ok) {
          //alert('Comment liked');
        } else {
          alert('Failed to like comment');
        }
        loadPosts();
      });
  }

  // Delete comment
  if (e.target.closest(".delete-comment-btn")) {
    const commentDiv = e.target.closest(".comment");
    const commentId = commentDiv?.dataset.commentId;
    console.log("Deleting comment:", commentId);
    fetch(`/posts/${postId}/comments/${commentId}`, { 
      method: 'DELETE', 
      body: JSON.stringify({ username: currentUser.username }),
      headers: { 'Content-Type': 'application/json' }})
      .then(res => {
        if (res.ok) {
          alert('Comment deleted');
        } else {
          alert('Failed to delete comment');
        }
        loadPosts();
      });
  }
});

// Comment form submission
postsContainer.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.closest(".comment-form");
  if (!form) return;

  const postId = parseInt(form.dataset.id);
  const input = form.querySelector("input");

  fetch(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: input.value, date: new Date().toLocaleString() })
  }).then(res => {
    if (res.ok) {
      alert('Comment added');
    } else {
      alert('Failed to add comment');
    }
    loadPosts();
  });
  input.value = "";
});

// Initial load
loadPosts();
