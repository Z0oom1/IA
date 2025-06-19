// --- SELETORES DE ELEMENTOS ---
const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll(".suggests__item");
const themeToggleButton = document.getElementById("themeToggler");
const clearChatButton = document.getElementById("deleteButton");
const inputField = messageForm.querySelector(".prompt__form-input");
const logoButton = document.querySelector(".navbar__logo");

// --- ESTADO DA APLICAÇÃO ---
let currentUserMessage = null;  
let isGeneratingResponse = false;

// --- CONFIGURAÇÃO GEMINI ---
// Use sua chave de API REAL
const GEMINI_API_KEY = 'AIzaSyAg93TDgQ7lyaDgHwVE6qBCR3A2Za2gRAI'; 
// Usando o modelo que sabemos que funciona para sua chave e v1beta
const GEMINI_MODEL = 'gemini-1.5-flash'; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// PROMPT DE SISTEMA PARA RESPOSTAS EM PORTUGUÊS
// Esta instrução será enviada junto com cada pergunta do usuário para guiar a IA.
const SYSTEM_PROMPT = "Responda sempre em português do Brasil e de forma clara e útil.";


// --- FUNÇÕES AUXILIARES ---

/**
 * Cria um novo elemento de mensagem de chat e o retorna.
 */
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};

/**
 * Atualiza a imagem do logo com base no tema atual (claro ou escuro).
 */
const updateLogoForTheme = () => {
    if (document.body.classList.contains('light_mode')) {
        logoButton.src = 'assets/Logo-IA-light.png';
    } else {
        logoButton.src = 'assets/Logo-IA.png';
    }
};

/**
 * Exibe o efeito de digitação para a resposta da IA.
 */
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    if (copyIconElement) copyIconElement.classList.add("hide");

    // Limpa o conteúdo inicial antes de começar a digitar
    messageElement.innerText = '';

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        if (wordIndex < wordsArray.length) {
            messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        } else {
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            // Após digitar, insere o HTML completo para renderizar markdown e código
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            if (copyIconElement) copyIconElement.classList.remove("hide");
        }
    }, 75);
};

/**
 * Adiciona botões de "copiar" a todos os blocos de código.
 */
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

/**
 * Copia o texto de uma mensagem para a área de transferência.
 */
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;
    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`;
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000);
};

/**
 * Faz uma requisição à API do Gemini para obter uma resposta.
 */
const getGeminiResponse = async (question) => {
    try {
        // Combinamos o SYSTEM_PROMPT diretamente com a pergunta do usuário
        // para garantir que a instrução de idioma seja sempre enviada.
        const fullQuestion = `${SYSTEM_PROMPT}\n\n${question}`; // Adiciona quebras de linha para separar

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // Agora, enviamos apenas uma "part" com a role 'user',
                // que inclui tanto a instrução de sistema quanto a pergunta do usuário.
                contents: [{
                    role: 'user', // Especificamos o papel como 'user'
                    parts: [{
                        text: fullQuestion // Usamos a pergunta completa
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


// --- LÓGICA PRINCIPAL ---

/**
 * Obtém uma resposta diretamente do Gemini.
 */
const getResponseFromGemini = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");
    let responseText;

    // Envia a mensagem para o Gemini com o prompt do sistema
    responseText = await getGeminiResponse(currentUserMessage.trim()); 
    
    const parsedResponse = marked.parse(responseText);
    showTypingEffect(responseText, parsedResponse, messageTextElement, incomingMessageElement);

    // Salva a conversa para persistência do histórico
    let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
    savedConversations.push({ userMessage: currentUserMessage, responseText: responseText });
    localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
};

/**
 * Exibe a animação de "carregando" e depois busca a resposta.
 */
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
    
    // Pequeno atraso para a animação aparecer antes de buscar a resposta real
    setTimeout(() => {
        loadingMessageElement.classList.remove("message--loading");
        getResponseFromGemini(loadingMessageElement); 
    }, 500);
};

/*  Lida com o envio de uma mensagem do usuário. */
const handleOutgoingMessage = () => {
    const userMessage = inputField.value.trim();
    if (!userMessage || isGeneratingResponse) return;

    isGeneratingResponse = true; // Bloqueia novos envios enquanto gera resposta

    currentUserMessage = userMessage;
    const outgoingMessageHtml = `<div class="message__content"><img class="message__avatar" src="assets/profile.png" alt="User avatar"><p class="message__text"></p></div>`;
    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);
    chatHistoryContainer.scrollTo(0, chatHistoryContainer.scrollHeight); // Rola antes da animação de loading para dar espaço

    setTimeout(displayLoadingAnimation, 300); 

    messageForm.reset();
    document.body.classList.add("hide-header");

};

// --- FUNÇÕES DE INICIALIZAÇÃO E RESET ---

const resetChatView = () => {
    localStorage.removeItem("saved-api-chats"); // Remove o histórico de chats
    chatHistoryContainer.innerHTML = '';
    document.body.classList.remove("hide-header");

    isGeneratingResponse = false; // Assegura que o estado seja resetado
    inputField.placeholder = "Escreva o seu prompt...";
};

/**
 * Inicializa a aplicação na primeira carga.
 */
const initializeApp = () => {
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.querySelector("i").className = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    
    // ATUALIZA O LOGO NA INICIALIZAÇÃO
    updateLogoForTheme();

    // Resetamos a visualização e histórico ao iniciar
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

    // ATUALIZA O LOGO AO TROCAR O TEMA
    updateLogoForTheme();
});

// Enviar mensagem pelo formulário
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// Clicar em uma sugestão
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        inputField.value = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
initializeApp();