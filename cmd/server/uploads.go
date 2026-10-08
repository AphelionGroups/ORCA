package main

import (
	"net/http"
	"os"
)

type assetFiles struct{ http.FileSystem }

func (fs assetFiles) Open(name string) (http.File, error) {
	file, err := fs.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, err
	}
	if info.IsDir() {
		file.Close()
		return nil, os.ErrNotExist
	}
	return file, nil
}

// Public object URLs must not expose directory indexes or executable content.
func uploadedAssetsHandler(dir string) http.Handler {
	files := http.StripPrefix("/uploads", http.FileServer(assetFiles{http.Dir(dir)}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
		files.ServeHTTP(w, r)
	})
}
