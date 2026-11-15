package task

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// Delegation belongs to this task only. Children do not inherit its recipient,
// follow-up date or notes. Completed tasks retain the information for context.
func NormalizeDelegation(t *Task) error {
	if t.DelegatedTo != nil {
		name := strings.TrimSpace(*t.DelegatedTo)
		if name == "" {
			t.DelegatedTo = nil
		} else {
			if utf8.RuneCountInString(name) > 255 {
				return errors.New("Penanggung jawab maksimum 255 karakter")
			}
			t.DelegatedTo = &name
		}
	}
	if t.DelegationNote != nil {
		note := strings.TrimSpace(*t.DelegationNote)
		if note == "" {
			t.DelegationNote = nil
		} else {
			if utf8.RuneCountInString(note) > 4000 {
				return errors.New("Catatan delegasi maksimum 4000 karakter")
			}
			t.DelegationNote = &note
		}
	}
	if t.DelegatedTo == nil && (t.FollowUpDate != nil || t.DelegationNote != nil) {
		return errors.New("Isi penanggung jawab sebelum menambahkan follow-up atau catatan delegasi")
	}
	return nil
}
