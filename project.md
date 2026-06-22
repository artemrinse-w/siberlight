Дорожная карта: Создание Serverless-трекера цен на GitHub Pages (с виджетом для OBS)Этот план поможет вам с нуля собрать и запустить интерактивный трекер цен для карточек Сайберлайта, используя GitHub как базу данных, сервер автоматизации, хостинг и платформу для стримерских виджетов.📅 Общая архитектура проектаВаш Репозиторий (GitHub)
├── .github/workflows/tracker-updater.yml  <-- Скрипт автоматизации (Cron)
├── parser/
│   ├── index.js                           <-- Скрипт-парсер цен
│   └── package.json                       <-- Зависимости парсера
├── public/
│   ├── index.html                         <-- Фронтенд (Главный интерфейс + Графики)
│   ├── widget.html                        <-- Виджет для OBS (Прозрачный, с авто-ротацией) [NEW]
│   └── data.json                          <-- Наша "База данных" (хранит историю)
🛠 ЭТАП 1: Инициализация репозитория и окруженияСоздайте новый публичный репозиторий на GitHub (например, cyberlight-tracker).Клонируйте его себе на компьютер и откройте в редакторе кода (VS Code).Создайте структуру папок:Создайте папку public (здесь будут жить сайт, виджет и файл данных).Создайте папку parser (здесь будет крутиться скрипт сбора данных).🕷 ЭТАП 2: Написание скрипта-парсера (Node.js)Парсер должен запускаться, брать актуальные цены с площадки Сайберлайта, читать старый public/data.json, обновлять его (добавлять новые точки для графиков истории) и сохранять обратно.Перейдите в папку parser через терминал: cd parserИнициализируйте проект: npm init -yУстановите библиотеки: npm install axios cheerioСоздайте файл parser/index.js со следующей логикой:// parser/index.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio'); // Используйте, если нужно парсить HTML

const DATA_PATH = path.join(__dirname, '../public/data.json');

// 1. Читаем текущую базу данных (или создаем структуру, если файла еще нет)
let database = { lastUpdated: null, cards: [] };
if (fs.existsSync(DATA_PATH)) {
    database = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

async function parsePrices() {
    try {
        console.log('Начало парсинга цен...');
        
        // --- ЗАМЕНИТЕ ЭТОТ БЛОК НА РЕАЛЬНЫЙ ЗАПРОС К САЙБЕРЛАЙТУ ---
        // const response = await axios.get('https://cyberlight-market-url.com');
        // const $ = cheerio.load(response.data);
        // -----------------------------------------------------------

        // Имитация полученных данных для примера:
        const parsedCards = [
            { id: 'card_1', name: 'Cyberlight Aura', price: Math.floor(Math.random() * 100) + 400, available: 12 },
            { id: 'card_2', name: 'Cyberlight Neon', price: Math.floor(Math.random() * 50) + 150, available: 5 },
            { id: 'card_3', name: 'Cyberlight Eclipse', price: Math.floor(Math.random() * 200) + 800, available: 2 }
        ];

        const today = new Date().toISOString().split('T')[0];

        // 2. Обновляем данные в нашей "базе"
        parsedCards.forEach(newCard => {
            let cardInDb = database.cards.find(c => c.id === newCard.id);
            
            if (!cardInDb) {
                cardInDb = {
                    id: newCard.id,
                    name: newCard.name,
                    history: []
                };
                database.cards.push(cardInDb);
            }

            // Рассчитываем изменение цены по сравнению с предыдущим днем (для виджета ОБС)
            const previousPrice = cardInDb.currentPrice || newCard.price;
            cardInDb.priceChange = newCard.price - previousPrice;

            // Обновляем текущие показатели
            cardInDb.currentPrice = newCard.price;
            cardInDb.available = newCard.available;

            // Добавляем точку в историю
            const hasHistoryToday = cardInDb.history.some(h => h.date === today);
            if (!hasHistoryToday) {
                cardInDb.history.push({ date: today, price: newCard.price });
            } else {
                const todayIndex = cardInDb.history.findIndex(h => h.date === today);
                cardInDb.history[todayIndex].price = newCard.price;
            }

            if (cardInDb.history.length > 30) {
                cardInDb.history.shift();
            }
        });

        database.lastUpdated = new Date().toISOString();

        // 3. Записываем обновленный файл обратно
        fs.writeFileSync(DATA_PATH, JSON.stringify(database, null, 2));
        console.log('Данные успешно сохранены в data.json!');

    } catch (error) {
        console.error('Ошибка при парсинге данных:', error);
        process.exit(1);
    }
}

parsePrices();
🎨 ЭТАП 3: Создание Фронтенда (HTML + Анимации)Создайте файл public/index.html. При заходе он подгрузит data.json, отобразит инвентарь и построит красивые анимированные графики с помощью библиотеки Chart.js.<!-- public/index.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cyberlight Cards Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-8">

    <div class="max-w-5xl mx-auto">
        <header class="mb-8 flex justify-between items-center border-b border-slate-800 pb-5">
            <div>
                <h1 class="text-3xl font-extrabold text-cyan-400 tracking-wide uppercase">Cyberlight Tracker</h1>
                <p class="text-sm text-slate-400 mt-1">Автоматический мониторинг цен и запасов</p>
            </div>
            <div class="text-right">
                <p class="text-xs text-slate-500">Последнее обновление:</p>
                <p id="last-update" class="text-sm font-semibold text-emerald-400">Загрузка...</p>
            </div>
        </header>

        <!-- Сетка карточек -->
        <div id="cards-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <!-- Карточки будут рендериться динамически -->
        </div>

        <!-- Секция с графиком (анимированным при клике) -->
        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl">
            <h2 id="chart-title" class="text-xl font-bold mb-4 text-cyan-300">Динамика цен (Выберите карточку)</h2>
            <div class="h-[300px] w-full">
                <canvas id="priceChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        let myChart = null;

        // Сколько карточек есть "у нас"
        const ourInventory = {
            'card_1': 3,
            'card_2': 0,
            'card_3': 1
        };

        async function initTracker() {
            try {
                const response = await fetch('./data.json');
                const data = await response.json();

                document.getElementById('last-update').innerText = new Date(data.lastUpdated).toLocaleString('ru-RU');

                const grid = document.getElementById('cards-grid');
                grid.innerHTML = '';

                data.cards.forEach(card => {
                    const owned = ourInventory[card.id] || 0;
                    const totalValue = owned * card.currentPrice;

                    const cardEl = document.createElement('div');
                    cardEl.className = `bg-slate-800 border border-slate-700/80 p-5 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]`;
                    cardEl.innerHTML = `
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-xs font-semibold bg-slate-700/50 text-cyan-400 px-2.5 py-1 rounded-full border border-slate-600">
                                В наличии: ${card.available} шт.
                            </span>
                            ${owned > 0 ? `<span class="text-xs font-semibold bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-800">У вас: ${owned} шт</span>` : ''}
                        </div>
                        <h3 class="text-lg font-bold text-white mb-2">${card.name}</h3>
                        <div class="flex items-baseline gap-2">
                            <span class="text-2xl font-black text-white">${card.currentPrice} ₽</span>
                            <span class="text-xs text-slate-400">текущая цена</span>
                        </div>
                        ${owned > 0 ? `
                        <div class="mt-3 pt-3 border-t border-slate-700/50 flex justify-between text-xs text-slate-400">
                            <span>Стоимость запасов:</span>
                            <span class="font-bold text-emerald-400">${totalValue} ₽</span>
                        </div>
                        ` : ''}
                    `;

                    cardEl.addEventListener('click', () => updateChart(card));
                    grid.appendChild(cardEl);
                });

                if(data.cards.length > 0) {
                    updateChart(data.cards[0]);
                }

            } catch (error) {
                console.error("Ошибка загрузки данных:", error);
                document.getElementById('last-update').innerText = "Ошибка загрузки";
            }
        }

        function updateChart(card) {
            document.getElementById('chart-title').innerText = `Динамика цен: ${card.name}`;

            const labels = card.history.map(h => h.date);
            const prices = card.history.map(h => h.price);

            if (myChart) {
                myChart.destroy();
            }

            const ctx = document.getElementById('priceChart').getContext('2d');
            myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Цена (₽)',
                        data: prices,
                        borderColor: '#22d3ee',
                        backgroundColor: 'rgba(34, 211, 238, 0.1)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3,
                        pointBackgroundColor: '#06b6d4',
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    },
                    animation: { duration: 800, easing: 'easeOutQuart' }
                }
            });
        }

        initTracker();
    </script>
</body>
</html>
🤖 ЭТАП 4: Настройка GitHub ActionsНастроим робота, запускающего парсер по расписанию, перезаписывающего JSON и отправляющего комит обратно в репозиторий.Создайте в корне проекта папку .github/workflows.Создайте файл tracker-updater.yml:# .github/workflows/tracker-updater.yml
name: Cyberlight Price Auto-Updater

on:
  schedule:
    - cron: '0 */6 * * *' # Каждые 6 часов
  workflow_dispatch: # Ручной запуск кнопкой в UI GitHub

permissions:
  contents: write

jobs:
  update-prices:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/with-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: parser/package.json

    - name: Install dependencies
      run: |
        cd parser
        npm install

    - name: Run parser script
      run: |
        cd parser
        node index.js

    - name: Commit and push changes
      run: |
        git config --global user.name "GitHub Action Bot"
        git config --global user.email "action@github.com"
        git add public/data.json
        git diff --quiet && git diff --staged --quiet || (git commit -m "Auto-update prices: $(date -u)" && git push)
🚀 ЭТАП 5: Деплой на GitHub PagesЗапушьте код в репозиторий на GitHub.Перейдите в Settings -> Pages вашего репозитория.В Build and deployment выберите ветку main и папку /public.Нажмите Save. Через 1-2 минуты ваш сайт будет доступен по адресу https://ваш-логин.github.io/имя-репозитория/.📺 ЭТАП 6: Виджет для OBS (Стримы / Оверлеи) [NEW]Для вывода цен прямо на трансляцию нам нужен оверлей с прозрачным фоном, крупным шрифтом для читаемости на стриме и авто-ротацией карточек (чтобы виджет занимал мало места на экране, но по очереди показывал все товары).Создайте в папке public файл widget.html:<!-- public/widget.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OBS Cyberlight Price Widget</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Скрываем скроллбар и делаем фон полностью прозрачным для OBS */
        body {
            background-color: transparent !important;
            overflow: hidden;
        }
        /* Анимация плавного переключения карточек (Cross-fade) */
        .fade-transition {
            transition: opacity 0.5s ease-in-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
    </style>
</head>
<body class="flex items-center justify-start p-4 h-screen w-screen">

    <!-- Контейнер виджета (с неоновым свечением) -->
    <div id="widget-container" class="fade-transition opacity-0 scale-95 w-[380px] bg-slate-900/90 border-2 border-cyan-500/80 p-4 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-md">
        <div class="flex justify-between items-center mb-2">
            <span id="widget-status" class="text-[10px] font-bold tracking-widest uppercase bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                CYBERLIGHT TRK
            </span>
            <span id="widget-available" class="text-xs text-slate-400 font-medium">
                Доступно: 0 шт.
            </span>
        </div>
        
        <h2 id="widget-title" class="text-lg font-black text-white tracking-wide uppercase truncate">
            Загрузка...
        </h2>
        
        <div class="flex items-center justify-between mt-1">
            <div class="flex items-baseline gap-2">
                <span id="widget-price" class="text-3xl font-extrabold text-white tracking-tight">0 ₽</span>
                <span class="text-[10px] text-slate-400 uppercase">текущая</span>
            </div>
            
            <!-- Индикатор изменения цены -->
            <div id="widget-trend" class="flex items-center gap-1 text-sm font-bold px-2 py-1 rounded bg-slate-800 text-slate-400">
                <span>0 ₽</span>
            </div>
        </div>
    </div>

    <script>
        let cardsData = [];
        let currentIndex = 0;
        const ROTATION_INTERVAL = 5000; // Смена карточки каждые 5 секунд
        const FETCH_INTERVAL = 30000;    // Проверка новых данных в JSON каждые 30 секунд

        const container = document.getElementById('widget-container');
        const titleEl = document.getElementById('widget-title');
        const priceEl = document.getElementById('widget-price');
        const trendEl = document.getElementById('widget-trend');
        const availableEl = document.getElementById('widget-available');

        // Получение свежих данных из JSON
        async function fetchWidgetData() {
            try {
                const response = await fetch('./data.json?t=' + Date.now()); // Избегаем кеширования браузером OBS
                const data = await response.json();
                cardsData = data.cards;
                
                if (cardsData.length > 0 && container.classList.contains('opacity-0')) {
                    // Самый первый запуск
                    showCard(0);
                }
            } catch (err) {
                console.error("Ошибка обновления виджета:", err);
            }
        }

        // Функция плавной смены карточки
        function showCard(index) {
            if (!cardsData || cardsData.length === 0) return;
            const card = cardsData[index];

            // 1. Плавно скрываем старую информацию
            container.classList.add('opacity-0', 'scale-95');

            setTimeout(() => {
                // 2. Меняем контент в момент когда виджет невидим
                titleEl.innerText = card.name;
                priceEl.innerText = `${card.currentPrice} ₽`;
                availableEl.innerText = `Доступно: ${card.available} шт.`;

                // Оформляем тренд изменения цены
                const change = card.priceChange || 0;
                if (change > 0) {
                    trendEl.className = "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800";
                    trendEl.innerHTML = `▲ +${change} ₽`;
                } else if (change < 0) {
                    trendEl.className = "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800";
                    trendEl.innerHTML = `▼ ${change} ₽`;
                } else {
                    trendEl.className = "flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400";
                    trendEl.innerHTML = `• 0 ₽`;
                }

                // 3. Плавно показываем новую карточку
                container.classList.remove('opacity-0', 'scale-95');
            }, 500); // Половина секунды на исчезновение
        }

        // Запуск карусели
        function startCarousel() {
            setInterval(() => {
                if (cardsData.length === 0) return;
                currentIndex = (currentIndex + 1) % cardsData.length;
                showCard(currentIndex);
            }, ROTATION_INTERVAL);
        }

        // Инициализация
        fetchWidgetData();
        startCarousel();

        // Регулярно забираем свежий JSON с гитхаба (если экшен обновил его во время стрима)
        setInterval(fetchWidgetData, FETCH_INTERVAL);
    </script>
</body>
</html>
Как настроить и вывести виджет в OBS:Скопируйте ссылку на ваш виджет. Она будет выглядеть так:https://ваш-логин.github.io/имя-репозитория/widget.htmlОткройте OBS Studio.В сцене в блоке Источники (Sources) нажмите на + (Добавить) и выберите Браузер (Browser).Назовите источник, например, Cyberlight Tracker.В поле Адрес (URL) вставьте скопированную ссылку на widget.html.Настройте размеры окна виджета:Ширина (Width): 420Высота (Height): 200 (этого с запасом хватит, чтобы отобразить светящуюся плашку).Обязательно поставьте галочку Обновлять браузер, когда сцена становится активной (это гарантирует актуальность цен при смене сцен на стриме).Нажмите ОК. Готово! Стильная плашка парит на вашем экране с прозрачным фоном и мягко переключает карточки каждые 5 секунд.