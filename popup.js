document.addEventListener('DOMContentLoaded', () => {
  const statusDiv            = document.getElementById('status');
  const createOfferBtn       = document.getElementById('createOffer');
  const offerText            = document.getElementById('offerText');
  const answerText           = document.getElementById('answerText');
  const createAnswerBtn      = document.getElementById('createAnswer');
  const sendAnswerBtn        = document.getElementById('sendAnswer');
  const receivedAnswerText   = document.getElementById('receivedAnswer');
  const connectFinalBtn      = document.getElementById('connectFinal');
  const chatMessages         = document.getElementById('chatMessages');
  const chatInput            = document.getElementById('chatInput');
  const sendChatBtn          = document.getElementById('sendChat');
  const reconnectBtn         = document.getElementById('reconnectBtn');
  const reconnectOfferText   = document.getElementById('reconnectOfferText');

  let peerConnection;
  let dataChannel;

  const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // Cria e configura o RTCPeerConnection
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    peerConnection.onicecandidate = ({ candidate }) => {
      console.log('Novo ICE candidate:', candidate);
      // You might want to send candidates to the other peer here.
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      statusDiv.textContent = `Estado da Conexão: ${state}`;

      if (state === 'disconnected' || state === 'failed') {
        // Gatilho automático de reconexão
        tryReconnect();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('Estado ICE:', peerConnection.iceConnectionState);
    };

    peerConnection.ondatachannel = ({ channel }) => setupDataChannel(channel);
  }

  function setupDataChannel(channel) {
    dataChannel = channel;
    dataChannel.onopen = () => {
      chatMessages.innerHTML += '<p><strong>[Chat Conectado]</strong></p>';
    };
    dataChannel.onmessage = e => {
      chatMessages.innerHTML += `<p>Amigo: ${e.data}</p>`;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    dataChannel.onclose = () => {
      chatMessages.innerHTML += '<p><strong>[Chat Desconectado]</strong></p>';
    };
    dataChannel.onerror = err => console.error('Data Channel error:', err);
  }

  // --- Geração de Oferta ---
createOfferBtn.onclick = async () => {
        createPeerConnection();        
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel(dataChannel);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);       
        await new Promise(resolve => setTimeout(resolve, 1000)); 
            const fullOffer = {
            sdp: peerConnection.localDescription.sdp,
            type: peerConnection.localDescription.type,
            iceCandidates: []
        };        
        offerText.value = JSON.stringify(fullOffer.sdp);
        statusDiv.textContent = 'Oferta gerada! Copie e envie para seu amigo.';
        console.log('Oferta SDP gerada:', fullOffer.sdp);
    };

  // --- Geração de Resposta ---
 createAnswerBtn.onclick = async () => {
        const receivedOffer = JSON.parse(answerText.value);
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: receivedOffer 
        }));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const fullAnswer = {
            sdp: peerConnection.localDescription.sdp,
            type: peerConnection.localDescription.type,
            iceCandidates: [] 
        };
        sendAnswerBtn.textContent = 'Copie isso e envie para o amigo!';
        sendAnswerBtn.onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(fullAnswer.sdp))
                .then(() => alert('Resposta copiada para a área de transferência!'))
                .catch(err => console.error('Erro ao copiar:', err));
        };
        answerText.value = JSON.stringify(fullAnswer.sdp); 
        statusDiv.textContent = 'Resposta gerada! Copie e envie de volta para seu amigo.';
        console.log('Resposta SDP gerada:', fullAnswer.sdp);
    };

  // --- Finalizar Conexão ---
  connectFinalBtn.onclick = async () => {
        const finalAnswer = JSON.parse(receivedAnswerText.value);
        if (!peerConnection) {            
            statusDiv.textContent = 'Erro: Gere a oferta primeiro!';
            return;
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: finalAnswer
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
    
   // --- Função de Reconexão com iceRestart ---
  async function tryReconnect() {
    if (!peerConnection ||
       (peerConnection.connectionState !== 'disconnected' &&
        peerConnection.connectionState !== 'failed')) {
      console.log('Reconexão não necessária.');
      return;
    }

    console.log('Tentando reconectar (iceRestart)...');
    statusDiv.textContent = 'Tentando reconectar...';

    try {
      // Gera nova oferta forçando iceRestart
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      await new Promise(r => setTimeout(r, 1000));

      // NOVO: Embrulhe o SDP em um objeto JSON para consistência
      const fullReconnectOffer = {
          sdp: peerConnection.localDescription.sdp,
          type: peerConnection.localDescription.type,
          iceCandidates: [] // Você pode querer preencher isso se for coletar candidatos
      };

      // Exibe a SDP de reconexão para copy/paste manual (agora como string JSON)
      reconnectOfferText.value = JSON.stringify(fullReconnectOffer.sdp); // Transforme em string JSON apenas o SDP para consistência com a lógica anterior
      statusDiv.textContent = 'Nova SDP gerada! Copie e envie ao outro peer.';
      console.log('Oferta de reconexão SDP gerada:', fullReconnectOffer.sdp)
    } 
    catch (err) {
      console.error('Erro na reconexão:', err);
      statusDiv.textContent = 'Falha na tentativa de reconexão.';
    }
  
  // Opção manual de reconexão pelo usuário
  reconnectBtn.onclick = () => tryReconnect();
}}
);