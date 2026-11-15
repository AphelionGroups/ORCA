package transfer

import (
	"encoding/json"
	"fmt"
	boardcontract "github.com/AphelionGroups/ORCA/internal/board"
	"math"
	"strings"
	"time"

	taskcontract "github.com/AphelionGroups/ORCA/internal/task"
)

func validateFields(table string, row Record) error {
	for key, value := range row {
		if value == nil {
			switch key {
			case "id", "name", "slug", "title", "status", "priority", "content", "board_id", "viewport_state", "kanban_columns", "auto_complete_subtasks", "completed_by_subtasks", "is_pinned", "is_archived", "is_all_day", "from_type", "from_id", "to_type", "to_id", "relation_type":
				return invalid("required field is null: " + key)
			}
			continue
		}
		switch key {
		case "auto_complete_subtasks", "completed_by_subtasks", "is_pinned", "is_archived", "is_all_day":
			if _, ok := value.(bool); !ok {
				return invalid("invalid boolean field: " + key)
			}
		case "sort_order", "estimated_minutes", "pos_x", "pos_y", "width", "height":
			number, ok := value.(float64)
			if !ok || math.IsNaN(number) || math.IsInf(number, 0) {
				return invalid("invalid numeric field: " + key)
			}
			if key == "estimated_minutes" && (number < 0 || number != math.Trunc(number) || number > 2147483647) {
				return invalid("invalid task estimate")
			}
			if key == "sort_order" && (number != math.Trunc(number) || number > 2147483647 || number < -2147483648) {
				return invalid("invalid space order")
			}
			if (key == "width" || key == "height") && number <= 0 {
				return invalid("invalid block size")
			}
		case "content":
			if table == "note_blocks" {
				switch value.(type) {
				case map[string]any, string:
				default:
					return invalid("block content must be an object or legacy text")
				}
			} else if _, ok := value.(string); !ok {
				return invalid("content must be text")
			}
		case "viewport_state", "metadata":
			if _, ok := value.(map[string]any); !ok {
				return invalid(key + " must be an object")
			}
		case "kanban_columns":
			items, ok := value.([]any)
			if !ok {
				return invalid("invalid Kanban columns")
			}
			for _, item := range items {
				if _, ok := item.(string); !ok {
					return invalid("invalid Kanban column")
				}
			}
		default:
			if _, ok := value.(string); !ok {
				return invalid("invalid text field: " + key)
			}
		}
	}
	for key, max := range map[string]int{"name": 255, "title": 255, "status": 50, "priority": 20, "slug": 100, "icon": 50, "color": 20, "doc_type": 50, "type": 50, "from_type": 50, "to_type": 50, "relation_type": 50} {
		if table == "spaces" && key == "name" {
			max = 100
		}
		if len([]rune(str(row, key))) > max {
			return invalid(fmt.Sprintf("%s exceeds %d characters", key, max))
		}
	}
	if table == "spaces" && strings.TrimSpace(str(row, "slug")) == "" {
		return invalid("space slug is missing")
	}
	if table == "inbox_notes" && row["content"] == nil {
		return invalid("inbox content is missing")
	}
	if table == "note_blocks" {
		if row["content"] != nil {
			raw, err := json.Marshal(row["content"])
			if err != nil {
				return invalid("invalid block content")
			}
			if err = boardcontract.ValidateContent(str(row, "type"), raw); err != nil {
				return invalid(err.Error())
			}
		}
		switch str(row, "type") {
		case "sticky", "text", "card", "image", "task_embed", "shape":
		default:
			return invalid("unsupported block type")
		}
	}
	if table == "tasks" {
		for _, key := range []string{"status", "priority"} {
			if value, exists := row[key]; exists && value == "" {
				return invalid("empty task " + key)
			}
		}
		if err := taskcontract.ValidateAttributes(str(row, "status"), str(row, "priority"), nil); err != nil {
			return invalid(err.Error())
		}
	}
	for _, key := range []string{"start_at", "end_at", "due_date", "target_date"} {
		if value := str(row, key); value != "" {
			if _, err := time.Parse(time.RFC3339Nano, value); err != nil {
				return invalid("invalid date: " + key)
			}
		}
	}
	if value := str(row, "planned_date"); value != "" {
		if _, err := time.Parse("2006-01-02", value); err != nil {
			return invalid("invalid planned date")
		}
	}
	if table == "events" {
		start, a := time.Parse(time.RFC3339Nano, str(row, "start_at"))
		end, b := time.Parse(time.RFC3339Nano, str(row, "end_at"))
		if a != nil || b != nil || !end.After(start) {
			return invalid("event end must be after its start")
		}
	}
	return nil
}
