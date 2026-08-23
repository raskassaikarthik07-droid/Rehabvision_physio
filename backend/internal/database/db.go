package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

// DB wraps sql.DB with app-level helpers
type DB struct {
	*sql.DB
}

// Connect opens a PostgreSQL connection with pool settings
func Connect(databaseURL string, maxOpen, maxIdle int) (*DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("db.Ping: %w", err)
	}

	log.Println("Database connected")
	return &DB{db}, nil
}

// Health checks database connectivity
func (db *DB) Health() error {
	return db.Ping()
}
