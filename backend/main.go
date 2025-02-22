package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Room struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func main() {
	// Initialize SQLite database
	db, err := sql.Open("sqlite3", "./colourstream.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Create rooms table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS rooms (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal(err)
	}

	// Create users table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			password TEXT NOT NULL
		)
	`)
	if err != nil {
		log.Fatal(err)
	}

	// Create admin user if it doesn't exist
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM users WHERE username = 'admin'").Scan(&count)
	if err != nil {
		log.Fatal(err)
	}
	if count == 0 {
		_, err = db.Exec(`
			INSERT INTO users (username, password) VALUES ('admin', 'password')
		`)
		if err != nil {
			log.Fatal(err)
		}
	}

	// API endpoints
	http.HandleFunc("/admin/auth", adminAuthHandler)
	http.HandleFunc("/rooms/create", roomCreateHandler)
	http.HandleFunc("/rooms/delete", roomDeleteHandler)
	http.HandleFunc("/rooms/list", roomListHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Println("Server listening on port " + port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func adminAuthHandler(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var storedPassword string
	err = db.QueryRow("SELECT password FROM users WHERE username = ?", creds.Username).Scan(&storedPassword)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if creds.Password != storedPassword {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Authentication successful"})
}

func roomCreateHandler(w http.ResponseWriter, r *http.Request) {
	rand.Seed(time.Now().UnixNano())
	roomName := fmt.Sprintf("room-%d", rand.Intn(1000))

	_, err := db.Exec("INSERT INTO rooms (name) VALUES (?)", roomName)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Room created successfully", "roomName": roomName})
}

func roomDeleteHandler(w http.ResponseWriter, r *http.Request) {
	roomIDStr := r.URL.Query().Get("id")
	if roomIDStr == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Room ID is required"})
		return
	}

	roomID, err := strconv.Atoi(roomIDStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid room ID"})
		return
	}

	_, err = db.Exec("DELETE FROM rooms WHERE id = ?", roomID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Room deleted successfully"})
}

func roomListHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name FROM rooms")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var room Room
		err := rows.Scan(&room.ID, &room.Name)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		rooms = append(rooms, room)
	}

	json.NewEncoder(w).Encode(rooms)
}
