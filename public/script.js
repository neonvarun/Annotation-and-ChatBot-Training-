(function () {
  const chatContainer = document.getElementById('chat-container');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function createMessageEl(text, who = 'bot', html = false) {
    const el = document.createElement('div');
    el.className = 'message ' + who;
    if (html) el.innerHTML = text; else el.textContent = text;
    return el;
  }

  function createImageEl(src, who = 'bot') {
    const wrapper = document.createElement('div');
    wrapper.className = 'message ' + who;
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'image';
    wrapper.appendChild(img);
    return wrapper;
  }

  function appendUserMessage(text) {
    const el = createMessageEl(text, 'user');
    chatContainer.appendChild(el);
    scrollToBottom();
  }

  function appendBotResponses(responses) {
    if (!Array.isArray(responses)) return;
    responses.forEach(r => {
      if (r.type === 'text') {
        const el = createMessageEl(r.text, 'bot');
        chatContainer.appendChild(el);
      } else if (r.type === 'image') {
        const imgEl = createImageEl(r.image, 'bot');
        chatContainer.appendChild(imgEl);
      } else if (r.type === 'unknown' && r.raw) {
        const el = createMessageEl(JSON.stringify(r.raw), 'bot');
        chatContainer.appendChild(el);
      }
      scrollToBottom();
    });
  }

  async function sendMessage(message) {
    try {
      const resp = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: 'Unknown error' }));
        appendBotResponses([{ type: 'text', text: 'Error: ' + (error.error || error.details || 'Server error') }]);
        return;
      }

      const data = await resp.json();
      appendBotResponses(data.responses || []);
    } catch (err) {
      appendBotResponses([{ type: 'text', text: 'Network error: ' + err.message }]);
    }
  }

  function handleSend() {
    const text = input.value && input.value.trim();
    if (!text) return;
    appendUserMessage(text);
    input.value = '';
    // Post to backend
    sendMessage(text);
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // Initial welcome message from bot (optional)
  const welcome = createMessageEl('Hello! Ask me anything.', 'bot');
  chatContainer.appendChild(welcome);
  scrollToBottom();
})();
