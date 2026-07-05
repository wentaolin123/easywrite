
        // ==========================================
        // SQLite 数据库层
        // ==========================================
        var db = null;
        var dbReady = false;

        function initSQLite() {
            return new Promise(function(resolve, reject) {
                if (typeof initSqlJs === 'undefined') {
                    console.warn('sql.js 未加载，跳过SQLite初始化');
                    resolve(false);
                    return;
                }
                initSqlJs({
                    locateFile: function(file) { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + file; }
                }).then(function(SQL) {
                    try {
                        db = new SQL.Database();
                        // 创建内容表
                        db.run(`
                            CREATE TABLE IF NOT EXISTS content_items (
                                id TEXT PRIMARY KEY,
                                category TEXT,
                                platform TEXT,
                                account TEXT,
                                title TEXT,
                                date TEXT,
                                views TEXT,
                                likes INTEGER,
                                keywords TEXT,
                                isApi INTEGER,
                                url TEXT,
                                rawData TEXT,
                                createdAt TEXT,
                                updatedAt TEXT
                            )
                        `);
                        // hidden_items 表已废弃（隐藏功能已移除）
                        // db.run(`DROP TABLE IF EXISTS hidden_items`);
                        // 创建配置表
                        db.run(`
                            CREATE TABLE IF NOT EXISTS app_config (
                                key TEXT PRIMARY KEY,
                                value TEXT
                            )
                        `);
                        dbReady = true;
                        console.log('[SQLite] 数据库初始化成功');
                        resolve(true);
                    } catch (e) {
                        console.error('[SQLite] 初始化失败', e);
                        resolve(false);
                    }
                }).catch(function(err) {
                    console.error('[SQLite] 加载失败', err);
                    resolve(false);
                });
            });
        }

        // 保存内容到SQLite
        function saveItemsToSQLite(items) {
            if (!dbReady || !db || !items || items.length === 0) return;
            var now = new Date().toISOString();
            var stmt = db.prepare(`
                INSERT OR REPLACE INTO content_items
                (id, category, platform, account, title, date, views, likes, keywords, isApi, url, rawData, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            items.forEach(function(item) {
                try {
                    stmt.run([
                        item.id,
                        item.category || '',
                        item.platform || '',
                        item.account || '',
                        item.title || '',
                        item.date || '',
                        item.views || '',
                        item.likes || 0,
                        JSON.stringify(item.keywords || []),
                        item.isApi ? 1 : 0,
                        item.url || '',
                        JSON.stringify(item),
                        now,
                        now
                    ]);
                } catch (e) {
                    console.warn('[SQLite] 插入失败', item.id, e);
                }
            });
            stmt.free();
            console.log('[SQLite] 已保存 ' + items.length + ' 条记录');
        }

        // 从SQLite读取内容
        function loadItemsFromSQLite(category, platform) {
            if (!dbReady || !db) return [];
            var sql = 'SELECT * FROM content_items WHERE 1=1';
            var params = [];
            if (category) {
                sql += ' AND category = ?';
                params.push(category);
            }
            if (platform) {
                sql += ' AND platform = ?';
                params.push(platform);
            }
            sql += ' ORDER BY date DESC';
            try {
                var stmt = db.prepare(sql);
                var results = [];
                while (stmt.step()) {
                    var row = stmt.getAsObject();
                    try {
                        var item = JSON.parse(row.rawData);
                        results.push(item);
                    } catch (e) {
                        results.push({
                            id: row.id,
                            category: row.category,
                            platform: row.platform,
                            account: row.account,
                            title: row.title,
                            date: row.date,
                            views: row.views,
                            likes: row.likes,
                            keywords: JSON.parse(row.keywords || '[]'),
                            isApi: row.isApi === 1,
                            url: row.url
                        });
                    }
                }
                stmt.free();
                return results;
            } catch (e) {
                console.error('[SQLite] 查询失败', e);
                return [];
            }
        }

        // 保存隐藏记录
        // 隐藏功能已移除，以下函数保留为空实现以兼容旧代码
        function saveHiddenToSQLite(id) {}
        function loadHiddenFromSQLite() { return new Set(); }

        // ==========================================
        // 数据层
        // ==========================================
        var currentCategory = 'cat-1';
        var activeDate = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
        var activeFilters = { platform: 'all', keyword: 'all', account: 'all' };

        // 分页状态
        var currentPage = 1;
        var pageSize = 20;
        var totalItems = 0;

        // 当前选中的平台（在设置页内）
        var currentPlatform = '';

        // 选题分析当前选中的日期
        var currentReportDate = '';

        var categoryConfigs = {
            'cat-1': {
                name: 'ClaudeCode 选题',
                platforms: {
                    '公众号': {
                        keywords: ['Claude', 'Cursor', 'AI代码'],
                        accounts: ['极客时间', '程序员老王'],
                        maxArticles: 50,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: true,
                        apiUrl: 'https://www.dajiala.com/fbmain/monitor/v3/kw_search',
                        apiKey: 'JZL24321bffb20aa16a'
                    },
                    '小红书': {
                        keywords: ['Claude', 'AI编程'],
                        accounts: ['AI前沿观察'],
                        maxArticles: 30,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: true,
                        apiUrl: 'http://api.cn8n.com/p2/xhs/search_note_web',
                        apiKey: 'sk-l7fiNaPOb8WJwuzcepGN8ZWpuPgNIMnxqfWExS9AdVyuJTwa'
                    },
                    '抖音': {
                        keywords: ['AI代码'],
                        accounts: [],
                        maxArticles: 20,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: false,
                        apiUrl: '',
                        apiKey: ''
                    },
                    'B站': {
                        keywords: ['Cursor', 'Claude'],
                        accounts: ['程序员老王'],
                        maxArticles: 40,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: false,
                        apiUrl: '',
                        apiKey: ''
                    }
                }
            },
            'cat-2': {
                name: 'VibeCoding 选题',
                platforms: {
                    'B站': {
                        keywords: ['VibeCoding', 'AI编程'],
                        accounts: ['技术胖'],
                        maxArticles: 50,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: true,
                        apiUrl: 'https://www.dajiala.com/fbmain/monitor/v3/kw_search',
                        apiKey: 'JZL24321bffb20aa16a'
                    },
                    '抖音': {
                        keywords: ['VibeCoding', '低代码'],
                        accounts: ['前端工程师'],
                        maxArticles: 30,
                        apiSortType: 1,
                        apiMode: 1,
                        apiPeriod: 7,
                        apiEnabled: false,
                        apiUrl: '',
                        apiKey: ''
                    }
                }
            }
        };

        // API 配置
        var API_CONFIG = {
            baseUrl: 'https://www.dajiala.com/fbmain/monitor/v3/kw_search',
            key: 'JZL24321bffb20aa16a',
            enabled: true
        };

        // API 数据缓存
        var apiCache = {};

        // 生成近7天的时间轴数据
        function generateDateData() {
            var dates = [];
            var today = new Date();
            var weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            
            for (var i = 0; i <= 6; i++) {
                var d = new Date(today);
                d.setDate(d.getDate() - i);
                var month = String(d.getMonth() + 1).padStart(2, '0');
                var day = String(d.getDate()).padStart(2, '0');
                var fullDate = d.getFullYear() + '-' + month + '-' + day;
                var label = i === 0 ? '今天' : (i === 1 ? '昨天' : weekDays[d.getDay()]);

                dates.push({
                    label: label,
                    date: month + '-' + day,
                    fullDate: fullDate,
                    count: 0,
                    active: i === 0
                });
            }
            return dates;
        }

        var dateData = generateDateData();

        var contentData = [
            { id: 1, category: 'cat-1', platform: '公众号', account: '极客时间', title: '深度解析：Claude 3.5 Sonnet 如何重塑开发者的工作流？', date: '2026-05-20 10:30', views: '10w+', likes: 3250, keywords: ['Claude', 'AI代码'] },
            { id: 2, category: 'cat-1', platform: '小红书', account: 'AI前沿观察', title: 'Claude 3.5 Sonnet 更新了！代码能力实测太强了', date: '2026-05-20 09:15', views: '1.2w', likes: 890, keywords: ['Claude'] },
            { id: 3, category: 'cat-1', platform: 'B站', account: '程序员老王', title: 'Cursor vs Claude Code：谁才是AI编程之王？', date: '2026-05-20 08:45', views: '5.6w', likes: 2300, keywords: ['Cursor', 'Claude', 'AI代码'] },
            { id: 4, category: 'cat-1', platform: '抖音', account: 'AI前沿观察', title: '用Cursor 5分钟搞定一个网站，老板都看呆了', date: '2026-05-20 18:20', views: '8.9w', likes: 5600, keywords: ['Cursor', 'AI代码'] },
            { id: 5, category: 'cat-1', platform: '公众号', account: '极客时间', title: '克劳德新版实测：这代码质量简直离谱', date: '2026-05-20 14:00', views: '6w+', likes: 1800, keywords: ['克劳德', 'AI代码'] },
            { id: 6, category: 'cat-1', platform: '小红书', account: '程序员老王', title: '独立开发者必看：AI编程工具变现指南', date: '2026-05-20 11:30', views: '3.4w', likes: 1200, keywords: ['AI代码'] },
            { id: 7, category: 'cat-1', platform: 'B站', account: 'AI前沿观察', title: 'Claude Code实战：从零开发一个Chrome插件', date: '2026-05-20 20:00', views: '12w', likes: 4500, keywords: ['Claude', 'AI代码'] },
            { id: 8, category: 'cat-1', platform: '公众号', account: '程序员老王', title: 'Cursor的正确打开方式，效率提升300%', date: '2026-05-20 09:00', views: '4w+', likes: 2100, keywords: ['Cursor'] },
            { id: 9, category: 'cat-1', platform: '抖音', account: '极客时间', title: 'Claude 3.5写代码比我快10倍，我要失业了吗？', date: '2026-05-20 16:45', views: '15w', likes: 8200, keywords: ['Claude', 'AI代码'] },
            { id: 10, category: 'cat-1', platform: '小红书', account: 'AI前沿观察', title: 'Cursor+Claude双剑合璧，开发效率翻倍秘籍', date: '2026-05-20 13:20', views: '2.1w', likes: 1560, keywords: ['Cursor', 'Claude', 'AI代码'] },
            { id: 11, category: 'cat-1', platform: 'B站', account: '程序员老王', title: '克劳德AI帮我改了一行代码，性能提升50倍', date: '2026-05-20 19:30', views: '7.8w', likes: 3200, keywords: ['克劳德', 'AI代码'] },
            { id: 12, category: 'cat-1', platform: '公众号', account: 'AI前沿观察', title: 'AI编程时代来临，程序员该如何转型？', date: '2026-05-20 08:00', views: '8w+', likes: 4100, keywords: ['AI代码'] },
            { id: 13, category: 'cat-1', platform: '抖音', account: '程序员老王', title: 'Cursor免费替代品大盘点，省钱党必看', date: '2026-05-19 20:10', views: '6.7w', likes: 3400, keywords: ['Cursor'] },
            { id: 14, category: 'cat-1', platform: '公众号', account: '极客时间', title: 'Claude官方提示词工程指南解读', date: '2026-05-19 11:00', views: '5w+', likes: 1900, keywords: ['Claude'] },
            { id: 15, category: 'cat-1', platform: 'B站', account: 'AI前沿观察', title: '实测：Claude 3.5 vs GPT-4o，代码能力谁更强？', date: '2026-05-19 18:00', views: '22w', likes: 7800, keywords: ['Claude', 'AI代码'] },
            { id: 16, category: 'cat-1', platform: '小红书', account: '程序员老王', title: '用克劳德3分钟写出一个爬虫，附完整教程', date: '2026-05-19 15:30', views: '1.8w', likes: 1100, keywords: ['克劳德', 'AI代码'] },
            { id: 17, category: 'cat-1', platform: '抖音', account: 'AI前沿观察', title: 'AI写代码已经这么强了？我试了一周后沉默了', date: '2026-05-19 12:00', views: '11w', likes: 6200, keywords: ['AI代码'] },
            { id: 18, category: 'cat-1', platform: '公众号', account: '程序员老王', title: 'Cursor Pro值不值得买？一个月深度使用报告', date: '2026-05-19 09:30', views: '3w+', likes: 1500, keywords: ['Cursor'] },
            { id: 19, category: 'cat-1', platform: 'B站', account: '极客时间', title: 'Claude Artifacts功能详解：让AI成为你的专属开发助手', date: '2026-05-19 21:00', views: '4.5w', likes: 1800, keywords: ['Claude', 'AI代码'] },
            { id: 20, category: 'cat-1', platform: '小红书', account: 'AI前沿观察', title: '新手入门：Cursor第一次使用全攻略', date: '2026-05-18 10:00', views: '9000', likes: 670, keywords: ['Cursor'] },
            { id: 21, category: 'cat-1', platform: '抖音', account: '程序员老王', title: 'Claude教我写算法，LeetCode刷题效率翻倍', date: '2026-05-18 17:30', views: '9.2w', likes: 4500, keywords: ['Claude', 'AI代码'] },
            { id: 22, category: 'cat-1', platform: '公众号', account: '极客时间', title: '2024年AI编程工具全景图：从入门到精通', date: '2026-05-18 08:00', views: '7w+', likes: 2800, keywords: ['AI代码'] },
            { id: 23, category: 'cat-1', platform: 'B站', account: 'AI前沿观察', title: '克劳德新模型实测：中文理解能力提升了吗？', date: '2026-05-18 19:00', views: '3.2w', likes: 1200, keywords: ['克劳德'] },
            { id: 24, category: 'cat-1', platform: '小红书', account: '程序员老王', title: 'Cursor + Claude双开 workflow，我的效率秘诀', date: '2026-05-18 14:00', views: '1.5w', likes: 980, keywords: ['Cursor', 'Claude'] },
            { id: 25, category: 'cat-1', platform: '抖音', account: 'AI前沿观察', title: '用AI 10分钟做一个App，从想法到上线全流程', date: '2026-05-17 16:00', views: '18w', likes: 9500, keywords: ['AI代码'] },
            { id: 26, category: 'cat-1', platform: '公众号', account: '程序员老王', title: 'Claude 3.5的隐藏功能，90%的人不知道', date: '2026-05-17 10:00', views: '4w+', likes: 2200, keywords: ['Claude'] },
            { id: 27, category: 'cat-1', platform: 'B站', account: '极客时间', title: 'Cursor Composer实测：AI帮你写整个项目', date: '2026-05-17 20:30', views: '5.5w', likes: 2100, keywords: ['Cursor', 'AI代码'] },
            { id: 28, category: 'cat-1', platform: '小红书', account: 'AI前沿观察', title: '克劳德帮我优化了简历，面试邀请翻倍', date: '2026-05-17 11:00', views: '2.3w', likes: 1400, keywords: ['克劳德'] },
            { id: 29, category: 'cat-1', platform: '抖音', account: '程序员老王', title: 'AI编程是泡沫还是未来？业内人士说真话', date: '2026-05-16 15:00', views: '7.5w', likes: 3800, keywords: ['AI代码'] },
            { id: 30, category: 'cat-1', platform: '公众号', account: '极客时间', title: 'Cursor团队协作功能上线，多人实时编码不是梦', date: '2026-05-16 09:00', views: '3w+', likes: 1100, keywords: ['Cursor'] },
            { id: 31, category: 'cat-1', platform: 'B站', account: 'AI前沿观察', title: 'Claude 3.5 Sonnet 图像理解能力测试', date: '2026-05-16 18:00', views: '6.8w', likes: 2600, keywords: ['Claude'] },
            { id: 32, category: 'cat-1', platform: '小红书', account: '程序员老王', title: 'AI代码审查工具对比，哪个更适合你？', date: '2026-05-16 13:00', views: '1.1w', likes: 720, keywords: ['AI代码'] },
            { id: 33, category: 'cat-1', platform: '抖音', account: '极客时间', title: '克劳德3分钟搞定数据分析，Excel再也不用愁', date: '2026-05-15 17:00', views: '13w', likes: 7100, keywords: ['克劳德', 'AI代码'] },
            { id: 34, category: 'cat-1', platform: '公众号', account: 'AI前沿观察', title: 'Cursor背后的技术原理：为什么它写代码这么强？', date: '2026-05-15 08:30', views: '5w+', likes: 2300, keywords: ['Cursor', 'AI代码'] },
            { id: 35, category: 'cat-1', platform: 'B站', account: '程序员老王', title: 'Claude vs Cursor：不同场景下该如何选择？', date: '2026-05-15 19:30', views: '8.1w', likes: 3400, keywords: ['Claude', 'Cursor', 'AI代码'] },
            { id: 36, category: 'cat-1', platform: '小红书', account: '极客时间', title: '用AI写了一个自动化脚本，每天省下2小时', date: '2026-05-15 12:00', views: '1.6w', likes: 1050, keywords: ['AI代码'] },
            { id: 37, category: 'cat-1', platform: '抖音', account: 'AI前沿观察', title: 'Cursor新手避坑指南，这些错误别再犯', date: '2026-05-14 16:00', views: '5.3w', likes: 2900, keywords: ['Cursor'] },
            { id: 38, category: 'cat-1', platform: '公众号', account: '程序员老王', title: 'Claude 3.5上下文窗口实测：能读多少代码？', date: '2026-05-14 10:00', views: '2w+', likes: 900, keywords: ['Claude', 'AI代码'] },
            { id: 39, category: 'cat-1', platform: 'B站', account: '极客时间', title: '克劳德帮我重构了祖传代码，整洁度提升10倍', date: '2026-05-14 20:00', views: '4.2w', likes: 1700, keywords: ['克劳德', 'AI代码'] },
            { id: 40, category: 'cat-1', platform: '小红书', account: 'AI前沿观察', title: 'AI编程工具测评合集： Cursor / Claude / GitHub Copilot', date: '2026-05-14 11:00', views: '2.8w', likes: 1850, keywords: ['Cursor', 'Claude', 'AI代码'] },
            { id: 101, category: 'cat-2', platform: 'B站', account: '技术胖', title: 'VibeCoding是什么？3分钟搞懂AI辅助编程新范式', date: '2026-05-20 10:00', views: '8.2w', likes: 3600, keywords: ['VibeCoding', 'AI编程'] },
            { id: 102, category: 'cat-2', platform: '抖音', account: '前端工程师', title: '不写代码也能做产品？VibeCoding实测告诉你答案', date: '2026-05-20 14:30', views: '12w', likes: 6800, keywords: ['VibeCoding', '低代码'] },
            { id: 103, category: 'cat-2', platform: 'B站', account: '技术胖', title: 'Cursor+VibeCoding：前端开发效率提升500%的秘诀', date: '2026-05-20 18:00', views: '5.5w', likes: 2100, keywords: ['VibeCoding', 'AI编程'] },
            { id: 104, category: 'cat-2', platform: '抖音', account: '前端工程师', title: '低代码平台对比：VibeCoding vs 传统低代码工具', date: '2026-05-19 11:00', views: '7.8w', likes: 3200, keywords: ['低代码', 'VibeCoding'] },
            { id: 105, category: 'cat-2', platform: 'B站', account: '技术胖', title: 'AI编程时代，前端工程师还有前途吗？', date: '2026-05-19 20:00', views: '15w', likes: 5400, keywords: ['AI编程'] },
            { id: 106, category: 'cat-2', platform: '抖音', account: '前端工程师', title: '用VibeCoding 1小时搞定一个后台管理系统', date: '2026-05-18 16:00', views: '9.5w', likes: 4100, keywords: ['VibeCoding', '低代码'] },
            { id: 107, category: 'cat-2', platform: 'B站', account: '技术胖', title: '低代码开发的坑，我踩过的你都别踩', date: '2026-05-18 09:00', views: '3.8w', likes: 1500, keywords: ['低代码'] },
            { id: 108, category: 'cat-2', platform: '抖音', account: '前端工程师', title: 'VibeCoding入门：从0到1搭建你的第一个AI项目', date: '2026-05-17 13:00', views: '6.2w', likes: 2800, keywords: ['VibeCoding', 'AI编程'] },
            { id: 109, category: 'cat-2', platform: 'B站', account: '技术胖', title: '2024低代码平台横评：谁是真正的生产力工具？', date: '2026-05-17 19:30', views: '4.1w', likes: 1200, keywords: ['低代码'] },
            { id: 110, category: 'cat-2', platform: '抖音', account: '前端工程师', title: 'AI编程+VibeCoding，独立开发者的新机会', date: '2026-05-16 15:00', views: '8.8w', likes: 3900, keywords: ['VibeCoding', 'AI编程'] }
        ];

        var reportData = {};
        var currentReportTopics = [];
        var topicLibrary = [];

        function loadTopicLibrary() {
            try {
                var stored = localStorage.getItem('topicLibrary');
                if (stored) topicLibrary = JSON.parse(stored);
            } catch (e) { console.error('[TopicLibrary] 加载失败', e); }
        }

        function saveTopicLibrary() {
            try {
                localStorage.setItem('topicLibrary', JSON.stringify(topicLibrary));
            } catch (e) { console.error('[TopicLibrary] 保存失败', e); }
        }

        function addToTopicLibrary(topic) {
            // 去重：根据标题判断
            var exists = topicLibrary.some(function(t) { return t.title === topic.title; });
            if (exists) {
                showToast('该选题已在选题库中', 'info');
                return;
            }
            var item = {
                title: topic.title,
                reason: topic.reason,
                point: topic.point,
                url: topic.url,
                platform: topic.platform,
                account: topic.account,
                views: topic.views,
                likes: topic.likes,
                date: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '月') + '日',
                savedAt: new Date().toISOString()
            };
            topicLibrary.unshift(item);
            saveTopicLibrary();
            renderReportGrid();
            showToast('已收藏到选题库', 'success');
        }

        function addToTopicLibraryByIndex(index) {
            var topic = currentReportTopics[index];
            if (!topic) {
                showToast('选题数据异常，请重试', 'error');
                return;
            }
            addToTopicLibrary(topic);
        }

        function generateReportFromData() {
            var dayMap = {};

            contentData.forEach(function(item) {
                var d = (item.storedDate || item.date || '').substring(0, 10);
                if (!d) return;
                if (!dayMap[d]) dayMap[d] = [];
                dayMap[d].push(item);
            });

            Object.keys(apiCache).forEach(function(key) {
                var items = apiCache[key] || [];
                items.forEach(function(item) {
                    var d = (item.storedDate || item.date || '').substring(0, 10);
                    if (!d) return;
                    if (!dayMap[d]) dayMap[d] = [];
                    var exists = dayMap[d].some(function(x) { return x.id === item.id; });
                    if (!exists) dayMap[d].push(item);
                });
            });

            var sortedDates = Object.keys(dayMap).sort().reverse();
            var result = {};

            sortedDates.forEach(function(date) {
                var items = dayMap[date];
                var month = date.substring(5, 7);
                var day = date.substring(8, 10);
                var dateStr = month + '月' + day + '日';

                // 如果已有 AI 分析报告，保留 AI 报告
                if (reportData[date] && reportData[date].isAIReport) {
                    result[date] = reportData[date];
                    return;
                }

                var kwCount = {};
                items.forEach(function(item) {
                    (item.keywords || []).forEach(function(k) {
                        kwCount[k] = (kwCount[k] || 0) + 1;
                    });
                });
                var topKws = Object.entries(kwCount).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 3).map(function(x) { return x[0]; });

                var platformCount = {};
                items.forEach(function(item) {
                    platformCount[item.platform] = (platformCount[item.platform] || 0) + 1;
                });
                var platformStr = Object.entries(platformCount).map(function(x) { return x[0] + x[1] + '篇'; }).join('、');

                var summary = '当日共采集 ' + items.length + ' 篇内容（' + platformStr + '）';
                if (topKws.length > 0) summary += '，热点关键词：' + topKws.join('、');
                summary += '。';

                result[date] = {
                    dateStr: dateStr,
                    summary: summary,
                    topics: items.map(function(item) {
                        return {
                            title: item.title || '无标题',
                            reason: (item.platform || '未知') + ' · ' + (item.account || '未知账号'),
                            point: '阅读 ' + (item.views || '0') + ' · 点赞 ' + (item.likes || '0') + (item.url ? ' · 点击阅读原文' : ''),
                            url: item.url || '',
                            id: item.id
                        };
                    })
                };
            });

            // 删除那些没有数据的日期的 AI 分析报告
            Object.keys(reportData).forEach(function(date) {
                if (!dayMap[date] && reportData[date] && reportData[date].isAIReport) {
                    delete reportData[date];
                }
            });

            reportData = result;
            return result;
        }

        // ==========================================
        // 初始化
        // ==========================================
        document.addEventListener('DOMContentLoaded', function() {
            lucide.createIcons();
            renderDateCards();
            renderFilters();
            renderContentList();
            renderSettings();
            generateReportFromData();
            var dates = Object.keys(reportData).sort().reverse();
            var latestDate = dates.length > 0 ? dates[0] : null;
            if (latestDate) currentReportDate = latestDate;
            renderReportTimeline();
            renderReportGrid();
            if (latestDate) renderReportDetail(latestDate);
        });

        // ==========================================
        // Toast 提示
        // ==========================================
        function showToast(message, type) {
            var container = document.getElementById('toast-container');
            var toast = document.createElement('div');
            var bgClass = type === 'success' ? 'bg-matcha' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
            toast.className = 'toast px-6 py-3 rounded-xl text-white text-sm font-bold shadow-lg flex items-center gap-2 ' + bgClass;
            toast.innerHTML = '<i data-lucide="' + (type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info') + '" class="w-4 h-4"></i>' + message;
            container.appendChild(toast);
            lucide.createIcons();
            setTimeout(function() { toast.remove(); }, 3000);
        }

        // ==========================================
        // 全局搜索功能
        // ==========================================
        var searchDebounceTimer = null;

        function handleGlobalSearch(query) {
            var clearBtn = document.getElementById('global-search-clear');
            if (query.trim()) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }

            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(function() {
                performGlobalSearch(query.trim());
            }, 200);
        }

        function performGlobalSearch(query) {
            var dropdown = document.getElementById('global-search-dropdown');
            var resultsContainer = document.getElementById('global-search-results');
            var emptyState = document.getElementById('global-search-empty');

            if (!query) {
                dropdown.classList.add('hidden');
                return;
            }

            var lowerQuery = query.toLowerCase();
            var results = [];

            contentData.forEach(function(item) {
                var titleMatch = item.title && item.title.toLowerCase().indexOf(lowerQuery) !== -1;
                var kwMatch = item.keywords && item.keywords.some(function(k) { return k.toLowerCase().indexOf(lowerQuery) !== -1; });
                var accountMatch = item.account && item.account.toLowerCase().indexOf(lowerQuery) !== -1;
                if (titleMatch || kwMatch || accountMatch) {
                    results.push(item);
                }
            });

            Object.keys(apiCache).forEach(function(key) {
                var items = apiCache[key] || [];
                items.forEach(function(item) {
                    var titleMatch = item.title && item.title.toLowerCase().indexOf(lowerQuery) !== -1;
                    var kwMatch = item.keywords && item.keywords.some(function(k) { return k.toLowerCase().indexOf(lowerQuery) !== -1; });
                    var accountMatch = item.account && item.account.toLowerCase().indexOf(lowerQuery) !== -1;
                    if (titleMatch || kwMatch || accountMatch) {
                        var exists = results.some(function(r) { return r.id === item.id; });
                        if (!exists) results.push(item);
                    }
                });
            });

            results.sort(function(a, b) {
                if (a.date > b.date) return -1;
                if (a.date < b.date) return 1;
                return 0;
            });

            results = results.slice(0, 30);

            dropdown.classList.remove('hidden');

            if (results.length === 0) {
                resultsContainer.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            var html = '<div class="p-2 border-b border-border-soft/50 bg-cream/30"><span class="text-xs font-bold text-matcha/70 px-3">找到 ' + results.length + ' 条结果</span></div>';

            results.forEach(function(item) {
                var platformColors = {
                    '公众号': 'bg-green-100 text-green-700',
                    '小红书': 'bg-red-100 text-red-600',
                    '抖音': 'bg-blue-100 text-blue-600',
                    'B站': 'bg-pink-100 text-pink-600',
                    '微博': 'bg-orange-100 text-orange-600',
                    '知乎': 'bg-purple-100 text-purple-600'
                };
                var colorClass = platformColors[item.platform] || 'bg-gray-100 text-gray-600';
                var title = item.title || '无标题';
                if (title.length > 50) title = title.substring(0, 50) + '...';
                var highlightedTitle = title.replace(new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark class="bg-cheese/60 rounded px-0.5">$1</mark>');

                html += '<a href="' + (item.url || '#') + '" target="_blank" class="flex items-start gap-3 px-4 py-3 hover:bg-matcha-light/50 transition-colors cursor-pointer group">';
                html += '<span class="shrink-0 mt-0.5 px-2 py-0.5 rounded-md text-xs font-bold ' + colorClass + '">' + (item.platform || '未知') + '</span>';
                html += '<div class="flex-1 min-w-0">';
                html += '<p class="text-sm font-medium text-gray-700 group-hover:text-matcha transition-colors truncate">' + highlightedTitle + '</p>';
                html += '<div class="flex items-center gap-3 mt-1">';
                if (item.account) html += '<span class="text-xs text-gray-400">' + item.account + '</span>';
                if (item.date) html += '<span class="text-xs text-gray-400">' + item.date.substring(0, 10) + '</span>';
                if (item.views) html += '<span class="text-xs text-gray-400">' + item.views + ' 阅读</span>';
                html += '</div></div></a>';
            });

            resultsContainer.innerHTML = html;
        }

        function clearGlobalSearch() {
            var input = document.getElementById('global-search-input');
            input.value = '';
            document.getElementById('global-search-clear').classList.add('hidden');
            document.getElementById('global-search-dropdown').classList.add('hidden');
            input.focus();
        }

        document.addEventListener('click', function(e) {
            var wrapper = document.getElementById('global-search-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('global-search-dropdown').classList.add('hidden');
            }
        });

        // ==========================================
        // 左侧侧边栏：分类切换
        // ==========================================
        function switchCategory(wrapper, catId) {
            currentCategory = catId;
            selectedIds.clear();
            var config = categoryConfigs[catId];
            var container = document.getElementById('category-list');
            container.querySelectorAll('.category-btn').forEach(function(btn) {
                btn.className = 'category-btn w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center gap-3 text-gray-600 hover:bg-matcha-light hover:text-matcha';
            });
            wrapper.querySelector('.category-btn').className = 'category-btn w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center gap-3 bg-matcha text-white font-medium shadow-md shadow-matcha/20';
            document.getElementById('page-title').innerHTML = config.name + '监控 <span class="px-2.5 py-1 bg-cheese-light text-yellow-800 text-xs rounded-lg border border-cheese/50 font-medium">运行中</span>';
            activeFilters = { platform: 'all', keyword: 'all', account: 'all' };
            renderFilters();
            renderContentList();
            renderSettings();
            showToast('已切换到：' + config.name, 'success');
        }

        function deleteCategory(catId) {
            var container = document.getElementById('category-list');
            var items = container.querySelectorAll('.group');
            if (items.length <= 1) {
                showToast('至少保留一个监控分类', 'error');
                return;
            }
            if (!confirm('确定要删除「' + categoryConfigs[catId].name + '」吗？')) return;
            var el = container.querySelector('[data-cat="' + catId + '"]');
            if (el) el.remove();
            delete categoryConfigs[catId];
            if (currentCategory === catId) {
                var first = container.querySelector('.group');
                if (first) {
                    var firstCatId = first.dataset.cat;
                    switchCategory(first, firstCatId);
                }
            }
            showToast('分类已删除', 'success');
        }

        function manualCrawl(catId) {
            if (catId !== currentCategory) {
                switchCategory(document.querySelector('[data-cat="' + catId + '"]'), catId);
            }

            var config = categoryConfigs[catId];
            var platforms = config.platforms || {};

            // 查找第一个启用了API且有关键词的平台
            var targetPlatform = '';
            var platformConfig = null;
            Object.keys(platforms).forEach(function(p) {
                if (!targetPlatform && platforms[p].apiEnabled && platforms[p].keywords && platforms[p].keywords.length > 0) {
                    targetPlatform = p;
                    platformConfig = platforms[p];
                }
            });

            if (!targetPlatform) {
                showToast('没有启用了API数据源且配置了关键词的平台', 'error');
                return;
            }

            var apiKw = platformConfig.keywords[0];

            if (!platformConfig.apiUrl || !platformConfig.apiKey) {
                showToast('平台「' + targetPlatform + '」的API地址或Key未配置', 'error');
                return;
            }

            showToast('开始手动爬取「' + config.name + '」平台：' + targetPlatform + '，关键词：' + apiKw, 'info');
            loadApiData(catId, targetPlatform, true).then(function(items) {
                console.log('[manualCrawl] loadApiData returned', items.length, 'items');
                renderContentList();
                if (items.length === 0) {
                    var cacheKey = catId + '_' + targetPlatform + '_' + activeDate;
                    var cached = apiCache[cacheKey] || [];
                    if (cached.length > 0) {
                        showToast('爬取完成，已缓存 ' + cached.length + ' 条文章', 'success');
                    } else {
                        showToast('API未返回数据，请检查关键词是否有结果或Key是否有效', 'error');
                    }
                } else {
                    showToast('爬取完成，新增 ' + items.length + ' 条文章', 'success');
                }
            }).catch(function(err) {
                console.error('爬取失败:', err);
                showToast('爬取失败：' + (err.message || '网络错误或CORS限制'), 'error');
            });
        }

        function openNewCategoryModal() {
            document.getElementById('category-modal').classList.remove('hidden');
            document.getElementById('new-category-name').value = '';
            document.getElementById('new-category-name').focus();
        }

        function closeNewCategoryModal() {
            document.getElementById('category-modal').classList.add('hidden');
        }

        var catIdCounter = 3;
        function confirmNewCategory() {
            var name = document.getElementById('new-category-name').value.trim();
            if (!name) {
                showToast('请输入分类名称', 'error');
                return;
            }
            var catId = 'cat-' + catIdCounter++;
            categoryConfigs[catId] = {
                name: name + ' 选题',
                platforms: {}
            };
            var list = document.getElementById('category-list');
            var wrapper = document.createElement('div');
            wrapper.className = 'group relative';
            wrapper.setAttribute('data-cat', catId);
            wrapper.innerHTML =
                '<button onclick="switchCategory(this.closest(\'.group\'), \'' + catId + '\')" class="category-btn w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center gap-3 text-gray-600 hover:bg-matcha-light hover:text-matcha pr-16" data-cat="' + catId + '">' +
                    '<i data-lucide="layout-dashboard" class="w-4 h-4"></i>' +
                    '<span class="truncate flex-1">' + name + ' 选题</span>' +
                '</button>' +
                '<button onclick="manualCrawl(\'' + catId + '\')" class="absolute right-10 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400/0 hover:bg-matcha hover:text-white transition-all z-10 group-hover:text-gray-400" title="手动触发爬取">' +
                    '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>' +
                '</button>' +
                '<button onclick="deleteCategory(\'' + catId + '\')" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400/0 hover:bg-red-500 hover:text-white transition-all z-10 group-hover:text-gray-400" title="删除分类">' +
                    '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>' +
                '</button>';
            list.appendChild(wrapper);
            lucide.createIcons();
            closeNewCategoryModal();
            showToast('新建分类成功：' + name + ' 选题', 'success');
        }

        // ==========================================
        // 顶层 Tab 切换
        // ==========================================
        function switchMainTab(tabId) {
            document.querySelectorAll('.tab-pane').forEach(function(el) {
                el.classList.add('hidden');
                el.classList.remove('block');
            });
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            document.getElementById('tab-' + tabId).classList.add('block');

            document.querySelectorAll('.main-tab-btn').forEach(function(btn) {
                if (btn.dataset.target === tabId) {
                    btn.className = 'main-tab-btn px-3 py-1.5 text-sm font-medium transition-colors text-matcha border-b-2 border-matcha';
                } else {
                    btn.className = 'main-tab-btn px-3 py-1.5 text-sm font-medium transition-colors text-gray-400 hover:text-gray-600 border-b-2 border-transparent';
                }
            });

            if (tabId === 'report') {
                generateReportFromData();
                var dates = Object.keys(reportData).sort().reverse();
                var latestDate = dates.length > 0 ? dates[0] : null;
                if (latestDate) currentReportDate = latestDate;
                renderReportTimeline();
                renderReportGrid();
                if (latestDate) {
                    renderReportDetail(latestDate);
                    setTimeout(function() {
                        var firstNode = document.querySelector('#report-timeline .report-node');
                        if (firstNode) switchReportTimeline(firstNode, latestDate);
                    }, 50);
                }
            }
        }

        // ==========================================
        // 内容大盘：时间线卡片
        // ==========================================
        // 根据实际数据更新日期统计（按抓取时间统计，不是发布时间）
        function updateDateCounts() {
            dateData.forEach(function(dateItem) {
                var count = 0;
                // 统计本地数据（只统计当前分类，按抓取时间 storedDate 统计）
                contentData.forEach(function(item) {
                    if (item.category !== currentCategory) return;
                    var storedDate = item.storedDate || item.date;
                    if (storedDate && storedDate.startsWith(dateItem.fullDate)) {
                        count++;
                    }
                });
                // 统计API缓存数据（只统计当前分类，按 storedDate 统计）
                Object.keys(apiCache).forEach(function(key) {
                    if (!key.startsWith(currentCategory + '_')) return;
                    var items = apiCache[key] || [];
                    var validItems = items.filter(function(item) {
                        var storedDate = item.storedDate || item.date;
                        return storedDate && storedDate.startsWith(dateItem.fullDate);
                    });
                    count += validItems.length;
                });
                dateItem.count = count;
            });
        }

        function renderDateCards() {
            updateDateCounts();
            var container = document.getElementById('date-cards');
            container.innerHTML = '';
            dateData.forEach(function(item, index) {
                var hasNew = item.count > 0;
                var activeClass = item.active 
                    ? 'border-matcha bg-matcha-light text-matcha shadow-sm' 
                    : 'border-white bg-white text-gray-500 hover:border-matcha/30 hover:shadow-sm';
                var opacityClass = item.active ? 'opacity-80' : 'opacity-60';
                var dotHtml = hasNew ? '<span class="flex w-2.5 h-2.5 rounded-full bg-[#E57A7A] border border-white"></span>' : '';
                
                var btn = document.createElement('button');
                btn.className = 'date-card flex-shrink-0 flex flex-col items-start p-4 rounded-2xl border-2 min-w-[120px] transition-all ' + activeClass;
                btn.setAttribute('onclick', 'switchDateCard(this, "' + item.fullDate + '")');
                btn.innerHTML = 
                    '<div class="flex items-center justify-between w-full mb-1"><span class="text-sm font-bold">' + item.label + '</span>' + dotHtml + '</div>' +
                    '<div class="text-xs font-medium ' + opacityClass + '">' + item.date + '</div>' +
                    '<div class="mt-2 text-2xl font-black">' + item.count + ' <span class="text-xs font-medium opacity-70">条</span></div>';
                container.appendChild(btn);
            });
        }

        function switchDateCard(clickedBtn, date) {
            activeDate = date;
            selectedIds.clear();
            var container = document.getElementById('date-cards');
            container.querySelectorAll('.date-card').forEach(function(btn) {
                btn.className = 'date-card flex-shrink-0 flex flex-col items-start p-4 rounded-2xl border-2 min-w-[120px] transition-all border-white bg-white text-gray-500 hover:border-matcha/30 hover:shadow-sm';
            });
            clickedBtn.className = 'date-card flex-shrink-0 flex flex-col items-start p-4 rounded-2xl border-2 min-w-[120px] transition-all border-matcha bg-matcha-light text-matcha shadow-sm';
            renderContentList();
            showToast('已切换至 ' + date + ' 的数据', 'info');
        }

        function scrollTimeline(direction) {
            var container = document.getElementById('date-cards');
            container.scrollBy({ left: direction * 140, behavior: 'smooth' });
        }

        // ==========================================
        // 内容大盘：根据分类配置动态渲染筛选器
        // ==========================================
        function renderFilters() {
            var config = categoryConfigs[currentCategory];
            var platforms = config.platforms || {};
            var platformNames = Object.keys(platforms);

            // 收集所有关键词和账号（去重）
            var allKeywords = [];
            var allAccounts = [];
            platformNames.forEach(function(p) {
                var pc = platforms[p];
                (pc.keywords || []).forEach(function(k) {
                    if (allKeywords.indexOf(k) === -1) allKeywords.push(k);
                });
                (pc.accounts || []).forEach(function(a) {
                    if (allAccounts.indexOf(a) === -1) allAccounts.push(a);
                });
            });

            var platContainer = document.getElementById('filter-platform');
            platContainer.innerHTML = '<button onclick="switchFilter(this, \'platform\', \'all\')" class="filter-btn-platform px-4 py-1.5 rounded-full text-sm font-bold transition-all bg-matcha text-white border border-matcha shadow-md shadow-matcha/20 shrink-0">全部</button>';
            platformNames.forEach(function(p) {
                platContainer.innerHTML += '<button onclick="switchFilter(this, \'platform\', \'' + p + '\')" class="filter-btn-platform px-4 py-1.5 rounded-full text-sm font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:border-matcha hover:text-matcha shrink-0">' + p + '</button>';
            });
            var kwContainer = document.getElementById('filter-keyword');
            kwContainer.innerHTML = '<button onclick="switchFilter(this, \'keyword\', \'all\')" class="filter-btn-keyword px-4 py-1.5 rounded-full text-sm font-bold transition-all bg-matcha text-white border border-matcha shadow-md shadow-matcha/20 shrink-0">全部</button>';
            allKeywords.forEach(function(k) {
                kwContainer.innerHTML += '<button onclick="switchFilter(this, \'keyword\', \'' + k + '\')" class="filter-btn-keyword px-4 py-1.5 rounded-full text-sm font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:border-matcha hover:text-matcha shrink-0">' + k + '</button>';
            });
            var accContainer = document.getElementById('filter-account');
            accContainer.innerHTML = '<button onclick="switchFilter(this, \'account\', \'all\')" class="filter-btn-account px-4 py-1.5 rounded-full text-sm font-bold transition-all bg-matcha text-white border border-matcha shadow-md shadow-matcha/20 shrink-0">全部</button>';
            allAccounts.forEach(function(a) {
                accContainer.innerHTML += '<button onclick="switchFilter(this, \'account\', \'' + a + '\')" class="filter-btn-account px-4 py-1.5 rounded-full text-sm font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:border-matcha hover:text-matcha shrink-0">' + a + '</button>';
            });
            lucide.createIcons();
        }

        // ==========================================
        // 微信公众号文章 API 获取
        // ==========================================
        function fetchWeixinArticles(kw, page, platformConfig) {
            page = page || 1;
            var sortType = platformConfig.apiSortType || 1;
            var mode = platformConfig.apiMode || 1;
            var period = platformConfig.apiPeriod || 7;
            var apiUrl = platformConfig.apiUrl || '';
            var apiKey = platformConfig.apiKey || '';
            // 搜索正文时，period 最大为 30
            if (mode !== 1 && period > 30) {
                period = 30;
            }
            if (!apiUrl) {
                return Promise.reject(new Error('该平台的API地址未配置'));
            }
            if (!apiKey) {
                return Promise.reject(new Error('该平台的API Key未配置'));
            }
            var reqBody = {
                kw: kw,
                sort_type: sortType,
                mode: mode,
                period: period,
                page: page,
                any_kw: '',
                ex_kw: '',
                key: apiKey
            };
            console.log('[API Request]', apiUrl, reqBody);
            // 使用本地代理服务器
            var proxyUrl = 'http://localhost:3000/?target=' + encodeURIComponent(apiUrl);
            return fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody)
            }).then(function(res) {
                console.log('[API Response Status]', res.status, res.statusText);
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ' ' + res.statusText);
                }
                return res.json();
            });
        }

        function convertApiItem(item, catId, platform) {
            var dateStr = item.publish_time_str || '';
            var timeMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
            var fullDate;
            if (timeMatch) {
                var apiYear = parseInt(timeMatch[1], 10);
                var currentYear = new Date().getFullYear();
                // 如果API返回的年份与当前年份相差超过1年，可能是数据源年份错误，使用当前年份
                if (Math.abs(apiYear - currentYear) > 1) {
                    fullDate = currentYear + '-' + timeMatch[2] + '-' + timeMatch[3];
                } else {
                    fullDate = timeMatch[1] + '-' + timeMatch[2] + '-' + timeMatch[3];
                }
            } else {
                fullDate = activeDate;
            }
            var readStr = item.read >= 10000 ? (item.read / 10000).toFixed(1) + 'w' : String(item.read);
            return {
                id: 'api_' + item.url,
                category: catId,
                platform: platform || '公众号',
                account: item.wx_name || '未知公众号',
                title: item.title,
                date: fullDate + ' ' + (dateStr.split(' ')[1] || '00:00'),
                views: readStr,
                likes: item.praise || 0,
                keywords: [],
                isApi: true,
                url: item.url,
                wxName: item.wx_name,
                content: item.content,
                looking: item.looking || 0,
                isOriginal: item.is_original === 1,
                publishTimeStr: item.publish_time_str || ''
            };
        }

        // ==========================================
        // 小红书笔记 API 获取
        // ==========================================
        function fetchXiaohongshuNotes(kw, page, platformConfig) {
            page = page || 1;
            var apiUrl = platformConfig.apiUrl || 'http://api.cn8n.com/p2/xhs/search_note_web';
            var apiKey = platformConfig.apiKey || '';
            if (!apiKey) {
                return Promise.reject(new Error('小红书API Key未配置'));
            }
            var reqBody = {
                keyword: kw,
                page: page
            };
            console.log('[XHS API Request]', apiUrl, reqBody);
            // 使用本地代理服务器
            var proxyUrl = 'http://localhost:3000/?target=' + encodeURIComponent(apiUrl);
            // 尝试两种认证格式
            var authHeader = apiKey.startsWith('sk-') ? 'Bearer ' + apiKey : apiKey;
            return fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody)
            }).then(function(res) {
                console.log('[XHS API Response Status]', res.status, res.statusText);
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ' ' + res.statusText);
                }
                return res.json();
            });
        }

        function convertXhsItem(item, catId, platform) {
            // 适配新的API响应格式
            var noteInfo = item.noteInfo || item.note || item;
            var user = item.user || noteInfo.user || {};

            var dateStr = noteInfo.notePublishTime || noteInfo.publish_time || '';
            var dateObj = dateStr ? new Date(dateStr.replace(/-/g, '/')) : new Date();
            var apiYear = dateObj.getFullYear();
            var currentYear = new Date().getFullYear();
            // 如果API返回的年份与当前年份相差超过1年，修正为当前年份
            if (Math.abs(apiYear - currentYear) > 1) {
                dateObj.setFullYear(currentYear);
            }
            var fullDate = dateObj.getFullYear() + '-' +
                String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
                String(dateObj.getDate()).padStart(2, '0');
            var timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' +
                String(dateObj.getMinutes()).padStart(2, '0');
            
            var likedCount = noteInfo.likeNum || noteInfo.liked_count || 0;
            var collectedCount = noteInfo.favNum || noteInfo.collected_count || 0;
            var commentsCount = noteInfo.cmtNum || noteInfo.comments_count || 0;
            var readNum = noteInfo.readNum || noteInfo.read_count || 0;
            var views = readNum || (likedCount + collectedCount * 2 + commentsCount * 3);
            var viewsStr = views >= 10000 ? (views / 10000).toFixed(1) + 'w' : String(views);
            
            var noteId = noteInfo.noteId || noteInfo.id || '';
            var xhsUrl = noteInfo.noteLink || (noteId ? 'https://www.xiaohongshu.com/explore/' + noteId : '');
            
            return {
                id: 'xhs_' + noteId,
                category: catId,
                platform: platform || '小红书',
                account: user.nickName || user.nickname || '未知用户',
                title: noteInfo.title || '',
                date: fullDate + ' ' + timeStr,
                views: viewsStr,
                likes: likedCount,
                keywords: [],
                isApi: true,
                url: xhsUrl,
                xhsNoteId: noteId,
                desc: noteInfo.desc || '',
                collectedCount: collectedCount,
                commentsCount: commentsCount,
                userAvatar: user.avatar || '',
                userId: user.userId || user.userid || '',
                publishTimeStr: fullDate + ' ' + timeStr
            };
        }

        var selectedIds = new Set();
        var apiLoadingLock = false;

        // 合并本地数据和API缓存数据，按ID去重（相同保留最新），支持多种排序方式
        function mergeContentItems(localItems, apiItems) {
            var itemMap = {};

            // 先加入本地数据
            localItems.forEach(function(item) {
                itemMap[item.id] = item;
            });

            // 再合并API数据，相同ID用API数据覆盖（API数据更新）
            apiItems.forEach(function(item) {
                itemMap[item.id] = item;
            });

            // 转为数组并按指定方式排序
            var result = Object.values(itemMap);
            var config = categoryConfigs[currentCategory];
            var currentPlatform = document.querySelector('.platform-tab.active');
            var platformName = currentPlatform ? currentPlatform.dataset.platform : null;
            var platformConfig = platformName && config && config.platforms ? config.platforms[platformName] : {};
            var sortType = platformConfig.displaySort || 'time';

            if (sortType === 'views') {
                // 按阅读数倒序排列（阅读数高的在前面）
                result.sort(function(a, b) {
                    var viewsA = parseInt(a.views) || 0;
                    var viewsB = parseInt(b.views) || 0;
                    return viewsB - viewsA;
                });
            } else {
                // 按时间倒序排列（最新的在前面）
                result.sort(function(a, b) {
                    var dateA = new Date(a.date.replace(/-/g, '/'));
                    var dateB = new Date(b.date.replace(/-/g, '/'));
                    return dateB - dateA;
                });
            }

            return result;
        }

        function loadApiData(catId, platform, force) {
            var config = categoryConfigs[catId];
            var platforms = config.platforms || {};
            var platformConfig = platforms[platform];
            if (!platformConfig || !platformConfig.apiEnabled) {
                console.log('[API] 平台「' + platform + '」未启用API或配置不存在');
                return Promise.resolve([]);
            }
            var apiKw = platformConfig.keywords && platformConfig.keywords[0] ? platformConfig.keywords[0] : '';
            if (!apiKw) {
                console.log('[API] 平台「' + platform + '」没有配置关键词');
                return Promise.resolve([]);
            }
            if (!platformConfig.apiUrl || !platformConfig.apiKey) {
                showToast('平台「' + platform + '」的API地址或Key未配置', 'error');
                console.warn('[API] 平台「' + platform + '」缺少apiUrl或apiKey');
                return Promise.resolve([]);
            }
            var cacheKey = catId + '_' + platform;
            if (!force && apiCache[cacheKey]) return Promise.resolve(apiCache[cacheKey]);
            if (apiLoadingLock) {
                console.log('[API] 已有请求在进行中，跳过');
                return Promise.resolve(apiCache[cacheKey] || []);
            }
            apiLoadingLock = true;

            var maxArticles = platformConfig.maxArticles || 50;
            var isXiaohongshu = platform === '小红书';
            var container = document.getElementById('content-list');
            var loadingId = 'api-loading-' + Date.now();
            var loadingDiv = document.createElement('div');
            loadingDiv.id = loadingId;
            loadingDiv.className = 'p-6 text-center fade-in';
            loadingDiv.innerHTML = '<div class="inline-flex items-center gap-2 text-sm text-gray-500 font-medium"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 正在从API获取' + (isXiaohongshu ? '小红书笔记' : '公众号文章') + '...</div>';
            if (container && !container.querySelector('#' + loadingId)) container.appendChild(loadingDiv);
            lucide.createIcons();

            console.log('[API] 开始请求平台「' + platform + '」，关键词：' + apiKw + '，URL：' + platformConfig.apiUrl);
            var fetchPromise = isXiaohongshu
                ? fetchXiaohongshuNotes(apiKw, 1, platformConfig)
                : fetchWeixinArticles(apiKw, 1, platformConfig);

            return fetchPromise.then(function(res) {
                console.log('[' + (isXiaohongshu ? 'XHS' : 'WX') + ' API Response Full JSON]');
                console.log(JSON.stringify(res, null, 2));
                var apiItems = [];

                if (isXiaohongshu) {
                    // 小红书API响应处理 - 兼容多种响应格式
                    console.log('[XHS API Response]', res);
                    var isSuccess = false;
                    if (res.code !== undefined) {
                        isSuccess = res.code === 0 || res.code === 200 || res.code === '0';
                    } else if (res.status !== undefined) {
                        isSuccess = res.status === 'ok' || res.status === 'success' || res.status === 200;
                    } else if (res.success !== undefined) {
                        isSuccess = res.success === true;
                    } else if (Array.isArray(res)) {
                        isSuccess = true;
                    }

                    if (!isSuccess && res.code !== undefined && res.code !== 0 && res.code !== 200 && res.code !== '0') {
                        console.warn('[XHS API Error Code]', res.code, res.msg || res.message || '');
                        showToast('小红书API错误：' + (res.msg || res.message || 'code=' + res.code), 'error');
                    } else {
                        var dataList = null;
                        if (res.data && res.data.result && res.data.result.data && Array.isArray(res.data.result.data)) {
                            dataList = res.data.result.data;
                            console.log('[XHS API] 从data.result.data提取到数据列表');
                        } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
                            dataList = res.data.items;
                        } else if (res.data && Array.isArray(res.data)) {
                            dataList = res.data;
                        } else if (res.items && Array.isArray(res.items)) {
                            dataList = res.items;
                        } else if (res.result && Array.isArray(res.result)) {
                            dataList = res.result;
                        } else if (res.notes && Array.isArray(res.notes)) {
                            dataList = res.notes;
                        } else if (res.list && Array.isArray(res.list)) {
                            dataList = res.list;
                        } else if (Array.isArray(res)) {
                            dataList = res;
                        } else if (res.data && typeof res.data === 'object') {
                            // 尝试从data对象中找到数组类型的字段
                            for (var key in res.data) {
                                if (Array.isArray(res.data[key]) && res.data[key].length > 0) {
                                    dataList = res.data[key];
                                    console.log('[XHS API] 从data.' + key + '提取到数据列表');
                                    break;
                                }
                            }
                        }
                        console.log('[XHS API Data List]', dataList);
                        if (dataList && dataList.length > 0) {
                            var items = dataList.map(function(item) { return convertXhsItem(item, catId, platform); });
                            var count = 0;
                            for (var i = 0; i < items.length; i++) {
                                if (count >= maxArticles) break;
                                apiItems.push(items[i]);
                                count++;
                            }
                            if (items.length > maxArticles) {
                                showToast('已达到每日监控上限 ' + maxArticles + ' 条，已自动截断', 'info');
                            }
                        } else {
                            console.warn('[XHS API Empty]', '响应成功但无数据列表');
                        }
                    }
                } else {
                    // 微信公众号API响应处理
                    if (res.code !== 0) {
                        console.warn('[API Error Code]', res.code, res.msg || '');
                        showToast('API错误：' + (res.msg || 'code=' + res.code), 'error');
                    } else {
                        var dataList = null;
                        if (res.data && res.data.data && Array.isArray(res.data.data)) {
                            dataList = res.data.data;
                        } else if (res.data && Array.isArray(res.data)) {
                            dataList = res.data;
                        } else if (res.list && Array.isArray(res.list)) {
                            dataList = res.list;
                        } else if (res.result && Array.isArray(res.result)) {
                            dataList = res.result;
                        }
                        console.log('[API Data List]', dataList);
                        if (dataList && dataList.length > 0) {
                            var items = dataList.map(function(item) { return convertApiItem(item, catId, platform); });
                            var count = 0;
                            for (var i = 0; i < items.length; i++) {
                                if (count >= maxArticles) break;
                                apiItems.push(items[i]);
                                count++;
                            }
                            if (items.length > maxArticles) {
                                showToast('已达到每日监控上限 ' + maxArticles + ' 条，已自动截断', 'info');
                            }
                        } else {
                            console.warn('[API Empty]', 'code=0 but no data list found');
                        }
                    }
                }
                // 为每个项目添加抓取时间
                var today = new Date();
                var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                apiItems.forEach(function(item) {
                    item.storedDate = todayStr;
                });

                // 合并到已有缓存中（累计模式：相同保留最新，不同累计）
                var existingCache = apiCache[cacheKey] || [];
                apiCache[cacheKey] = mergeContentItems(existingCache, apiItems);
                console.log('[API Cache Set]', cacheKey, 'count:', apiCache[cacheKey].length);

                // 保存到SQLite
                saveItemsToSQLite(apiItems);

                apiLoadingLock = false;
                var ld = document.getElementById(loadingId);
                if (ld) ld.remove();
                // 返回缓存中的数据（包含已有数据+新数据），确保调用方能拿到完整数据
                return apiCache[cacheKey] || [];
            }).catch(function(err) {
                apiLoadingLock = false;
                var ld = document.getElementById(loadingId);
                if (ld) ld.remove();
                console.error('[' + (isXiaohongshu ? 'XHS' : 'WX') + ' API Catch]', err);
                var errorMsg = err.message || '未知错误';
                if (errorMsg.indexOf('Failed to fetch') !== -1) {
                    showToast('请求被浏览器拦截（CORS），请使用后端代理或安装CORS插件', 'error');
                } else if (errorMsg.indexOf('INVALID_TOKEN') !== -1 || errorMsg.indexOf('无效的API令牌') !== -1) {
                    showToast('API Key无效，请检查「' + platform + '」的API Key配置', 'error');
                } else {
                    showToast((isXiaohongshu ? '小红书' : '') + 'API获取失败：' + errorMsg, 'error');
                }
                return [];
            });
        }

        // ==========================================
        // 内容大盘：筛选与列表
        // ==========================================
        function switchFilter(clickedBtn, type, value) {
            activeFilters[type] = value;
            var container = document.getElementById('filter-' + type);
            container.querySelectorAll('.filter-btn-' + type).forEach(function(btn) {
                btn.className = 'filter-btn-' + type + ' px-4 py-1.5 rounded-full text-sm font-medium transition-all bg-white border border-gray-200 text-gray-600 hover:border-matcha hover:text-matcha shrink-0';
            });
            clickedBtn.className = 'filter-btn-' + type + ' px-4 py-1.5 rounded-full text-sm font-bold transition-all bg-matcha text-white border border-matcha shadow-md shadow-matcha/20 shrink-0';
            currentPage = 1;
            renderContentList();
        }

        var platformStyles = {
            '公众号': { bg: 'bg-[#E7F3E9]', text: 'text-[#2BA245]', border: 'border-[#2BA245]/20' },
            '小红书': { bg: 'bg-[#FDECECF0]', text: 'text-[#FF2442]', border: 'border-[#FF2442]/20' },
            '抖音': { bg: 'bg-[#FFF4E6]', text: 'text-[#FF8C00]', border: 'border-[#FF8C00]/20' },
            'B站': { bg: 'bg-[#FDF3DF]', text: 'text-yellow-800', border: 'border-[#F7DCA0]/50' }
        };

        function updateBatchDeleteBtn() {
            var btn = document.getElementById('batch-delete-btn');
            if (btn) {
                btn.classList.toggle('hidden', selectedIds.size === 0);
            }
        }

        function renderContentItem(item) {
            var style = platformStyles[item.platform] || platformStyles['公众号'];
            var div = document.createElement('div');
            div.className = 'p-6 hover:bg-matcha-light/30 transition-colors flex items-start gap-5 fade-in';
            var isSelected = selectedIds.has(item.id);
            div.innerHTML =
                '<label class="flex items-center mt-1 cursor-pointer shrink-0">' +
                    '<input type="checkbox" class="batch-check w-4 h-4 rounded border-gray-300 text-matcha focus:ring-matcha" ' + (isSelected ? 'checked' : '') + ' />' +
                '</label>' +
                '<div class="flex-1">' +
                    '<div class="flex items-center gap-2 mb-3">' +
                        '<span class="px-2.5 py-1 rounded-lg text-xs font-bold ' + style.bg + ' ' + style.text + ' border ' + style.border + '">' + item.platform + '</span>' +
                        (item.isApi ? '<span class="px-2 py-0.5 bg-matcha-light text-matcha text-xs font-bold rounded-md">API</span>' : '') +
                        '<span class="text-xs font-medium text-gray-400">' + item.date + '</span>' +
                    '</div>' +
                    '<h4 class="text-lg font-bold text-gray-800 mb-2 cursor-pointer hover:text-matcha transition-colors">' + item.title + '</h4>' +
                    '<div class="flex items-center gap-3 text-sm text-gray-500 font-medium flex-wrap">' +
                        '<span class="flex items-center gap-1.5"><i data-lucide="user" class="w-4 h-4 text-cheese"></i> ' + item.account + '</span>' +
                        '<span class="flex items-center gap-1.5"><i data-lucide="eye" class="w-4 h-4"></i> ' + item.views + '</span>' +
                        '<span class="flex items-center gap-1.5"><i data-lucide="thumbs-up" class="w-4 h-4"></i> ' + item.likes + '</span>' +
                        (item.isApi ? '<span class="flex items-center gap-1.5"><i data-lucide="bookmark" class="w-4 h-4 text-matcha"></i> ' + (item.looking || 0) + '</span>' : '') +
                        (item.isApi && item.isOriginal ? '<span class="px-2 py-0.5 bg-matcha-light text-matcha text-xs font-bold rounded-md">原创</span>' : '') +
                        (item.isApi && !item.isOriginal ? '<span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-md">转载</span>' : '') +
                        (item.isApi && item.publishTimeStr ? '<span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4 text-gray-400"></i> ' + item.publishTimeStr + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="flex flex-col gap-2 shrink-0">' +
                    '<button class="btn-read px-4 py-2 text-sm font-bold border-2 border-border-soft rounded-xl text-gray-600 hover:border-matcha hover:text-matcha transition-all">' + (item.isApi ? '查看原文' : '阅读原文') + '</button>' +
                    '<button class="btn-delete px-4 py-2 text-sm font-bold border-2 border-border-soft rounded-xl text-gray-400 hover:border-red-300 hover:text-red-500 transition-all flex items-center justify-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>删除</button>' +
                '</div>';

            var btnRead = div.querySelector('.btn-read');
            var btnDelete = div.querySelector('.btn-delete');

            btnRead.addEventListener('click', function() {
                if (item.isApi) {
                    if (item.url) window.open(item.url, '_blank');
                } else {
                    showToast('正在打开：' + item.title.substring(0, 20) + '...', 'info');
                    setTimeout(function() {
                        window.open('https://www.example.com/article/' + item.id, '_blank');
                    }, 500);
                }
            });

            btnDelete.addEventListener('click', function() {
                if (!confirm('确定要删除这条文章吗？删除后不可恢复。')) return;
                // 从本地数据中删除
                var localIdx = contentData.findIndex(function(c) { return c.id === item.id; });
                if (localIdx !== -1) {
                    contentData.splice(localIdx, 1);
                }
                // 从API缓存中删除
                Object.keys(apiCache).forEach(function(key) {
                    var items = apiCache[key];
                    if (Array.isArray(items)) {
                        var idx = items.findIndex(function(c) { return c.id === item.id; });
                        if (idx !== -1) {
                            items.splice(idx, 1);
                        }
                    }
                });
                selectedIds.delete(item.id);
                saveDataToStorage();
                renderDateCards();
                renderContentList();
                generateReportFromData();
                // 如果当前显示的 AI 报告所属日期已没有数据，清空右侧报告
                if (currentReportDate && !reportData[currentReportDate]) {
                    clearReportDetail();
                    renderReportTimeline();
                }
                showToast('文章已删除', 'success');
            });

            var checkbox = div.querySelector('.batch-check');
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    selectedIds.add(item.id);
                } else {
                    selectedIds.delete(item.id);
                }
                updateBatchDeleteBtn();
            });

            return div;
        }

        function batchDelete() {
            if (selectedIds.size === 0) return;
            if (!confirm('确定要删除选中的 ' + selectedIds.size + ' 条文章吗？删除后不可恢复。')) return;
            var count = selectedIds.size;
            selectedIds.forEach(function(id) {
                // 从本地数据中删除
                var localIdx = contentData.findIndex(function(item) { return item.id === id; });
                if (localIdx !== -1) {
                    contentData.splice(localIdx, 1);
                }
                // 从API缓存中删除
                Object.keys(apiCache).forEach(function(key) {
                    var items = apiCache[key];
                    if (Array.isArray(items)) {
                        var idx = items.findIndex(function(item) { return item.id === id; });
                        if (idx !== -1) {
                            items.splice(idx, 1);
                        }
                    }
                });
            });
            selectedIds.clear();
            updateBatchDeleteBtn();
            saveDataToStorage();
            renderDateCards();
            renderContentList();
            generateReportFromData();
            // 如果当前显示的 AI 报告所属日期已没有数据，清空右侧报告
            if (currentReportDate && !reportData[currentReportDate]) {
                clearReportDetail();
                renderReportTimeline();
            }
            showToast('已删除 ' + count + ' 条文章', 'success');
        }

        function getFilteredItems() {
            console.log('[getFilteredItems] apiCache keys:', Object.keys(apiCache), 'activeDate:', activeDate);
            // 筛选本地数据（本地数据按日期筛选）
            var filtered = contentData.filter(function(item) {
                var matchCategory = item.category === currentCategory;
                var matchPlatform = activeFilters.platform === 'all' || item.platform === activeFilters.platform;
                var matchKeyword = activeFilters.keyword === 'all' || item.keywords.includes(activeFilters.keyword);
                var matchAccount = activeFilters.account === 'all' || item.account === activeFilters.account;
                var matchDate = item.date.startsWith(activeDate);
                return matchCategory && matchPlatform && matchKeyword && matchAccount && matchDate;
            });

            // 收集所有平台的API缓存数据（API数据不过滤日期，显示所有抓取到的内容）
            var config = categoryConfigs[currentCategory];
            var platforms = config.platforms || {};
            var allApiItems = [];
            Object.keys(platforms).forEach(function(p) {
                var cacheKey = currentCategory + '_' + p;
                var apiItems = apiCache[cacheKey] || [];
                var apiFiltered = apiItems.filter(function(item) {
                    var matchPlatform = activeFilters.platform === 'all' || item.platform === activeFilters.platform;
                    var matchAccount = activeFilters.account === 'all' || item.account === activeFilters.account;
                    return matchPlatform && matchAccount;
                });
                allApiItems = allApiItems.concat(apiFiltered);
            });

            // 合并去重（相同ID保留最新），并按时间倒序排列
            var result = mergeContentItems(filtered, allApiItems);
            console.log('[getFilteredItems] local:', filtered.length, 'api:', allApiItems.length, 'total:', result.length);
            return result;
        }

        function renderContentList() {
            var container = document.getElementById('content-list');
            var allItems = getFilteredItems();
            totalItems = allItems.length;
            document.getElementById('content-count').textContent = totalItems;

            // 更新全选复选框状态
            var selectAllCheckbox = document.getElementById('select-all-checkbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
            }

            if (allItems.length === 0) {
                container.innerHTML = '';
                document.getElementById('empty-state').classList.remove('hidden');
                document.getElementById('pagination-bar').classList.add('hidden');
                updateBatchDeleteBtn();
                return;
            }

            document.getElementById('empty-state').classList.add('hidden');
            container.innerHTML = '';

            // 分页计算
            var totalPages = Math.ceil(totalItems / pageSize);
            if (currentPage > totalPages) currentPage = totalPages || 1;
            var startIndex = (currentPage - 1) * pageSize;
            var endIndex = Math.min(startIndex + pageSize, totalItems);
            var pageItems = allItems.slice(startIndex, endIndex);

            pageItems.forEach(function(item) {
                container.appendChild(renderContentItem(item));
            });

            // 渲染分页栏
            renderPagination(totalPages);

            lucide.createIcons();
            updateBatchDeleteBtn();
        }

        function renderPagination(totalPages) {
            var paginationBar = document.getElementById('pagination-bar');
            if (totalItems <= 10) {
                paginationBar.classList.add('hidden');
                return;
            }
            paginationBar.classList.remove('hidden');
            document.getElementById('current-page-num').textContent = currentPage;
            document.getElementById('total-page-num').textContent = totalPages;

            var prevBtn = document.getElementById('page-prev');
            var nextBtn = document.getElementById('page-next');
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= totalPages;
        }

        function goToPage(direction) {
            var allItems = getFilteredItems();
            var totalPages = Math.ceil(allItems.length / pageSize);
            if (direction === 'prev' && currentPage > 1) {
                currentPage--;
            } else if (direction === 'next' && currentPage < totalPages) {
                currentPage++;
            }
            renderContentList();
            // 滚动到列表顶部
            document.getElementById('content-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function changePageSize() {
            var select = document.getElementById('page-size-select');
            pageSize = parseInt(select.value, 10);
            currentPage = 1;
            renderContentList();
        }

        function toggleSelectAll() {
            var checkbox = document.getElementById('select-all-checkbox');
            var allItems = getFilteredItems();
            var totalPages = Math.ceil(allItems.length / pageSize);
            var startIndex = (currentPage - 1) * pageSize;
            var endIndex = Math.min(startIndex + pageSize, allItems.length);
            var pageItems = allItems.slice(startIndex, endIndex);

            if (checkbox.checked) {
                pageItems.forEach(function(item) {
                    selectedIds.add(item.id);
                });
            } else {
                pageItems.forEach(function(item) {
                    selectedIds.delete(item.id);
                });
            }

            // 更新当前页所有复选框状态
            var checkboxes = document.querySelectorAll('#content-list .batch-check');
            checkboxes.forEach(function(cb) {
                cb.checked = checkbox.checked;
            });

            updateBatchDeleteBtn();
        }

        function openOriginal(id) {
            var item = contentData.find(function(c) { return c.id === id; });
            showToast('正在打开：' + (item ? item.title.substring(0, 20) + '...' : '文章链接'), 'info');
            setTimeout(function() {
                window.open('https://www.example.com/article/' + id, '_blank');
            }, 500);
        }

        function openApiOriginal(url) {
            if (!url) { showToast('链接无效', 'error'); return; }
            window.open(url, '_blank');
        }

        function exportData() {
            var filtered = contentData.filter(function(item) {
                var matchCategory = item.category === currentCategory;
                var matchPlatform = activeFilters.platform === 'all' || item.platform === activeFilters.platform;
                var matchKeyword = activeFilters.keyword === 'all' || item.keywords.includes(activeFilters.keyword);
                var matchAccount = activeFilters.account === 'all' || item.account === activeFilters.account;
                var matchDate = item.date.startsWith(activeDate);
                return matchCategory && matchPlatform && matchKeyword && matchAccount && matchDate;
            });

            var allApiItems = [];
            Object.keys(apiCache).forEach(function(key) {
                if (key.startsWith(currentCategory + '_')) {
                    var items = apiCache[key] || [];
                    var apiFiltered = items.filter(function(item) {
                        var matchPlatform = activeFilters.platform === 'all' || item.platform === activeFilters.platform;
                        var matchAccount = activeFilters.account === 'all' || item.account === activeFilters.account;
                        return matchPlatform && matchAccount;
                    });
                    allApiItems = allApiItems.concat(apiFiltered);
                }
            });

            var allItems = filtered.concat(allApiItems);

            var csv = '\uFEFF平台,账号,标题,发布时间,阅读量,点赞数,来源\n';
            allItems.forEach(function(item) {
                var source = item.isApi ? 'API' : '本地';
                csv += item.platform + ',' + item.account + ',"' + item.title + '",' + item.date + ',' + item.views + ',' + item.likes + ',' + source + '\n';
            });

            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '内容监控数据_' + activeDate + '.csv';
            link.click();
            showToast('已导出 ' + allItems.length + ' 条数据', 'success');
        }

        // ==========================================
        // 报告页面：时间线 & 网格
        // ==========================================
        function renderReportTimeline() {
            var container = document.getElementById('report-timeline');
            var dates = Object.keys(reportData).sort().reverse();
            container.innerHTML = '';
            
            dates.forEach(function(dateKey, index) {
                var data = reportData[dateKey];
                var isActive = index === 0;
                var node = document.createElement('div');
                node.className = 'report-node relative flex items-start gap-4 group cursor-pointer';
                node.setAttribute('onclick', "switchReportTimeline(this, '" + dateKey + "')");
                
                var iconClass = isActive 
                    ? 'node-icon flex items-center justify-center w-12 h-12 rounded-full border-4 border-cream shrink-0 shadow-md bg-matcha text-white z-10 relative'
                    : 'node-icon flex items-center justify-center w-12 h-12 rounded-full border-4 border-cream shrink-0 shadow-sm bg-white text-gray-400 z-10 relative';
                var iconHtml = isActive ? '<i data-lucide="sparkles" class="w-5 h-5"></i>' : '<i data-lucide="calendar" class="w-5 h-5"></i>';
                var cardClass = isActive
                    ? 'node-card flex-1 p-5 rounded-2xl border-2 transition-all border-matcha bg-white shadow-sm mt-1'
                    : 'node-card flex-1 p-5 rounded-2xl border-2 transition-all border-border-soft bg-white hover:border-matcha/40 mt-1';
                var titleClass = isActive ? 'text-base font-black text-matcha' : 'text-base font-bold text-gray-800';
                var badgeClass = isActive
                    ? 'badge px-2 py-0.5 bg-matcha-light text-matcha text-xs font-bold rounded-lg border border-matcha/20'
                    : 'badge px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg border border-gray-200';
                
                node.innerHTML = 
                    '<div class="' + iconClass + '">' + iconHtml + '</div>' +
                    '<div class="' + cardClass + '">' +
                        '<div class="flex justify-between items-start mb-2">' +
                            '<div class="' + titleClass + '">' + data.dateStr + '</div>' +
                            '<span class="' + badgeClass + '">' + data.topics.length + '个选题</span>' +
                        '</div>' +
                        '<div class="text-sm text-gray-600 line-clamp-2 font-medium mb-3">' + data.summary + '</div>' +
                    '</div>';
                container.appendChild(node);
            });
        }

        function renderReportGrid() {
            var container = document.getElementById('report-view-grid');
            container.innerHTML = '';

            if (topicLibrary.length === 0) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-400">' +
                    '<i data-lucide="bookmark" class="w-12 h-12 mb-4 opacity-30"></i>' +
                    '<p class="text-base font-bold text-gray-500">选题库为空</p>' +
                    '<p class="text-sm mt-1">在推荐选题中点击「收藏选题」即可加入</p></div>';
                lucide.createIcons();
                return;
            }

            topicLibrary.forEach(function(topic) {
                var titleHtml = topic.url
                    ? '<a href="' + topic.url + '" target="_blank" class="hover:text-matcha transition-colors cursor-pointer">' + topic.title + '</a>'
                    : topic.title;

                // 构建元数据标签
                var metaTags = '';
                if (topic.platform) metaTags += '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">' + topic.platform + (topic.account ? ' · ' + topic.account : '') + '</span>';
                if (topic.views) metaTags += '<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">阅读 ' + topic.views + '</span>';
                if (topic.likes) metaTags += '<span class="px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-xs font-medium">点赞 ' + topic.likes + '</span>';

                var div = document.createElement('div');
                div.className = 'bg-white border-2 border-border-soft rounded-3xl p-6 shadow-sm hover:border-matcha/50 transition-colors';
                div.innerHTML =
                    '<div class="flex items-center justify-between mb-3">' +
                        '<span class="px-2 py-1 bg-matcha-light text-matcha text-xs font-bold rounded-lg">' + topic.date + '</span>' +
                        (metaTags ? '<div class="flex gap-1.5">' + metaTags + '</div>' : '') +
                    '</div>' +
                    '<h5 class="text-lg font-bold text-gray-800 mb-4">' + titleHtml + '</h5>' +
                    '<ul class="space-y-3 text-sm text-gray-600 font-medium">' +
                        '<li class="flex items-start gap-2"><div class="w-1.5 h-1.5 rounded-full bg-cheese mt-1.5 shrink-0"></div><span class="flex-1 whitespace-pre-line">' + (topic.reason || '') + '</span></li>' +
                        '<li class="flex items-start gap-2"><div class="w-1.5 h-1.5 rounded-full bg-matcha mt-1.5 shrink-0"></div><span class="flex-1 whitespace-pre-line">' + (topic.point || '') + '</span></li>' +
                    '</ul>';
                container.appendChild(div);
            });
        }

        function clearReportDetail() {
            var prevDate = currentReportDate;
            currentReportTopics = [];

            // 取消左侧时间线高亮
            var timelineContainer = document.getElementById('report-timeline');
            if (timelineContainer) {
                timelineContainer.querySelectorAll('.report-node').forEach(function(node) {
                    var icon = node.querySelector('.node-icon');
                    var card = node.querySelector('.node-card');
                    var title = card.querySelector('.text-base, .font-black, .font-bold');
                    var badge = card.querySelector('.badge');

                    icon.className = 'node-icon flex items-center justify-center w-12 h-12 rounded-full border-4 border-cream shrink-0 shadow-sm bg-white text-gray-400 z-10 relative';
                    icon.innerHTML = '<i data-lucide="calendar" class="w-5 h-5"></i>';
                    card.className = 'node-card flex-1 p-5 rounded-2xl border-2 transition-all border-border-soft bg-white hover:border-matcha/40 mt-1';
                    if (title) title.className = 'text-base font-bold text-gray-800';
                    if (badge) badge.className = 'badge px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg border border-gray-200';
                });
                lucide.createIcons();
            }

            // 删除当前日期的 AI 分析报告，重新生成默认报告以恢复原始选题数量
            if (prevDate && reportData[prevDate] && reportData[prevDate].isAIReport) {
                delete reportData[prevDate];
                generateReportFromData();
                saveDataToStorage();
                renderReportTimeline();
                // 恢复为默认报告样式（图二状态），保留 currentReportDate 以便再次 AI 分析
                renderReportDetail(prevDate);
            } else {
                // 没有 AI 报告时，清空 currentReportDate 并恢复右侧为初始提示
                currentReportDate = '';
                var container = document.getElementById('report-detail-container');
                container.innerHTML = '<div class="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400">' +
                    '<i data-lucide="mouse-pointer-click" class="w-12 h-12 mb-4 opacity-30"></i>' +
                    '<p class="text-base font-bold text-gray-500">点击左侧日期查看 AI 分析详情</p>' +
                    '<p class="text-sm mt-1 text-gray-400">或选择日期后点击「AI 分析」生成报告</p>' +
                    '</div>';
                lucide.createIcons();
            }
        }

        function renderReportDetail(dateKey) {
            var data = reportData[dateKey];
            if (!data) return;
            currentReportTopics = data.topics || [];

            var container = document.getElementById('report-detail-container');

            // 判断 summary 是否为结构化（含 ### 标题）
            var isStructured = data.summary && data.summary.indexOf('###') !== -1;
            var summaryHtml = isStructured ? renderMarkdown(data.summary) : '<p class="text-sm text-gray-700 leading-relaxed font-medium">' + data.summary + '</p>';

            var topicsHtml = '';
            data.topics.forEach(function(topic, i) {
                // 清理标题中的 Markdown 加粗标记
                var displayTitle = (topic.title || '').replace(/\*\*/g, '').trim();
                // 如果 URL 为空，尝试再次从原始文章中查找（兜底）
                var topicUrl = topic.url || '';
                if (!topicUrl && dateKey) {
                    var dateItems = [];
                    var ds = dateKey; // dateKey 已经是 YYYY-MM-DD 格式
                    contentData.forEach(function(it) {
                        var d = (it.storedDate || it.date || '').substring(0, 10);
                        if (d === ds) dateItems.push(it);
                    });
                    Object.keys(apiCache).forEach(function(k) {
                        (apiCache[k] || []).forEach(function(it) {
                            var d = (it.storedDate || it.date || '').substring(0, 10);
                            if (d === ds) dateItems.push(it);
                        });
                    });
                    var found = findOriginalItem(displayTitle, dateItems);
                    // 如果第一次匹配失败，尝试截取标题前半部分（AI 常在标题后追加评分等后缀）
                    if (!found && displayTitle.indexOf(' - ') !== -1) {
                        var shortTitle = displayTitle.split(' - ')[0].trim();
                        found = findOriginalItem(shortTitle, dateItems);
                    }
                    if (found && found.url) {
                        topicUrl = found.url;
                        topic.url = found.url; // 回填到 topic
                    }
                }
                var titleHtml = topicUrl
                    ? '<a href="' + topicUrl + '" target="_blank" class="hover:text-matcha transition-colors cursor-pointer">' + displayTitle + '</a>'
                    : displayTitle;

                // 如果 reason 完全没有结构化内容（AI 没按要求返回），显示提示
                var hasStructured = (topic.reason && topic.reason.indexOf('【') !== -1) || (topic.point && topic.point.indexOf('【') !== -1);

                var reasonInner;
                if (hasStructured) {
                    // 走 Markdown 渲染
                    reasonInner = (topic.reason && topic.reason.indexOf('\n') !== -1)
                        ? renderMarkdown(topic.reason)
                        : '<p class="text-sm text-gray-600 font-medium pt-1 whitespace-pre-line">' + (topic.reason || '') + '</p>';
                } else {
                    // 没有结构化内容时，把 topic.reason / topic.point 平铺展示
                    var fallback = '';
                    if (topic.reason) fallback += '<p class="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-line mb-2">' + topic.reason + '</p>';
                    if (topic.point) fallback += '<p class="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-line">' + topic.point + '</p>';
                    if (!fallback) fallback = '<p class="text-xs text-gray-400 italic">未提取到详细分析，请查看控制台 [AI 原始返回]</p>';
                    reasonInner = fallback;
                }

                // 构建文章元数据条
                var metaTags = [];
                if (topic.platform) metaTags.push('<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">' + topic.platform + (topic.account ? ' · ' + topic.account : '') + '</span>');
                if (topic.views) metaTags.push('<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">阅读 ' + topic.views + '</span>');
                if (topic.likes) metaTags.push('<span class="px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-xs font-medium">点赞 ' + topic.likes + '</span>');
                var metaBar = metaTags.length > 0
                    ? '<div class="flex flex-wrap gap-2 mb-3">' + metaTags.join('') + '</div>'
                    : '';

                var pointInner;
                if (topic.point && topic.point.trim()) {
                    var pointContent = (topic.point.indexOf('\n') !== -1)
                        ? renderMarkdown(topic.point)
                        : '<p class="text-sm text-gray-600 font-medium pt-1 whitespace-pre-line">' + topic.point + '</p>';
                    pointInner = metaBar + pointContent;
                } else {
                    pointInner = metaBar + '<p class="text-xs text-gray-400 italic">AI 未提供模仿要点与改编建议</p>';
                }

                topicsHtml += '<div class="border-2 border-border-soft rounded-2xl p-6 hover:border-matcha/50 transition-colors bg-white mb-6">' +
                    '<h5 class="text-lg font-bold text-gray-800 mb-4 flex items-start gap-3">' +
                        '<span class="w-6 h-6 rounded-full bg-matcha text-white flex items-center justify-center text-sm shrink-0">' + (i + 1) + '</span>' +
                        '<span class="flex-1">' + titleHtml + '</span>' +
                    '</h5>' +
                    '<div class="ml-9 space-y-4">' +
                        '<div class="bg-cream/40 border border-cheese/30 rounded-xl p-4">' +
                            '<div class="text-xs font-black text-yellow-800 mb-2 flex items-center gap-1.5"><i data-lucide="flame" class="w-3.5 h-3.5"></i>来源</div>' +
                            '<div class="space-y-2">' + reasonInner + '</div>' +
                        '</div>' +
                        (hasStructured ?
                            '<div class="bg-matcha-light/40 border border-matcha/20 rounded-xl p-4">' +
                                '<div class="text-xs font-black text-matcha mb-2 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i>数据</div>' +
                                '<div class="space-y-2">' + pointInner + '</div>' +
                            '</div>'
                        : '') +
                    '</div>' +
                    '<div class="mt-4 flex justify-end">' +
                        '<button onclick="addToTopicLibraryByIndex(' + i + ')" class="px-4 py-2 bg-matcha text-white text-sm font-bold rounded-xl hover:bg-matcha/90 transition-colors flex items-center gap-1.5 shadow-sm">' +
                            '<i data-lucide="bookmark" class="w-4 h-4"></i>收藏选题' +
                        '</button>' +
                    '</div>' +
                '</div>';
            });

            container.classList.remove('fade-in');
            void container.offsetWidth;
            container.classList.add('fade-in');

            container.innerHTML = '<div class="absolute -top-10 -right-10 w-40 h-40 bg-cheese/20 rounded-full blur-3xl pointer-events-none"></div>' +
                '<div class="flex items-center justify-between mb-8">' +
                    '<div class="flex items-center gap-4">' +
                        '<div class="w-12 h-12 rounded-2xl bg-cheese flex items-center justify-center text-yellow-700 shadow-sm border border-cheese/50"><i data-lucide="lightbulb" class="w-6 h-6"></i></div>' +
                        '<div><h3 class="text-2xl font-black text-gray-800">AI 选题洞察报告</h3><p class="text-sm font-medium text-gray-500 mt-1">基于 ' + data.dateStr + ' 全网 Top 10 热门内容生成</p></div>' +
                    '</div>' +
                    '<button onclick="clearReportDetail()" class="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-1.5">' +
                        '<i data-lucide="arrow-left" class="w-4 h-4"></i>返回' +
                    '</button>' +
                '</div>' +
                '<div class="bg-cream/50 p-5 rounded-2xl border border-cheese/40 mb-8">' +
                    '<h4 class="text-base font-bold text-yellow-800 mb-3 flex items-center gap-2"><i data-lucide="flame" class="w-5 h-5 text-orange-400"></i>大盘热点总结</h4>' +
                    summaryHtml +
                '</div>' +
                '<h4 class="text-xl font-black text-gray-800 mb-5 flex items-center gap-2"><i data-lucide="target" class="w-6 h-6 text-matcha"></i> 推荐选题方向</h4>' +
                '<div>' + topicsHtml + '</div>';

            lucide.createIcons();
        }

        // 轻量级 Markdown 渲染（仅支持标题、表格、加粗、列表、换行）
        function renderMarkdown(text) {
            if (!text) return '';
            // 转义 HTML
            var html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // 1) 过滤掉 Markdown 表格行
            var lines = html.split('\n');
            var out = [];
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.trim().indexOf('|') === 0 && i + 1 < lines.length && /^\s*\|[\s\-|:]+\|\s*$/.test(lines[i + 1])) {
                    // 跳过表头和分隔行
                    i += 2;
                    // 跳过表格数据行
                    while (i < lines.length && lines[i].trim().indexOf('|') === 0) {
                        i++;
                    }
                } else {
                    out.push(line);
                    i++;
                }
            }
            html = out.join('\n');

            // 2) 标题：### / ## / #
            html = html.replace(/^### (.+)$/gm, '<h5 class="text-sm font-black text-gray-800 mt-4 mb-2">$1</h5>');
            html = html.replace(/^## (.+)$/gm, '<h4 class="text-base font-black text-gray-800 mt-4 mb-2">$1</h4>');
            html = html.replace(/^# (.+)$/gm, '<h3 class="text-lg font-black text-gray-800 mt-4 mb-2">$1</h3>');

            // 3) 加粗
            html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-800">$1</strong>');

            // 4) 【xxx】标签渲染为高亮小标签
            html = html.replace(/【\s*([^】\n]+?)\s*】\s*/g, function(m, name) {
                var colors = {
                    '数据亮点': 'bg-orange-100 text-orange-800 border-orange-200',
                    '选题价值': 'bg-blue-100 text-blue-800 border-blue-200',
                    '模仿要点': 'bg-green-100 text-green-800 border-green-200',
                    '改编建议': 'bg-purple-100 text-purple-800 border-purple-200'
                };
                var cls = colors[name] || 'bg-gray-100 text-gray-800 border-gray-200';
                return '<span class="inline-block px-2 py-0.5 text-xs font-bold border rounded-md mb-1 ' + cls + '">' + name + '</span><br>';
            });

            // 5) 列表项（- 开头）
            html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-gray-700 my-1">$1</li>');

            // 6) 多余空行变成段落分隔
            var parts = html.split(/\n{2,}/);
            html = parts.map(function(p) {
                if (p.indexOf('<h') === 0 || p.indexOf('<li') === 0 || p.indexOf('<table') === 0 || p.indexOf('<div') === 0) return p;
                if (p.trim() === '') return '';
                return '<p class="text-sm text-gray-700 leading-relaxed font-medium mb-2">' + p.replace(/\n/g, '<br>') + '</p>';
            }).join('');

            return html;
        }

        function switchReportView(viewType) {
            var timelineView = document.getElementById('report-view-timeline');
            var gridView = document.getElementById('report-view-grid');
            var btnTimeline = document.getElementById('view-btn-timeline');
            var btnGrid = document.getElementById('view-btn-grid');

            if (viewType === 'timeline') {
                timelineView.classList.remove('hidden'); timelineView.classList.add('flex');
                gridView.classList.add('hidden'); gridView.classList.remove('grid');
                btnTimeline.className = 'px-5 py-2 rounded-xl text-sm font-bold transition-all bg-cheese text-yellow-900 shadow-sm';
                btnGrid.className = 'px-5 py-2 rounded-xl text-sm font-bold transition-all text-gray-500 hover:text-gray-800 hover:bg-cream';
            } else {
                timelineView.classList.add('hidden'); timelineView.classList.remove('flex');
                gridView.classList.remove('hidden'); gridView.classList.add('grid');
                btnGrid.className = 'px-5 py-2 rounded-xl text-sm font-bold transition-all bg-cheese text-yellow-900 shadow-sm';
                btnTimeline.className = 'px-5 py-2 rounded-xl text-sm font-bold transition-all text-gray-500 hover:text-gray-800 hover:bg-cream';
                renderReportGrid();
            }
        }

        function switchReportTimeline(clickedNode, dateKey) {
            currentReportDate = dateKey;
            var container = document.getElementById('report-timeline');
            container.querySelectorAll('.report-node').forEach(function(node) {
                var icon = node.querySelector('.node-icon');
                var card = node.querySelector('.node-card');
                var title = card.querySelector('.text-base, .font-black, .font-bold');
                var badge = card.querySelector('.badge');
                
                icon.className = 'node-icon flex items-center justify-center w-12 h-12 rounded-full border-4 border-cream shrink-0 shadow-sm bg-white text-gray-400 z-10 relative';
                icon.innerHTML = '<i data-lucide="calendar" class="w-5 h-5"></i>';
                card.className = 'node-card flex-1 p-5 rounded-2xl border-2 transition-all border-border-soft bg-white hover:border-matcha/40 mt-1';
                if(title) title.className = 'text-base font-bold text-gray-800';
                if(badge) badge.className = 'badge px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg border border-gray-200';
            });

            var icon = clickedNode.querySelector('.node-icon');
            var card = clickedNode.querySelector('.node-card');
            var title = card.querySelector('.text-base, .font-black, .font-bold');
            var badge = clickedNode.querySelector('.badge');
            
            icon.className = 'node-icon flex items-center justify-center w-12 h-12 rounded-full border-4 border-cream shrink-0 shadow-md bg-matcha text-white z-10 relative';
            icon.innerHTML = '<i data-lucide="sparkles" class="w-5 h-5"></i>';
            card.className = 'node-card flex-1 p-5 rounded-2xl border-2 transition-all border-matcha bg-white shadow-sm mt-1';
            if(title) title.className = 'text-base font-black text-matcha';
            if(badge) badge.className = 'badge px-2 py-0.5 bg-matcha-light text-matcha text-xs font-bold rounded-lg border border-matcha/20';
            
            lucide.createIcons();
            renderReportDetail(dateKey);
        }

        // ==========================================
        // AI 选题分析
        // ==========================================
        var AI_API_KEY = 'sk-1b8d140be54f4b67978490d5ae9f8f71';
        var AI_BASE_URL = 'https://api.deepseek.com';
        var AI_MODEL = 'deepseek-v4-flash';

        var DEFAULT_SYSTEM_PROMPT = '你是一位资深的内容运营专家，擅长分析热点内容并挖掘选题方向。\n\n你的任务：\n1. 仔细阅读用户提供的当日所有文章内容\n2. 按照用户的四层筛选逻辑为每篇文章打分\n3. 给出 TOP5 排名\n4. 对每篇入选文章做详细分析（数据亮点、选题价值、模仿要点、改编建议）\n5. 指出 1-2 篇不适合模仿的文章\n\n## 输出格式要求（严格遵守）\n1. 使用 Markdown 格式\n2. TOP5 排名使用 Markdown 表格语法（| ... |）\n3. 每个字段必须用【字段名】包裹，例如：\n   - 【数据亮点】xxx\n   - 【选题价值】xxx\n   - 【模仿要点】xxx（用 - 列表）\n   - 【改编建议】xxx\n4. 每个 ### 编号下完整包含这 4 个字段\n5. 不要用 **加粗** 来标记字段名，必须用【】中括号包裹\n6. 严格遵循"先表格 → 再每个 ### 详细分析 → 最后额外提醒"的顺序';
        var DEFAULT_USER_PROMPT = '# 任务：结合数据与内容，从以下文章中筛选出最值得我模仿的5个选题和对应范文\n\n## 我的背景\n- 写作新手，模仿写作，目标长度1500-3000字。\n- 写作方向：[填写，如"职场/个人成长/AI自学/AI工具"]\n- 目标平台：[公众号/知乎/小红书]\n\n## 筛选逻辑（四层递进）\n\n请按照以下顺序筛选：\n\n### 第0层：数据验证（满分10分）\n根据我提供的每篇文章的数据（阅读量、点赞、在看/转发、评论），按以下标准打分：\n- 阅读量：基准视平台而定（公众号>3万给8分，1-3万给6分，<5000给2分）\n- 点赞率：>2%给10分，1%-2%给7分，0.5%-1%给4分，<0.5%给1分\n- 在看/转发率：>0.5%给10分，0.2%-0.5%给6分，<0.2%给2分\n- 评论质量：有10条以上真实讨论（非"沙发"）给10分，有少量讨论给5分，无评论0分\n最终数据分 = (阅读量分×0.3 + 点赞率分×0.3 + 转发率分×0.2 + 评论分×0.2) 归一化到10分制\n\n### 第1层：选题潜力（满分10分）\n- 是否戳中常见痛点/痒点/爽点？(4分)\n- 是否有讨论度或时效性？(3分)\n- 我能否加入自己的观点/案例？(3分)\n\n### 第2层：模仿价值（满分10分）\n- 结构清晰（总分总/递进/并列）？(3分)\n- 有可复制的技法（对比/排比/故事化/金句）？(4分)\n- 排版友好（小标题/加粗/短段落）？(3分)\n\n### 第3层：与我匹配（满分10分）\n- 字数、复杂度适合新手？(3分)\n- 领域相关？(4分)\n- 素材是否易得？(3分)\n\n### 最终综合得分公式\n**综合分 = 数据分×0.3 + 选题潜力分×0.3 + 模仿价值分×0.3 + 匹配度分×0.1**\n\n## 输出格式（严格遵守，关系到字段能否被正确解析）\n\n请严格按以下结构输出 Markdown：\n\n```\n## 大盘总结\n[2-3 句总结]\n\n## TOP5 排名\n| 排名 | 文章标题 | 综合得分 | 数据分 | 选题分 | 模仿分 | 匹配分 |\n| --- | --- | --- | --- | --- | --- | --- |\n| 1 | 标题1 | 9.2 | 9.5 | 9.0 | 9.0 | 8.5 |\n| 2 | 标题2 | ... | ... | ... | ... | ... |\n| 3 | ... |\n| 4 | ... |\n| 5 | ... |\n\n### 1. 标题1\n【数据亮点】\n[这里写数据亮点 200字内]\n\n【选题价值】\n[这里写选题价值 200字内]\n\n【模仿要点】\n- 要点1\n- 要点2\n- 要点3\n\n【改编建议】\n[这里写改编建议 200字内]\n\n### 2. 标题2\n【数据亮点】\n...\n[其他字段同上]\n\n## 额外提醒\n[1-2 篇数据好但不适合模仿的文章说明]\n```\n\n**关键要求**：\n1. **必须**用【数据亮点】【选题价值】【模仿要点】【改编建议】四个中文方括号标签包裹字段\n2. **不要**用 **加粗** 代替中括号\n3. **不要**省略任何一个字段\n4. 每个 `### 编号` 下必须完整包含 4 个字段\n5. 【模仿要点】用 `- 列表` 形式，至少 3 条\n\n## 文章卡片列表（每篇请附上数据）\n\n卡片格式示例：\n标题：《废掉一个人最隐蔽的方式》\n数据：阅读量5.2万，点赞1036（点赞率1.99%），在看312（在看率0.6%），评论28条（多为"太真实了"）\n开头：朋友故事\n结构：递进式（是什么-为什么-怎么办）\n核心观点：不要只做擅长的事\n金句："你越擅长什么，就越容易被什么困住"\n字数：2600字\n\n[接着列出其他卡片...]';

        var userPromptConfig = {
            system: '',
            user: ''
        };

        function loadPromptConfig() {
            try {
                var saved = localStorage.getItem('ai_prompt_config');
                if (saved) {
                    userPromptConfig = JSON.parse(saved);
                }
            } catch (e) { /* ignore */ }
        }

        function savePromptConfigToStorage() {
            try {
                localStorage.setItem('ai_prompt_config', JSON.stringify(userPromptConfig));
            } catch (e) { /* ignore */ }
        }

        function openPromptModal() {
            var modal = document.getElementById('prompt-modal');
            document.getElementById('prompt-system').value = userPromptConfig.system || DEFAULT_SYSTEM_PROMPT;
            document.getElementById('prompt-user').value = userPromptConfig.user || DEFAULT_USER_PROMPT;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            lucide.createIcons();
        }

        function closePromptModal() {
            var modal = document.getElementById('prompt-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function savePromptConfig() {
            userPromptConfig.system = document.getElementById('prompt-system').value.trim() || DEFAULT_SYSTEM_PROMPT;
            userPromptConfig.user = document.getElementById('prompt-user').value.trim() || DEFAULT_USER_PROMPT;
            savePromptConfigToStorage();
            closePromptModal();
            showToast('提示词配置已保存', 'success');
        }

        function resetSystemPrompt() {
            document.getElementById('prompt-system').value = DEFAULT_SYSTEM_PROMPT;
        }

        function resetUserPrompt() {
            document.getElementById('prompt-user').value = DEFAULT_USER_PROMPT;
        }

        function analyzeReportWithAI() {
            var keywordInput = document.getElementById('report-keyword-input');
            var keyword = keywordInput ? keywordInput.value.trim() : '';

            var dateStr = currentReportDate;
            if (!dateStr) {
                var targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - 1);
                dateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
            }

            var allItems = [];
            contentData.forEach(function(item) {
                var d = (item.storedDate || item.date || '').substring(0, 10);
                if (d === dateStr) {
                    if (!keyword || (item.title && item.title.indexOf(keyword) !== -1) || (item.keywords && item.keywords.indexOf(keyword) !== -1)) {
                        allItems.push(item);
                    }
                }
            });
            Object.keys(apiCache).forEach(function(key) {
                (apiCache[key] || []).forEach(function(item) {
                    var d = (item.storedDate || item.date || '').substring(0, 10);
                    if (d === dateStr) {
                        var exists = allItems.some(function(x) { return x.id === item.id; });
                        if (!exists) {
                            if (!keyword || (item.title && item.title.indexOf(keyword) !== -1) || (item.keywords && item.keywords.indexOf(keyword) !== -1)) {
                                allItems.push(item);
                            }
                        }
                    }
                });
            });

            if (allItems.length === 0) {
                showToast(dateStr + ' 没有' + (keyword ? '包含「' + keyword + '」的' : '') + '数据，无需分析', 'info');
                return;
            }

            var btn = document.getElementById('btn-ai-report');
            var originalText = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>分析中...';
            btn.disabled = true;
            lucide.createIcons();

            var prompt = buildAnalysisPrompt(allItems, dateStr, keyword);

            function doAnalyze(attempt) {
                callDeepSeekAPI(prompt, attempt).then(function(result) {
                    var report = parseAIReport(result, dateStr, allItems);

                    // 检查解析结果是否有效：至少要有 topics 且 reason/point 有结构化内容
                    var hasValidContent = report.topics.length > 0 && report.topics.some(function(t) {
                        return (t.reason && t.reason.indexOf('【') !== -1) || (t.point && t.point.indexOf('【') !== -1);
                    });

                    if (!hasValidContent && attempt === 1) {
                        // 第一次解析失败，自动重试一次
                        console.log('[AI分析] 第1次返回格式不符合要求，自动重试...');
                        btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>格式不符，重试中...';
                        lucide.createIcons();
                        doAnalyze(2);
                        return;
                    }

                    reportData[dateStr] = report;
                    renderReportTimeline();
                    renderReportGrid();
                    renderReportDetail(dateStr);
                    var msg = attempt > 1 ? 'AI 分析完成（重试后）：' : 'AI 分析完成：';
                    showToast(msg + dateStr + ' 共 ' + allItems.length + ' 篇文章', 'success');
                }).catch(function(err) {
                    console.error('[AI分析] 失败', err);
                    showToast('AI 分析失败：' + err.message, 'error');
                }).finally(function() {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    lucide.createIcons();
                });
            }

            doAnalyze(1);
        }

        function buildAnalysisPrompt(items, dateStr, keyword) {
            var contentText = items.map(function(item, i) {
                var line = (i + 1) + '. [' + (item.platform || '未知') + '] ' + (item.title || '无标题') +
                    '（账号：' + (item.account || '未知') + '，阅读：' + (item.views || '0') + '，点赞：' + (item.likes || '0') + '）';
                if (item.content) {
                    line += '\n   正文摘要：' + (item.content.length > 200 ? item.content.substring(0, 200) + '…' : item.content);
                }
                return line;
            }).join('\n\n');

            var userPrompt = (userPromptConfig.user || DEFAULT_USER_PROMPT) + '\n\n';
            userPrompt += '—— 当日数据（' + dateStr + '，共 ' + items.length + ' 篇）——\n\n';
            userPrompt += contentText + '\n\n';
            if (keyword) {
                userPrompt += '备注：以上内容是针对关键词「' + keyword + '」筛选后的结果。\n\n';
            }
            return userPrompt;
        }

        function callDeepSeekAPI(prompt, attempt) {
            attempt = attempt || 1;
            return new Promise(function(resolve, reject) {
                var proxyUrl = 'http://localhost:3000/?target=' + encodeURIComponent(AI_BASE_URL + '/v1/chat/completions');
                var systemMsg = userPromptConfig.system || DEFAULT_SYSTEM_PROMPT;
                // 第2次重试时，在 system prompt 中强调格式要求
                if (attempt > 1) {
                    systemMsg += '\n\n【重要提醒】这是第' + attempt + '次请求，请务必严格遵守输出格式要求，使用【数据亮点】【选题价值】【模仿要点】【改编建议】四个中括号标签包裹内容，不要用**加粗**代替。';
                }
                fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + AI_API_KEY
                    },
                    body: JSON.stringify({
                        model: AI_MODEL,
                        messages: [
                            { role: 'system', content: systemMsg },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0,
                        max_tokens: 4000
                    })
                }).then(function(res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                }).then(function(data) {
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        resolve(data.choices[0].message.content);
                    } else {
                        throw new Error('API 返回格式异常');
                    }
                }).catch(function(err) {
                    reject(err);
                });
            });
        }

        // 根据标题从原始文章中匹配 URL（全局函数，供 parseAIReport 和 renderReportDetail 共用）
        function findOriginalItem(aiTitle, items) {
                if (!aiTitle || !items || !items.length) return null;
                // 去除书名号、排名前缀、加粗标记、AI 添加的后缀（如 - 综合评分：9.1）等
                var cleanTitle = aiTitle
                    .replace(/[《》「」""''']/g, '')
                    .replace(/^\s*(?:第\s*\d+\s*名[：:]?\s*|\d+\.\s*|\*\*)?/g, '')
                    .replace(/\*\*$/g, '')
                    .replace(/\s*[-–—]\s*(?:综合评分|评分|得分|匹配度|相似度)[：:]\s*[\d.]+/g, '')
                    .trim();
            if (!cleanTitle) return null;
            var cleanItemTitle = function(t) { return t.replace(/[《》「」""''']/g, '').replace(/^\s*(?:第\s*\d+\s*名[：:]?\s*|\d+\.\s*|\*\*)?/g, '').trim(); };
            // 1. 精确匹配
            for (var i = 0; i < items.length; i++) {
                if (items[i].title && cleanItemTitle(items[i].title) === cleanTitle) {
                    return items[i];
                }
            }
            // 2. 包含匹配（AI标题在原始标题中）
            for (var i = 0; i < items.length; i++) {
                if (items[i].title && items[i].title.indexOf(cleanTitle) !== -1) {
                    return items[i];
                }
            }
            // 3. 反向包含（原始标题在AI标题中）
            for (var i = 0; i < items.length; i++) {
                if (items[i].title && cleanTitle.indexOf(cleanItemTitle(items[i].title)) !== -1) {
                    return items[i];
                }
            }
            return null;
        }

        function parseAIReport(aiResponse, dateStr, originalItems) {
            var month = dateStr.substring(5, 7);
            var day = dateStr.substring(8, 10);
            var dateStrLabel = month + '月' + day + '日';

            console.log('[AI 原始返回]', aiResponse);

            // 工具函数：从文本中提取某个字段
            function getField(text, key) {
                // 兼容 1：【数据亮点】 xxx\n【选题价值】
                var re1 = new RegExp('【\\s*' + key + '\\s*】\\s*([\\s\\S]*?)(?=\\n\\s*【|\\n###|\\n##|\\n#|$)');
                var m1 = text.match(re1);
                if (m1 && m1[1]) return m1[1].trim();

                // 兼容 2：**数据亮点** xxx  (空行前)
                var re2 = new RegExp('\\*\\*\\s*' + key + '\\s*\\*\\*\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*(?:数据亮点|选题价值|模仿要点|改编建议)|\\n#{2,3}|\\n#|$)');
                var m2 = text.match(re2);
                if (m2 && m2[1]) return m2[1].trim();

                // 兼容 3：数据亮点：xxx
                var re3 = new RegExp('(?:^|\\n)\\s*' + key + '\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:数据亮点|选题价值|模仿要点|改编建议)[:：]|\\n#{2,3}|\\n#|$)');
                var m3 = text.match(re3);
                if (m3 && m3[1]) return m3[1].trim();

                return '';
            }

            // 提取 summary：寻找 ##/### 总结 / ##/### 大盘总结 / ##/### 热点总结 等标题后的内容
            var summaryMatch = aiResponse.match(/#{2,3}\s*(?:大盘)?(?:热点)?(?:选题)?总结[\s\S]*?\n([\s\S]*?)(?=\n#{2,3}|\n#|$)/);
            var summary = summaryMatch ? summaryMatch[1].trim() : '';

            // 提取 TOP5 排名表格
            var tableMatch = aiResponse.match(/\|[^\n]*排名[^\n]*\|[\s\S]*?(?=\n#{2,3}|\n#|$)/);
            var rankingTable = tableMatch ? tableMatch[0].trim() : '';

            // 解析 TOP5 排名表格，建立排名->原始标题映射（用于解决 AI 改写标题导致匹配失败的问题）
            var rankingMap = {};
            if (rankingTable) {
                var tableLines = rankingTable.split('\n');
                tableLines.forEach(function(line) {
                    var cells = line.split('|').map(function(c) { return c.trim(); });
                    if (cells.length >= 3 && /^\d+$/.test(cells[1])) {
                        var rank = parseInt(cells[1]);
                        var originalTitle = cells[2];
                        if (rank && originalTitle && originalTitle !== '---' && originalTitle !== '文章标题') {
                            rankingMap[rank] = originalTitle;
                        }
                    }
                });
            }

            // 解析每个入选文章（以 ### 1. / ## 1. 等开头的段落，兼容顿号、无点号等格式）
            var topics = [];
            var sectionPattern = /#{2,3}\s*(\d+)[\.、]?\s*([\s\S]*?)(?=\n#{2,3}|\n#|$)/g;
            var match;
            while ((match = sectionPattern.exec(aiResponse)) !== null) {
                var section = match[2].trim();
                var rankNum = parseInt(match[1]);
                // 提取该小节内的所有字段
                // 先去掉开头的 ** / ## 等标记，再取第一行作为标题
                var firstLine = section.split('\n')[0].trim()
                    .replace(/^\s*(?:\*\*)?/, '')
                    .replace(/(?:\*\*)?\s*$/, '')
                    .replace(/^标题[：:]\s*/, '')
                    .trim();
                var title = firstLine || '推荐选题';

                var dataHighlight = getField(section, '数据亮点');
                var topicValue = getField(section, '选题价值');
                var imitatePoints = getField(section, '模仿要点');
                var adaptSuggestion = getField(section, '改编建议');

                // reason 拼接【数据亮点】+【选题价值】
                var reason = '';
                if (dataHighlight) reason += '【数据亮点】' + dataHighlight + '\n';
                if (topicValue) reason += '【选题价值】' + topicValue;

                // point 拼接【模仿要点】+【改编建议】
                var point = '';
                if (imitatePoints) point += '【模仿要点】' + imitatePoints + '\n';
                if (adaptSuggestion) point += '【改编建议】' + adaptSuggestion;

                // 匹配原始文章，获取 URL 和元数据
                // 优先使用表格中的原始标题匹配，避免 AI 改写标题导致无法找到原文
                var lookupTitle = rankingMap[rankNum] || title;
                var matchedItem = findOriginalItem(lookupTitle, originalItems);

                topics.push({
                    title: title.split('\n')[0].trim(),
                    reason: reason || '',
                    point: point || '',
                    url: matchedItem ? (matchedItem.url || '') : '',
                    id: matchedItem ? (matchedItem.id || '') : '',
                    ranking: topics.length + 1,
                    platform: matchedItem ? (matchedItem.platform || '') : '',
                    account: matchedItem ? (matchedItem.account || '') : '',
                    views: matchedItem ? (matchedItem.views || '') : '',
                    likes: matchedItem ? (matchedItem.likes || '') : ''
                });
            }

            // 如果没解析到 topics（AI 没按 ### 分段），尝试把整篇内容作为 1-2 个推荐
            if (topics.length === 0) {
                // 兜底 1：从 TOP5 排名表格中提取标题生成 topics（只要表格存在就有数据）
                if (rankingTable) {
                    var tableLines = rankingTable.split('\n');
                    var tableTopics = [];
                    tableLines.forEach(function(line) {
                        var cells = line.split('|').map(function(c) { return c.trim(); });
                        if (cells.length >= 3 && /^\d+$/.test(cells[1])) {
                            var rank = parseInt(cells[1]);
                            var title = cells[2];
                            if (rank && title && title !== '---' && title !== '文章标题') {
                                var matchedItem = findOriginalItem(title, originalItems);
                                tableTopics.push({
                                    title: title,
                                    reason: '综合得分：' + (cells[3] || '未知') + (cells[4] ? ' | 阅读量：' + cells[4] : ''),
                                    point: '',
                                    url: matchedItem ? (matchedItem.url || '') : '',
                                    id: matchedItem ? (matchedItem.id || '') : '',
                                    ranking: rank,
                                    platform: matchedItem ? (matchedItem.platform || '') : '',
                                    account: matchedItem ? (matchedItem.account || '') : '',
                                    views: matchedItem ? (matchedItem.views || '') : '',
                                    likes: matchedItem ? (matchedItem.likes || '') : ''
                                });
                            }
                        }
                    });
                    if (tableTopics.length > 0) {
                        topics = tableTopics.slice(0, 5);
                    }
                }

                // 兜底 2：把整篇 AI 回复按"段落"拆，每个 ### 段落作为一个 topic
                if (topics.length === 0) {
                    var fallback = [];
                    var lines = aiResponse.split('\n');
                    var currentBlock = null;
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (/^#+\s/.test(line) && line.length < 60 && line.indexOf('|') === -1) {
                            if (currentBlock && currentBlock.text.length > 50) {
                                fallback.push(currentBlock);
                            }
                            currentBlock = { title: line.replace(/^#+\s*/, ''), text: '' };
                        } else if (currentBlock) {
                            currentBlock.text += line + '\n';
                        }
                    }
                    if (currentBlock && currentBlock.text.length > 50) fallback.push(currentBlock);
                    if (fallback.length > 0) {
                        topics = fallback.slice(0, 5).map(function(b, i) {
                            var fbItem = findOriginalItem(b.title, originalItems);
                            return {
                                title: b.title,
                                reason: b.text.trim(),
                                point: '',
                                url: fbItem ? (fbItem.url || '') : '',
                                id: fbItem ? (fbItem.id || '') : '',
                                ranking: i + 1,
                                platform: fbItem ? (fbItem.platform || '') : '',
                                account: fbItem ? (fbItem.account || '') : '',
                                views: fbItem ? (fbItem.views || '') : '',
                                likes: fbItem ? (fbItem.likes || '') : ''
                            };
                        });
                    }
                }
            }

            // 提取"额外提醒"段落
            var extraMatch = aiResponse.match(/#{2,3}\s*额外提醒[\s\S]*?\n([\s\S]*?)(?=\n#{2,3}|\n#|$)/);
            var extraReminder = extraMatch ? extraMatch[1].trim() : '';

            // 把排名表和额外提醒拼到 summary 前面
            var fullSummary = '';
            if (rankingTable) fullSummary += '### TOP5 排名\n' + rankingTable + '\n\n';
            if (extraReminder) fullSummary += '### 额外提醒\n' + extraReminder + '\n\n';
            if (summary) {
                fullSummary += '### 大盘总结\n' + summary;
            } else if (topics.length === 0) {
                // 完全没有结构化，把 AI 整篇原始输出放进去
                fullSummary = aiResponse.trim();
            } else {
                fullSummary += '### 大盘总结\n本次共分析 ' + originalItems.length + ' 篇文章，AI 给出了 ' + topics.length + ' 个推荐选题。';
            }

            return {
                dateStr: dateStrLabel,
                summary: fullSummary,
                topics: topics.slice(0, 5),
                isAIReport: true
            };
        }

        function runDailyAnalysis() {
            var now = new Date();
            if (now.getHours() === 2 && now.getMinutes() === 0) {
                console.log('[Daily] 02:00 触发每日选题分析');
                analyzeReportWithAI();
            }
        }

        setInterval(runDailyAnalysis, 60000);

        // ==========================================
        // API 配置管理
        // ==========================================
        function toggleApiEnabled() {
            var config = getCurrentPlatformConfig();
            if (config) {
                config.apiEnabled = document.getElementById('api-enabled').checked;
            }
        }

        function loadApiConfigToUI() {
            var config = getCurrentPlatformConfig();
            if (config) {
                document.getElementById('api-enabled').checked = config.apiEnabled !== false;
            }
        }

        function getCurrentPlatformConfig() {
            var catConfig = categoryConfigs[currentCategory];
            if (!catConfig || !catConfig.platforms) return null;
            return catConfig.platforms[currentPlatform] || null;
        }

        // ==========================================
        // 监控设置 - 平台 Tab 与动态增删逻辑
        // ==========================================
        function renderPlatformTabs() {
            var container = document.getElementById('platform-tabs');
            container.innerHTML = '';
            var config = categoryConfigs[currentCategory];
            var platforms = config.platforms || {};
            var platformNames = Object.keys(platforms);

            if (platformNames.length === 0) {
                currentPlatform = '';
                document.getElementById('platform-config-panel').classList.add('hidden');
                return;
            }

            document.getElementById('platform-config-panel').classList.remove('hidden');

            platformNames.forEach(function(p) {
                var btn = document.createElement('button');
                var isActive = p === currentPlatform;
                btn.className = isActive
                    ? 'platform-tab-btn px-4 py-2 rounded-xl text-sm font-bold transition-all bg-matcha text-white shadow-sm border border-matcha'
                    : 'platform-tab-btn px-4 py-2 rounded-xl text-sm font-medium transition-all bg-white text-gray-600 border border-border-soft hover:border-matcha hover:text-matcha';
                var nameSpan = document.createElement('span');
                nameSpan.className = 'platform-name';
                nameSpan.textContent = p;
                var delIcon = document.createElement('i');
                delIcon.setAttribute('data-lucide', 'x');
                delIcon.className = 'w-3.5 h-3.5 ml-1 opacity-60 hover:opacity-100 transition-opacity inline delete-platform-icon';
                btn.appendChild(nameSpan);
                btn.appendChild(delIcon);
                btn.onclick = function(e) {
                    if (e.target === delIcon || e.target.closest('.delete-platform-icon')) {
                        e.stopPropagation();
                        deletePlatform(p);
                    } else {
                        switchPlatformTab(p);
                    }
                };
                container.appendChild(btn);
            });

            if (!currentPlatform || !platforms[currentPlatform]) {
                currentPlatform = platformNames[0];
                // 重新渲染以更新选中态
                renderPlatformTabs();
                renderPlatformConfig();
            }

            lucide.createIcons();
        }

        function switchPlatformTab(platform) {
            currentPlatform = platform;
            renderPlatformTabs();
            renderPlatformConfig();
        }

        function deletePlatform(platform) {
            var config = categoryConfigs[currentCategory];
            if (!config || !config.platforms) return;
            var platformNames = Object.keys(config.platforms);
            if (platformNames.length <= 1) {
                showToast('至少保留一个监控平台', 'error');
                return;
            }
            if (!confirm('确定要删除平台「' + platform + '」吗？其配置将一并删除。')) return;
            console.log('[deletePlatform] 删除前:', Object.keys(config.platforms));
            delete config.platforms[platform];
            console.log('[deletePlatform] 删除后:', Object.keys(config.platforms), '删除的:', platform);
            if (currentPlatform === platform) {
                currentPlatform = '';
            }
            renderPlatformTabs();
            renderPlatformConfig();
            showToast('平台已删除：' + platform, 'success');
        }

        function addPlatform() {
            var input = document.getElementById('new-platform-input');
            var val = input.value.trim();
            if (!val) return;

            var config = categoryConfigs[currentCategory];
            if (!config.platforms) config.platforms = {};
            if (config.platforms[val]) {
                showToast('平台已存在：' + val, 'error');
                return;
            }

            config.platforms[val] = {
                keywords: [],
                accounts: [],
                maxArticles: 50,
                apiSortType: 1,
                apiMode: 1,
                apiPeriod: 7,
                apiEnabled: false,
                apiUrl: '',
                apiKey: ''
            };

            input.value = '';
            currentPlatform = val;
            renderPlatformTabs();
            renderPlatformConfig();
            showToast('已添加平台：' + val, 'success');
        }

        // ==========================================
        // 平台独立配置面板渲染
        // ==========================================
        function renderPlatformConfig() {
            var config = getCurrentPlatformConfig();
            var panel = document.getElementById('platform-config-panel');
            if (!config) {
                panel.classList.add('hidden');
                return;
            }
            panel.classList.remove('hidden');

            document.getElementById('api-enabled').checked = config.apiEnabled !== false;
            document.getElementById('api-url-input').value = config.apiUrl || '';
            document.getElementById('api-key-input').value = config.apiKey || '';
            document.getElementById('max-articles-input').value = config.maxArticles || 50;
            document.getElementById('api-sort-type').value = config.apiSortType || 1;
            document.getElementById('api-mode').value = config.apiMode || 1;
            document.getElementById('api-period').value = config.apiPeriod || 7;
            document.getElementById('display-sort-type').value = config.displaySort || 'time';

            var kwList = document.getElementById('keyword-list');
            kwList.innerHTML = '';
            (config.keywords || []).forEach(function(k) {
                var span = document.createElement('span');
                span.className = 'group inline-flex items-center gap-2 px-4 py-2 bg-white border border-border-soft rounded-xl text-sm font-bold text-gray-700 shadow-sm cursor-pointer hover:border-red-300 hover:text-red-500 transition-colors';
                span.onclick = function() { this.remove(); };
                span.innerHTML = k + ' <i data-lucide="x" class="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors"></i>';
                kwList.appendChild(span);
            });

            var accList = document.getElementById('account-list');
            accList.innerHTML = '';
            (config.accounts || []).forEach(function(a) {
                var div = document.createElement('div');
                div.className = 'account-item flex items-center justify-between p-4 bg-white border border-border-soft rounded-2xl shadow-sm';
                div.innerHTML = '<div class="flex items-center gap-4">' +
                    '<span class="text-base font-bold text-gray-800">' + a + '</span>' +
                '</div>' +
                '<button onclick="this.closest(\'.account-item\').remove()" class="text-gray-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-5 h-5"></i></button>';
                accList.appendChild(div);
            });

            lucide.createIcons();
        }

        function addKeyword() {
            var input = document.getElementById('new-keyword-input');
            var val = input.value.trim();
            if (!val) return;

            var list = document.getElementById('keyword-list');
            var exists = false;
            list.querySelectorAll('span').forEach(function(el) {
                if (el.childNodes[0].textContent.trim() === val) exists = true;
            });
            if (exists) {
                showToast('关键词已存在：' + val, 'error');
                return;
            }

            var span = document.createElement('span');
            span.className = 'group inline-flex items-center gap-2 px-4 py-2 bg-white border border-border-soft rounded-xl text-sm font-bold text-gray-700 shadow-sm cursor-pointer hover:border-red-300 hover:text-red-500 transition-colors';
            span.onclick = function() { this.remove(); };
            span.innerHTML = val + ' <i data-lucide="x" class="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors"></i>';

            list.appendChild(span);
            input.value = '';
            lucide.createIcons();
            showToast('已添加关键词：' + val, 'success');
        }

        function addAccount() {
            var input = document.getElementById('new-account-input');
            var val = input.value.trim();
            if (!val) return;

            var list = document.getElementById('account-list');
            var exists = false;
            list.querySelectorAll('.account-item').forEach(function(el) {
                if (el.querySelector('.text-base').textContent.trim() === val) exists = true;
            });
            if (exists) {
                showToast('账号已存在：' + val, 'error');
                return;
            }

            var div = document.createElement('div');
            div.className = 'account-item flex items-center justify-between p-4 bg-white border border-border-soft rounded-2xl shadow-sm';
            div.innerHTML = '<div class="flex items-center gap-4">' +
                '<span class="text-base font-bold text-gray-800">' + val + '</span>' +
            '</div>' +
            '<button onclick="this.closest(\'.account-item\').remove()" class="text-gray-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-5 h-5"></i></button>';

            list.appendChild(div);
            input.value = '';
            lucide.createIcons();
            showToast('已添加账号：' + val, 'success');
        }

        // ==========================================
        // 监控设置：根据分类配置动态渲染
        // ==========================================
        function renderSettings() {
            currentPlatform = '';
            renderPlatformTabs();
        }

        function saveSettings() {
            var config = getCurrentPlatformConfig();
            if (!config) {
                showToast('请先选择一个平台', 'error');
                return;
            }

            var keywords = [];
            document.getElementById('keyword-list').querySelectorAll('span').forEach(function(el) {
                keywords.push(el.childNodes[0].textContent.trim());
            });
            var accounts = [];
            document.getElementById('account-list').querySelectorAll('.account-item').forEach(function(el) {
                accounts.push(el.querySelector('.text-base').textContent.trim());
            });

            config.keywords = keywords;
            config.accounts = accounts;
            config.apiEnabled = document.getElementById('api-enabled').checked;
            config.apiUrl = document.getElementById('api-url-input').value.trim();
            config.apiKey = document.getElementById('api-key-input').value.trim();
            var maxVal = parseInt(document.getElementById('max-articles-input').value, 10);
            config.maxArticles = isNaN(maxVal) || maxVal < 1 ? 50 : maxVal;
            config.apiSortType = parseInt(document.getElementById('api-sort-type').value, 10) || 1;
            config.apiMode = parseInt(document.getElementById('api-mode').value, 10) || 1;
            config.displaySort = document.getElementById('display-sort-type').value || 'time';
            var periodVal = parseInt(document.getElementById('api-period').value, 10) || 7;
            if (config.apiMode !== 1 && periodVal > 30) {
                periodVal = 30;
                showToast('搜索正文时时间范围已自动调整为 30 天', 'info');
            }
            config.apiPeriod = periodVal;

            activeFilters = { platform: 'all', keyword: 'all', account: 'all' };
            renderFilters();
            renderContentList();
            showToast('配置保存成功！筛选器已同步更新', 'success');
        }

        // 手动触发所有平台的API数据获取（串行执行，从左到右逐个抓取）
        function fetchAllPlatformData() {
            var config = categoryConfigs[currentCategory];
            var platforms = config.platforms || {};
            var platformNames = Object.keys(platforms);
            if (platformNames.length === 0) {
                showToast('当前分类没有配置任何平台', 'error');
                return;
            }
            var enabledPlatforms = [];
            platformNames.forEach(function(p) {
                var platformConfig = platforms[p];
                if (platformConfig.apiEnabled && platformConfig.apiUrl && platformConfig.apiKey) {
                    enabledPlatforms.push(p);
                } else {
                    console.log('[FetchAll] 跳过平台「' + p + '」：API未启用或配置不完整');
                }
            });
            if (enabledPlatforms.length === 0) {
                showToast('没有启用了API配置的平台', 'error');
                return;
            }

            showToast('开始抓取 ' + enabledPlatforms.length + ' 个平台的数据...', 'info');

            var totalItems = [];
            var index = 0;

            function fetchNext() {
                if (index >= enabledPlatforms.length) {
                    showToast('所有平台抓取完成，共 ' + totalItems.length + ' 条新内容', 'success');
                    saveDataToStorage();
                    renderDateCards();
                    renderContentList();
                    generateReportFromData();
                    // 自动刷新选题分析时间线
                    if (typeof renderReportTimeline === 'function') {
                        renderReportTimeline();
                        renderReportGrid();
                    }
                    return;
                }
                var p = enabledPlatforms[index];
                index++;
                showToast('正在抓取「' + p + '」(' + index + '/' + enabledPlatforms.length + ')...', 'info');
                loadApiData(currentCategory, p, true).then(function(items) {
                    var cacheKey = currentCategory + '_' + p;
                    var cachedItems = apiCache[cacheKey] || [];
                    if (cachedItems.length > 0) {
                        totalItems = totalItems.concat(cachedItems);
                    }
                    fetchNext();
                }).catch(function(err) {
                    console.error('[FetchAll] 平台「' + p + '」抓取失败', err);
                    fetchNext();
                });
            }

            fetchNext();
        }

        // ==========================================
        // 数据持久化：保存和加载
        // ==========================================
        function saveDataToStorage() {
            try {
                var data = {
                    apiCache: apiCache,
                    contentData: contentData,
                    categoryConfigs: categoryConfigs,
                    reportData: reportData,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('contentMonitorData', JSON.stringify(data));
                console.log('[Storage] 数据已保存到本地');
            } catch (e) {
                console.error('[Storage] 保存失败', e);
            }
        }

        function loadDataFromStorage() {
            try {
                var stored = localStorage.getItem('contentMonitorData');
                if (stored) {
                    var data = JSON.parse(stored);
                    if (data.apiCache) {
                        // 兼容旧格式：把 category_platform_YYYY-MM-DD 转换为 category_platform
                        var migratedCache = {};
                        Object.keys(data.apiCache).forEach(function(key) {
                            var items = data.apiCache[key];
                            if (!Array.isArray(items)) return;
                            // 尝试提取 category_platform 前缀
                            var match = key.match(/^([^_]+_[^_]+)_\d{4}-\d{2}-\d{2}$/);
                            if (match) {
                                var newKey = match[1];
                                if (!migratedCache[newKey]) migratedCache[newKey] = [];
                                migratedCache[newKey] = migratedCache[newKey].concat(items);
                            } else {
                                migratedCache[key] = items;
                            }
                        });
                        apiCache = migratedCache;
                    }
                    if (data.contentData) {
                        contentData = data.contentData;
                    }
                    if (data.categoryConfigs) {
                        categoryConfigs = data.categoryConfigs;
                    }
                    if (data.reportData) {
                        reportData = data.reportData;
                    }
                    // deletedIds 功能已移除，忽略旧数据
                    console.log('[Storage] 数据已从本地加载');
                    return true;
                }
            } catch (e) {
                console.error('[Storage] 加载失败', e);
            }
            return false;
        }

        // 定期自动保存（每30秒）
        setInterval(saveDataToStorage, 30000);

        // ==========================================
        // 初始化入口
        // ==========================================
        document.addEventListener('DOMContentLoaded', function() {
            // 先尝试从本地加载数据
            loadDataFromStorage();
            loadTopicLibrary();
            // 加载 AI 提示词配置
            loadPromptConfig();

            initSQLite().then(function(ok) {
                if (ok) {
                    console.log('[Init] SQLite 就绪');
                } else {
                    console.log('[Init] SQLite 未启用，使用内存模式');
                }

                // 初始化界面
                renderDateCards();
                renderFilters();
                renderContentList();
                generateReportFromData();
            });
        });
    
