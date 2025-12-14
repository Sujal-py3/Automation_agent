// DOM Elements
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const authStatus = document.getElementById('auth-status');
const loginButton = document.getElementById('login-button');

// State
let isAuthenticated = false;
let userId = null;

// Functions
function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
  messageDiv.textContent = content;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateAuthStatus(authenticated, id = null) {
  isAuthenticated = authenticated;
  userId = id;
  authStatus.textContent = authenticated ? `Logged in as ${id}` : 'Not logged in';
  authStatus.className = authenticated ? 'logged-in' : '';
  messageInput.disabled = !authenticated;
  sendButton.disabled = !authenticated;
  
  // Show/hide login button
  if (loginButton) {
    loginButton.style.display = authenticated ? 'none' : 'block';
  }
}

function handleLogin() {
  window.location.href = 'http://localhost:8000/auth/login';
}

function handleAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');
  
  if (userId) {
    // Store the user ID
    localStorage.setItem('userId', userId);
    updateAuthStatus(true, userId);
    addMessage('Welcome to ALF.RED Chat! How can I help you today?');
    
    // Remove the userId from URL
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // No userId found, show login prompt
    updateAuthStatus(false);
    addMessage('Please log in to start chatting.');
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !isAuthenticated || !userId) return;

  // Add user message to chat
  addMessage(message, true);
  messageInput.value = '';

  try {
    // Send message to backend
    const response = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized error
        updateAuthStatus(false);
        addMessage('Your session has expired. Please log in again.');
        return;
      }
      throw new Error('Failed to send message');
    }

    const data = await response.json();
    addMessage(data.response);
  } catch (error) {
    console.error('Error sending message:', error);
    addMessage('Sorry, there was an error sending your message. Please try again.');
  }
}

// Event Listeners
if (sendButton) {
  sendButton.addEventListener('click', sendMessage);
}

if (messageInput) {
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
}

if (loginButton) {
  loginButton.addEventListener('click', handleLogin);
}

// Check authentication on page load
window.addEventListener('load', () => {
  const storedUserId = localStorage.getItem('userId');
  if (storedUserId) {
    updateAuthStatus(true, storedUserId);
  } else {
    // Check for auth callback
    handleAuthCallback();
  }
}); 