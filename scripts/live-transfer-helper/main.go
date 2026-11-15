// Live-test utility. It operates only on explicitly named temporary schemas and
// the local orca-live MinIO bucket. Credentials are read from the environment.
package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/AphelionGroups/ORCA/internal/transfer"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func output(value any) error { return json.NewEncoder(os.Stdout).Encode(value) }
func run() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("command required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	command := os.Args[1]
	if command == "noise-png" {
		picture := image.NewNRGBA(image.Rect(0, 0, 512, 512))
		if _, err := rand.Read(picture.Pix); err != nil {
			return err
		}
		for i := 3; i < len(picture.Pix); i += 4 {
			picture.Pix[i] = 255
		}
		f, err := os.Create(os.Args[2])
		if err != nil {
			return err
		}
		defer f.Close()
		return png.Encode(f, picture)
	}
	if command == "inspect" {
		data, err := os.ReadFile(os.Args[2])
		if err != nil {
			return err
		}
		p, err := transfer.Decode(data)
		if err != nil {
			return err
		}
		return output(p)
	}
	if command == "mutate" {
		return mutate(os.Args[2], os.Args[3], os.Args[4])
	}
	if strings.HasPrefix(command, "schema-") || strings.HasPrefix(command, "fault-") {
		schema := os.Args[2]
		if !regexp.MustCompile(`^orca_live_[a-z0-9_]+$`).MatchString(schema) {
			return fmt.Errorf("only temporary orca_live_* schemas are allowed")
		}
		conn, err := pgx.Connect(ctx, os.Getenv("ORCA_TEST_DATABASE_URL"))
		if err != nil {
			return err
		}
		defer conn.Close(ctx)
		quoted := pgx.Identifier{schema}.Sanitize()
		switch command {
		case "schema-create":
			_, err = conn.Exec(ctx, "CREATE SCHEMA "+quoted)
		case "schema-drop":
			_, err = conn.Exec(ctx, "DROP SCHEMA IF EXISTS "+quoted+" CASCADE")
		case "fault-on":
			_, err = conn.Exec(ctx, "SET search_path TO "+quoted+`,public; CREATE FUNCTION orca_live_fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Live test: intentional import failure'; END $$; CREATE TRIGGER orca_live_fail_import BEFORE INSERT ON documents FOR EACH ROW WHEN (NEW.title='Live brief') EXECUTE FUNCTION orca_live_fail_import()`)
		case "fault-off":
			_, err = conn.Exec(ctx, "SET search_path TO "+quoted+`,public; DROP TRIGGER IF EXISTS orca_live_fail_import ON documents; DROP FUNCTION IF EXISTS orca_live_fail_import()`)
		default:
			return fmt.Errorf("unknown database command")
		}
		return err
	}
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"), config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(os.Getenv("MINIO_ROOT_USER"), os.Getenv("MINIO_ROOT_PASSWORD"), "")))
	if err != nil {
		return err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String("http://127.0.0.1:9000"); o.UsePathStyle = true })
	bucket := "orca-live"
	switch command {
	case "bucket-init":
		if _, err = client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &bucket}); err != nil {
			if _, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &bucket}); err != nil {
				return err
			}
		}
		policy := `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::orca-live/*"]}]}`
		_, err = client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{Bucket: &bucket, Policy: &policy})
		return err
	case "objects":
		prefix := ""
		if len(os.Args) > 2 {
			prefix = os.Args[2]
		}
		pager := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{Bucket: &bucket, Prefix: &prefix})
		objects := []map[string]any{}
		for pager.HasMorePages() {
			page, err := pager.NextPage(ctx)
			if err != nil {
				return err
			}
			for _, item := range page.Contents {
				objects = append(objects, map[string]any{"key": aws.ToString(item.Key), "size": aws.ToInt64(item.Size)})
			}
		}
		return output(objects)
	case "delete-object":
		key := os.Args[2]
		parts := strings.Split(key, "/")
		if len(parts) != 3 || parts[1] != "images" {
			return fmt.Errorf("only a single test image can be removed")
		}
		if _, err = uuid.Parse(parts[0]); err != nil {
			return err
		}
		_, err = client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &bucket, Key: &key})
		return err
	default:
		return fmt.Errorf("unknown command: %s", command)
	}
}
func mutate(input, output, mode string) error {
	data, err := os.ReadFile(input)
	if err != nil {
		return err
	}
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	var out bytes.Buffer
	writer := zip.NewWriter(&out)
	skipAsset := mode == "missing-asset"
	for _, entry := range archive.File {
		if skipAsset && strings.HasPrefix(entry.Name, "assets/") {
			skipAsset = false
			continue
		}
		r, err := entry.Open()
		if err != nil {
			return err
		}
		body, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			return err
		}
		if entry.Name == "manifest.json" {
			var manifest map[string]any
			if err = json.Unmarshal(body, &manifest); err != nil {
				return err
			}
			switch mode {
			case "version":
				manifest["version"] = float64(99)
			case "hash":
				manifest["assets"].([]any)[0].(map[string]any)["sha256"] = strings.Repeat("0", 64)
			case "reference":
				manifest["entities"].(map[string]any)["tasks"].([]any)[0].(map[string]any)["parent_task_id"] = uuid.NewString()
			case "cycle":
				task := manifest["entities"].(map[string]any)["tasks"].([]any)[0].(map[string]any)
				task["parent_task_id"] = task["id"]
			case "legacy":
				legacy := manifest["entities"].(map[string]any)["note_blocks"].([]any)[0].(map[string]any)
				legacy["type"] = "text"
				legacy["content"] = "Legacy board text"
			}
			body, err = json.Marshal(manifest)
			if err != nil {
				return err
			}
		}
		w, err := writer.Create(entry.Name)
		if err != nil {
			return err
		}
		if _, err = w.Write(body); err != nil {
			return err
		}
	}
	if mode == "traversal" {
		w, err := writer.Create("../escape.txt")
		if err != nil {
			return err
		}
		w.Write([]byte("must be rejected"))
	}
	if mode == "expanded" {
		w, err := writer.Create("assets/oversized")
		if err != nil {
			return err
		}
		if _, err = w.Write(make([]byte, (10<<20)+1)); err != nil {
			return err
		}
	}
	if err = writer.Close(); err != nil {
		return err
	}
	return os.WriteFile(output, out.Bytes(), 0600)
}
