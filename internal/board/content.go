package board

import (
	"encoding/json"
	"fmt"
)

type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }
func invalid(message string) error       { return &ValidationError{Message: message} }

// Legacy string content remains readable; object payloads have an explicit version.
func ValidateContent(kind string, raw json.RawMessage) error {
	switch kind {
	case "sticky", "text", "card", "shape", "image", "task_embed":
	default:
		return invalid("Unsupported block type")
	}
	if len(raw) == 0 {
		return nil
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return invalid("Invalid block JSON")
	}
	if _, legacy := value.(string); legacy {
		return nil
	}
	object, ok := value.(map[string]any)
	if !ok {
		return invalid("Block content must be an object or legacy text")
	}
	if version, exists := object["schema_version"]; exists && version != float64(1) {
		return invalid("Unsupported block content version")
	}
	for _, field := range []string{"text", "url", "caption", "color", "shape_kind", "border_style", "fill_style", "task_id"} {
		if v, present := object[field]; present {
			if _, ok := v.(string); !ok {
				return invalid(fmt.Sprintf("%s must be text", field))
			}
		}
	}
	if v, present := object["locked"]; present {
		if _, ok := v.(bool); !ok {
			return invalid("locked must be boolean")
		}
	}
	return nil
}
