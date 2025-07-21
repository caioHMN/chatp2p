// Lógica WebRTC e interação com o popup.html
document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const createOfferBtn = document.getElementById('createOffer');
    const offerText = document.getElementById('offerText');
    const answerText = document.getElementById('answerText');
    const createAnswerBtn = document.getElementById('createAnswer');
    const sendAnswerBtn = document.getElementById('sendAnswer');
    const receivedAnswerText = document.getElementById('receivedAnswer');
    const connectFinalBtn = document.getElementById('connectFinal');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChat');

    let peerConnection;
    let dataChannel;

    // Configurações básicas de ICE (usando STUN público do Google)
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Você pode adicionar mais servidores STUN/TURN se necessário
        ]
    };

    // --- Funções WebRTC ---

    function createPeerConnection() {
        peerConnection = new RTCPeerConnection(iceServers);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                // Quando um ICE candidate é gerado, adicione-o à oferta/resposta
                // Por enquanto, vamos logar para você copiar junto
                console.log('New ICE candidate:', event.candidate);
            }
        };

        peerConnection.onconnectionstatechange = () => {
            statusDiv.textContent = `Estado da Conexão: ${peerConnection.connectionState}`;
            console.log('Connection state change:', peerConnection.connectionState);
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state change:', peerConnection.iceConnectionState);
        };

        // Listener para quando o outro lado adicionar um Data Channel
        peerConnection.ondatachannel = event => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
        };
    }

    function setupDataChannel(channel) {
        dataChannel = channel; // Garante que a variável global esteja atualizada
        dataChannel.onopen = () => {
            chatMessages.innerHTML += '<p><strong>[Chat Conectado]</strong></p>';
            console.log('Data Channel is open!');
        };
        dataChannel.onmessage = event => {
            chatMessages.innerHTML += `<p>Amigo: ${event.data}</p>`;
            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll para o final
        };
        dataChannel.onclose = () => {
            chatMessages.innerHTML += '<p><strong>[Chat Desconectado]</strong></p>';
            console.log('Data Channel closed!');
        };
        dataChannel.onerror = error => {
            console.error('Data Channel error:', error);
        };
    }


    // --- Event Listeners dos Botões ---

    createOfferBtn.onclick = async () => {
        createPeerConnection();

        // Cria o Data Channel do lado que gera a oferta
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel(dataChannel);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Coleta os ICE candidates antes de exibir a oferta completa
        // Isso é uma simplificação. Em um app real, você coletaria os candidatos
        // à medida que eles chegam e os trocaria incrementalmente.
        // Para o teste manual, vamos esperar um pouco para pegar alguns.
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1s para alguns candidatos

        const fullOffer = {
            sdp: peerConnection.localDescription.sdp,
            type: peerConnection.localDescription.type,
            iceCandidates: []
        };

        // Isso é uma forma rudimentar de coletar candidatos.
        // A forma ideal é enviar o candidato quando ele for gerado (onicecandidate)
        // mas para o propósito de copiar/colar em um bloco, é mais simples assim.
        // No entanto, para uma aplicação robusta, você PRECISA enviar candidatos um a um.
        // Por simplicidade aqui, vamos apenas mostrar a oferta/resposta SDP.
        // Os candidatos seriam trocados separadamente ou embutidos no SDP (que é o que a string SDP faz).

        offerText.value = JSON.stringify(fullOffer.sdp); // Apenas o SDP por simplicidade na cópia/cola
        statusDiv.textContent = 'Oferta gerada! Copie e envie para seu amigo.';
        console.log('Oferta SDP gerada:', fullOffer.sdp);
    };


    createAnswerBtn.onclick = async () => {
        const receivedOffer = JSON.parse(answerText.value); // Espera que o amigo cole o SDP
        createPeerConnection(); // Inicializa o PeerConnection

        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: receivedOffer // Espera que o receivedOffer seja a string SDP
        }));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Espera um pouco para alguns candidatos (mesma lógica do createOffer)
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const fullAnswer = {
            sdp: peerConnection.localDescription.sdp,
            type: peerConnection.localDescription.type,
            iceCandidates: [] // Candidatos seriam coletados e trocados separadamente
        };

        sendAnswerBtn.textContent = 'Copie isso e envie para o amigo!';
        sendAnswerBtn.onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(fullAnswer.sdp))
                .then(() => alert('Resposta copiada para a área de transferência!'))
                .catch(err => console.error('Erro ao copiar:', err));
        };

        answerText.value = JSON.stringify(fullAnswer.sdp); // Exibe a resposta SDP
        statusDiv.textContent = 'Resposta gerada! Copie e envie de volta para seu amigo.';
        console.log('Resposta SDP gerada:', fullAnswer.sdp);
    };


    connectFinalBtn.onclick = async () => {
        const finalAnswer = JSON.parse(receivedAnswerText.value); // Espera que o amigo cole a resposta SDP

        if (!peerConnection) {
            // Se o Peer A reiniciar a página, ele precisaria refazer a oferta e trocar.
            // Para este exemplo simples, assumimos que o Peer A já gerou uma oferta.
            statusDiv.textContent = 'Erro: Gere a oferta primeiro!';
            return;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: finalAnswer // Espera que o finalAnswer seja a string SDP
        }));
        statusDiv.textContent = 'Conectando...';
        console.log('Resposta final recebida e configurada. Tentando conectar...');
    };

    // --- Funções de Chat ---
    sendChatBtn.onclick = () => {
        const message = chatInput.value;
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(message);
            chatMessages.innerHTML += `<p>Eu: ${message}</p>`;
            chatInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            statusDiv.textContent = 'Chat não conectado. Tente novamente.';
            console.warn('Data Channel not open for sending message.');
        }
    };

    // Lidar com Enter no input do chat
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatBtn.click();
        }
    });

});