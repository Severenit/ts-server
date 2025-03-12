import { Card } from './card.js';

export class Game {
    constructor(settings, rules) {
        this.settings = settings;
        this.rules = rules;
        this.board = Array(9).fill(null);
        this.boardElements = Array(9).fill(null); // Элементы на игровом поле
        this.playerHand = [];
        this.aiHand = [];
        this.currentTurn = settings.firstTurn || this._getRandomFirstTurn();
        this.playerScore = 5;
        this.aiScore = 5;
        this.gameStatus = 'playing'; // 'playing', 'finished', 'sudden_death'
        this.winner = null; // 'player', 'ai', 'draw'
        this.suddenDeathRound = 0; // Счетчик раундов внезапной смерти
        this.originalPlayerCards = []; // Сохраняем оригинальные карты для sudden death
        this.originalAiCards = [];
        this.defeatReward = null;
        this.cardExchange = null;
    }

    /**
     * Случайный выбор первого хода
     * @private
     * @returns {'player'|'ai'} Кто ходит первым
     */
    _getRandomFirstTurn() {
        return Math.random() < 0.5 ? 'player' : 'ai';
    }

    /**
     * Инициализация новой игры
     * @param {Array<string>} playerCardIds - Массив ID карт игрока
     * @returns {Object} Состояние игры
     */
    initializeGame(playerCardIds = []) {
        const deck = Card.createDeck();
        
        if (playerCardIds.length === 5) {
            // Если игрок предоставил свои карты
            this.playerHand = playerCardIds
                .map(id => deck.find(card => card.id === id))
                .filter(card => card !== undefined)
                .map(card => card.clone().setOwner('player'));

            if (this.playerHand.length !== 5) {
                throw new Error('Invalid player cards');
            }
        } else {
            // Если карты не предоставлены, выбираем случайные из первых 3 уровней
            const lowLevelCards = [];
            for (let level = 1; level <= 3; level++) {
                lowLevelCards.push(...Card.getCardsByLevel(level));
            }
            this.playerHand = this._getRandomCards(lowLevelCards, 5).map(card => card.setOwner('player'));
        }

        // Оцениваем среднюю силу карт игрока
        const averagePlayerPower = this.playerHand.reduce((sum, card) => sum + card.calculatePower(), 0) / 5;
        
        // Подбираем карты AI соответствующей силы
        this.aiHand = this._selectAICards(averagePlayerPower).map(card => card.setOwner('ai'));
        
        // Сохраняем копии карт для sudden death
        this.originalPlayerCards = this.playerHand.map(card => card.clone());
        this.originalAiCards = this.aiHand.map(card => card.clone());
        
        // Инициализируем элементы на поле, если включено правило ELEMENTAL
        if (this.rules.ELEMENTAL) {
            this._initializeBoardElements();
        }
        
        return this.getState();
    }

    /**
     * Подбор карт для AI на основе силы карт игрока
     * @private
     * @param {number} playerPower - Средняя сила карт игрока
     * @returns {Array<Card>} Подобранные карты для AI
     */
    _selectAICards(playerPower) {
        const deck = Card.createDeck();
        let aiCards = [];

        // Определяем диапазон уровней карт на основе силы карт игрока
        let levelRanges;
        if (playerPower < 30) {
            levelRanges = [
                { level: 1, weight: 0.5 },
                { level: 2, weight: 0.3 },
                { level: 3, weight: 0.2 }
            ];
        } else if (playerPower < 50) {
            levelRanges = [
                { level: 2, weight: 0.4 },
                { level: 3, weight: 0.35 },
                { level: 4, weight: 0.25 }
            ];
        } else if (playerPower < 70) {
            levelRanges = [
                { level: 3, weight: 0.35 },
                { level: 4, weight: 0.3 },
                { level: 5, weight: 0.25 },
                { level: 6, weight: 0.1 }
            ];
        } else if (playerPower < 85) {
            levelRanges = [
                { level: 4, weight: 0.25 },
                { level: 5, weight: 0.3 },
                { level: 6, weight: 0.25 },
                { level: 7, weight: 0.15 },
                { level: 8, weight: 0.05 }
            ];
        } else {
            // Для самого высокого уровня силы
            levelRanges = [
                { level: 5, weight: 0.2 },
                { level: 6, weight: 0.25 },
                { level: 7, weight: 0.25 },
                { level: 8, weight: 0.2 },
                { level: 9, weight: 0.08 },
                { level: 10, weight: 0.02 } // Очень редкий шанс получить карту 10 уровня
            ];
        }

        // Функция для выбора случайного уровня с учетом весов
        const selectRandomLevel = () => {
            const totalWeight = levelRanges.reduce((sum, range) => sum + range.weight, 0);
            let random = Math.random() * totalWeight;
            
            for (const range of levelRanges) {
                if (random < range.weight) {
                    return range.level;
                }
                random -= range.weight;
            }
            
            return levelRanges[0].level; // Fallback на первый уровень из диапазона
        };

        // Собираем пул карт для каждой карты AI отдельно
        while (aiCards.length < 5) {
            const selectedLevel = selectRandomLevel();
            const levelCards = Card.getCardsByLevel(selectedLevel);
            
            // Выбираем случайную карту из выбранного уровня
            const randomIndex = Math.floor(Math.random() * levelCards.length);
            const selectedCard = levelCards[randomIndex];
            
            // Проверяем, что такой карты еще нет в руке AI
            if (!aiCards.some(card => card.id === selectedCard.id)) {
                aiCards.push(selectedCard);
            }
        }

        return aiCards;
    }

    /**
     * Инициализация элементов на игровом поле
     * @private
     */
    _initializeBoardElements() {
        const elements = ['FIRE', 'WATER', 'EARTH', 'THUNDER', 'ICE', 'WIND', 'POISON', 'HOLY'];
        this.boardElements = Array(9).fill(null).map(() => {
            // 25% шанс появления элемента на клетке
            return Math.random() < 0.25 ? elements[Math.floor(Math.random() * elements.length)] : null;
        });
    }

    /**
     * Инициализация раунда внезапной смерти
     * @private
     */
    _initializeSuddenDeath() {
        this.suddenDeathRound++;
        this.gameStatus = 'sudden_death';
        this.board = Array(9).fill(null);
        this.currentTurn = this.settings.firstTurn || 'player';
        this.playerScore = 5;
        this.aiScore = 5;
        
        // Восстанавливаем оригинальные карты
        this.playerHand = this.originalPlayerCards.map(card => card.clone().setOwner('player'));
        this.aiHand = this.originalAiCards.map(card => card.clone().setOwner('ai'));
    }

    /**
     * Получение награды за проигрыш
     * @returns {Card|null} Карта-награда или null, если награда не положена
     */
    getDefeatReward() {
        // Награда выдается только при проигрыше и завершенной игре
        if (this.gameStatus !== 'finished' || this.winner !== 'ai') {
            return null;
        }

        // Находим максимальный уровень карт игрока
        const playerMaxLevel = Math.max(...this.originalPlayerCards.map(card => Math.ceil(parseInt(card.id) / 11)));
        
        // Определяем диапазон уровней для награды (1-2 уровня выше максимального уровня игрока)
        const minRewardLevel = Math.min(playerMaxLevel + 1, 9); // Не выше 9 уровня
        const maxRewardLevel = Math.min(playerMaxLevel + 2, 10); // Не выше 10 уровня
        
        // Получаем все карты подходящих уровней
        const deck = Card.createDeck();
        const rewardPool = deck.filter(card => {
            const cardLevel = Math.ceil(parseInt(card.id) / 11);
            return cardLevel >= minRewardLevel && cardLevel <= maxRewardLevel;
        });

        // Если пул наград пуст, возвращаем null
        if (rewardPool.length === 0) {
            return null;
        }

        // Выбираем случайную карту из пула наград
        // Для карт 10 уровня снижаем вероятность выпадения
        const rewards = rewardPool.map(card => {
            const cardLevel = Math.ceil(parseInt(card.id) / 11);
            return {
                card,
                weight: cardLevel === 10 ? 0.2 : 1 // Снижаем вес для карт 10 уровня
            };
        });

        // Считаем общий вес
        const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
        
        // Выбираем карту с учетом весов
        let random = Math.random() * totalWeight;
        for (const reward of rewards) {
            if (random < reward.weight) {
                return reward.card;
            }
            random -= reward.weight;
        }

        return rewards[0].card; // Fallback на первую карту из пула
    }

    /**
     * Выбор карты для обмена после окончания игры
     * @returns {Object|null} Информация об обмене картами или null, если обмен не происходит
     */
    getCardExchange() {
        // Обмен происходит только при завершенной игре и не в ничью
        if (this.gameStatus !== 'finished' || this.winner === 'draw') {
            return null;
        }

        // Функция выбора карты с учетом силы
        const selectCardForExchange = (cards) => {
            // Сортируем карты по силе
            const sortedCards = [...cards].sort((a, b) => b.calculatePower() - a.calculatePower());
            
            // Разделяем карты на группы по силе
            const strongCards = sortedCards.filter(card => card.calculatePower() >= 70);
            const mediumCards = sortedCards.filter(card => card.calculatePower() >= 40 && card.calculatePower() < 70);
            const weakCards = sortedCards.filter(card => card.calculatePower() < 40);

            // Выбираем группу карт с разными вероятностями
            const random = Math.random();
            let selectedGroup;
            
            if (random < 0.2 && strongCards.length > 0) {
                // 20% шанс выбрать сильную карту
                selectedGroup = strongCards;
            } else if (random < 0.6 && mediumCards.length > 0) {
                // 40% шанс выбрать среднюю карту
                selectedGroup = mediumCards;
            } else if (weakCards.length > 0) {
                // 40% шанс выбрать слабую карту
                selectedGroup = weakCards;
            } else {
                // Если группа пустая, берем из всех карт
                selectedGroup = sortedCards;
            }

            // Выбираем случайную карту из выбранной группы
            return selectedGroup[Math.floor(Math.random() * selectedGroup.length)];
        };

        let takenCard, givenCard;

        if (this.winner === 'player') {
            // Игрок выиграл - забирает карту у AI
            takenCard = selectCardForExchange(this.originalAiCards);
            this.cardExchange = {
                type: 'player_win',
                takenCard: takenCard.clone(),
                message: `Вы выиграли карту ${takenCard.name}!`
            };
        } else {
            // AI выиграл - забирает карту у игрока
            takenCard = selectCardForExchange(this.originalPlayerCards);
            this.cardExchange = {
                type: 'ai_win',
                takenCard: takenCard.clone(),
                message: `AI забирает вашу карту ${takenCard.name}`
            };
        }

        return this.cardExchange;
    }

    /**
     * Проверка окончания игры
     * @private
     * @returns {boolean} true если игра окончена
     */
    _checkGameEnd() {
        // Игра заканчивается, когда у игроков не осталось карт
        const isGameEnd = this.playerHand.length === 0 || this.aiHand.length === 0;
        
        if (isGameEnd) {
            if (this.playerScore > this.aiScore) {
                this.gameStatus = 'finished';
                this.winner = 'player';
            } else if (this.aiScore > this.playerScore) {
                this.gameStatus = 'finished';
                this.winner = 'ai';
            } else {
                // Ничья
                if (this.rules.SUDDEN_DEATH) {
                    this._initializeSuddenDeath();
                } else {
                    this.gameStatus = 'finished';
                    this.winner = 'draw';
                }
            }
        }
        
        return isGameEnd;
    }

    /**
     * Получение текущего состояния игры
     * @returns {Object} Состояние игры
     */
    getState() {
        const state = {
            settings: this.settings,
            rules: this.rules,
            board: this.board.map((card, index) => {
                if (!card) return null;
                const cardObj = card.toClientObject(false);
                
                // Добавляем информацию о бонусах для карт на поле
                if (this.rules.ELEMENTAL && this.boardElements[index]) {
                    cardObj.elementalBonus = {
                        element: this.boardElements[index],
                        bonus: card.element === this.boardElements[index] ? 1 : -1
                    };
                }

                // Добавляем информацию о специальных правилах
                cardObj.specialRules = {
                    same: false,    // Карта захвачена по правилу Same
                    plus: false,    // Карта захвачена по правилу Plus
                    combo: false,   // Карта захвачена по комбо Same+Plus
                    wasUsedInRule: false  // Карта участвовала в правиле (например, её значение использовалось для Plus)
                };

                return cardObj;
            }),
            boardElements: this.boardElements,
            playerHand: this.playerHand.map(card => card.toClientObject(false)),
            aiHand: this.aiHand.map(card => card.toClientObject(!this.rules.OPEN)),
            currentTurn: this.currentTurn,
            playerScore: this.playerScore,
            aiScore: this.aiScore,
            gameStatus: this.gameStatus,
            winner: this.winner,
            originalPlayerCards: this.originalPlayerCards.map(card => card.toClientObject(false)),
            originalAiCards: this.originalAiCards.map(card => card.toClientObject(false))
        };

        // Добавляем информацию о внезапной смерти
        if (this.gameStatus === 'sudden_death') {
            state.suddenDeath = {
                round: this.suddenDeathRound,
                message: `Sudden Death Round ${this.suddenDeathRound}`
            };
        }

        // Добавляем информацию об окончании игры
        if (this.gameStatus === 'finished') {
            state.gameEndInfo = {
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                },
                cardsOwnership: this.board.map((card, index) => ({
                    position: index,
                    owner: card ? card.owner : null,
                    originalOwner: card ? card.originalOwner : null
                })),
                totalRounds: this.suddenDeathRound + 1,
                originalCards: {
                    player: this.originalPlayerCards.map(card => card.toClientObject(false)),
                    ai: this.originalAiCards.map(card => card.toClientObject(false))
                }
            };

            // Добавляем информацию об обмене картами, если он произошел
            if (this.cardExchange) {
                state.gameEndInfo.cardExchange = {
                    type: this.cardExchange.type,
                    card: this.cardExchange.takenCard.toClientObject(false),
                    message: this.cardExchange.message
                };
            }
        }

        return state;
    }

    /**
     * Выполнение хода игрока
     * @param {number} cardIndex - Индекс карты в руке
     * @param {number} position - Позиция на поле
     * @returns {Object} Результат хода
     */
    makeMove(cardIndex, position) {
        cardIndex = parseInt(cardIndex, 0);
        position = parseInt(position, 0);

        if (this.gameStatus === 'finished') {
            throw new Error('Game is already finished');
        }

        if (this.currentTurn !== 'player') {
            throw new Error('Not player\'s turn');
        }

        if (position < 0 || position >= 9) {
            throw new Error(`Invalid position = ${position} = ${this.board}`);
        }

        if (cardIndex < 0 || cardIndex >= this.playerHand.length) {
            throw new Error('Invalid card index');
        }

        const card = this.playerHand[cardIndex];
        const captureResult = this._placeCard(card, position, 'player');
        
        // Удаляем использованную карту из руки
        this.playerHand.splice(cardIndex, 1);
        
        // Обновляем счет
        this._updateScore();
        
        // Проверяем окончание игры
        const isGameEnd = this._checkGameEnd();
        
        // Меняем ход только если игра не закончена
        if (!isGameEnd) {
            this.currentTurn = 'ai';
        }

        return {
            placedCard: card.toClientObject(false),
            position,
            capturedCards: captureResult.capturedCards.map(({ position, card }) => ({
                position: parseInt(position, 0),
                card: card.toClientObject(false)
            })),
            captureDirections: captureResult.captureDirections,
            specialRules: captureResult.specialRules,
            elementalBonuses: captureResult.elementalBonuses,
            isGameEnd,
            gameEndInfo: isGameEnd ? {
                winner: this.winner,
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                }
            } : null
        };
    }

    /**
     * Выполнение хода AI
     * @returns {Object} Результат хода
     */
    makeAIMove() {
        if (this.gameStatus === 'finished') {
            throw new Error('Game is already finished');
        }

        if (this.currentTurn !== 'ai') {
            throw new Error('Not AI\'s turn');
        }

        const move = this._calculateBestMove();
        
        if (!move) {
            throw new Error('No valid moves available');
        }

        const { cardIndex, position } = move;
        const card = this.aiHand[cardIndex];
        const captureResult = this._placeCard(card, position, 'ai');
        
        // Удаляем использованную карту из руки
        this.aiHand.splice(cardIndex, 1);
        
        // Обновляем счет
        this._updateScore();
        
        // Проверяем окончание игры
        const isGameEnd = this._checkGameEnd();
        
        // Меняем ход только если игра не закончена
        if (!isGameEnd) {
            this.currentTurn = 'player';
        }

        return {
            placedCard: card.toClientObject(false),
            position,
            capturedCards: captureResult.capturedCards.map(({ position, card }) => ({
                position,
                card: card.toClientObject(false)
            })),
            captureDirections: captureResult.captureDirections,
            specialRules: captureResult.specialRules,
            elementalBonuses: captureResult.elementalBonuses,
            isGameEnd,
            gameEndInfo: isGameEnd ? {
                winner: this.winner,
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                }
            } : null
        };
    }

    /**
     * Размещение карты на поле и проверка захвата
     * @private
     */
    _placeCard(card, position, player) {
        const capturedCards = [];
        const captureDirections = [];
        const specialRules = {
            same: false,
            plus: false,
            combo: false
        };
        
        // Добавляем информацию об элементальных бонусах
        const elementalBonuses = {
            placedCard: {
                element: null,
                bonus: 0
            },
            capturedCards: []
        };
        
        // Устанавливаем владельца карты
        card.setOwner(player);
        this.board[position] = card;

        // Проверяем элементальный бонус для размещенной карты
        if (this.rules.ELEMENTAL && this.boardElements[position]) {
            elementalBonuses.placedCard = {
                element: this.boardElements[position],
                bonus: card.element === this.boardElements[position] ? 1 : -1
            };
        }

        // Проверяем соседние карты для захвата
        const adjacentPositions = this._getAdjacentPositions(position);
        
        // Собираем значения для правила PLUS
        const adjacentValues = [];
        
        // Собираем карты для правила SAME
        const sameValueCards = new Map();

        for (const [adjPos, direction] of adjacentPositions) {
            const adjCard = this.board[adjPos];
            if (adjCard && adjCard.owner !== player) {
                const attackValue = card.getValue(direction);
                const defendValue = adjCard.getValue(this._getOppositeDirection(direction));
                
                // Проверяем элементальный бонус для соседней карты
                let elementalBonus = null;
                if (this.rules.ELEMENTAL && this.boardElements[adjPos]) {
                    elementalBonus = {
                        element: this.boardElements[adjPos],
                        bonus: adjCard.element === this.boardElements[adjPos] ? 1 : -1
                    };
                }
                
                // Сохраняем для правила SAME
                if (attackValue === defendValue) {
                    if (!sameValueCards.has(attackValue)) {
                        sameValueCards.set(attackValue, []);
                    }
                    sameValueCards.get(attackValue).push({ pos: adjPos, card: adjCard });
                    // Отмечаем карту как участвующую в правиле
                    adjCard.specialRules = { same: true, plus: false, combo: false, wasUsedInRule: true };
                }
                
                // Сохраняем для правила PLUS
                if (this.rules.PLUS) {
                    adjacentValues.push({ 
                        sum: attackValue + defendValue,
                        pos: adjPos,
                        card: adjCard
                    });
                    // Отмечаем карту как участвующую в правиле
                    adjCard.specialRules = { same: false, plus: true, combo: false, wasUsedInRule: true };
                }

                if (this._checkCapture(card, adjCard, direction)) {
                    capturedCards.push({ position: adjPos, card: adjCard });
                    captureDirections.push(direction);
                    adjCard.setOwner(player);
                    
                    // Добавляем информацию об элементальном бонусе для захваченной карты
                    if (elementalBonus) {
                        elementalBonuses.capturedCards.push({
                            position: adjPos,
                            ...elementalBonus
                        });
                    }
                }
            }
        }

        // Проверяем правило SAME
        if (this.rules.SAME && sameValueCards.size > 0) {
            for (const [value, cards] of sameValueCards) {
                if (cards.length >= 2) {
                    specialRules.same = true;
                    cards.forEach(({ pos, card }) => {
                        if (!capturedCards.some(c => c.position === pos)) {
                            capturedCards.push({ position: pos, card });
                            card.setOwner(player);
                            // Обновляем информацию о правиле
                            card.specialRules = { same: true, plus: false, combo: false, wasUsedInRule: true };
                        }
                    });
                }
            }
        }

        // Проверяем правило PLUS
        if (this.rules.PLUS && adjacentValues.length >= 2) {
            const sums = new Map();
            adjacentValues.forEach(({ sum, pos, card }) => {
                if (!sums.has(sum)) sums.set(sum, []);
                sums.get(sum).push({ pos, card });
            });

            for (const [sum, cards] of sums) {
                if (cards.length >= 2) {
                    specialRules.plus = true;
                    cards.forEach(({ pos, card }) => {
                        if (!capturedCards.some(c => c.position === pos)) {
                            capturedCards.push({ position: pos, card });
                            card.setOwner(player);
                            // Обновляем информацию о правиле
                            card.specialRules = { same: false, plus: true, combo: false, wasUsedInRule: true };
                        }
                    });
                }
            }
        }

        // Если сработало и SAME и PLUS, отмечаем комбо
        if (specialRules.same && specialRules.plus) {
            specialRules.combo = true;
            // Обновляем информацию о комбо для всех захваченных карт
            capturedCards.forEach(({ card }) => {
                card.specialRules.combo = true;
            });
        }

        // Обновляем общий счет на основе карт на поле
        this._updateScore();

        return {
            capturedCards,
            captureDirections,
            specialRules,
            elementalBonuses
        };
    }

    /**
     * Получение случайных карт из колоды
     * @private
     */
    _getRandomCards(deck, count) {
        const cards = [...deck];
        const selected = [];
        for (let i = 0; i < count; i++) {
            const index = Math.floor(Math.random() * cards.length);
            selected.push(cards.splice(index, 1)[0]);
        }
        return selected;
    }

    /**
     * Получение соседних позиций и направлений
     * @private
     */
    _getAdjacentPositions(position) {
        const adjacent = [];
        // top
        if (position > 2) adjacent.push([position - 3, 'top']);
        // right
        if (position % 3 < 2) adjacent.push([position + 1, 'right']);
        // bottom
        if (position < 6) adjacent.push([position + 3, 'bottom']);
        // left
        if (position % 3 > 0) adjacent.push([position - 1, 'left']);
        return adjacent;
    }

    /**
     * Проверка захвата карты с учетом элементов
     * @private
     */
    _checkCapture(attackingCard, defendingCard, direction) {
        // Получаем базовые значения карт
        let attackValue = attackingCard.getValue(direction);
        let defendValue = defendingCard.getValue(this._getOppositeDirection(direction));

        // Применяем элементальные бонусы, если правило включено
        if (this.rules.ELEMENTAL) {
            const attackingPosition = this.board.indexOf(attackingCard);
            const defendingPosition = this.board.indexOf(defendingCard);

            // Бонус +1 если элемент карты совпадает с элементом клетки, -1 если не совпадает
            if (this.boardElements[attackingPosition]) {
                if (attackingCard.element === this.boardElements[attackingPosition]) {
                    attackValue += 1;
                } else {
                    attackValue -= 1;
                }
            }

            if (this.boardElements[defendingPosition]) {
                if (defendingCard.element === this.boardElements[defendingPosition]) {
                    defendValue += 1;
                } else {
                    defendValue -= 1;
                }
            }
        }

        // Проверяем захват
        let captured = attackValue > defendValue;

        // Дополнительные правила
        if (this.rules.SAME) {
            // TODO: Implement Same rule
        }
        if (this.rules.PLUS) {
            // TODO: Implement Plus rule
        }

        return captured;
    }

    /**
     * Получение противоположного направления
     * @private
     */
    _getOppositeDirection(direction) {
        switch (direction) {
            case 'top': return 'bottom';
            case 'right': return 'left';
            case 'bottom': return 'top';
            case 'left': return 'right';
            default: throw new Error('Invalid direction');
        }
    }

    /**
     * Обновление счета после захвата карт
     * @private
     */
    _updateScore() {
        // Сбрасываем счет
        this.playerScore = 0;
        this.aiScore = 0;
        
        // Подсчитываем карты на поле
        for (const card of this.board) {
            if (card) {
                if (card.owner === 'player') {
                    this.playerScore++;
                } else if (card.owner === 'ai') {
                    this.aiScore++;
                }
            }
        }

        // Добавляем очки за карты в руках
        this.playerScore += this.playerHand.length;
        this.aiScore += this.aiHand.length;
    }

    /**
     * Расчет лучшего хода для AI
     * @private
     */
    _calculateBestMove() {
        let bestScore = -Infinity;
        let bestMove = null;
        let hasValidMoves = false;

        // Проверяем наличие свободных позиций
        const emptyPositions = this.board.reduce((acc, cell, index) => {
            if (cell === null) acc.push(index);
            return acc;
        }, []);

        if (emptyPositions.length === 0) {
            throw new Error('Нет свободных позиций на поле');
        }

        if (this.aiHand.length === 0) {
            throw new Error('У AI нет карт в руке');
        }

        // Перебираем все возможные ходы
        for (let cardIndex = 0; cardIndex < this.aiHand.length; cardIndex++) {
            for (const position of emptyPositions) {
                hasValidMoves = true;
                const score = this._evaluateMove(this.aiHand[cardIndex], position);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { cardIndex, position };
                }
            }
        }

        // Если нет лучшего хода, но есть валидные ходы - выбираем случайный
        if (!bestMove && hasValidMoves) {
            const randomCardIndex = Math.floor(Math.random() * this.aiHand.length);
            const randomPosition = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
            bestMove = { cardIndex: randomCardIndex, position: randomPosition };
        }

        if (!bestMove) {
            throw new Error('Нет доступных ходов');
        }

        return bestMove;
    }

    /**
     * Оценка потенциального хода
     * @private
     */
    _evaluateMove(card, position) {
        let score = 0;
        const adjacent = this._getAdjacentPositions(position);

        for (const [adjPos, direction] of adjacent) {
            const adjCard = this.board[adjPos];
            if (adjCard) {
                if (this._checkCapture(card, adjCard, direction)) {
                    score += 1;
                }
            }
        }

        return score;
    }
}