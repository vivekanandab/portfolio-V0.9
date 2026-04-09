// Wrap everything in an init function so the main script can call it AFTER fetch
window.initRagTerminal = function() {
    const terminal = document.getElementById('ai-terminal');
    const toggleBtn = document.getElementById('toggle-terminal');
    const sendBtn = document.getElementById('send-chat');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');

    if (!terminal) {
        console.error("FAIL: Terminal DOM elements not found.");
        return;
    }

    console.log("SYSTEM: RAG Agent Initialized & Listening.");

    // Toggle Terminal
    toggleBtn.addEventListener('click', () => {
        if (terminal.classList.contains('ai-terminal-closed')) {
            terminal.classList.remove('ai-terminal-closed');
            terminal.classList.add('ai-terminal-open');
            toggleBtn.innerText = 'X';
        } else {
            terminal.classList.remove('ai-terminal-open');
            terminal.classList.add('ai-terminal-closed');
            toggleBtn.innerText = '_';
        }
    });

    // Send Message Logic
    const sendMessage = async () => {
        const question = chatInput.value.trim();
        if (!question) return;

        appendMessage('user', question);
        chatInput.value = '';
        const loadingId = appendMessage('ai', 'Processing query...', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) throw new Error('Server disconnect.');
            const data = await response.json();
            
            document.getElementById(loadingId).innerHTML = `<span class="prompt">>></span> ${data.answer}`;
        } catch (error) {
            document.getElementById(loadingId).innerHTML = `<span class="prompt" style="color:red;">>></span> [ERROR] Connection to mainframe lost.`;
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    function appendMessage(sender, text, isLoading = false) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', `${sender}-message`);
        const id = 'msg-' + Date.now();
        msgDiv.id = id;
        
        if (sender === 'user') {
            msgDiv.innerHTML = text + ` <span class="prompt"><<</span>`;
        } else {
            msgDiv.innerHTML = `<span class="prompt ${isLoading ? 'loading-blink' : ''}">>></span> ${text}`;
        }
        
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        return id;
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
};