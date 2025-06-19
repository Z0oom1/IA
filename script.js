// --- SELETORES DE ELEMENTOS ---
const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");
const inputField = messageForm.querySelector(".prompt__form-input");
const logoButton = document.querySelector(".navbar__logo");


let currentUserMessage = null;  
let isGeneratingResponse = false;


const GEMINI_API_KEY = 'AIzaSyAg93TDgQ7lyaDgHwVE6qBCR3A2Za2gRAI'; 


const GEMINI_MODEL = 'gemini-1.5-flash'; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;


const SYSTEM_PROMPT = "Responda sempre em português do Brasil e de forma clara e útil.";



const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};


const updateLogoForTheme = () => {
    if (document.body.classList.contains('light_mode')) {
        logoButton.src = 'assets/Logo-IA-light.png';
    } else {
        logoButton.src = 'assets/Logo-IA.png';
    }
};


const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    if (copyIconElement) copyIconElement.classList.add("hide");


    messageElement.innerText = '';

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        if (wordIndex < wordsArray.length) {
            messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        } else {
            clearInterval(typingInterval);
            isGeneratingResponse = false;

            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            if (copyIconElement) copyIconElement.classList.remove("hide");
        }
    }, 75);
};



const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        if (block.querySelector('.code__copy-btn')) return; // Evita duplicar botões
        const codeElement = block.querySelector('code');
        
        // Verifica se codeElement existe antes de prosseguir
        if (!codeElement) return;

        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text';
        const languageLabel = document.createElement('div');
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add('code__language-label');
        block.appendChild(languageLabel);
        
        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add('code__copy-btn');
        block.appendChild(copyButton);
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000);
            });
        });
    });
};


const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;
    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`;
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000);
};


const getGeminiResponse = async (question) => {
    try {

        const fullQuestion = `${SYSTEM_PROMPT}\n\n${question}`;

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({

                contents: [{
                    role: 'user', 
                    parts: [{
                        text: fullQuestion 
                    }]
                }]
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro da API Gemini:', response.status, errorData);
            let errorMessage = `Erro HTTP: ${response.status}. `;
            if (errorData && errorData.error && errorData.error.message) {
                errorMessage += `Detalhes: ${errorData.error.message}`;
            } else {
                errorMessage += `Resposta do servidor: ${JSON.stringify(errorData)}`;
            }
            return `Desculpe, não consegui obter uma resposta. ${errorMessage}. Por favor, tente novamente mais tarde.`;
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.warn('Resposta inesperada do Gemini:', data);
            return "Recebi uma resposta, mas o formato é inesperado. Por favor, tente novamente.";
        }

    } catch (error) {
        console.error("Erro de rede ou ao processar resposta:", error);
        return "Desculpe, não foi possível conectar à API do Gemini. Verifique sua conexão com a internet.";
    }
};



const getResponseFromGemini = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    let responseText;


    responseText = await getGeminiResponse(currentUserMessage.trim()); 
    
    const parsedResponse = marked.parse(responseText);
    showTypingEffect(responseText, parsedResponse, messageTextElement, incomingMessageElement);


    let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({ userMessage: currentUserMessage, responseText: responseText });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
};


const displayLoadingAnimation = () => {
    const loadingHtml = `
        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>`;
    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);
    

    setTimeout(() => {
        loadingMessageElement.classList.remove("message--loading");
        getResponseFromGemini(loadingMessageElement); 
    }, 500);
};


const handleOutgoingMessage = () => {
    const userMessage = inputField.value.trim();
    if (!userMessage || isGeneratingResponse) return;

    isGeneratingResponse = true; 

    currentUserMessage = userMessage;
    const outgoingMessageHtml = `<div class="message__content"><img class="message__avatar" src="assets/profile.png" alt="User avatar"><p class="message__text"></p></div>`;
    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);
    chatHistoryContainer.scrollTo(0, chatHistoryContainer.scrollHeight);

    setTimeout(displayLoadingAnimation, 300); 

    messageForm.reset();
    document.body.classList.add("hide-header");

};



const resetChatView = () => {
    localStorage.removeItem("saved-api-chats");
    chatHistoryContainer.innerHTML = '';
    document.body.classList.remove("hide-header");

    isGeneratingResponse = false;
    inputField.placeholder = "Escreva o seu prompt...";
};

const initializeApp = () => {
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.querySelector("i").className = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    

    updateLogoForTheme();

    resetChatView(); 
};




clearChatButton.addEventListener('click', () => {
    if (confirm("Você tem certeza que quer deletar todo o histórico da conversa?")) {
        localStorage.removeItem("saved-api-chats"); // Apenas limpa o histórico de chats
        resetChatView(); // Reseta a interface
    }
});


logoButton.addEventListener('click', resetChatView);


themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggleButton.querySelector("i").className = isLightTheme ? "bx bx-moon" : "bx bx-sun";

    updateLogoForTheme();
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        inputField.value = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

initializeApp();
