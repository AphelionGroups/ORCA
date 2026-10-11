package httputil

import "time"

func CheckVersion(expected *time.Time, current time.Time) error {
	if expected != nil && !expected.Equal(current) {
		return ErrConflict
	}
	return nil
}
