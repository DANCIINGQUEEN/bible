require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const app = express();

// Vercel과 같은 리버스 프록시 환경에서 클라이언트 IP를 올바로 가져오기 위한 설정
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

let db;
let hymnDb;

async function connectDB() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('bible_db');
    console.log('Bible DB 연결 성공');

    const hymnClient = new MongoClient(process.env.MONGODB_URI_HYMN);
    await hymnClient.connect();
    hymnDb = hymnClient.db('Hymn');
    console.log('Hymn DB 연결 성공');
}

// ===== 보안 미들웨어 =====

// 1. Helmet: HTTP 보안 헤더 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "data:"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://firebasestorage.googleapis.com", "https://hymn-705c2.firebasestorage.app"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false,
}));

// 2. CORS: 허용 출처 제한
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : true, // 개발 시 모두 허용, 배포 시 .env에 도메인 설정
    methods: ['GET'],
    optionsSuccessStatus: 200,
}));

// 3. 요청 크기 제한 (body parser 공격 방지)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 4. Rate Limiting: IP당 요청 수 제한
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1분
    max: 100,                // IP당 최대 100회
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

// 5. Slow Down: 과도한 요청 시 점진적 응답 지연
const speedLimiter = slowDown({
    windowMs: 1 * 60 * 1000, // 1분
    delayAfter: 80,          // 80회 이후부터
    delayMs: (hits) => (hits - 80) * 100, // 초과 1회당 100ms 추가 지연
    maxDelayMs: 5000,        // 최대 5초 지연
});

// API 경로에만 rate limit 및 slow down 적용
app.use('/api', apiLimiter);
app.use('/api', speedLimiter);

// 6. 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// ===== 파라미터 검증 헬퍼 =====
function validateInt(val, min, max) {
    const num = parseInt(val);
    if (isNaN(num) || num < min || num > max) return null;
    return num;
}

// ===== API =====

// 성경 책 목록
app.get('/api/books', async (req, res) => {
    try {
        const books = await db.collection('verses').aggregate([
            {
                $group: {
                    _id: { bookIndex: '$bookIndex', bookName: '$bookName', testament: '$testament' }
                }
            },
            { $sort: { '_id.bookIndex': 1 } },
            {
                $project: {
                    _id: 0,
                    bookIndex: '$_id.bookIndex',
                    bookName: '$_id.bookName',
                    testament: '$_id.testament'
                }
            }
        ]).toArray();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 특정 책의 장 목록
app.get('/api/books/:bookIndex/chapters', async (req, res) => {
    try {
        const bookIndex = validateInt(req.params.bookIndex, 1, 66);
        if (!bookIndex) return res.status(400).json({ error: '잘못된 요청입니다.' });

        const chapters = await db.collection('verses').aggregate([
            { $match: { bookIndex } },
            { $group: { _id: '$chapter' } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, chapter: '$_id' } }
        ]).toArray();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.json(chapters);
    } catch (err) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 특정 장의 구절 전체
app.get('/api/books/:bookIndex/chapters/:chapter', async (req, res) => {
    try {
        const bookIndex = validateInt(req.params.bookIndex, 1, 66);
        const chapter = validateInt(req.params.chapter, 1, 150);
        if (!bookIndex || !chapter) return res.status(400).json({ error: '잘못된 요청입니다.' });

        const verses = await db.collection('verses')
            .find({ bookIndex, chapter })
            .sort({ verse: 1 })
            .toArray();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.json(verses);
    } catch (err) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// ===== 찬송가 API =====

// 찬송가 목록 (장 번호만)
app.get('/api/hymns', async (req, res) => {
    try {
        const hymns = await hymnDb.collection('hymns')
            .find({}, { projection: { _id: 0, chapter: 1 } })
            .sort({ chapter: 1 })
            .toArray();
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.json(hymns);
    } catch (err) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 특정 찬송가 조회
app.get('/api/hymns/:chapter', async (req, res) => {
    try {
        const chapter = validateInt(req.params.chapter, 1, 645);
        if (!chapter) return res.status(400).json({ error: '잘못된 요청입니다.' });

        const hymn = await hymnDb.collection('hymns').findOne(
            { chapter },
            { projection: { _id: 0 } }
        );
        if (!hymn) return res.status(404).json({ error: '찬송가를 찾을 수 없습니다.' });
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.json(hymn);
    } catch (err) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 존재하지 않는 경로 차단
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: '존재하지 않는 API입니다.' });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`서버 실행 중: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('서버 시작 실패:', err);
    process.exit(1);
});
