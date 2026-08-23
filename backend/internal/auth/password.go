package auth

import (
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const (
	// BcryptCost balances security and performance for high-concurrency API authentication
	BcryptCost = 12
)

// HashPassword hashes a raw plaintext password using bcrypt with salt
func HashPassword(password string) (string, error) {
	if len(password) < 4 {
		return "", errors.New("password must be at least 4 characters long")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword compares a plaintext password with a stored bcrypt hash
func CheckPassword(password, hash string) bool {
	if hash == "" || password == "" {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
