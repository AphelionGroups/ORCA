package httputil

import (
	"bytes"
	"encoding/json"
)

// Optional distinguishes omitted fields from an explicit JSON null in partial updates.
type Optional[T any] struct {
	Set   bool
	Value *T
}

func (field *Optional[T]) UnmarshalJSON(data []byte) error {
	field.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		field.Value = nil
		return nil
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	field.Value = &value
	return nil
}
