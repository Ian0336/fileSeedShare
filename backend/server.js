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

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 限制文件大小為 10MB
  fileFilter: (req, file, cb) => {
    if (req.body.upload_type === 'file') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// 設定 rate limit
const rateLimit = new Map();
const MAX_REQUESTS = 40; // 最大请求次数
const TIME_WINDOW = 60 * 1000; // 时间窗口（1分钟）
// 添加限制请求的中间件
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, {
      count: 1,
      firstRequest: now
    });
    next();
    return;
  }

  const userLimit = rateLimit.get(ip);
  
  // 检查是否在时间窗口内
  if (now - userLimit.firstRequest > TIME_WINDOW) {
    // 重置计数器
    userLimit.count = 1;
    userLimit.firstRequest = now;
    next();
    return;
  }

  // 检查请求次数
  if (userLimit.count >= MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.' 
    });
  }

  userLimit.count++;
  next();
}

// 中間件設定
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: 'http://localhost:80', // 允許的來源
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允許的 HTTP 方法
  credentials: true // 如果需要發送 Cookie，設置為 true
}));
app.use('/api/', rateLimiter);

// 檔案上傳路由
app.post('/api/upload', upload.single('file'), async (req, res) => {
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
app.post('/api/file-name', rateLimiter, async (req, res) => {
  const { seed_code } = req.body;  
  if (!seed_code) {
    return res.status(400).json({ error: 'Seed code is required' });
  }

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

app.get('/api/download/:seed_code', async (req, res) => {
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
// Add a new endpoint to server.js to serve file content
app.get('/api/view-file/:seed_code', rateLimiter, async (req, res) => {
  const { seed_code } = req.params;

  try {
    // Retrieve file info from database
    const result = await pool.query('SELECT file_path FROM files WHERE seed_code = $1', [seed_code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seed Code Not Found' });
    }

    const filePath = result.rows[0].file_path;

    // Check if it's a text message (not a file path)
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ text: filePath });
    }

    // Get file extension to determine content type
    const fileExtension = path.extname(filePath).toLowerCase();
    // For images, PDFs, and binary files - send the file directly with proper content type
    if (['.jpg', '.jpeg', '.png', '.ico', '.gif', '.bmp', '.pdf', '.mp4', '.webm', '.mov'].includes(fileExtension)) {
      return res.sendFile(path.resolve(filePath));
    } 
    
    // For text files, read and send as JSON
    if (['.txt', '.md', '.js', '.html', '.css', '.json', '.xml'].includes(fileExtension)) {
      const textContent = fs.readFileSync(filePath, 'utf8');
      return res.status(200).json({ 
        fileContent: textContent,
        fileName: filePath.split('uploads/')[1].split('-').slice(1).join('-'),
        fileType: 'text'
      });
    }
    
    // For other file types, just return metadata and let client download
    return res.status(200).json({
      fileName: filePath.split('uploads/')[1].split('-').slice(1).join('-'),
      fileType: fileExtension.substring(1),
      downloadUrl: `/api/download/${seed_code}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get all seed code and its all information
// app.get('/api/all-seed-code', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM files');
//     res.status(200).json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }
// );

// 定期清理过期的 IP 记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.firstRequest > TIME_WINDOW) {
      rateLimit.delete(ip);
    }
  }
}, TIME_WINDOW);



// 啟動伺服器
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
