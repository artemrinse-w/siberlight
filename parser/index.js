const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_PATH = path.join(__dirname, '../public/data.json');

// Убедимся, что родительские директории существуют
const dir = path.dirname(DATA_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// 1. Читаем текущую базу данных (или создаем структуру, если файла еще нет)
let database = { lastUpdated: null, cards: [] };
if (fs.existsSync(DATA_PATH)) {
    try {
        database = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (e) {
        console.error('Ошибка чтения существующей БД:', e);
    }
}

// Список отслеживаемых стикеров игрока SabeRLighT- в Dota 2 (2022, 2023, 2025 гг.)
const ITEMS_TO_TRACK = [
    { id: 'card_1', name: 'SabeRLighT- (Normal) 2022', market_hash_name: 'SabeRLighT- Player Sticker - TI 2022', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKosjk5lj-RA_i0ceyq3AKvar4PuppdKjGCzXDw7p1sbZtHX7jl0p_5G3Snt36dy6eOFchWZomTOQPshS7jJS5YGR4HVcQ' },
    { id: 'card_2', name: 'SabeRLighT- (Glitter) 2022', market_hash_name: 'Glitter SabeRLighT- Player Sticker - TI 2022', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKosjk5lj-RA_i0ceyq3AKvar4PuppdKjGCzXDw7p1sbZtHX7jl0p_5G3Snt36dy6eOFchWZomTOQPshS7jJS5YGR4HVcQ' },
    { id: 'card_3', name: 'SabeRLighT- (Holo) 2022', market_hash_name: 'Holo SabeRLighT- Player Sticker - TI 2022', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKosjk5lj-RA_i0ceyq3AKvar4PuppdKjGCzXDw7p1sbZtHX7jl0p_5G3Snt36dy6eOFchWZomTOQPshS7jJS5YGR4HVcQ' },
    { id: 'card_4', name: 'SabeRLighT- (Gold) 2022', market_hash_name: 'Gold SabeRLighT- Player Sticker - TI 2022', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKosjk5lj-RA_i0ceyq3AKvar4PuppdKjGCzXDw7p1sbZtHX7jl0p_5G3Snt36dy6eOFchWZomTOQPshS7jJS5YGR4HVcQ' },
    { id: 'card_5', name: 'SabeRLighT- (Normal) 2023', market_hash_name: 'SaberLight Player Sticker - TI 2023', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpde7-lXmWBjjjdmxr3QJvqD2PvIjIaHLCmGVkuwl4eQ-GC21kU51sjuBzdysc3LBalIoW5AkF7YCsBjrkMqnab2TK-HAgQ' },
    { id: 'card_6', name: 'SabeRLighT- (Holo) 2023', market_hash_name: 'Holo SaberLight Player Sticker - TI 2023', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpde7-lXmWBjjjdmxr3QJvqD2PvIjIaHLCmGVkuwl4eQ-GC21kU51sjuBzdysc3LBalIoW5AkF7YCsBjrkMqnab2TK-HAgQ' },
    { id: 'card_7', name: 'SabeRLighT- (Gold) 2023', market_hash_name: 'Gold SaberLight Player Sticker - TI 2023', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpde7-lXmWBjjjdmxr3QJvqD2PvIjIaHLCmGVkuwl4eQ-GC21kU51sjuBzdysc3LBalIoW5AkF7YCsBjrkMqnab2TK-HAgQ' },
    { id: 'card_8', name: 'SabeRLighT- (Normal) 2025', market_hash_name: 'Saberlight Player Sticker - TI 2025', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpdW7-lXmWBjjjdmxr3QJvqD2PvIjI_XAW2PHlrd3s-cxH3nixk8itWyEm96vdyiWbVApCMdwE-QJsRW5lcqnab1KtUMlxw' },
    { id: 'card_9', name: 'SabeRLighT- (Holo) 2025', market_hash_name: 'Holo Saberlight Player Sticker - TI 2025', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpdW7-lXmWBjjjdmxr3QJvqD2PvIjI_XAW2PHlrd3s-cxH3nixk8itWyEm96vdyiWbVApCMdwE-QJsRW5lcqnab1KtUMlxw' },
    { id: 'card_10', name: 'SabeRLighT- (Gold) 2025', market_hash_name: 'Gold Saberlight Player Sticker - TI 2025', icon_url: 'i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttydbPaERSR0WqmuqKgQfUYS42ES-RPPa14WyMHqE6lhKpdW7-lXmWBjjjdmxr3QJvqD2PvIjI_XAW2PHlrd3s-cxH3nixk8itWyEm96vdyiWbVApCMdwE-QJsRW5lcqnab1KtUMlxw' }
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Очистка и парсинг строковой цены Steam (например, "2,46 pуб." -> 2.46)
function parseSteamPrice(priceStr) {
    if (!priceStr) return null;
    const cleaned = priceStr
        .replace(/\s+/g, '') // убираем пробелы
        .replace(/,/g, '.')  // меняем запятую на точку
        .replace(/[^\d.]/g, ''); // оставляем только цифры и точки
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

// Запрос цен у API Торговой площадки Steam с обработкой ошибок
async function fetchPrice(item) {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=570&currency=5&market_hash_name=${encodeURIComponent(item.market_hash_name)}`;
    console.log(`Запрос цены для: ${item.name} (${url})...`);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });
            
            if (response.data && response.data.success) {
                const lowest = response.data.lowest_price;
                const median = response.data.median_price;
                const volume = response.data.volume ? parseInt(response.data.volume.replace(/[^\d]/g, ''), 10) : 0;
                
                const rawPrice = lowest || median;
                const price = parseSteamPrice(rawPrice);
                
                if (price !== null) {
                    return { price, available: volume };
                }
            }
            throw new Error('Ответ Steam не содержит флага success:true или цены');
        } catch (error) {
            console.warn(`Попытка ${attempt} для ${item.name} не удалась: ${error.message}`);
            if (attempt < 3) {
                await sleep(5000 * attempt); // экспоненциальная задержка перед повтором
            } else {
                throw error;
            }
        }
    }
}

async function parsePrices() {
    try {
        console.log('Начало парсинга цен с торговой площадки Steam...');
        const today = new Date().toISOString().split('T')[0];
        
        for (const item of ITEMS_TO_TRACK) {
            let fetchedData = null;
            try {
                fetchedData = await fetchPrice(item);
                await sleep(3000); // задержка 3 секунды между запросами для предотвращения 429
            } catch (err) {
                console.error(`Не удалось получить актуальные данные для ${item.name}:`, err.message);
            }

            let cardInDb = database.cards.find(c => c.id === item.id);
            
            if (!cardInDb) {
                cardInDb = {
                    id: item.id,
                    history: []
                };
                database.cards.push(cardInDb);
            }
            
            // Синхронизируем имя и хэш-имя с конфигурацией ITEMS_TO_TRACK
            cardInDb.name = item.name;
            cardInDb.market_hash_name = item.market_hash_name;
            cardInDb.icon_url = item.icon_url;

            if (fetchedData) {
                const { price, available } = fetchedData;
                
                const previousPrice = cardInDb.currentPrice || price;
                cardInDb.priceChange = Number((price - previousPrice).toFixed(2));

                cardInDb.currentPrice = price;
                cardInDb.available = available;

                const hasHistoryToday = cardInDb.history.some(h => h.date === today);
                if (!hasHistoryToday) {
                    cardInDb.history.push({ date: today, price: price });
                } else {
                    const todayIndex = cardInDb.history.findIndex(h => h.date === today);
                    cardInDb.history[todayIndex].price = price;
                }

                if (cardInDb.history.length > 30) {
                    cardInDb.history.shift();
                }
            } else {
                // Если запрос упал, сохраняем последние известные данные
                if (cardInDb.currentPrice !== undefined) {
                    cardInDb.priceChange = 0;
                }
            }
        }

        database.lastUpdated = new Date().toISOString();

        fs.writeFileSync(DATA_PATH, JSON.stringify(database, null, 2));
        console.log('Данные успешно сохранены в data.json!');

    } catch (error) {
        console.error('Критическая ошибка парсинга:', error);
        process.exit(1);
    }
}

if (process.argv.includes('--watch')) {
    console.log('Запущен режим постоянного мониторинга (обновление каждую минуту)...');
    parsePrices();
    setInterval(parsePrices, 60000); // 60 секунд
} else {
    parsePrices();
}
