export class Card {
    constructor(id, name, top, right, bottom, left, element = null, imageUrl = null) {
        this.id = id;
        this.name = name;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
        this.element = element;
        this.imageUrl = imageUrl || `/img/cards/${id.padStart(3, '0')}.png`;
        this.owner = null;
        this.originalOwner = null;
    }

    static createDeck() {
        return [
            // Level 1
            new Card('1', 'Geezard', 1, 5, 4, 1, null),
            new Card('2', 'Funguar', 5, 3, 1, 1, null),
            new Card('3', 'Bite Bug', 1, 5, 3, 3, null),
            new Card('4', 'Red Bat', 6, 2, 1, 1, null),
            new Card('5', 'Blobra', 2, 5, 3, 1, null),
            new Card('6', 'Gayla', 2, 4, 1, 4, 'THUNDER'),
            new Card('7', 'Gesper', 1, 1, 5, 4, null),
            new Card('8', 'Fastitocalon-F', 3, 1, 5, 2, 'EARTH'),
            new Card('9', 'Blood Soul', 2, 1, 1, 6, null),
            new Card('10', 'Caterchipillar', 4, 3, 2, 4, null),
            new Card('11', 'Cockatrice', 2, 6, 1, 2, 'THUNDER'),

            // Level 2
            new Card('12', 'Grat', 7, 1, 1, 3, null),
            new Card('13', 'Buel', 6, 3, 2, 2, null),
            new Card('14', 'Mesmerize', 5, 4, 3, 3, null),
            new Card('15', 'Glacial Eye', 6, 3, 1, 4, 'ICE'),
            new Card('16', 'Belhelmel', 3, 3, 4, 5, null),
            new Card('17', 'Thrustaevis', 5, 5, 3, 2, 'WIND'),
            new Card('18', 'Anacondaur', 5, 5, 1, 3, 'POISON'),
            new Card('19', 'Creeps', 5, 2, 2, 5, 'THUNDER'),
            new Card('20', 'Grendel', 4, 2, 4, 5, 'THUNDER'),
            new Card('21', 'Jelleye', 3, 7, 2, 1, null),
            new Card('22', 'Grand Mantis', 5, 3, 2, 5, null),

            // Level 3
            new Card('23', 'Forbidden', 6, 2, 6, 3, null),
            new Card('24', 'Armadodo', 6, 6, 3, 1, 'EARTH'),
            new Card('25', 'Tri-Face', 3, 5, 5, 5, 'POISON'),
            new Card('26', 'Fastitocalon', 7, 3, 5, 1, 'EARTH'),
            new Card('27', 'Snow Lion', 7, 3, 1, 5, 'ICE'),
            new Card('28', 'Ochu', 5, 3, 6, 3, null),
            new Card('29', 'SAM08G', 5, 4, 6, 2, 'FIRE'),
            new Card('30', 'Death Claw', 4, 2, 4, 7, 'FIRE'),
            new Card('31', 'Cactuar', 6, 3, 2, 6, null),
            new Card('32', 'Tonberry', 3, 4, 6, 4, null),
            new Card('33', 'Abyss Worm', 7, 5, 2, 3, 'EARTH'),

            // Level 4
            new Card('34', 'Turtapod', 2, 7, 3, 6, null),
            new Card('35', 'Vysage', 6, 5, 5, 4, null),
            new Card('36', 'T-Rexaur', 4, 7, 6, 2, null),
            new Card('37', 'Bomb', 2, 3, 7, 6, 'FIRE'),
            new Card('38', 'Blitz', 1, 7, 6, 4, 'THUNDER'),
            new Card('39', 'Wendigo', 7, 6, 3, 1, null),
            new Card('40', 'Torama', 7, 4, 4, 4, null),
            new Card('41', 'Imp', 3, 6, 7, 3, null),
            new Card('42', 'Blue Dragon', 6, 3, 2, 7, 'POISON'),
            new Card('43', 'Adamantoise', 4, 6, 5, 5, 'EARTH'),
            new Card('44', 'Hexadragon', 7, 3, 5, 4, 'FIRE'),

            // Level 5
            new Card('45', 'Iron Giant', 6, 5, 5, 6, null),
            new Card('46', 'Behemoth', 3, 7, 6, 5, null),
            new Card('47', 'Chimera', 7, 3, 6, 5, 'WATER'),
            new Card('48', 'PuPu', 3, 1, 10, 2, null),
            new Card('49', 'Elastoid', 6, 7, 2, 6, null),
            new Card('50', 'GIM47N', 5, 4, 5, 7, null),
            new Card('51', 'Malboro', 7, 2, 7, 4, 'POISON'),
            new Card('52', 'Ruby Dragon', 7, 4, 2, 7, 'FIRE'),
            new Card('53', 'Elnoyle', 5, 6, 3, 7, null),
            new Card('54', 'Tonberry King', 4, 4, 6, 7, null),
            new Card('55', 'Wedge, Biggs', 6, 7, 6, 2, null),

            // Level 6
            new Card('56', 'Fujin Raijin', 2, 4, 8, 8, null),
            new Card('57', 'Elvoret', 7, 4, 8, 3, 'WIND'),
            new Card('58', 'X-ATM092', 4, 3, 8, 7, null),
            new Card('59', 'Granaldo', 7, 5, 2, 8, null),
            new Card('60', 'Gerogero', 1, 3, 8, 8, 'POISON'),
            new Card('61', 'Iguion', 8, 2, 2, 8, null),
            new Card('62', 'Abadon', 6, 5, 8, 4, null),
            new Card('63', 'Trauma', 4, 6, 8, 5, null),
            new Card('64', 'Oilboyle', 1, 8, 8, 4, null),
            new Card('65', 'Shumi', 6, 4, 5, 8, null),
            new Card('66', 'Krysta', 7, 1, 5, 8, null),

            // Level 7
            new Card('67', 'Propagator', 8, 8, 4, 4, null),
            new Card('68', 'Jumbo Cactuar', 8, 4, 8, 4, null),
            new Card('69', 'Tri-Point', 8, 8, 5, 2, 'THUNDER'),
            new Card('70', 'Gargantua', 5, 8, 6, 6, null),
            new Card('71', 'Mobile Type 8', 8, 3, 6, 7, null),
            new Card('72', 'Sphinxara', 8, 8, 3, 5, null),
            new Card('73', 'Tiamat', 8, 4, 8, 5, null),
            new Card('74', 'BGH251F2', 5, 5, 7, 8, null),
            new Card('75', 'Red Giant', 6, 7, 8, 4, null),
            new Card('76', 'Catoblepas', 1, 7, 8, 7, null),
            new Card('77', 'Ultima Weapon', 7, 8, 7, 2, null),

            // Level 8 (GF Cards)
            new Card('78', 'Chubby Chocobo', 4, 9, 4, 8, null),
            new Card('79', 'Angelo', 9, 3, 6, 7, null),
            new Card('80', 'Gilgamesh', 3, 6, 7, 9, null),
            new Card('81', 'MiniMog', 9, 2, 3, 9, null),
            new Card('82', 'Chicobo', 9, 4, 4, 8, null),
            new Card('83', 'Quezacotl', 2, 4, 9, 9, 'THUNDER'),
            new Card('84', 'Shiva', 6, 9, 7, 4, 'ICE'),
            new Card('85', 'Ifrit', 9, 8, 6, 2, 'FIRE'),
            new Card('86', 'Siren', 8, 2, 9, 6, null),
            new Card('87', 'Sacred', 5, 9, 1, 9, 'EARTH'),
            new Card('88', 'Minotaur', 9, 9, 5, 2, 'EARTH'),

            // Level 9 (GF Cards)
            new Card('89', 'Carbuncle', 8, 4, 4, 10, null),
            new Card('90', 'Diablos', 5, 3, 10, 8, null),
            new Card('91', 'Leviathan', 7, 7, 10, 1, 'WATER'),
            new Card('92', 'Odin', 8, 5, 10, 3, null),
            new Card('93', 'Pandemona', 10, 7, 1, 7, 'WIND'),
            new Card('94', 'Cerberus', 7, 10, 4, 6, null),
            new Card('95', 'Alexander', 9, 2, 10, 4, 'HOLY'),
            new Card('96', 'Phoenix', 7, 10, 2, 7, 'FIRE'),
            new Card('97', 'Bahamut', 10, 6, 8, 2, null),
            new Card('98', 'Doomtrain', 3, 10, 1, 10, 'POISON'),
            new Card('99', 'Eden', 4, 10, 4, 9, null),

            // Level 10 (Character Cards)
            new Card('100', 'Ward', 10, 8, 7, 2, null),
            new Card('101', 'Kiros', 6, 10, 7, 6, null),
            new Card('102', 'Laguna', 5, 9, 10, 3, null),
            new Card('103', 'Selphie', 10, 4, 8, 6, null),
            new Card('104', 'Quistis', 9, 2, 6, 10, null),
            new Card('105', 'Irvine', 2, 10, 6, 9, null),
            new Card('106', 'Zell', 8, 6, 5, 10, null),
            new Card('107', 'Rinoa', 4, 10, 10, 2, null),
            new Card('108', 'Edea', 10, 3, 10, 3, null),
            new Card('109', 'Seifer', 6, 4, 9, 10, null),
            new Card('110', 'Squall', 10, 9, 4, 6, null)
        ];
    }

    /**
     * Получение URL изображения обратной стороны карты
     * @returns {string} URL изображения обратной стороны карты
     */
    static getBackImageUrl() {
        return '/img/card-back.png';
    }

    /**
     * Сравнение значений карт
     * @param {Card} otherCard - Карта для сравнения
     * @param {string} direction - Направление сравнения ('top', 'right', 'bottom', 'left')
     * @returns {boolean} true если эта карта сильнее в указанном направлении
     */
    compare(otherCard, direction) {
        switch (direction) {
            case 'top':
                return this.top > otherCard.bottom;
            case 'right':
                return this.right > otherCard.left;
            case 'bottom':
                return this.bottom > otherCard.top;
            case 'left':
                return this.left > otherCard.right;
            default:
                throw new Error('Invalid direction');
        }
    }

    /**
     * Получение значения карты в указанном направлении
     * @param {string} direction - Направление ('top', 'right', 'bottom', 'left')
     * @returns {number} Значение карты в указанном направлении
     */
    getValue(direction) {
        switch (direction) {
            case 'top':
                return this.top;
            case 'right':
                return this.right;
            case 'bottom':
                return this.bottom;
            case 'left':
                return this.left;
            default:
                throw new Error('Invalid direction');
        }
    }

    /**
     * Проверка элементального бонуса
     * @param {string|null} boardElement - Элемент клетки поля
     * @returns {boolean} true если карта получает элементальный бонус
     */
    hasElementalBonus(boardElement) {
        return this.element !== null && this.element === boardElement;
    }

    /**
     * Создание копии карты
     * @returns {Card} Новый экземпляр карты с теми же значениями
     */
    clone() {
        const clonedCard = new Card(
            this.id,
            this.name,
            this.top,
            this.right,
            this.bottom,
            this.left,
            this.element,
            this.imageUrl
        );
        clonedCard.owner = this.owner;
        clonedCard.originalOwner = this.originalOwner;
        return clonedCard;
    }

    /**
     * Получение объекта карты для отправки клиенту
     * @param {boolean} isHidden - Нужно ли скрыть значения карты
     * @returns {Object} Объект карты для клиента
     */
    toClientObject(isHidden = false) {
        if (isHidden) {
            return {
                id: this.id,
                name: '???',
                imageUrl: Card.getBackImageUrl(),
                hidden: true,
                owner: this.owner,
                originalOwner: this.originalOwner
            };
        }

        return {
            id: this.id,
            name: this.name,
            top: this.top,
            right: this.right,
            bottom: this.bottom,
            left: this.left,
            element: this.element,
            imageUrl: this.imageUrl,
            hidden: false,
            owner: this.owner,
            originalOwner: this.originalOwner
        };
    }

    /**
     * Установка владельца карты
     * @param {'player'|'ai'|null} owner - Владелец карты
     */
    setOwner(owner) {
        this.owner = owner;
        if (this.originalOwner === null) {
            this.originalOwner = owner;
        }
        return this;
    }

    /**
     * Вычисление силы карты
     * @returns {number} Значение от 0 до 100, где 100 - самая сильная карта
     */
    calculatePower() {
        // Базовая сила - сумма всех значений
        let power = this.top + this.right + this.bottom + this.left;
        
        // Бонус за высокие значения (8-10)
        const highValues = [this.top, this.right, this.bottom, this.left].filter(v => v >= 8).length;
        power += highValues * 2;
        
        // Бонус за элемент
        if (this.element && this.element !== 'NEUTRAL') {
            power += 2;
        }
        
        // Нормализация до 100
        return Math.min(Math.round((power / 44) * 100), 100); // 44 - максимально возможная сумма (10+10+10+10 + 4)
    }

    /**
     * Получение карт определенного уровня
     * @param {number} level - Уровень карт (1-10)
     * @returns {Array<Card>} Массив карт указанного уровня
     */
    static getCardsByLevel(level) {
        const allCards = Card.createDeck();
        const levelStart = (level - 1) * 11;
        const levelEnd = level * 11;
        return allCards.slice(levelStart, levelEnd);
    }

    /**
     * Получение стартовых карт для нового игрока
     * @returns {Array<Card>} Массив из 8 случайных карт начального уровня
     */
    static getStarterCards() {
        const deck = Card.createDeck();
        // Берем только карты с ID от 1 до 30 (первые три уровня)
        const starterPool = deck.filter(card => parseInt(card.id) <= 30);
        
        // Перемешиваем карты
        const shuffled = [...starterPool].sort(() => Math.random() - 0.5);
        
        // Возвращаем первые 8 карт
        return shuffled.slice(0, 10);
    }
}