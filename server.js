// server.js - Đã chuyển đổi sang Gemini AI OCR
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
// Tăng giới hạn upload để nhận ảnh chất lượng cao
app.use(bodyParser.json({ limit: '50mb' }));

// Cấu hình Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Đảm bảo bạn có file này trong thư mục public (nếu có) hoặc cùng cấp
    // Lưu ý: Dựa trên file bạn gửi, index.html đang nằm cùng cấp server.js,
    // nếu bạn để index.html ở root thì dùng: res.sendFile(path.join(__dirname, 'index.html'));
});

// Hàm mapping mã ngôn ngữ sang tên đầy đủ để nhắc AI
const getLanguageName = (code) => {
    const map = {
        'chs': 'Tiếng Trung (Giản thể)',
        'cht': 'Tiếng Trung (Phồn thể)',
        'vie': 'Tiếng Việt',
        'eng': 'Tiếng Anh',
        'kor': 'Tiếng Hàn',
        'jpn': 'Tiếng Nhật'
    };
    return map[code] || 'ngôn ngữ trong ảnh';
};

app.post('/scan', async (req, res) => {
    try {
        const { imageBase64, language } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Không có dữ liệu ảnh' });
        }

        // 1. Xử lý Base64: Loại bỏ prefix "data:image/png;base64," nếu có
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        // 2. Tạo Prompt (Câu lệnh cho AI)
        const langName = getLanguageName(language);
        const prompt = `
        Bạn là một chuyên gia OCR (Nhận diện ký tự quang học).
        Nhiệm vụ: Trích xuất toàn bộ văn bản từ hình ảnh này.
        
        Yêu cầu quan trọng:
        1. Ngôn ngữ ưu tiên nhận diện: ${langName}.
        2. Giữ nguyên định dạng gốc (xuống dòng, phân đoạn) giống hệt trong ảnh.
        3. Nếu là Tiếng Trung, hãy giữ nguyên chữ Hán (không phiên âm Pinyin).
        4. Tự động sửa các lỗi chính tả nhỏ nếu ngữ cảnh rõ ràng.
        5. Chỉ trả về kết quả văn bản thuần túy, không thêm lời chào hay giải thích.
        `;

        console.log(`📡 Đang gửi yêu cầu tới Gemini (${langName})...`);

        // 3. Gọi API Gemini
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png", // Gemini chấp nhận image/png hoặc image/jpeg chung cho base64
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        console.log("✅ Đã nhận kết quả từ AI.");
        
        // Trả kết quả về cho Frontend
        res.json({ text: text });

    } catch (error) {
        console.error("❌ Lỗi Server:", error);
        res.json({ text: "Lỗi xử lý AI: " + (error.message || "Không xác định") });
    }
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "OK", server: "Ready" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Server AI chạy tại http://localhost:${PORT}`));

