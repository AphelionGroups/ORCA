package migrations

import "embed"

//go:embed *.up.sql
var Files embed.FS

//go:embed 000001_init_schema.up.sql
var InitSchemaSQL string
