package task

import "errors"

func ValidateAttributes(status, priority string, estimate *int) error {
	switch status {
	case "", "todo", "in_progress", "in_review", "done", "cancelled":
	default:
		return errors.New("Invalid task status")
	}
	switch priority {
	case "", "low", "medium", "high", "urgent":
	default:
		return errors.New("Invalid task priority")
	}
	if estimate != nil && *estimate < 0 {
		return errors.New("Estimated minutes cannot be negative")
	}
	return nil
}
