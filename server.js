const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

let players = {};
let playersCards = {}; 
let playerNames = {};  // Objeto para armazenar os nomes dos jogadores
let turnIndex = 0;
let reverseDirection = 1;  // 1 significa sentido horário, -1 contra-horário

const circleRadius = 15;
const stackPositions = [];

let lastPlayedCard = null;

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  socket.on('player-name', (name, age) => {  
    if (!playersCards[socket.id]) {
      const newCards = generateRandomCards(7);
      players[socket.id] = {
        id: socket.id,
        name: name,
        age: age,
        cards: newCards,
      };
      playersCards[socket.id] = newCards; 
    }
  
    playersCards[socket.id] = players[socket.id].cards;
  
    // Verifica se todos os jogadores têm um nome
    const allPlayersNamed = Object.values(players).every(player => player.name);
  
    if (allPlayersNamed) {
      // Emite 'players-update' para todos os jogadores
      io.emit('players-update', Object.values(players));
  
      // Define o primeiro jogador da partida para iniciar o turno
      const playerIds = Object.keys(players);
      const firstPlayerId = playerIds[0];
      
      playerIds.forEach(id => {
        updateStackPositions();

        io.to(id).emit('your-turn', id === firstPlayerId);
        io.emit('stack-positions', stackPositions);
      });
  
    } else {
      // Apenas o jogador atual recebe a atualização parcial até todos terem um nome
      io.to(socket.id).emit('players-update', Object.values(players));
      io.to(socket.id).emit('your-turn', false);  // Jogador atual ainda não tem o turno
    }
  }); 

  socket.on('played-card', (updatedCards, cardColor, cardType, cardNumber) => {
    const playersArray = Object.values(players);
    
    // Identificação da carta jogada
    const cardIdentifier = `${cardColor}_${cardNumber}`;
    const cardIndex = playersCards[socket.id].indexOf(cardIdentifier);
  
    if (players[socket.id]) {
      // Se for a primeira carta jogada
      if (!lastPlayedCard) {
        lastPlayedCard = {
          color: cardColor,
          type: cardType,
          number: cardNumber,
        };
        console.log('Primeira carta jogada:', lastPlayedCard);
        playersCards[socket.id].splice(cardIndex, 1);  // Remove a carta do jogador

        socket.emit('valided-play', true);
        io.emit('create-center-card', { color: cardColor, type: cardType, number: cardNumber });
  
        io.emit('players-update', Object.values(players))

        turnIndex = getNextTurnIndex(turnIndex);
        io.emit('turn-changed', turnIndex, reverseDirection);
        io.emit('players-update', Object.values(players))
  
        // Define o próximo jogador
        const currentTurnPlayerId = playersArray[turnIndex].id;
        io.to(currentTurnPlayerId).emit('your-turn', true);  // Próximo jogador recebe o turno
        io.to(socket.id).emit('your-turn', false);  // Jogador atual perde o turno
  
      } else {
        let isValidPlay = false;
        const actionCards = ['reverse', 'block', '+2'];

        if (actionCards.includes(cardNumber)) {
          if (cardColor === lastPlayedCard.color) {
            isValidPlay = true;
            lastPlayedCard = { color: cardColor, type: cardType, number: cardNumber };  // Atualiza a última carta jogada
          }
        } else {
          if (cardColor === lastPlayedCard.color || cardNumber === lastPlayedCard.number || cardNumber === '+4' || cardNumber === 'onAim' || cardNumber === 'age') {
            isValidPlay = true;
            lastPlayedCard = { color: cardColor, type: cardType, number: cardNumber };
            playersCards[socket.id].splice(cardIndex, 1);  // Remove a carta do jogador
          }
        }
  
        if (isValidPlay) {
          console.log('Jogada válida');
          socket.emit('valided-play', true);
          io.emit('players-update', Object.values(players))
          io.emit('create-center-card', { color: cardColor, type: cardType, number: cardNumber });

          switch (cardNumber) {
            case 'reverse':
              reverseDirection *= -1;
              console.log('Direção invertida');
              break;

            case 'block':
              turnIndex = getNextTurnIndex(turnIndex, 2);  // Pula um turno
              console.log('Próximo jogador bloqueado');
              break;

            case '+2':
              const nextPlayerForPlus2 = playersArray[getNextTurnIndex(turnIndex)].id;
              playersCards[nextPlayerForPlus2].push(...generateRandomCards(2));
              console.log(`Jogador ${nextPlayerForPlus2} recebeu +2 cartas`);
              break;

            case '+4':
              const nextPlayerForPlus4 = playersArray[getNextTurnIndex(turnIndex)].id;
              playersCards[nextPlayerForPlus4].push(...generateRandomCards(4));
              console.log(`Jogador ${nextPlayerForPlus4} recebeu +4 cartas`);

              io.emit('players-update', Object.values(players))

              io.to(socket.id).emit('choose-color', true);

              socket.once('color-chosen', (chosenColor) => {
                console.log(`Jogador ${socket.id} escolheu a cor ${chosenColor}`);
                lastPlayedCard.color = chosenColor;  // Atualiza a cor da última carta jogada

                advanceTurn();  // Avança o turno após a escolha da cor
                io.emit('affect-everyone-color', chosenColor)
              });
              return; // Para evitar que o turno avance automaticamente no final do caso '+4'

            case 'onAim':
              io.to(socket.id).emit('choose-target', { playerIds: Object.keys(players), players });
              console.log(`Jogador ${socket.id} está escolhendo um alvo para comprar 4 cartas`);
          
              // Aguarda a resposta do jogador
              socket.once('target-chosen', (targetPlayerId) => {
                if (playersCards[targetPlayerId]) {
                  playersCards[targetPlayerId].push(...generateRandomCards(4));
                  console.log(`Jogador ${targetPlayerId} recebeu +4 cartas escolhidas pelo jogador ${socket.id}`);
                  
                  io.emit('players-update', Object.values(players));
                  
                  advanceTurn();
                } else {
                  console.log(`Erro: Jogador com ID ${targetPlayerId} não encontrado`);
                }
              });
              return; // Evita que o turno avance automaticamente

            case 'age':
              const nextPlayer = playersArray[getNextTurnIndex(turnIndex)].id;
              const playerAge = playersArray[getNextTurnIndex(turnIndex)].age;
              playersCards[nextPlayer].push(...generateRandomCards(playerAge));
              console.log(`Jogador ${nextPlayer} recebeu ${playerAge} cartas`);

              io.emit('players-update', Object.values(players))

              advanceTurn();

              return; // Para evitar que o turno avance automaticamente no final do caso '+4'
          }

          advanceTurn();  // Avança o turno após a jogada válida
          io.emit('players-update', Object.values(players))

        } else {
          console.log('Jogada inválida');
          socket.emit('valided-play', false);
        }

        function advanceTurn() {
          turnIndex = getNextTurnIndex(turnIndex);
          const playersArray = Object.values(players);
          const currentTurnPlayer = playersArray[turnIndex];
          
          // Emite o evento 'turn-changed' com o índice do turno e o nome do jogador da vez
          io.emit('turn-changed', turnIndex, reverseDirection, currentTurnPlayer.name);
        
          const currentTurnPlayerId = currentTurnPlayer.id;
        
          // Define o próximo jogador como o que tem o turno
          io.to(currentTurnPlayerId).emit('your-turn', true);
        
          // Todos os outros jogadores perdem o turno
          playersArray.forEach(player => {
            if (player.id !== currentTurnPlayerId) {
              io.to(player.id).emit('your-turn', false);
            }
          });
        }
        
      }
    }
  });  

  
  socket.on('request-draw-card', () => {
    const playerIndex = Object.keys(players).indexOf(socket.id);
    const isPlayerTurn = playerIndex === turnIndex;
  
    if (isPlayerTurn) {
      // Gera uma nova carta e adiciona ao array de cartas do jogador
      const newCard = generateRandomCards(1)[0];
      playersCards[socket.id].push(newCard);
  
      // Atualiza o estado dos jogadores e emite para todos os clientes
      io.emit('players-update', Object.values(players));
    } else {
      socket.emit('not-your-turn', 'Não é a sua vez de comprar uma carta.');
    }
  });
  
  
  
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    
    const wasCurrentPlayer = turnIndex === Object.keys(players).indexOf(socket.id);
    
    // Remove o jogador da lista
    delete players[socket.id];
    delete playersCards[socket.id]; // Remove as cartas do jogador desconectado
  
    io.emit('players-update', Object.values(players));
  
    const playerCount = Object.keys(players).length;
  
    if (wasCurrentPlayer && playerCount > 0) {
      // Ajusta o índice do turno, garantindo que ele esteja no intervalo correto
      turnIndex = turnIndex % playerCount;
  
      // Define o próximo jogador para receber o turno
      const nextPlayerId = Object.keys(players)[turnIndex];
      io.to(nextPlayerId).emit('your-turn', true);
    } else if (playerCount === 0) {
      // Caso todos os jogadores desconectem, reinicia o turno
      turnIndex = 0;
    }
  
    // Atualiza as posições da pilha
    updateStackPositions();
    io.emit('stack-positions', stackPositions);
  });

});

function generateRandomCards(quantidade) {
  const normalColors = ['#ff0000', '#fff900', '#2137ff', '#21ff25'];

  const specialCards = [
    { type: 'reverse', probability: 0.3 },
    { type: 'block', probability: 0.3 },
    { type: '+2', probability: 0.2 },
    { type: '+4', probability: 0.1 },
    { type: 'onAim', probability: 0.1 },
    { type: 'age', probability: 0.05 }
  ];

  let cards = [];

  // Função para selecionar uma carta especial com base na probabilidade
  function getRandomSpecialCard() {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const card of specialCards) {
      cumulativeProbability += card.probability;
      if (random < cumulativeProbability) {
        return card.type;
      }
    }
    return null;
  }

  // Gera cartas de acordo com a quantidade solicitada
  for (let i = 0; i < quantidade; i++) {
    const isSpecial = Math.random() < 0.5; // 50% chance de ser especial
    const randomColor = normalColors[Math.floor(Math.random() * normalColors.length)];

    if (isSpecial) {
      const specialCard = getRandomSpecialCard();
      if (specialCard) {
        cards.push(`${randomColor}_${specialCard}`);
      } else {
        // Se não houver carta especial selecionada, cria uma carta normal
        const randomNumber = Math.floor(Math.random() * 10);
        cards.push(`${randomColor}_${randomNumber}`);
      }
    } else {
      // Gera uma carta normal com número
      const randomNumber = Math.floor(Math.random() * 10);
      cards.push(`${randomColor}_${randomNumber}`);
    }
  }

  // Embaralha as cartas (opcional)
  cards = cards.sort(() => Math.random() - 0.5);

  return cards;
}






function updateStackPositions() {
  stackPositions.length = 0;

  const playersArray = Object.values(players).filter(player => player);
  const numberOfPlayers = playersArray.length;

  if (numberOfPlayers === 0) return;

  const cameraPositions = [];
  playersArray.forEach((player, index) => {
    const angle = index * (2 * Math.PI) / numberOfPlayers;
    cameraPositions.push({
      x: Math.cos(angle) * circleRadius,
      z: Math.sin(angle) * circleRadius,
    });
  });

  cameraPositions.forEach((cameraPosition, index) => {
    const nextIndex = (index + 1) % cameraPositions.length;
    const nextCameraPosition = cameraPositions[nextIndex];
    const stackX = (cameraPosition.x + nextCameraPosition.x) / 2;
    const stackZ = (cameraPosition.z + nextCameraPosition.z) / 2;

    stackPositions.push({ playerId: playersArray[index].id, x: stackX, y: 1, z: stackZ });
  });

  io.emit('stack-positions', stackPositions);
}

function getNextTurnIndex(currentIndex, skipTurns = 1) {
  return (currentIndex + reverseDirection * skipTurns + Object.keys(players).length) % Object.keys(players).length;
}

server.listen(PORT, () => {
  console.log(`Servidor ouvindo em http://localhost:${PORT}`);
});
