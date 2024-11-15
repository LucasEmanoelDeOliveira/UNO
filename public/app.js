const socket = io();

// Configuração da cena Three.js
const scene = new THREE.Scene();

// Criando a câmera principal para o jogador local
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Posição da câmera principal, ajustando a altura para ter uma visão mais elevada
const cameraRadius = 10;
camera.position.set(cameraRadius, 8, cameraRadius); // Ajuste de altura no eixo Y (5 para mais alto)
camera.rotation.x = -0.3; // Rotação para baixo, para olhar o centro da cena

// Configuração do renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let players = [];
let localPlayer = null;
let playerName = '';   // Variável para armazenar o nome do jogador
let playerAge = '';   // Variável para armazenar o nome do jogador

const cardSpacing = 0.9;      // Distância entre as cartas
const maxRotationZ = -0.3;    // Máxima rotação para inclinação no eixo Z
const maxDrop = -0.5;         // Máxima queda em Y para as cartas nas extremidades
const maxHover = 0.2

let rotationSpeed = 1; // Velocidade da rotação (ajuste conforme necessário)
let planeArrows;
let clock = new THREE.Clock(); // Instancia um relógio para controle do tempo

function createPlane() {
  const cardGeometry = new THREE.PlaneGeometry(10, 10); // Tamanho do plano

  const cardTexture = new THREE.TextureLoader().load('./images/Rotator.png');

  cardTexture.minFilter = THREE.LinearFilter;
  cardTexture.magFilter = THREE.LinearFilter;
  cardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  cardTexture.transparent = true;

  // Cria o material com a textura carregada
  const cardMaterial = new THREE.MeshBasicMaterial({
    map: cardTexture,
    side: THREE.DoubleSide,
    transparent: true,   // Ativa a transparência no material
    opacity: 0.5         // Define a opacidade (0 para totalmente transparente, 1 para totalmente opaco)
  });

  planeArrows = new THREE.Mesh(cardGeometry, cardMaterial);

  planeArrows.position.set(0, 1, 0);
  planeArrows.rotation.x = Math.PI / 2;
  planeArrows.scale.x = -1;
  scene.add(planeArrows);
}

createPlane()


function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth); // Converte a data de nascimento em um objeto Date
  const today = new Date(); // Obtém a data atual
  let age = today.getFullYear() - birthDate.getFullYear(); // Calcula a diferença de anos
  
  // Ajusta a idade se a data de aniversário já passou ou não no ano atual
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--; // Subtrai um ano caso o aniversário ainda não tenha ocorrido este ano
  }
  
  return age; // Retorna a idade calculada
}

function startGame() {
  playerName = document.getElementById('playerName').value;  // Obtém o nome inserido
  playerDate = document.getElementById('playerDate').value;  // Obtém a data de nascimento inserida

  if (playerName.trim() === '' || playerDate.trim() === '') {
    alert("Por favor, preencha todos os campos necessários.");
    return;
  }

  const playerAge = calculateAge(playerDate);

  if (playerAge >= 20) {
    alert('Só se for a idade da tua vó que tu tem ' + playerAge + ' anos, bota essa merda direito, porra')
    return;
  } else if (playerAge < 13) {
    alert('Oque que tu ta fazendo o 9° ano com ' + playerAge + ' anos, bota essa merda direito, porra')
    return;
  } else {
    socket.emit('player-name', playerName, playerAge);
  }

  document.getElementById('nameEntry').style.display = 'none';
}



socket.on('players-update', (updatedPlayers) => {
  console.log("Recebendo atualização de jogadores:", updatedPlayers);

  players = updatedPlayers;

  // Atualiza os jogadores e remove os que não estão mais presentes
  updatePlayers();

  // Remover as cartas de jogadores desconectados
  updatedPlayers.forEach(player => {
    const existingPlayerGroup = scene.getObjectByName(player.id);
    if (!existingPlayerGroup) {
      return; // Se o jogador não estiver na cena, não faz nada
    }

    // Remove as cartas do jogador que não está mais presente
    if (!updatedPlayers.find(updatedPlayer => updatedPlayer.id === player.id)) {
      scene.remove(existingPlayerGroup);
      console.log(`Removendo cartas do jogador desconectado: ${player.id}`);
    }
  });
});

let stackPosition;

socket.on('stack-positions', (positions) => {
  // Verificando se o formato das posições está correto
  if (Array.isArray(positions)) {
    positions.forEach(position => {
      // Verificando se cada posição tem as propriedades x, y, e z
      if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
        stackPosition = position;  // Atualiza a posição da pilha com a do servidor
        createLocalStackCard(); 
      } else {
        console.error("Posição inválida recebida:", position);
      }
    });
  } else {
    console.error("Formato de posições inválido, esperado um array:", positions);
  }
});

const localPlayerCardsGroup = new THREE.Group();
const opponentCardsGroup = new THREE.Group();

scene.add(localPlayerCardsGroup);


const backCardTexture = new THREE.TextureLoader().load('./images/BackCard.jpg');

// Adiciona uma variável global para armazenar o grupo de cartas da pilha
let stackCardGroup = new THREE.Group();

function createLocalStackCard() {
  // Limpa as cartas anteriores da pilha
  stackCardGroup.clear();  // Remove todos os objetos do grupo (cartas anteriores)

  // Adiciona o grupo à cena para que ele seja renderizado
  scene.add(stackCardGroup);

  const stackX = stackPosition.x;
  const stackY = stackPosition.y;
  const stackZ = stackPosition.z;

  // Cria novas cartas da pilha
  for (let i = 0; i < 15; i++) {
    const stackCardGeometry = new THREE.PlaneGeometry(1, 1.5);
    const stackCardMaterial = new THREE.MeshBasicMaterial({ map: backCardTexture, side: THREE.DoubleSide });
    const stackCard = new THREE.Mesh(stackCardGeometry, stackCardMaterial);
    const randomRotationZ = THREE.MathUtils.degToRad(Math.random() * 30);

    // Define a posição de cada carta empilhada com deslocamento no eixo Y
    stackCard.position.set(stackX, stackY + (i * 0.05), stackZ);  // Empilha com altura progressiva
    
    stackCard.rotation.x = Math.PI / 2;  // Rotaciona as cartas para o eixo X
    stackCard.rotation.z = randomRotationZ;  // Rotaciona aleatoriamente em torno do eixo Z

    // Adiciona a carta ao grupo de cartas da pilha
    stackCardGroup.add(stackCard);  
  }
}


function updatePlayers() {
  opponentCardsGroup.clear();
  localPlayerCardsGroup.clear(); // Limpa as cartas do jogador local
  scene.add(localPlayerCardsGroup);  // Adiciona o grupo de cartas à cena

  // Obtém o jogador local
  localPlayer = players.find(player => player.id === socket.id);
  if (!localPlayer) {
    console.error("Jogador local não encontrado.");
    return;
  }

  // Atualiza a posição da pilha de cartas local
  createLocalStackCard();

  // Adiciona as cartas do jogador local
// Adiciona as cartas do jogador local
localPlayer.cards.forEach((cardData, i) => {
  if (!cardData) {
    console.error("Carta inválida detectada:", cardData);
    return; // Pula para a próxima carta se cardData for nulo ou indefinido
  }

  const [cardColor, ...cardDetails] = cardData.split('_');  // Divide a string em cor e os detalhes restantes
  let cardType, cardNumber;

  if (cardDetails.length === 1) {
    cardNumber = cardDetails[0]; // Único detalhe é o número
  } else if (cardDetails.length === 2) {
    cardType = cardDetails[0];   // Exemplo: 'reverse' ou 'block'
    cardNumber = cardDetails[1]; // Número da carta
  }

  const cardGeometry = new THREE.PlaneGeometry(1, 1.5);
  let cardTexture;

  if (cardNumber === '+4') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/+4.jpg`);
  } else if (cardNumber === 'onAim') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/onAim.jpg`);
  } else if (cardNumber === 'age') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/age.jpg`);
  } else {
    const textureFileName = cardType || cardNumber;
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/${cardColor.substring(1).toUpperCase()}/${textureFileName}.jpg`);
  }

  // Ajustes de qualidade da textura
  cardTexture.minFilter = THREE.LinearFilter;
  cardTexture.magFilter = THREE.LinearFilter;
  cardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture, side: THREE.DoubleSide });
  const card = new THREE.Mesh(cardGeometry, cardMaterial);

  const offsetX = (i - Math.floor(localPlayer.cards.length / 2)) * cardSpacing;
  const rotationFactor = (i - Math.floor(localPlayer.cards.length / 2)) / (localPlayer.cards.length / 2);
  const offsetY = -1 + (Math.abs(rotationFactor) * maxDrop);
  const rotationZ = rotationFactor * maxRotationZ;

  card.position.set(offsetX, offsetY, -3);
  card.rotation.z = rotationZ;

  card.userData = {
    color: cardColor,
    type: cardType,
    number: cardNumber,
    originalRotationZ: rotationZ,
    originalY: offsetY
  };

  localPlayerCardsGroup.add(card);
});

  

  const circleRadius = 15;
  const angleStep = (2 * Math.PI) / players.length;
  
  // Agora, removemos todas as cartas dos adversários e as recriamos
players.forEach((player, index) => {
  if (player.id === socket.id) return; // Ignora o jogador local

  // Limpa as cartas do jogador adversário, se existirem
  const existingPlayerGroup = scene.getObjectByName(player.id);
  if (existingPlayerGroup) {
    existingPlayerGroup.traverse(child => {
      if (child instanceof THREE.Mesh) {
        scene.remove(child);  // Remove as cartas da cena
      }
    });
    console.log(`Removendo cartas antigas do jogador: ${player.id}`);
  }

  opponentCardsGroup.name = player.id; // Nomeia o grupo com o ID do jogador
  scene.add(opponentCardsGroup);

  // Calcula a posição da câmera do adversário, centralizada em relação ao centro
  const angle = index * angleStep;
  const playerX = Math.cos(angle) * circleRadius;
  const playerZ = Math.sin(angle) * circleRadius;

  const baseRadius = 2.5; // Raio base para o arco das cartas
  const maxRadius = 5; // Raio máximo para o arco (opcional)
  const maxAngle = Math.PI / 1.5; // Ângulo máximo para distribuir as cartas (ex: 120 graus)
  
  // Ajusta o raio e o ângulo total com base no número de cartas
  const totalCards = player.cards.length;
  const arcRadius = Math.min(baseRadius + totalCards * 0.2, maxRadius); // O raio aumenta conforme o número de cartas, limitado a `maxRadius`
  const totalAngle = Math.min(maxAngle, Math.PI / 4 + (totalCards - 1) * 0.1); // Ângulo ajustável que varia com a quantidade de cartas
  
  // Adiciona as cartas do adversário
  player.cards.forEach((cardImage, i) => {
    const cardGeometry = new THREE.PlaneGeometry(1, 1.5);
    const cardMaterial = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load('./images/BackCard.jpg'),
      side: THREE.DoubleSide
    });
    const card = new THREE.Mesh(cardGeometry, cardMaterial);
  
    // Ajusta o ângulo de cada carta dentro do `totalAngle`
    const cardAngle = totalCards === 1 
      ? 0 // Se houver apenas uma carta, a posição é centralizada
      : (i - (totalCards - 1) / 2) * (totalAngle / (totalCards - 1)); // Distribui as cartas em um arco
  
    // Calcula a posição no arco
    const cardX = playerX + -arcRadius * Math.cos(cardAngle + angle);
    const cardZ = playerZ + -arcRadius * Math.sin(cardAngle + angle);
  
    card.position.set(cardX, 2, cardZ); // Posiciona a carta no arco
  
    // Calcula a direção para que a carta olhe para o centro da cena
    const direction = new THREE.Vector3(0, 0, 0).sub(card.position).normalize();
    const angleToCenter = Math.atan2(direction.x, direction.z); 
    card.rotation.y = -angleToCenter;
  
    opponentCardsGroup.add(card); // Adiciona a carta ao grupo de cartas do adversário
  });
  
});
  

  // Atualiza a posição da câmera para o jogador local
  const localPlayerIndex = players.indexOf(localPlayer);
  const localAngle = localPlayerIndex * angleStep;
  camera.position.set(Math.cos(localAngle) * circleRadius, 5, Math.sin(localAngle) * circleRadius);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
}



function moveCameraToPlayer(targetPosition) {
  camera.position.copy(targetPosition); // Ajusta a posição diretamente
  camera.lookAt(new THREE.Vector3(0, 0, 0)); // A câmera sempre olha para o centro
}

// Listener para ajustar a cena ao redimensionar a tela
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let cardsExpanded = true;
let hoveredCard = null; // Variável para armazenar a carta que está sendo "hovered"

function expandCards() {
  if (cardsExpanded) return; // Se já está expandido, não faz nada
  cardsExpanded = true;

  localPlayerCardsGroup.children.forEach((card, i) => {
    const targetPosition = {
      x: (i - Math.floor(localPlayer.cards.length / 2)) * cardSpacing,
      y: -1 + Math.abs((i - Math.floor(localPlayer.cards.length / 2)) / (localPlayer.cards.length / 2)) * maxDrop,
      z: -3
    };

    // Anima cada carta para a posição expandida original
    gsap.to(card.position, { 
      x: targetPosition.x, 
      y: targetPosition.y, 
      z: targetPosition.z, 
      duration: 0.3 
    });

    // Restaura a rotação original
    gsap.to(card.rotation, { 
      z: card.userData.originalRotationZ, 
      duration: 0.3 
    });
  });
}

// Função para empilhar as cartas
function stackCards() {
  if (!cardsExpanded) return;
  cardsExpanded = false;

  localPlayerCardsGroup.children.forEach((card, i) => {
    const randomRotationZ = THREE.MathUtils.degToRad(Math.random() * 20 - 10);

    // Garante que todas as cartas vão para a posição y = -1
    gsap.to(card.position, { 
      x: 0, 
      y: -1,  // Garante que todas as cartas têm y = -1
      z: -3 , 
      duration: 0.3 
    });

    // Anima a rotação para uma rotação aleatória em Z
    gsap.to(card.rotation, { 
      z: randomRotationZ, 
      duration: 0.3 
    });
  });
}


let isMouseOverCards = false; 

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Atualiza o raycaster com a posição do mouse
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(localPlayerCardsGroup.children);

  // Se o mouse está sobre alguma carta
  if (intersects.length > 0) {
    if (!isMouseOverCards) {
      // Se o mouse entrou na área das cartas, chama expandCards()
      expandCards();
      isMouseOverCards = true; // Marca que o mouse está sobre as cartas
    }

    const card = intersects[0].object; // A carta sobre a qual o mouse está
    if (hoveredCard !== card) {
      // Se a carta atual não for a carta que já está sendo "hovered"
      if (hoveredCard) {
        // Se já havia uma carta sendo "hovered", volta para a posição original
        gsap.to(hoveredCard.position, { y: hoveredCard.userData.originalY, duration: 0.3 });
        console.log(`Carta selecionada: ${hoveredCard.id}`)
      }
      // A nova carta que está sendo "hovered"
      hoveredCard = card;
      gsap.to(card.position, { y: card.position.y + maxHover, duration: 0.3 }); // Aumenta a posição Y para "subir"
    }
  } else {
    if (isMouseOverCards) {
      // Se o mouse saiu da área das cartas, chama stackCards()
      stackCards();
      isMouseOverCards = false; // Marca que o mouse não está mais sobre as cartas
    }

    // Se o mouse não está sobre nenhuma carta, faz a carta que estava sendo "hovered" voltar
    if (hoveredCard) {
      gsap.to(hoveredCard.position, { y: hoveredCard.userData.originalY, duration: 0.3 });
      hoveredCard = null; // Reseta a carta que estava sendo "hovered"
    }
  }
});






let isTurn = false;  // Variável para armazenar se é o turno do jogador
let reverseDirection = 1; // Inicializando a direção


socket.on('your-turn', (isTurnStatus) => {
  isTurn = isTurnStatus;  // Atualiza o status de turno do jogador
  console.log("Turno do jogador:", isTurnStatus);

  if (isTurn) {
    console.log("É o seu turno!");
    enableCardInteraction(true);  // Habilita a interação com as cartas
  } else {
    console.log("Não é o seu turno.");
    enableCardInteraction(false);  // Desabilita a interação com as cartas
  }
});

// Função para habilitar ou desabilitar a interação com as cartas
function enableCardInteraction(enabled) {
  console.log("Habilitar interação com cartas:", enabled);

  localPlayerCardsGroup.children.forEach(card => {
    if (!card.userData.originalColor) {
      card.userData.originalColor = card.material.color.clone();  // Salva a cor original se ainda não estiver salva
    }

    if (enabled) {
      card.material.color.copy(card.userData.originalColor);  // Restaura a cor original
      card.material.transparent = false;  // Torna a carta opaca
    } else {
      card.material.color.set(card.userData.originalColor.clone().multiplyScalar(0.3));  // Escurece a cor original
      card.material.transparent = true;  // Torna a carta semi-transparente
    }
  });
}


// Quando o turno mudar, o servidor emite o evento "turn-changed"
socket.on('turn-changed', (newTurnIndex, newReverseDirection, currentPlayerName) => {
  console.log("Novo índice de turno:", newTurnIndex);
  console.log("Sentido da direção (1 para horário, -1 para anti-horário):", newReverseDirection);

  // Atualiza o índice de turno
  turnIndex = newTurnIndex;

  // Atualiza o texto do turno com o nome do jogador atual
  const textElement = document.getElementById('turnText');
  if (currentPlayerName) {
    textElement.textContent = `É a vez de: ${currentPlayerName}`;
  }
});

// Atualiza a interface com o novo turno
function updateTurn(newTurnIndex) {
  const playerIds = Object.keys(players);  // Lista dos IDs dos jogadores
  const totalPlayers = playerIds.length;  // Total de jogadores

  // Atualiza o índice de turno com base na direção
  newTurnIndex = (newTurnIndex + (reverseDirection === 1 ? 1 : -1) + totalPlayers) % totalPlayers;

  // Inverte o eixo X de planeArrows para refletir a direção do turno
  if (reverseDirection === 1 && planeArrows.scale.x < 0 || reverseDirection === -1 && planeArrows.scale.x > 0) {
    planeArrows.scale.x *= -1;
  }

  // Verifica se o novo índice de turno é válido
  if (newTurnIndex >= 0 && newTurnIndex < totalPlayers) {
    const currentPlayerId = playerIds[newTurnIndex];  // ID do jogador atual
    console.log("Turno atual:", currentPlayerId);

    // Verifica se o jogador atual é o da vez e emite para o servidor
    socket.emit('your-turn', currentPlayerId === socket.id);

    // Atualiza a variável de turno localmente
    isTurn = (currentPlayerId === socket.id);

    // Atualiza a interface do jogador (habilita ou desabilita a interação com as cartas)
    enableCardInteraction(isTurn);  // Habilita ou desabilita a interação com as cartas dependendo do turno

    // Imprime o próximo jogador da vez
    const nextPlayerId = playerIds[newTurnIndex];
    console.log("Próximo jogador da vez:", nextPlayerId);
  } else {
    console.error("Índice de turno inválido!");
  }
}


// Quando o jogador clicar em uma carta
window.addEventListener('click', (event) => {
  console.log("Verificando se é o turno do jogador:", isTurn);
  if (!isTurn) {
    return;  // Bloqueia qualquer interação se não for o turno
  }

  // Calcula as coordenadas do mouse no espaço 3D
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Configura o raycaster para detectar o objeto clicado
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(localPlayerCardsGroup.children);

  if (intersects.length > 0) {
    const card = intersects[0].object;

    const cardColor = card.userData.color;
    const cardType = card.userData.type; // Tipo especial, se houver
    const cardNumber = card.userData.number; // Tipo especial, se houver

    console.log("Carta clicada: " + `${cardColor}_${cardNumber}`);

    const cardIdentifier = `${cardColor}_${cardNumber}`; // Se tiver tipo, combine com a cor

    // Verifica se a carta está no inventário local do jogador
    const cardIndex = localPlayer.cards.indexOf(cardIdentifier);

    if (cardIndex !== -1) {
      socket.emit('played-card', localPlayer.cards, cardColor, cardType, cardNumber);

      socket.once('valided-play', (isValid) => {
        if (isValid) {
          console.log("Jogada válida! Carta jogada:", cardColor, cardNumber);

          localPlayer.cards.splice(cardIndex, 1);  // Remove a carta do inventário local
          localPlayerCardsGroup.remove(card);
        } else {
          console.log("Jogada inválida!");
        }
      });
    } else {
      console.log("Carta não encontrada no inventário local.");
    }
  } else {
    console.log("Nenhuma carta clicada.");
  }

});

window.addEventListener('click', (event) => {
  // Normaliza a posição do mouse para o sistema de coordenadas -1 a 1
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Atualiza o raycaster com a posição do mouse e a câmera
  raycaster.setFromCamera(mouse, camera);

  // Verifica se o raycaster intercepta o stackCardGroup
  const intersects = raycaster.intersectObjects(stackCardGroup.children);
  if (intersects.length > 0) {
    // Emite um evento para o servidor solicitando a compra de uma carta
    socket.emit('request-draw-card');
  }
});




let centerCardsY = 0.001;  // Começa com um valor muito pequeno para o Y

function createCardAtCenter(cardColor, cardType, cardNumber) {
  const cardGeometry = new THREE.PlaneGeometry(2, 3);  // Tamanho da carta

  let cardTexture;

  // Verifica se é uma carta +4
  if (cardNumber === '+4') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/+4.jpg`);
  } else if (cardNumber === 'onAim') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/onAim.jpg`);
  } else if (cardNumber === 'age') {
    cardTexture = new THREE.TextureLoader().load(`./images/Cards/age.jpg`);
  } else {
    const texturePath = `./images/Cards/${cardColor.substring(1).toUpperCase()}/${cardType || cardNumber}.jpg`;
    cardTexture = new THREE.TextureLoader().load(texturePath);
  }
  
  // Ajustes de qualidade da textura
  cardTexture.minFilter = THREE.LinearFilter; // Melhora a qualidade da textura quando vista de longe
  cardTexture.magFilter = THREE.LinearFilter; // Melhora a qualidade da textura quando vista de perto
  cardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Ativa anisotropia máxima para maior nitidez
  

  // Definir o material da carta
  const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture, side: THREE.DoubleSide });

  // Criar a carta com o material da textura
  const card = new THREE.Mesh(cardGeometry, cardMaterial);

  // Definir a rotação da carta de forma aleatória (ou outro comportamento desejado)
  const randomRotationZ = THREE.MathUtils.degToRad(Math.random() * 50 - 10);

  // Posicionar a carta no centro e ajustar o valor de Y
  card.position.set(0, 1 + centerCardsY, 0);
  centerCardsY += 0.001;

  // Definir a rotação da carta
  card.rotation.x = Math.PI / 2;
  card.rotation.z = randomRotationZ;

  // Adicionar a carta à cena
  scene.add(card);
}


socket.on('create-center-card', (cardData) => {
  createCardAtCenter(cardData.color, cardData.type, cardData.number);
});


socket.on('choose-target', ({ playerIds, players }) => {
  const localPlayerId = socket.id; // Obtém o ID do jogador local

  // Cria o div de seleção de alvo
  const targetContainer = document.createElement('div');
  targetContainer.id = 'targetSelection';
  targetContainer.style.position = 'fixed';
  targetContainer.style.top = '50%';
  targetContainer.style.left = '50%';
  targetContainer.style.transform = 'translate(-50%, -50%)';
  targetContainer.style.backgroundColor = 'white';
  targetContainer.style.padding = '20px';
  targetContainer.style.border = '2px solid black';
  targetContainer.style.borderRadius = '10px';
  targetContainer.style.zIndex = '1000';

  const instruction = document.createElement('h1');
  instruction.textContent = 'Selecione o jogador que deve receber 4 Cartas abaixo:';
  instruction.style.fontFamily = 'Arial'
  instruction.style.fontWeight = 'bold'
  instruction.style.fontSize = '20px'
  targetContainer.appendChild(instruction);

  // Filtra os jogadores, excluindo o jogador local
  playerIds
    .filter(playerId => playerId !== localPlayerId) // Exclui o ID do jogador local
    .forEach((playerId) => {
      if (players[playerId]) {
        const playerButton = document.createElement('button');
        playerButton.textContent = players[playerId].name;
        playerButton.style.padding = '5px';
        playerButton.style.backgroundColor = '#47a9ff'
        playerButton.style.border = 'none'
        playerButton.style.color = 'white'
        
        // Adiciona evento de clique para escolher o alvo e remover o container
        playerButton.addEventListener('click', () => {
          socket.emit('target-chosen', playerId); // Envia o ID do jogador escolhido
          
          // Remove o container de seleção após a escolha
          document.body.removeChild(targetContainer);
        });
        targetContainer.appendChild(playerButton);
      } else {
        console.warn(`Player com ID ${playerId} não encontrado em players.`);
      }
    });

  // Adiciona o div ao corpo da página
  document.body.appendChild(targetContainer);
});




let isChoosingColor = false;
let selectedColor = null;

// Ouve o evento de escolher a cor
socket.on('choose-color', (canChoose) => {
  if (canChoose) {
    displayColorSelectionPanel();  // Função para mostrar o painel de cores
    isChoosingColor = true;
  }
});

socket.on('affect-everyone-color', (chooseColor) => {
  const splashSVG = document.getElementById('splashSVG');

  splashSVG.style.filter = `hue-rotate(${chooseColor}deg)`;  // Modifica a cor do SVG com filtro
  splashSVG.style.display = 'block';
  
  // Define as propriedades iniciais do SVG
  splashSVG.style.width = '0px';
  splashSVG.style.height = '0px';
  splashSVG.style.opacity = '1';

  // Passo 1: Aumente o tamanho do SVG (width e height)
  setTimeout(() => {
    splashSVG.style.transition = 'width 0.8s ease-out, height 0.8s ease-out, opacity 0.8s ease-out';
    splashSVG.style.width = '10000px';  // Ajuste esse valor conforme necessário
    splashSVG.style.height = '10000px';
  }, 10);

  setTimeout(() => {
    const darkerColor = shadeColor(chooseColor, -90);
    scene.background = new THREE.Color(darkerColor);  // Altera a cor de fundo da cena
  }, 800);

  setTimeout(() => {
    splashSVG.style.opacity = '0';
  }, 1000);

  setTimeout(() => {
    splashSVG.style.width = '0px';
    splashSVG.style.height = '0px';
    setTimeout(() => {
      splashSVG.style.opacity = '1';
    }, 5000)
  }, 1800);
})

// Função para exibir o painel de seleção de cor
function displayColorSelectionPanel() {
  const panel = document.createElement('div');
  panel.classList.add('color-panel');
  document.body.appendChild(panel);

  // Criação das opções de cor
  const colors = ['#ff0000', '#fff900', '#2137ff', '#21ff25'];
  colors.forEach(color => {
    const colorButton = document.createElement('button');
    colorButton.style.backgroundColor = color;
    colorButton.addEventListener('click', () => chooseColor(color));
    panel.appendChild(colorButton);
  });
}

// Função para o jogador escolher uma cor
function chooseColor(color) {
  if (isChoosingColor) {
    selectedColor = color;
    socket.emit('color-chosen', selectedColor);
    removeColorSelectionPanel();
    isChoosingColor = false;
    }
}


function shadeColor(color, percent) {
  let R = parseInt(color.slice(1, 3), 16),
      G = parseInt(color.slice(3, 5), 16),
      B = parseInt(color.slice(5, 7), 16);

  // Calcula novos valores RGB, limitados para o intervalo 0-255
  R = Math.max(0, Math.min(255, R * (1 + percent / 100)));
  G = Math.max(0, Math.min(255, G * (1 + percent / 100)));
  B = Math.max(0, Math.min(255, B * (1 + percent / 100)));

  // Converte de volta para hexadecimal
  const newColor = "#" + ((1 << 24) + (Math.round(R) << 16) + (Math.round(G) << 8) + Math.round(B)).toString(16).slice(1);
  return newColor;
}



// Função para remover o painel de seleção de cor
function removeColorSelectionPanel() {
  const panel = document.querySelector('.color-panel');
  if (panel) {
    panel.remove();
  }
}

function animate() {
  requestAnimationFrame(animate);

  localPlayerCardsGroup.position.copy(camera.position);
  localPlayerCardsGroup.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5));
  localPlayerCardsGroup.lookAt(camera.position);

  // Obtém o tempo passado desde o último quadro
  const delta = clock.getDelta();

  // Controla a rotação suave com base no tempo
  if (reverseDirection === 1) {
    planeArrows.rotation.z += rotationSpeed * delta; // Sentido horário
  } else {
    planeArrows.rotation.z -= rotationSpeed * delta; // Sentido anti-horário
  }

  renderer.render(scene, camera);
}

animate();