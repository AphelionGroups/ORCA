package httputil

import (
	"encoding/json"
	"testing"
)

func TestOptionalPreservesOmittedAndExplicitNull(t *testing.T) {
	for _, tc := range []struct {
		body  string
		set   bool
		value *string
	}{
		{`{}`, false, nil}, {`{"field":null}`, true, nil}, {`{"field":""}`, true, new(string)},
	} {
		var request struct {
			Field Optional[string] `json:"field"`
		}
		if err := json.Unmarshal([]byte(tc.body), &request); err != nil {
			t.Fatal(err)
		}
		if request.Field.Set != tc.set || (request.Field.Value == nil) != (tc.value == nil) {
			t.Fatalf("incorrect field presence for %s", tc.body)
		}
	}
}
