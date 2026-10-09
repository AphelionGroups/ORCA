package task

import "testing"

func TestValidateAttributes(t *testing.T) {
	negative := -1
	for _, tc := range []struct {
		status, priority string
		estimate         *int
	}{
		{"hidden-status", "medium", nil}, {"todo", "critical", nil}, {"todo", "medium", &negative},
	} {
		if err := ValidateAttributes(tc.status, tc.priority, tc.estimate); err == nil {
			t.Fatalf("invalid task accepted: %+v", tc)
		}
	}
	for _, status := range []string{"", "todo", "in_progress", "in_review", "done", "cancelled"} {
		if err := ValidateAttributes(status, "medium", nil); err != nil {
			t.Fatal(err)
		}
	}
}
