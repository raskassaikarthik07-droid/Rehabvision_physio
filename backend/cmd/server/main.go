package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"rehabvision/internal/app"
	"rehabvision/internal/config"
	"rehabvision/internal/database"
)

func main() {
	// Load .env if present (for local development)
	if err := godotenv.Load(".env"); err != nil {
		if !os.IsNotExist(err) {
			log.Printf("[warn] .env load: %v", err)
		}
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[fatal] config: %v", err)
	}

	// Database
	db, err := database.Connect(cfg.DatabaseURL, cfg.DBMaxOpenConns, cfg.DBMaxIdleConns)
	if err != nil {
		log.Fatalf("[fatal] database: %v", err)
	}
	defer db.Close()

	// Migrations (Idempotent)
	if err := database.RunMigrations(db); err != nil {
		log.Fatalf("[fatal] migrations: %v", err)
	}

	// Router
	router, err := app.BuildRouter(cfg, db)
	if err != nil {
		log.Fatalf("[fatal] router: %v", err)
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("[info] RehabVision backend starting on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[fatal] server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[info] shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[error] shutdown: %v", err)
	}
	log.Println("[info] shutdown complete")
}
