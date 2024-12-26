const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();

// PostgreSQL 連線設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 設定檔案存儲位置
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// 使用 multer 處理檔案上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// 中間件設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 檔案上傳路由
app.post('/upload', upload.single('file'), async (req, res) => {
  const { seed_code, metadata } = req.body;
  const file = req.file;

  if (!seed_code || !file) {
    return res.status(400).json({ error: 'Seed code and file are required' });
  }

  try {
    // 檢查種子碼是否已存在
    const existing = await pool.query('SELECT * FROM files WHERE seed_code = $1', [seed_code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Seed code already exists' });
    }

    // 儲存檔案資訊到資料庫
    const result = await pool.query(
      'INSERT INTO files (seed_code, file_path, metadata) VALUES ($1, $2, $3) RETURNING *',
      [seed_code, file.path, metadata ? JSON.parse(metadata) : {}]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      seed_code: result.rows[0].seed_code,
      download_link: `http://localhost:5001/download/${result.rows[0].seed_code}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 檔案下載路由
app.get('/download/:seed_code', async (req, res) => {
  const { seed_code } = req.params;

  try {
    // 從資料庫檢索檔案路徑
    const result = await pool.query('SELECT file_path FROM files WHERE seed_code = $1', [seed_code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seed Code Not Found' });
    }

    const filePath = result.rows[0].file_path;

    // 檢查檔案是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File Not Found' });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 啟動伺服器
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
