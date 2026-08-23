package handler

import (
	"log"
	"net/http"
	"sync"

	"rehabvision/internal/app"
	"rehabvision/internal/config"
	"rehabvision/internal/database"
)

var (
	handlerInstance http.Handler
	initOnce        sync.Once
	initErr         error
)

func initApp() {
	cfg, err := config.Load()
	if err != nil {
		initErr = err
		log.Printf("[error] serverless config load: %v", err)
		return
	}

	var db *database.DB
	if cfg.DatabaseURL != "" {
		// Serverless pool settings (5 max open, 2 idle)
		connectedDB, dbErr := database.Connect(cfg.DatabaseURL, 5, 2)
		if dbErr != nil {
			log.Printf("[warn] serverless db connect: %v", dbErr)
		} else {
			db = connectedDB
			_ = database.RunMigrations(db)
		}
	}

	r, err := app.BuildRouter(cfg, db)
	if err != nil {
		initErr = err
		log.Printf("[error] serverless router build: %v", err)
		return
	}

	handlerInstance = r
}

// Handler is the Vercel serverless Go function entrypoint.
func Handler(w http.ResponseWriter, r *http.Request) {
	initOnce.Do(initApp)
	if initErr != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"status":"error","error":"Serverless initialization error"}`))
		return
	}
	if handlerInstance != nil {
		handlerInstance.ServeHTTP(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok","service":"rehabvision-serverless"}`))
}
