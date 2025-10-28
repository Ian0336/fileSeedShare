// server.go
package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
)

const (
	maxFileSize    = 10 * 1024 * 1024 // 10 MB
	maxRequests    = 40
	rateWindow     = time.Minute
	uploadFolder   = "uploads"
	serverPort     = 30601
	allowedOrigin  = "http://localhost:80"
	downloadPrefix = "/api/download/"
)

var (
	db          *sql.DB
	rateLimiter = NewIPRateLimiter(maxRequests, rateWindow)
)

// IPRateLimiter enforces a simple per-IP rate limit.
type IPRateLimiter struct {
	requests map[string]*clientData
	mu       sync.Mutex
	maxCount int
	window   time.Duration
}

type clientData struct {
	count        int
	firstRequest time.Time
}

// NewIPRateLimiter creates a limiter allowing maxCount per window.
func NewIPRateLimiter(maxCount int, window time.Duration) *IPRateLimiter {
	rl := &IPRateLimiter{
		requests: make(map[string]*clientData),
		maxCount: maxCount,
		window:   window,
	}
	go rl.cleanupLoop()
	return rl
}

// cleanupLoop periodically removes stale entries.
func (rl *IPRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.window)
	for range ticker.C {
		now := time.Now()
		rl.mu.Lock()
		for ip, data := range rl.requests {
			if now.Sub(data.firstRequest) > rl.window {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks and updates the counter for this IP.
// Returns an error if limit exceeded.
func (rl *IPRateLimiter) Allow(ip string) error {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	d, ok := rl.requests[ip]
	if !ok || now.Sub(d.firstRequest) > rl.window {
		rl.requests[ip] = &clientData{count: 1, firstRequest: now}
		return nil
	}
	if d.count >= rl.maxCount {
		return errors.New("rate limit exceeded")
	}
	d.count++
	return nil
}

// getClientIP extracts the IP portion from r.RemoteAddr
func getClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func main() {
	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to DB: %v", err)
	}
	defer db.Close()

	// check if DB is connected
	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping DB: %v", err)
	}

	// check if table exists
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.files (
			seed_code   TEXT PRIMARY KEY,
			file_path   TEXT NOT NULL,
			metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
			expire_time TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 days')
		);
	`); err != nil {
		log.Fatalf("failed to create table: %v", err)
	}

	// delete expired records
	go deleteExpiredRecords()

	// ensure upload folder exists
	if err := os.MkdirAll(uploadFolder, 0755); err != nil {
		log.Fatalf("failed to create upload folder: %v", err)
	}

	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.Use(rateLimitMiddleware)

	api.HandleFunc("/upload", handleUpload).Methods("POST")
	api.HandleFunc("/file-name", handleFileName).Methods("POST")
	api.HandleFunc("/download/{seed_code}", handleDownload).Methods("GET")
	api.HandleFunc("/view-file/{seed_code}", handleViewFile).Methods("GET")

	// CORS
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{allowedOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
		AllowCredentials: true,
	}).Handler(r)

	addr := fmt.Sprintf(":%d", serverPort)
	log.Printf("Server running on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}

// rateLimitMiddleware applies the per-IP limiter to all /api routes.
func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		if err := rateLimiter.Allow(ip); err != nil {
			http.Error(w, "Too many requests. Please try again later.", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// a cron job to delete expired records
func deleteExpiredRecords() {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	cleanup := func() {
		rows, err := db.Query(`
            SELECT seed_code, file_path 
            FROM files 
            WHERE expire_time < NOW()
        `)
		if err != nil {
			log.Printf("query expired records: %v", err)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var seedCode, filePath string
			if err := rows.Scan(&seedCode, &filePath); err != nil {
				log.Printf("scan expired record: %v", err)
				continue
			}

			if _, err := os.Stat(filePath); err == nil {
				if err := os.Remove(filePath); err != nil {
					log.Printf("remove file %q failed: %v", filePath, err)
				}
			} else if !os.IsNotExist(err) {
				log.Printf("stat file %q error: %v", filePath, err)
			}

			if _, err := db.Exec(`DELETE FROM files WHERE seed_code = $1`, seedCode); err != nil {
				log.Printf("delete db record %q failed: %v", seedCode, err)
				continue
			}
			log.Printf("deleted expired record: %s", seedCode)
		}
		if err := rows.Err(); err != nil {
			log.Printf("rows iteration error: %v", err)
		}
	}

	cleanup()
	for {
		cleanup()
	}
}

// handleUpload handles POST /api/upload
// multipart form with fields: seed_code, metadata (JSON string), upload_type (text|file), text_message (if text), and file (if file)
func handleUpload(w http.ResponseWriter, r *http.Request) {
	// enforce max file size
	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize+512)
	if err := r.ParseMultipartForm(maxFileSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	seedCode := r.FormValue("seed_code")
	if seedCode == "" {
		http.Error(w, "seed_code is required", http.StatusBadRequest)
		return
	}
	uploadType := r.FormValue("upload_type")
	metadataStr := r.FormValue("metadata")

	var storedPath string
	switch uploadType {
	case "text":
		text := r.FormValue("text_message")
		if text == "" {
			http.Error(w, "Text message is required", http.StatusBadRequest)
			return
		}
		storedPath = text

	case "file":
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "File is required and must be under 10 MB", http.StatusBadRequest)
			return
		}
		defer file.Close()
		// build unique filename
		ts := time.Now().UnixNano() / int64(time.Millisecond)
		safeName := fmt.Sprintf("%d-%s", ts, header.Filename)
		destPath := filepath.Join(uploadFolder, safeName)

		dst, err := os.Create(destPath)
		if err != nil {
			http.Error(w, "Unable to save file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()
		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to write file", http.StatusInternalServerError)
			return
		}
		storedPath = destPath

	default:
		http.Error(w, "Invalid upload type", http.StatusBadRequest)
		return
	}

	// check seed_code uniqueness
	var exists bool
	err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM files WHERE seed_code=$1)`,
		seedCode,
	).Scan(&exists)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "Seed code already exists", http.StatusBadRequest)
		return
	}

	// prepare metadata JSON
	if metadataStr == "" {
		metadataStr = "{}"
	}
	// insert into DB
	_, err = db.Exec(
		`INSERT INTO files(seed_code, file_path, metadata, expire_time)
         VALUES($1, $2, $3, $4)`,
		seedCode, storedPath, metadataStr,
		time.Now().Add(time.Hour*24*1), // 1 days
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	downloadLink := fmt.Sprintf("http://localhost:%d/download/%s", serverPort, seedCode)
	resp := map[string]interface{}{
		"message":       "File uploaded successfully",
		"seed_code":     seedCode,
		"download_link": downloadLink,
	}
	writeJSON(w, http.StatusCreated, resp)
}

// handleFileName handles POST /api/file-name { seed_code }
// returns { file: filePath } or 404/400
func handleFileName(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SeedCode string `json:"seed_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SeedCode == "" {
		http.Error(w, "seed_code is required", http.StatusBadRequest)
		return
	}
	var filePath string
	err := db.QueryRow(
		`SELECT file_path FROM files WHERE seed_code=$1`,
		req.SeedCode,
	).Scan(&filePath)
	if err == sql.ErrNoRows {
		http.Error(w, "Seed Code Not Found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// if file doesn't exist on disk, echo the stored text
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		writeJSON(w, http.StatusOK, map[string]string{"text": filePath})
		return
	}
	// otherwise return the path
	writeJSON(w, http.StatusOK, map[string]string{"file": filePath})
}

// handleDownload serves the raw file at /api/download/{seed_code}
func handleDownload(w http.ResponseWriter, r *http.Request) {
	seed := mux.Vars(r)["seed_code"]
	var filePath string
	err := db.QueryRow(
		`SELECT file_path FROM files WHERE seed_code=$1`,
		seed,
	).Scan(&filePath)
	if err == sql.ErrNoRows {
		http.Error(w, "Seed Code Not Found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File Not Found", http.StatusNotFound)
		return
	}
	http.ServeFile(w, r, filePath)
}

// handleViewFile handles GET /api/view-file/{seed_code}
func handleViewFile(w http.ResponseWriter, r *http.Request) {
	seed := mux.Vars(r)["seed_code"]
	var filePath string
	if err := db.QueryRow(
		`SELECT file_path FROM files WHERE seed_code=$1`, seed,
	).Scan(&filePath); err == sql.ErrNoRows {
		http.Error(w, "Seed Code Not Found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// if path is actually text
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		writeJSON(w, http.StatusOK, map[string]string{"text": filePath})
		return
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	textExts := map[string]bool{
		".txt": true, ".md": true, ".js": true,
		".html": true, ".css": true, ".json": true, ".xml": true,
	}
	binaryExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".ico": true, ".gif": true, ".bmp": true,
		".pdf": true, ".mp4": true, ".webm": true, ".mov": true,
	}

	switch {
	case binaryExts[ext]:
		// let browser handle it
		http.ServeFile(w, r, filePath)

	case textExts[ext]:
		data, err := os.ReadFile(filePath)
		if err != nil {
			http.Error(w, "Unable to read file", http.StatusInternalServerError)
			return
		}
		// extract original filename
		_, fname := filepath.Split(filePath)
		// remove timestamp prefix
		parts := strings.SplitN(fname, "-", 2)
		realName := fname
		if len(parts) == 2 {
			realName = parts[1]
		}
		resp := map[string]string{
			"fileContent": string(data),
			"fileName":    realName,
			"fileType":    "text",
		}
		writeJSON(w, http.StatusOK, resp)

	default:
		// unknown type → metadata + download link
		_, fname := filepath.Split(filePath)
		parts := strings.SplitN(fname, "-", 2)
		realName := fname
		if len(parts) == 2 {
			realName = parts[1]
		}
		resp := map[string]string{
			"fileName":    realName,
			"fileType":    strings.TrimPrefix(ext, "."),
			"downloadUrl": downloadPrefix + seed,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// writeJSON is a helper to respond with JSON
func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
