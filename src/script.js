function showTab(tabId) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
}

function togglePrivacy() {
  alert('Your profile is now private!');
  // Implement actual privacy settings in backend
}
// Function to show specific tabs
function showTab(tabId) {
  // Hide all tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  // Show the selected tab
  const activeTab = document.getElementById(tabId);
  activeTab.classList.add('active');
}

// Toggle profile privacy
function togglePrivacy() {
  const privacyButton = document.querySelector('#profile button');
  const isPrivate = privacyButton.textContent.includes('Private');
  privacyButton.textContent = isPrivate ? 'Make Profile Private' : 'Make Profile Public';
  alert(`Your profile is now ${isPrivate ? 'public' : 'private'}.`);
}

// Example: Populate feed dynamically
function populateFeed() {
  const contentFeed = document.getElementById('contentFeed');
  const examplePosts = [
    { author: 'Alice', content: 'Check out my new photo!' },
    { author: 'Bob', content: 'Loving the new track I uploaded!' },
    { author: 'Eve', content: 'Here’s a sneak peek of my latest video.' },
  ];

  examplePosts.forEach(post => {
    const postDiv = document.createElement('div');
    postDiv.style.padding = '10px';
    postDiv.style.borderBottom = '1px solid #fff';
    postDiv.innerHTML = `<strong>${post.author}</strong>: ${post.content}`;
    contentFeed.appendChild(postDiv);
  });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Default tab to show
  showTab('profile');
  populateFeed();
});
// Toggle modal visibility
function toggleModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

// Handle upload form
document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('uploadForm');
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('contentType').value;
    const title = document.getElementById('contentTitle').value;
    const file = document.getElementById('fileInput').files[0];
    alert(`Uploading ${type}: "${title}"`);

    // TODO: integrate with backend API
    toggleModal('uploadModal');
    uploadForm.reset();
  });
});

// Simple cart array
let cart = [];

// Simulate adding item to cart
function addToCart(itemName) {
  cart.push(itemName);
  alert(`${itemName} added to cart.`);
  renderCart();
}

// Render cart items
function renderCart() {
  const cartList = document.getElementById('cartItems');
  cartList.innerHTML = '';
  cart.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    cartList.appendChild(li);
  });
}

// Simulated checkout
function checkout() {
  alert('Processing checkout for: ' + cart.join(', '));
  cart = [];
  renderCart();
  toggleModal('cartModal');
}
