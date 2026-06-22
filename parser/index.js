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
    { id: 'card_1', name: 'SabeRLighT- (Normal) 2022', market_hash_name: 'SabeRLighT- Player Sticker - TI 2022' },
    { id: 'card_2', name: 'SabeRLighT- (Glitter) 2022', market_hash_name: 'Glitter SabeRLighT- Player Sticker - TI 2022' },
    { id: 'card_3', name: 'SabeRLighT- (Holo) 2022', market_hash_name: 'Holo SabeRLighT- Player Sticker - TI 2022' },
    { id: 'card_4', name: 'SabeRLighT- (Gold) 2022', market_hash_name: 'Gold SabeRLighT- Player Sticker - TI 2022' },
    { id: 'card_5', name: 'SabeRLighT- (Normal) 2023', market_hash_name: 'SaberLight Player Sticker - TI 2023' },
    { id: 'card_6', name: 'SabeRLighT- (Glitter) 2023', market_hash_name: 'Glitter SaberLight Player Sticker - TI 2023' },
    { id: 'card_7', name: 'SabeRLighT- (Holo) 2023', market_hash_name: 'Holo SaberLight Player Sticker - TI 2023' },
    { id: 'card_8', name: 'SabeRLighT- (Gold) 2023', market_hash_name: 'Gold SaberLight Player Sticker - TI 2023' },
    { id: 'card_9', name: 'SabeRLighT- (Normal) 2025', market_hash_name: 'Saberlight Player Sticker - TI 2025' },
    { id: 'card_10', name: 'SabeRLighT- (Holo) 2025', market_hash_name: 'Holo Saberlight Player Sticker - TI 2025' },
    { id: 'card_11', name: 'SabeRLighT- (Gold) 2025', market_hash_name: 'Gold Saberlight Player Sticker - TI 2025' }
];

const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9'
};

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

// ===========================
// API 1: Steam Market Search/Render — получаем sell_listings (количество в продаже) и icon_url
// ===========================
async function fetchSearchData() {
    const searchMap = {}; // market_hash_name -> { sell_listings, icon_url }
    
    // Steam ограничивает pagesize до 10, поэтому нужна пагинация
    let start = 0;
    const pageSize = 10;
    let totalCount = Infinity;
    
    while (start < totalCount) {
        const url = `https://steamcommunity.com/market/search/render/?query=SabeRLighT&appid=570&norender=1&start=${start}&count=${pageSize}`;
        console.log(`  Запрос search/render API (start=${start}): ${url}`);
        
        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await axios.get(url, {
                    headers: AXIOS_HEADERS,
                    timeout: 15000
                });
                
                if (response.data && response.data.success && Array.isArray(response.data.results)) {
                    totalCount = response.data.total_count || 0;
                    
                    for (const result of response.data.results) {
                        searchMap[result.hash_name] = {
                            sellListings: result.sell_listings || 0,
                            iconUrl: result.asset_description?.icon_url || null
                        };
                    }
                    console.log(`    ✓ Получено ${response.data.results.length} предметов (всего найдено: ${totalCount})`);
                    success = true;
                    break;
                }
                throw new Error('Ответ search API не содержит results');
            } catch (error) {
                console.warn(`    Попытка ${attempt} search API (start=${start}) не удалась: ${error.message}`);
                if (attempt < 3) {
                    await sleep(5000 * attempt);
                }
            }
        }
        
        if (!success) {
            console.error(`  ✗ Search API: все попытки исчерпаны для start=${start}`);
            break;
        }
        
        start += pageSize;
        
        // Задержка между запросами пагинации
        if (start < totalCount) {
            await sleep(2000);
        }
    }
    
    console.log(`  ✓ Search API итого: ${Object.keys(searchMap).length} предметов`);
    return searchMap;
}


// ===========================
// API 2: Steam PriceOverview — получаем lowest_price, median_price, volume (продажи за 24ч)
// ===========================
async function fetchPriceOverview(item) {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=570&currency=5&market_hash_name=${encodeURIComponent(item.market_hash_name)}`;
    console.log(`  Запрос цены для: ${item.name}...`);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(url, {
                headers: AXIOS_HEADERS,
                timeout: 10000
            });
            
            if (response.data && response.data.success) {
                const lowest = response.data.lowest_price;
                const median = response.data.median_price;
                // volume — количество ПРОДАННЫХ за последние 24 часа (не количество в продаже!)
                const volume = response.data.volume ? parseInt(response.data.volume.replace(/[^\d]/g, ''), 10) : 0;
                
                const rawPrice = lowest || median;
                const price = parseSteamPrice(rawPrice);
                
                if (price !== null) {
                    console.log(`    ✓ Цена: ${price} ₽, продано за 24ч: ${volume}`);
                    return { price, soldLast24h: volume };
                }
            }
            throw new Error('Ответ Steam не содержит флага success:true или цены');
        } catch (error) {
            console.warn(`    Попытка ${attempt} для ${item.name} не удалась: ${error.message}`);
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
        console.log('═══════════════════════════════════════════════');
        console.log('Начало парсинга цен с торговой площадки Steam...');
        console.log('═══════════════════════════════════════════════');
        const today = new Date().toISOString().split('T')[0];
        
        // Шаг 1: Получаем sell_listings и icon_url через Search API (один запрос на всех)
        console.log('\n📦 Шаг 1: Получение количества лотов в продаже (Search API)...');
        const searchData = await fetchSearchData();
        
        // Задержка между разными API
        await sleep(3000);
        
        // Шаг 2: Получаем цены по каждому предмету через PriceOverview API
        console.log('\n💰 Шаг 2: Получение цен (PriceOverview API)...');
        
        for (const item of ITEMS_TO_TRACK) {
            let priceData = null;
            try {
                priceData = await fetchPriceOverview(item);
                await sleep(3000); // задержка 3 секунды между запросами для предотвращения 429
            } catch (err) {
                console.error(`  ✗ Не удалось получить цену для ${item.name}:`, err.message);
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
            
            // Обновляем данные из Search API (sell_listings, icon_url)
            const searchInfo = searchData[item.market_hash_name];
            if (searchInfo) {
                cardInDb.sellListings = searchInfo.sellListings;
                if (searchInfo.iconUrl) {
                    cardInDb.icon_url = searchInfo.iconUrl;
                }
            }

            if (priceData) {
                const { price, soldLast24h } = priceData;
                
                const previousPrice = cardInDb.currentPrice || price;
                cardInDb.priceChange = Number((price - previousPrice).toFixed(2));

                cardInDb.currentPrice = price;
                cardInDb.soldLast24h = soldLast24h;

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
            
            // Удаляем устаревшее поле "available" (ранее неправильно использовалось)
            delete cardInDb.available;
        }

        database.lastUpdated = new Date().toISOString();

        fs.writeFileSync(DATA_PATH, JSON.stringify(database, null, 2));
        console.log('\n✅ Данные успешно сохранены в data.json!');
        console.log(`   Обновлено карточек: ${database.cards.length}`);

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
