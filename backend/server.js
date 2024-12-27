const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

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

const upload = multer({ storage, fileFilter: (req, file, cb) => {
  // req.body.upload_type === 'file' ? cb(null, true) : cb(null, false);
  if (req.body.upload_type === 'file') {
    cb(null, true);
  } else {
    cb(null, false);
  }

  // set file size limit
  if (file.size > 1024 * 1024) {
    cb(null, false);
  } else {
    cb(null, true);
  } 
}
});

// 中間件設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000', // 允許的來源
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允許的 HTTP 方法
  credentials: true // 如果需要發送 Cookie，設置為 true
}));

// async (req, res, next) => {
//   const { upload_type } = req.body;
//   for (const key in req.body) {
//     console.log(key, req.body[key]);
//   }
//   console.log('upload_type:', req.body.upload_type);
//   if (upload_type === 'file') {
//     return upload.single('file')(req, res, next);
//   }

//   next();
// }
// 檔案上傳路由
app.post('/upload', upload.single('file'), async (req, res) => {
  const { seed_code, metadata, upload_type, text_message } = req.body;
  for (const key in req.body) {
  }
  const file = req.file;
  if (upload_type === 'text' && !text_message) {
    return res.status(400).json({ error: 'Text message is required' });
  }else if(upload_type === 'file' && !file) {
    return res.status(400).json({ error: 'File is required and file size should be less than 1MB' });
  }else if (upload_type !== 'text' && upload_type !== 'file') {
    return res.status(400).json({ error: 'Invalid upload type' });
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
      [seed_code, upload_type=='text'?text_message:file.path, metadata ? JSON.parse(metadata) : {}]
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
app.get('/file-name/:seed_code', async (req, res) => {
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
      // return res.status(404).json({ error: 'File Not Found' });
      return res.status(200).json({ text: filePath });
    }

    // res.download(filePath);
    // return name of file
    res.status(200).json({ file: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
      // return res.status(200).json({ text: filePath });
    }

    res.download(filePath);
    // return name of file
    // res.status(200).json({ file: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get all seed code and its all information
app.get('/all-seed-code', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM files');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
);

// 啟動伺服器
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
