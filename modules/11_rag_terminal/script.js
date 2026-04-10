// Wrap everything in an init function so the main script can call it AFTER fetch
// Rate limiting configuration
let messageCount = 0;
let lastMessageTime = Date.now();
const COOLDOWN_MS = 2000; 
const BANNED_TIMEOUT = 10000;
let isBanned = false;
const sessionId = 'session-' + Math.random().toString(36).substring(2, 9);

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
    const bootSound = new Audio('https://www.myinstants.com/media/sounds/ui_succes_notification.mp3');

    toggleBtn.addEventListener('click', () => {
        if (terminal.classList.contains('ai-terminal-closed')) {
            terminal.classList.remove('ai-terminal-closed');
            terminal.classList.add('ai-terminal-open');
            toggleBtn.style.color = '#00ffcc';
            toggleBtn.innerText = 'X';
            chatInput.focus();
            try { bootSound.play(); } catch(e) {}
        } else {
            terminal.classList.remove('ai-terminal-open');
            terminal.classList.add('ai-terminal-closed');
            toggleBtn.style.color = 'transparent';
            toggleBtn.innerText = '_';
        }
    });

    // Send Message Logic
    const sendMessage = async () => {
        const question = chatInput.value.trim();
        if (!question) return;

        // Rate limiting verification
        const now = Date.now();
        if (isBanned) {
            appendMessage('ai', "Chill out, human! My processors are overheating. Give me a few seconds...");
            return;
        }
        if (now - lastMessageTime < COOLDOWN_MS) {
            messageCount++;
            if (messageCount > 4) {
                isBanned = true;
                setTimeout(() => { isBanned = false; messageCount = 0; }, BANNED_TIMEOUT);
                appendMessage('ai', "🚨 SPEED LIMIT EXCEEDED. Initiating 10-second thermal cooldown sequence... Ask your 100 questions slower! 🚨");
                return;
            }
        } else {
            messageCount = Math.max(0, messageCount - 1);
        }
        lastMessageTime = now;

        appendMessage('user', question);
        chatInput.value = '';
        const loadingId = appendMessage('ai', 'Processing query...', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question, session_id: sessionId })
            });

            if (!response.ok) throw new Error('Server disconnect.');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullAnswer = '';
            
            // Remove the blinking loading class immediately before streaming
            const msgEl = document.getElementById(loadingId);
            const textContainer = msgEl.querySelector('.ai-text');
            msgEl.querySelector('.prompt').classList.remove('loading-blink');
            textContainer.innerHTML = ''; // Clear processing text

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullAnswer += chunk;
                
                // Append text chunk safely
                textContainer.appendChild(document.createTextNode(chunk));
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            // Append Feedback buttons
            const feedbackHtml = `
                <div class="feedback-box">
                    <button onclick="submitFeedback('${escapeQuotes(question)}', '${escapeQuotes(fullAnswer)}', true)">👍</button>
                    <button onclick="submitFeedback('${escapeQuotes(question)}', '${escapeQuotes(fullAnswer)}', false)">👎</button>
                    <span class="feedback-msg"></span>
                </div>
            `;
            msgEl.insertAdjacentHTML('beforeend', feedbackHtml);

        } catch (error) {
            const msgEl = document.getElementById(loadingId);
            msgEl.innerHTML = `<img src="assets/icons/ng_bot.png" class="bot-avatar"><span class="prompt" style="color:red;">>></span> [ERROR] Connection to mainframe lost.`;
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    function appendMessage(sender, text, isLoading = false) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', `${sender}-message`);
        const id = 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5);
        msgDiv.id = id;
        
        if (sender === 'user') {
            msgDiv.innerHTML = text + ` <span class="prompt"><<</span>`;
        } else {
            const avatar = `<img src="assets/icons/ng_bot.png" class="bot-avatar">`;
            msgDiv.innerHTML = `${avatar}<span class="prompt ${isLoading ? 'loading-blink' : ''}">>></span> <span class="ai-text">${text}</span>`;
        }
        
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        return id;
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Global feedback function attached to window
    window.submitFeedback = async function(question, answer, isPositive) {
        const event = window.event;
        const feedbackBox = event ? event.target.parentElement : null;
        if(feedbackBox) {
            feedbackBox.querySelector('.feedback-msg').innerText = "Logged!";
            feedbackBox.querySelectorAll('button').forEach(b => b.disabled = true);
        }
        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question, answer: answer, is_positive: isPositive })
            });
        } catch(e) {}
    };

    window.escapeQuotes = function(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    };
};